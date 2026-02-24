"use strict";
/**
 * City Seed Data
 * Seeds primary cities for multi-tenant architecture.
 * Uses upsert on unique [cityName, state] for idempotency.
 */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.seedCities = seedCities;
var SYSTEM_USER_ID = 'system-seed';
var cities = [
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
function seedCities(prisma) {
    return __awaiter(this, void 0, void 0, function () {
        var cityIdMap, _i, cities_1, city, result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    cityIdMap = {};
                    _i = 0, cities_1 = cities;
                    _a.label = 1;
                case 1:
                    if (!(_i < cities_1.length)) return [3 /*break*/, 4];
                    city = cities_1[_i];
                    return [4 /*yield*/, prisma.city.upsert({
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
                        })];
                case 2:
                    result = _a.sent();
                    cityIdMap[city.cityName] = result.id;
                    _a.label = 3;
                case 3:
                    _i++;
                    return [3 /*break*/, 1];
                case 4:
                    console.log("Seeded ".concat(cities.length, " cities"));
                    return [2 /*return*/, cityIdMap];
            }
        });
    });
}
