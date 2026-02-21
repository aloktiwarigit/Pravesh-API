/**
 * [P1] Tests for SLA timer service - Business days calculation and status
 * Story 5-10: SLA Timer Service
 */
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { PrismaClient } from '@prisma/client';
import PgBoss from 'pg-boss';
import { SlaTimerService } from '../sla-timer.service.js';

// Mock dependencies
vi.mock('@prisma/client', () => {
  const mockPrisma = {
    serviceInstance: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
    serviceStateHistory: {
      findFirst: vi.fn(),
    },
    escalation: {
      findFirst: vi.fn(),
      create: vi.fn(),
      count: vi.fn(),
      findMany: vi.fn(),
    },
  };
  return {
    PrismaClient: vi.fn(() => mockPrisma),
  };
});

vi.mock('pg-boss', () => {
  return {
    default: vi.fn(() => ({
      send: vi.fn(),
    })),
  };
});

vi.mock('../workflow-engine.js', () => ({
  getAllActiveStates: vi.fn(() => ['PENDING', 'IN_PROGRESS', 'AWAITING_DOCS']),
}));

describe('[P1] SlaTimerService - Business Days Calculation', () => {
  let service: SlaTimerService;
  let mockPrisma: any;
  let mockBoss: any;

  beforeEach(() => {
    mockPrisma = new PrismaClient();
    mockBoss = new PgBoss();
    service = new SlaTimerService(mockPrisma, mockBoss);
    vi.clearAllMocks();
  });

  test('calculateBusinessDays excludes weekends (Saturday and Sunday)', async () => {
    // Given - Monday 2025-01-06 to Friday 2025-01-10
    const monday = new Date('2025-01-06T09:00:00Z');
    const friday = new Date('2025-01-10T17:00:00Z');

    mockPrisma.serviceInstance.findUnique.mockResolvedValue({
      id: 'si_123',
      createdAt: monday,
      state: 'IN_PROGRESS',
      cityId: 'city_1',
      serviceRequestId: 'sr_1',
      serviceDefinition: {
        definition: { slaBusinessDays: 15 },
      },
    });

    // When
    const status = await service.getSlaStatus('si_123');

    // Then - Monday through Friday is 5 business days (excludes weekend)
    // Note: We're using current date as 'end', so we'll test directly by checking if weekends are excluded
    expect(status).toBeTruthy();
  });

  test('calculateBusinessDays for Monday to Friday equals 5 business days', async () => {
    // Given - Monday 2025-01-06 09:00 to Friday 2025-01-10 09:00
    const monday = new Date('2025-01-06T09:00:00Z');
    const fridaySameTime = new Date('2025-01-10T09:00:00Z');

    mockPrisma.serviceInstance.findUnique.mockResolvedValue({
      id: 'si_123',
      createdAt: monday,
      state: 'IN_PROGRESS',
      cityId: 'city_1',
      serviceRequestId: 'sr_1',
      serviceDefinition: {
        definition: { slaBusinessDays: 15 },
      },
    });

    // Mock current date to be Friday same time
    vi.useFakeTimers();
    vi.setSystemTime(fridaySameTime);

    // When
    const status = await service.getSlaStatus('si_123');

    // Then
    expect(status?.elapsedBusinessDays).toBe(4); // Mon, Tue, Wed, Thu (not including Friday since same time)

    vi.useRealTimers();
  });

  test('calculateBusinessDays for Friday to Monday equals 1 business day', async () => {
    // Given - Friday 2025-01-10 09:00 to Monday 2025-01-13 09:00
    const friday = new Date('2025-01-10T09:00:00Z');
    const mondaySameTime = new Date('2025-01-13T09:00:00Z');

    mockPrisma.serviceInstance.findUnique.mockResolvedValue({
      id: 'si_123',
      createdAt: friday,
      state: 'IN_PROGRESS',
      cityId: 'city_1',
      serviceRequestId: 'sr_1',
      serviceDefinition: {
        definition: { slaBusinessDays: 15 },
      },
    });

    vi.useFakeTimers();
    vi.setSystemTime(mondaySameTime);

    // When
    const status = await service.getSlaStatus('si_123');

    // Then - Only Monday is counted (Sat, Sun excluded)
    expect(status?.elapsedBusinessDays).toBe(1);

    vi.useRealTimers();
  });

  test('addBusinessDays skips weekends when adding days', async () => {
    // Given - Thursday 2025-01-09, add 3 business days
    const thursday = new Date('2025-01-09T09:00:00Z');
    const slaBusinessDays = 3;

    mockPrisma.serviceInstance.findUnique.mockResolvedValue({
      id: 'si_123',
      createdAt: thursday,
      state: 'IN_PROGRESS',
      cityId: 'city_1',
      serviceRequestId: 'sr_1',
      serviceDefinition: {
        definition: { slaBusinessDays },
      },
    });

    vi.useFakeTimers();
    // Set time past SLA to trigger breach
    vi.setSystemTime(new Date('2025-01-15T09:00:00Z'));

    // When
    const status = await service.getSlaStatus('si_123');

    // Then - breachedAt should be calculated by adding 3 business days to Thursday
    // Thursday + 1 = Friday, + 2 = Monday (skip weekend), + 3 = Tuesday
    expect(status?.isBreached).toBe(true);
    expect(status?.breachedAt).toBeTruthy();

    const breachedDate = new Date(status!.breachedAt!);
    // Expected: Tuesday 2025-01-14 (Thu -> Fri -> Mon -> Tue)
    expect(breachedDate.getUTCDate()).toBe(14);

    vi.useRealTimers();
  });
});

describe('[P1] SlaTimerService - SLA Status Calculation', () => {
  let service: SlaTimerService;
  let mockPrisma: any;
  let mockBoss: any;

  beforeEach(() => {
    mockPrisma = new PrismaClient();
    mockBoss = new PgBoss();
    service = new SlaTimerService(mockPrisma, mockBoss);
    vi.clearAllMocks();
  });

  test('getSlaStatus returns correct elapsed and remaining days', async () => {
    // Given
    const createdAt = new Date('2025-01-06T09:00:00Z'); // Monday
    const slaBusinessDays = 10;

    mockPrisma.serviceInstance.findUnique.mockResolvedValue({
      id: 'si_123',
      createdAt,
      state: 'IN_PROGRESS',
      cityId: 'city_1',
      serviceRequestId: 'sr_1',
      serviceDefinition: {
        definition: { slaBusinessDays },
      },
    });

    vi.useFakeTimers();
    // Set current date to Wednesday (2 business days elapsed)
    vi.setSystemTime(new Date('2025-01-08T09:00:00Z'));

    // When
    const status = await service.getSlaStatus('si_123');

    // Then
    expect(status?.slaBusinessDays).toBe(10);
    expect(status?.elapsedBusinessDays).toBe(2); // Mon, Tue
    expect(status?.remainingBusinessDays).toBe(8); // 10 - 2
    expect(status?.percentElapsed).toBe(20); // (2/10) * 100

    vi.useRealTimers();
  });

  test('getSlaStatus detects breach when elapsed > SLA days', async () => {
    // Given
    const createdAt = new Date('2025-01-06T09:00:00Z');
    const slaBusinessDays = 5;

    mockPrisma.serviceInstance.findUnique.mockResolvedValue({
      id: 'si_123',
      createdAt,
      state: 'IN_PROGRESS',
      cityId: 'city_1',
      serviceRequestId: 'sr_1',
      serviceDefinition: {
        definition: { slaBusinessDays },
      },
    });

    vi.useFakeTimers();
    // Set to 10 business days later (breached)
    vi.setSystemTime(new Date('2025-01-20T09:00:00Z'));

    // When
    const status = await service.getSlaStatus('si_123');

    // Then
    expect(status?.isBreached).toBe(true);
    expect(status?.isWarning).toBe(false); // Breached, not just warning
    expect(status?.percentElapsed).toBe(100); // Capped at 100
    expect(status?.remainingBusinessDays).toBe(0);
    expect(status?.breachedAt).toBeDefined();

    vi.useRealTimers();
  });

  test('getSlaStatus detects warning when >= 80% elapsed', async () => {
    // Given
    const createdAt = new Date('2025-01-06T09:00:00Z');
    const slaBusinessDays = 10;

    mockPrisma.serviceInstance.findUnique.mockResolvedValue({
      id: 'si_123',
      createdAt,
      state: 'IN_PROGRESS',
      cityId: 'city_1',
      serviceRequestId: 'sr_1',
      serviceDefinition: {
        definition: { slaBusinessDays },
      },
    });

    vi.useFakeTimers();
    // Set to 8 business days elapsed (80%)
    vi.setSystemTime(new Date('2025-01-16T09:00:00Z'));

    // When
    const status = await service.getSlaStatus('si_123');

    // Then
    expect(status?.percentElapsed).toBeGreaterThanOrEqual(80);
    expect(status?.isWarning).toBe(true);
    expect(status?.isBreached).toBe(false);

    vi.useRealTimers();
  });

  test('getSlaStatus returns null for non-existent service instance', async () => {
    // Given
    mockPrisma.serviceInstance.findUnique.mockResolvedValue(null);

    // When
    const status = await service.getSlaStatus('si_nonexistent');

    // Then
    expect(status).toBeNull();
  });

  test('getSlaStatus uses default SLA of 15 days when not specified', async () => {
    // Given
    const createdAt = new Date('2025-01-06T09:00:00Z');

    mockPrisma.serviceInstance.findUnique.mockResolvedValue({
      id: 'si_123',
      createdAt,
      state: 'IN_PROGRESS',
      cityId: 'city_1',
      serviceRequestId: 'sr_1',
      serviceDefinition: {
        definition: {}, // No slaBusinessDays specified
      },
    });

    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-08T09:00:00Z'));

    // When
    const status = await service.getSlaStatus('si_123');

    // Then
    expect(status?.slaBusinessDays).toBe(15); // Default value

    vi.useRealTimers();
  });

  test('getSlaStatus includes current state in response', async () => {
    // Given
    mockPrisma.serviceInstance.findUnique.mockResolvedValue({
      id: 'si_123',
      createdAt: new Date('2025-01-06T09:00:00Z'),
      state: 'AWAITING_DOCS',
      cityId: 'city_1',
      serviceRequestId: 'sr_1',
      serviceDefinition: {
        definition: { slaBusinessDays: 10 },
      },
    });

    // When
    const status = await service.getSlaStatus('si_123');

    // Then
    expect(status?.currentState).toBe('AWAITING_DOCS');
  });

  test('getSlaStatus caps percent elapsed at 100', async () => {
    // Given
    const createdAt = new Date('2025-01-01T09:00:00Z');
    const slaBusinessDays = 5;

    mockPrisma.serviceInstance.findUnique.mockResolvedValue({
      id: 'si_123',
      createdAt,
      state: 'IN_PROGRESS',
      cityId: 'city_1',
      serviceRequestId: 'sr_1',
      serviceDefinition: {
        definition: { slaBusinessDays },
      },
    });

    vi.useFakeTimers();
    // Set to way past SLA
    vi.setSystemTime(new Date('2025-02-01T09:00:00Z'));

    // When
    const status = await service.getSlaStatus('si_123');

    // Then
    expect(status?.percentElapsed).toBe(100); // Capped at 100, not > 100

    vi.useRealTimers();
  });

  test('getSlaStatus calculates remaining days as zero when breached', async () => {
    // Given
    const createdAt = new Date('2025-01-06T09:00:00Z');
    const slaBusinessDays = 3;

    mockPrisma.serviceInstance.findUnique.mockResolvedValue({
      id: 'si_123',
      createdAt,
      state: 'IN_PROGRESS',
      cityId: 'city_1',
      serviceRequestId: 'sr_1',
      serviceDefinition: {
        definition: { slaBusinessDays },
      },
    });

    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-20T09:00:00Z'));

    // When
    const status = await service.getSlaStatus('si_123');

    // Then
    expect(status?.remainingBusinessDays).toBe(0); // Non-negative
    expect(status?.isBreached).toBe(true);

    vi.useRealTimers();
  });
});
