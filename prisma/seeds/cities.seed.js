"use strict";
/**
 * City Seed Data
 * Seeds primary cities for multi-tenant architecture.
 * Uses upsert on unique [cityName, state] for idempotency.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.seedCities = seedCities;
const SYSTEM_USER_ID = 'system-seed';
const cities = [
    {
        cityName: 'Lucknow',
        state: 'Uttar Pradesh',
        activeStatus: true,
        configData: {
            timezone: 'Asia/Kolkata',
            locale: 'hi-IN',
            currency: 'INR',
            registryOffice: 'Sub-Registrar Office, Lucknow',
            tehsilCount: 8,
            supportedLanguages: ['hi', 'en'],
            govPortals: {
                igrs: 'https://igrsup.gov.in',
                revenue: 'https://upbhulekh.gov.in',
                rera: 'https://up-rera.in',
            },
            operatingHours: { start: '09:00', end: '18:00' },
            slaMultiplier: 1.0,
            stampDutyMalePercent: 7,
            stampDutyFemalePercent: 6,
            registrationChargePercent: 1,
        },
        createdBy: SYSTEM_USER_ID,
    },
    {
        cityName: 'Delhi',
        state: 'Delhi',
        activeStatus: true,
        configData: {
            timezone: 'Asia/Kolkata',
            locale: 'hi-IN',
            currency: 'INR',
            registryOffice: 'Sub-Registrar Office, Delhi',
            tehsilCount: 11,
            supportedLanguages: ['hi', 'en'],
            govPortals: {
                igrs: 'https://doris.delhigovt.nic.in',
                revenue: 'https://revenue.delhi.gov.in',
                rera: 'https://rera.delhi.gov.in',
            },
            operatingHours: { start: '09:00', end: '17:30' },
            slaMultiplier: 1.1,
            stampDutyMalePercent: 6,
            stampDutyFemalePercent: 4,
            registrationChargePercent: 1,
        },
        createdBy: SYSTEM_USER_ID,
    },
    {
        cityName: 'Mumbai',
        state: 'Maharashtra',
        activeStatus: true,
        configData: {
            timezone: 'Asia/Kolkata',
            locale: 'mr-IN',
            currency: 'INR',
            registryOffice: 'Sub-Registrar Office, Mumbai',
            tehsilCount: 5,
            supportedLanguages: ['hi', 'en', 'mr'],
            govPortals: {
                igrs: 'https://igrmaharashtra.gov.in',
                revenue: 'https://mahabhumi.gov.in',
                rera: 'https://maharera.mahaonline.gov.in',
            },
            operatingHours: { start: '10:00', end: '17:30' },
            slaMultiplier: 1.2,
            stampDutyMalePercent: 6,
            stampDutyFemalePercent: 5,
            registrationChargePercent: 1,
        },
        createdBy: SYSTEM_USER_ID,
    },
    {
        cityName: 'Bangalore',
        state: 'Karnataka',
        activeStatus: true,
        configData: {
            timezone: 'Asia/Kolkata',
            locale: 'kn-IN',
            currency: 'INR',
            registryOffice: 'Sub-Registrar Office, Bangalore Urban',
            tehsilCount: 4,
            supportedLanguages: ['hi', 'en', 'kn'],
            govPortals: {
                igrs: 'https://kaveri.karnataka.gov.in',
                revenue: 'https://landrecords.karnataka.gov.in',
                rera: 'https://rera.karnataka.gov.in',
            },
            operatingHours: { start: '10:00', end: '17:30' },
            slaMultiplier: 1.15,
            stampDutyMalePercent: 5,
            stampDutyFemalePercent: 4,
            registrationChargePercent: 1,
        },
        createdBy: SYSTEM_USER_ID,
    },
];
async function seedCities(prisma) {
    const cityIdMap = {};
    for (const city of cities) {
        const result = await prisma.city.upsert({
            where: {
                cityName_state: {
                    cityName: city.cityName,
                    state: city.state,
                },
            },
            update: {
                activeStatus: city.activeStatus,
                configData: city.configData,
            },
            create: {
                cityName: city.cityName,
                state: city.state,
                activeStatus: city.activeStatus,
                configData: city.configData,
                createdBy: city.createdBy,
            },
        });
        cityIdMap[city.cityName] = result.id;
    }
    console.log(`Seeded ${cities.length} cities`);
    return cityIdMap;
}
//# sourceMappingURL=cities.seed.js.map