import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CityService } from '../city.service';
import { CityConfig } from '../franchise.types';

// Mock PrismaClient
const mockPrisma = {
  city: {
    create: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
  },
} as any;

describe('CityService', () => {
  let service: CityService;

  const validConfig: CityConfig = {
    governmentAuthorities: [
      { name: 'LDA Lucknow', departmentType: 'development_authority' },
      { name: 'Nagar Nigam Lucknow', departmentType: 'municipal_corporation' },
    ],
    officeAddresses: {
      main: {
        addressLine1: '10 Ashok Marg',
        city: 'Lucknow',
        state: 'Uttar Pradesh',
        pincode: '226001',
        gpsLat: 26.8467,
        gpsLng: 80.9462,
      },
    },
    contactNumbers: {
      main: '+919876543210',
      support: '+919876543211',
    },
    workingHours: {
      weekdayStart: '09:00',
      weekdayEnd: '17:00',
      saturdayStart: '10:00',
      saturdayEnd: '14:00',
      sundayClosed: true,
    },
    holidayCalendar: [
      { date: '2026-01-26', name: 'Republic Day', type: 'national' },
      { date: '2026-03-14', name: 'Holi', type: 'state' },
    ],
  };

  beforeEach(() => {
    service = new CityService(mockPrisma);
    vi.clearAllMocks();
  });

  describe('createCity', () => {
    it('creates a city with valid config (AC1, AC2, AC3)', async () => {
      const mockCity = {
        id: 'test-uuid',
        cityName: 'Lucknow',
        state: 'Uttar Pradesh',
        activeStatus: true,
        configData: validConfig,
        version: 1,
        createdBy: 'admin-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.city.create.mockResolvedValue(mockCity);

      const result = await service.createCity({
        cityName: 'Lucknow',
        state: 'Uttar Pradesh',
        configData: validConfig,
        createdBy: 'admin-1',
      });

      expect(result).toEqual(mockCity);
      expect(mockPrisma.city.create).toHaveBeenCalledWith({
        data: {
          cityName: 'Lucknow',
          state: 'Uttar Pradesh',
          configData: validConfig,
          version: 1,
          createdBy: 'admin-1',
        },
      });
    });

    it('rejects invalid config data missing required fields (AC3)', async () => {
      const invalidConfig = {
        governmentAuthorities: [], // min(1) will fail
        officeAddresses: {},
        contactNumbers: {},
        workingHours: {
          weekdayStart: '09:00',
          weekdayEnd: '17:00',
          sundayClosed: true,
        },
        holidayCalendar: [],
      };

      await expect(
        service.createCity({
          cityName: 'Test City',
          state: 'Test State',
          configData: invalidConfig as any,
          createdBy: 'admin-1',
        })
      ).rejects.toThrow();
    });

    it('rejects config with invalid holiday date format', async () => {
      const badConfig = {
        ...validConfig,
        holidayCalendar: [{ date: '26/01/2026', name: 'Republic Day', type: 'national' as const }],
      };

      await expect(
        service.createCity({
          cityName: 'Test',
          state: 'Test',
          configData: badConfig as any,
          createdBy: 'admin-1',
        })
      ).rejects.toThrow();
    });

    it('rejects config with invalid pincode', async () => {
      const badConfig = {
        ...validConfig,
        officeAddresses: {
          main: {
            addressLine1: 'Test',
            city: 'Test',
            state: 'Test',
            pincode: '12345', // Must be 6 digits
          },
        },
      };

      await expect(
        service.createCity({
          cityName: 'Test',
          state: 'Test',
          configData: badConfig as any,
          createdBy: 'admin-1',
        })
      ).rejects.toThrow();
    });
  });

  describe('updateCityConfig', () => {
    it('increments version on config update (AC7)', async () => {
      mockPrisma.city.update.mockResolvedValue({
        id: 'city-1',
        version: 2,
        configData: validConfig,
      });

      const result = await service.updateCityConfig('city-1', validConfig);

      expect(mockPrisma.city.update).toHaveBeenCalledWith({
        where: { id: 'city-1' },
        data: {
          configData: validConfig,
          version: { increment: 1 },
        },
      });
    });
  });

  describe('getCityConfig', () => {
    it('returns cached config within TTL (AC6)', async () => {
      const mockCity = { id: 'city-1', cityName: 'Lucknow', configData: validConfig };
      mockPrisma.city.findUnique.mockResolvedValue(mockCity);

      // First call — hits DB
      const result1 = await service.getCityConfig('city-1');
      expect(mockPrisma.city.findUnique).toHaveBeenCalledTimes(1);

      // Second call — hits cache
      const result2 = await service.getCityConfig('city-1');
      expect(mockPrisma.city.findUnique).toHaveBeenCalledTimes(1); // Still 1
      expect(result2).toEqual(mockCity);
    });

    it('throws error for non-existent city', async () => {
      mockPrisma.city.findUnique.mockResolvedValue(null);

      await expect(service.getCityConfig('non-existent')).rejects.toThrow('not found');
    });
  });

  describe('listActiveCities', () => {
    it('returns only active cities (AC4)', async () => {
      const mockCities = [
        { id: 'city-1', cityName: 'Lucknow', state: 'UP', activeStatus: true, version: 1, createdAt: new Date() },
      ];
      mockPrisma.city.findMany.mockResolvedValue(mockCities);

      const result = await service.listActiveCities();

      expect(mockPrisma.city.findMany).toHaveBeenCalledWith({
        where: { activeStatus: true },
        orderBy: { cityName: 'asc' },
        select: {
          id: true,
          cityName: true,
          state: true,
          activeStatus: true,
          version: true,
          createdAt: true,
        },
      });
    });
  });

  describe('clearCache', () => {
    it('clears all cached entries', async () => {
      const mockCity = { id: 'city-1', cityName: 'Lucknow', configData: validConfig };
      mockPrisma.city.findUnique.mockResolvedValue(mockCity);

      await service.getCityConfig('city-1');
      service.clearCache();

      // Next call should hit DB again
      await service.getCityConfig('city-1');
      expect(mockPrisma.city.findUnique).toHaveBeenCalledTimes(2);
    });
  });
});
