/**
 * Tests for DisputeService
 * Story 3-17: Dispute flagging, management, and resolution
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DisputeService, CreateDisputePayload, ResolveDisputePayload } from '../dispute.service';
import { PrismaClient } from '@prisma/client';

// ---------------------------------------------------------------------------
// Mock factories
// ---------------------------------------------------------------------------
function createMockPrisma() {
  return {
    dispute: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    disputeComment: {
      create: vi.fn(),
    },
  } as unknown as PrismaClient;
}

function createMockBoss() {
  return {
    send: vi.fn().mockResolvedValue(undefined),
  };
}

describe('DisputeService', () => {
  let mockPrisma: ReturnType<typeof createMockPrisma>;
  let mockBoss: ReturnType<typeof createMockBoss>;
  let service: DisputeService;

  const validCreatePayload: CreateDisputePayload = {
    taskId: 'task-001',
    serviceRequestId: 'sr-001',
    agentId: 'agent-001',
    cityId: 'city-001',
    category: 'document_discrepancy',
    severity: 'medium',
    title: 'Missing Sale Deed',
    description: 'Customer cannot locate the original sale deed for the property.',
    gpsLat: 26.8467,
    gpsLng: 80.9462,
  };

  beforeEach(() => {
    mockPrisma = createMockPrisma();
    mockBoss = createMockBoss();
    service = new DisputeService(mockPrisma, mockBoss);
    vi.clearAllMocks();
  });

  // ===========================================================================
  // createDispute
  // ===========================================================================

  describe('createDispute', () => {
    it('creates a dispute with status open for non-critical severity', async () => {
      const createdDispute = {
        id: 'dispute-001',
        ...validCreatePayload,
        status: 'open',
      };
      (mockPrisma.dispute.create as any).mockResolvedValue(createdDispute);

      const result = await service.createDispute(validCreatePayload);

      expect(result.id).toBe('dispute-001');
      expect(mockPrisma.dispute.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'open',
            category: 'document_discrepancy',
            severity: 'medium',
          }),
        }),
      );
      // Non-critical dispute sends 'dispute_flagged' notification
      expect(mockBoss.send).toHaveBeenCalledWith(
        'notification.send',
        expect.objectContaining({ type: 'dispute_flagged' }),
      );
    });

    it('auto-escalates critical disputes and sends critical escalation notification', async () => {
      const criticalPayload: CreateDisputePayload = {
        ...validCreatePayload,
        severity: 'critical',
      };
      const createdDispute = { id: 'dispute-crit', ...criticalPayload, status: 'open' };
      (mockPrisma.dispute.create as any).mockResolvedValue(createdDispute);
      (mockPrisma.dispute.update as any).mockResolvedValue({
        ...createdDispute,
        status: 'escalated',
      });

      await service.createDispute(criticalPayload);

      // Should update status to escalated
      expect(mockPrisma.dispute.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'dispute-crit' },
          data: expect.objectContaining({ status: 'escalated' }),
        }),
      );
      // Should send critical escalation notification
      expect(mockBoss.send).toHaveBeenCalledWith(
        'notification.send',
        expect.objectContaining({ type: 'dispute_critical_escalation', severity: 'critical' }),
      );
    });

    it('stores photoUrls as empty array when not provided', async () => {
      const payloadWithoutPhotos = { ...validCreatePayload };
      delete (payloadWithoutPhotos as any).photoUrls;

      const createdDispute = { id: 'dispute-002', ...payloadWithoutPhotos, status: 'open' };
      (mockPrisma.dispute.create as any).mockResolvedValue(createdDispute);

      await service.createDispute(payloadWithoutPhotos);

      expect(mockPrisma.dispute.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ photoUrls: [] }),
        }),
      );
    });

    it('includes photoUrls and documentIds when provided', async () => {
      const payloadWithPhotos: CreateDisputePayload = {
        ...validCreatePayload,
        photoUrls: ['https://storage.example.com/photo1.jpg'],
        documentIds: ['doc-001'],
      };
      const createdDispute = { id: 'dispute-003', ...payloadWithPhotos, status: 'open' };
      (mockPrisma.dispute.create as any).mockResolvedValue(createdDispute);

      await service.createDispute(payloadWithPhotos);

      expect(mockPrisma.dispute.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            photoUrls: ['https://storage.example.com/photo1.jpg'],
            documentIds: ['doc-001'],
          }),
        }),
      );
    });
  });

  // ===========================================================================
  // getAgentDisputes
  // ===========================================================================

  describe('getAgentDisputes', () => {
    it('returns all disputes for an agent without status filter', async () => {
      const disputes = [
        { id: 'dispute-001', raisedBy: 'agent-001', status: 'open' },
        { id: 'dispute-002', raisedBy: 'agent-001', status: 'resolved' },
      ];
      (mockPrisma.dispute.findMany as any).mockResolvedValue(disputes);

      const result = await service.getAgentDisputes('agent-001');

      expect(result).toHaveLength(2);
      expect(mockPrisma.dispute.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { raisedBy: 'agent-001' },
        }),
      );
    });

    it('filters disputes by status when specified', async () => {
      (mockPrisma.dispute.findMany as any).mockResolvedValue([]);

      await service.getAgentDisputes('agent-001', 'open');

      expect(mockPrisma.dispute.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { raisedBy: 'agent-001', status: 'open' },
        }),
      );
    });
  });

  // ===========================================================================
  // getServiceDisputes
  // ===========================================================================

  describe('getServiceDisputes', () => {
    it('returns all disputes for a service request', async () => {
      const disputes = [
        { id: 'dispute-001', serviceRequestId: 'sr-001', agent: { id: 'agent-001', name: 'Test' } },
      ];
      (mockPrisma.dispute.findMany as any).mockResolvedValue(disputes);

      const result = await service.getServiceDisputes('sr-001');

      expect(result).toHaveLength(1);
      expect(mockPrisma.dispute.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { serviceRequestId: 'sr-001' },
        }),
      );
    });
  });

  // ===========================================================================
  // getDisputeById
  // ===========================================================================

  describe('getDisputeById', () => {
    it('returns dispute with agent and comments included', async () => {
      const dispute = {
        id: 'dispute-001',
        title: 'Missing Sale Deed',
        agent: { id: 'agent-001', name: 'Ramesh', phone: '9876543210' },
        comments: [],
      };
      (mockPrisma.dispute.findUnique as any).mockResolvedValue(dispute);

      const result = await service.getDisputeById('dispute-001');

      expect(result.id).toBe('dispute-001');
      expect(result.agent).toBeDefined();
    });

    it('throws BUSINESS_DISPUTE_NOT_FOUND when dispute does not exist', async () => {
      (mockPrisma.dispute.findUnique as any).mockResolvedValue(null);

      await expect(service.getDisputeById('nonexistent')).rejects.toMatchObject({
        code: 'BUSINESS_DISPUTE_NOT_FOUND',
        statusCode: 404,
      });
    });
  });

  // ===========================================================================
  // addComment
  // ===========================================================================

  describe('addComment', () => {
    it('adds a comment to an existing dispute', async () => {
      const dispute = { id: 'dispute-001', raisedBy: 'agent-001', status: 'open' };
      const comment = {
        id: 'comment-001',
        disputeId: 'dispute-001',
        authorId: 'ops-001',
        content: 'We are reviewing this.',
      };
      (mockPrisma.dispute.findUnique as any).mockResolvedValue(dispute);
      (mockPrisma.disputeComment.create as any).mockResolvedValue(comment);

      const result = await service.addComment('dispute-001', 'ops-001', 'ops', 'We are reviewing this.');

      expect(result.id).toBe('comment-001');
      expect(mockPrisma.disputeComment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            disputeId: 'dispute-001',
            authorId: 'ops-001',
            authorRole: 'ops',
            content: 'We are reviewing this.',
          }),
        }),
      );
    });

    it('throws BUSINESS_DISPUTE_NOT_FOUND when dispute does not exist', async () => {
      (mockPrisma.dispute.findUnique as any).mockResolvedValue(null);

      await expect(
        service.addComment('nonexistent', 'ops-001', 'ops', 'comment'),
      ).rejects.toMatchObject({
        code: 'BUSINESS_DISPUTE_NOT_FOUND',
        statusCode: 404,
      });
    });
  });

  // ===========================================================================
  // updateStatus
  // ===========================================================================

  describe('updateStatus', () => {
    it('updates dispute status and notifies the agent', async () => {
      const dispute = { id: 'dispute-001', raisedBy: 'agent-001', status: 'open' };
      const updatedDispute = { ...dispute, status: 'under_review' };
      (mockPrisma.dispute.findUnique as any).mockResolvedValue(dispute);
      (mockPrisma.dispute.update as any).mockResolvedValue(updatedDispute);

      const result = await service.updateStatus('dispute-001', 'under_review', 'ops-001');

      expect(result.status).toBe('under_review');
      expect(mockBoss.send).toHaveBeenCalledWith(
        'notification.send',
        expect.objectContaining({
          type: 'dispute_status_update',
          disputeId: 'dispute-001',
          newStatus: 'under_review',
          agentId: 'agent-001',
        }),
      );
    });

    it('sets escalatedAt when transitioning to escalated', async () => {
      const dispute = { id: 'dispute-001', raisedBy: 'agent-001', status: 'open' };
      (mockPrisma.dispute.findUnique as any).mockResolvedValue(dispute);
      (mockPrisma.dispute.update as any).mockResolvedValue({ ...dispute, status: 'escalated' });

      await service.updateStatus('dispute-001', 'escalated', 'ops-001');

      expect(mockPrisma.dispute.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ escalatedAt: expect.any(Date) }),
        }),
      );
    });

    it('sets resolvedAt and resolvedBy when resolving', async () => {
      const dispute = { id: 'dispute-001', raisedBy: 'agent-001', status: 'under_review' };
      (mockPrisma.dispute.findUnique as any).mockResolvedValue(dispute);
      (mockPrisma.dispute.update as any).mockResolvedValue({ ...dispute, status: 'resolved' });

      await service.updateStatus('dispute-001', 'resolved', 'ops-001');

      expect(mockPrisma.dispute.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            resolvedAt: expect.any(Date),
            resolvedBy: 'ops-001',
          }),
        }),
      );
    });

    it('throws BUSINESS_DISPUTE_NOT_FOUND when dispute does not exist', async () => {
      (mockPrisma.dispute.findUnique as any).mockResolvedValue(null);

      await expect(
        service.updateStatus('nonexistent', 'resolved', 'ops-001'),
      ).rejects.toMatchObject({
        code: 'BUSINESS_DISPUTE_NOT_FOUND',
        statusCode: 404,
      });
    });
  });

  // ===========================================================================
  // resolveDispute
  // ===========================================================================

  describe('resolveDispute', () => {
    const resolvePayload: ResolveDisputePayload = {
      disputeId: 'dispute-001',
      resolvedBy: 'ops-001',
      resolution: 'Verified with customer - document was misplaced but found.',
      newStatus: 'resolved',
    };

    it('resolves an open dispute and notifies the agent', async () => {
      const dispute = { id: 'dispute-001', raisedBy: 'agent-001', status: 'open' };
      const updatedDispute = { ...dispute, status: 'resolved' };
      (mockPrisma.dispute.findUnique as any).mockResolvedValue(dispute);
      (mockPrisma.dispute.update as any).mockResolvedValue(updatedDispute);

      const result = await service.resolveDispute(resolvePayload);

      expect(result.status).toBe('resolved');
      expect(mockPrisma.dispute.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'resolved',
            resolution: resolvePayload.resolution,
            resolvedBy: 'ops-001',
          }),
        }),
      );
      expect(mockBoss.send).toHaveBeenCalledWith(
        'notification.send',
        expect.objectContaining({
          type: 'dispute_resolved',
          disputeId: 'dispute-001',
          agentId: 'agent-001',
        }),
      );
    });

    it('throws BUSINESS_DISPUTE_ALREADY_CLOSED for already-resolved disputes', async () => {
      const dispute = { id: 'dispute-001', raisedBy: 'agent-001', status: 'resolved' };
      (mockPrisma.dispute.findUnique as any).mockResolvedValue(dispute);

      await expect(service.resolveDispute(resolvePayload)).rejects.toMatchObject({
        code: 'BUSINESS_DISPUTE_ALREADY_CLOSED',
        statusCode: 422,
      });
    });

    it('throws BUSINESS_DISPUTE_ALREADY_CLOSED for dismissed disputes', async () => {
      const dispute = { id: 'dispute-001', raisedBy: 'agent-001', status: 'dismissed' };
      (mockPrisma.dispute.findUnique as any).mockResolvedValue(dispute);

      await expect(service.resolveDispute(resolvePayload)).rejects.toMatchObject({
        code: 'BUSINESS_DISPUTE_ALREADY_CLOSED',
      });
    });

    it('throws BUSINESS_DISPUTE_NOT_FOUND when dispute does not exist', async () => {
      (mockPrisma.dispute.findUnique as any).mockResolvedValue(null);

      await expect(service.resolveDispute(resolvePayload)).rejects.toMatchObject({
        code: 'BUSINESS_DISPUTE_NOT_FOUND',
        statusCode: 404,
      });
    });

    it('can dismiss a dispute with dismissed status', async () => {
      const dispute = { id: 'dispute-001', raisedBy: 'agent-001', status: 'under_review' };
      const dismissedDispute = { ...dispute, status: 'dismissed' };
      (mockPrisma.dispute.findUnique as any).mockResolvedValue(dispute);
      (mockPrisma.dispute.update as any).mockResolvedValue(dismissedDispute);

      const result = await service.resolveDispute({
        ...resolvePayload,
        newStatus: 'dismissed',
      });

      expect(result.status).toBe('dismissed');
    });
  });
});
