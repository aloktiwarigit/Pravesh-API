"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
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
exports.seedSupportTemplates = seedSupportTemplates;
// Story 10.3: Default Communication Templates Seed Data
var client_1 = require("@prisma/client");
var prisma = new client_1.PrismaClient();
var DEFAULT_TEMPLATES = [
    {
        category: 'DOCUMENT_REQUESTS',
        templateTextEn: 'Dear [Customer Name], we need the following documents for your [Service Type] service. Please upload them at your earliest convenience.',
        templateTextHi: 'प्रिय [Customer Name], आपकी [Service Type] सेवा के लिए हमें निम्नलिखित दस्तावेज़ चाहिए। कृपया जल्द से जल्द अपलोड करें।',
        placeholders: ['Customer Name', 'Service Type'],
    },
    {
        category: 'DOCUMENT_REQUESTS',
        templateTextEn: 'Dear [Customer Name], could you please clarify the property details for your [Service Type] request?',
        templateTextHi: 'प्रिय [Customer Name], कृपया अपने [Service Type] अनुरोध के लिए संपत्ति विवरण स्पष्ट करें।',
        placeholders: ['Customer Name', 'Service Type'],
    },
    {
        category: 'TIMELINE_UPDATES',
        templateTextEn: 'Dear [Customer Name], there is a delay in your [Service Type] due to a government office closure. Your new expected date is [SLA Date].',
        templateTextHi: 'प्रिय [Customer Name], सरकारी कार्यालय बंद होने के कारण आपकी [Service Type] में देरी हो रही है। आपकी नई अपेक्षित तिथि [SLA Date] है।',
        placeholders: ['Customer Name', 'Service Type', 'SLA Date'],
    },
    {
        category: 'TIMELINE_UPDATES',
        templateTextEn: 'Dear [Customer Name], here is an update on your [Service Type]: Your service is on track. Agent [Agent Name] is handling your case. Expected completion by [SLA Date].',
        templateTextHi: 'प्रिय [Customer Name], आपकी [Service Type] का अपडेट: सेवा ट्रैक पर है। एजेंट [Agent Name] आपका मामला संभाल रहे हैं। [SLA Date] तक पूर्ण होने की उम्मीद है।',
        placeholders: ['Customer Name', 'Service Type', 'Agent Name', 'SLA Date'],
    },
    {
        category: 'ISSUE_RESOLUTION',
        templateTextEn: 'Dear [Customer Name], we are pleased to inform you that the issue with your [Service Type] has been resolved. Please let us know if you need further assistance.',
        templateTextHi: 'प्रिय [Customer Name], हमें आपको सूचित करते हुए खुशी हो रही है कि आपकी [Service Type] की समस्या हल हो गई है। यदि और सहायता चाहिए तो कृपया बताएं।',
        placeholders: ['Customer Name', 'Service Type'],
    },
    {
        category: 'ISSUE_RESOLUTION',
        templateTextEn: 'Dear [Customer Name], your case regarding [Service Type] has been escalated to our Operations team for priority handling. You will receive an update within 24 hours.',
        templateTextHi: 'प्रिय [Customer Name], [Service Type] से संबंधित आपका मामला प्राथमिकता से निपटने के लिए हमारी संचालन टीम को भेजा गया है। आपको 24 घंटे में अपडेट मिलेगा।',
        placeholders: ['Customer Name', 'Service Type'],
    },
    {
        category: 'GENERAL_INQUIRY',
        templateTextEn: 'Dear [Customer Name], thank you for reaching out. We are looking into your inquiry regarding [Service Type] and will get back to you shortly.',
        templateTextHi: 'प्रिय [Customer Name], संपर्क करने के लिए धन्यवाद। हम आपकी [Service Type] से संबंधित पूछताछ पर काम कर रहे हैं और जल्द ही आपसे संपर्क करेंगे।',
        placeholders: ['Customer Name', 'Service Type'],
    },
];
function seedSupportTemplates(createdBy) {
    return __awaiter(this, void 0, void 0, function () {
        var _i, DEFAULT_TEMPLATES_1, template;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.info('Seeding support communication templates...');
                    _i = 0, DEFAULT_TEMPLATES_1 = DEFAULT_TEMPLATES;
                    _a.label = 1;
                case 1:
                    if (!(_i < DEFAULT_TEMPLATES_1.length)) return [3 /*break*/, 4];
                    template = DEFAULT_TEMPLATES_1[_i];
                    return [4 /*yield*/, prisma.supportTemplate.create({
                            data: __assign(__assign({}, template), { createdBy: createdBy }),
                        })];
                case 2:
                    _a.sent();
                    _a.label = 3;
                case 3:
                    _i++;
                    return [3 /*break*/, 1];
                case 4:
                    console.info("".concat(DEFAULT_TEMPLATES.length, " support templates seeded successfully."));
                    return [2 /*return*/];
            }
        });
    });
}
