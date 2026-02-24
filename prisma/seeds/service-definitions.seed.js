"use strict";
/**
 * Service Definitions Seed Data
 * Seeds the property legal service catalog with JSONB definition blobs.
 * Each definition includes steps, documents, fees, and SLA info.
 * Uses upsert on unique `code` for idempotency.
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
exports.seedServiceDefinitions = seedServiceDefinitions;
var serviceDefinitions = [
    // ── Pre-Purchase Services ──
    {
        code: 'PRE-001',
        name: 'Title Search & Verification',
        category: 'pre_purchase',
        definition: {
            description: 'Comprehensive title search going back 30+ years to verify ownership chain and identify encumbrances.',
            steps: [
                { index: 0, name: 'Document Collection', slaDays: 2, description: 'Collect property documents from customer' },
                { index: 1, name: 'Registry Office Visit', slaDays: 3, description: 'Visit sub-registrar office for index-II search' },
                { index: 2, name: 'Revenue Record Check', slaDays: 3, description: 'Verify khatauni/khasra from tehsil office' },
                { index: 3, name: 'Encumbrance Check', slaDays: 2, description: 'Verify no liens, mortgages, or pending litigation' },
                { index: 4, name: 'Title Report Preparation', slaDays: 2, description: 'Prepare detailed title search report' },
                { index: 5, name: 'Report Delivery', slaDays: 1, description: 'Deliver report to customer via app' },
            ],
            requiredDocuments: ['sale_deed_copy', 'property_map', 'owner_id_proof', 'property_tax_receipt'],
            fees: {
                basePricePaise: 499900, // Rs 4,999
                govtFeesPaise: 50000, // Rs 500
                gstPercent: 18,
            },
            estimatedDays: 13,
            offices: ['Sub-Registrar Office', 'Tehsil Office'],
        },
    },
    {
        code: 'PRE-002',
        name: 'Encumbrance Certificate',
        category: 'pre_purchase',
        definition: {
            description: 'Obtain Encumbrance Certificate (EC) to verify property is free from legal dues and mortgages.',
            steps: [
                { index: 0, name: 'Application Preparation', slaDays: 1, description: 'Prepare EC application with property details' },
                { index: 1, name: 'Registry Office Submission', slaDays: 2, description: 'Submit application at sub-registrar office' },
                { index: 2, name: 'Follow-up & Collection', slaDays: 5, description: 'Follow up and collect EC certificate' },
                { index: 3, name: 'Verification & Delivery', slaDays: 1, description: 'Verify EC and deliver to customer' },
            ],
            requiredDocuments: ['property_address_proof', 'sale_deed_copy', 'owner_id_proof'],
            fees: {
                basePricePaise: 199900, // Rs 1,999
                govtFeesPaise: 20000, // Rs 200
                gstPercent: 18,
            },
            estimatedDays: 9,
            offices: ['Sub-Registrar Office'],
        },
    },
    {
        code: 'PRE-003',
        name: 'RERA Verification',
        category: 'pre_purchase',
        definition: {
            description: 'Verify builder/project RERA registration status and compliance for under-construction properties.',
            steps: [
                { index: 0, name: 'RERA Number Collection', slaDays: 1, description: 'Collect RERA registration number from customer' },
                { index: 1, name: 'Online Portal Verification', slaDays: 1, description: 'Verify on state RERA portal' },
                { index: 2, name: 'Compliance Check', slaDays: 2, description: 'Check quarterly compliance reports and financials' },
                { index: 3, name: 'Report Generation', slaDays: 1, description: 'Generate RERA verification report' },
            ],
            requiredDocuments: ['rera_registration_number', 'builder_brochure', 'allotment_letter'],
            fees: {
                basePricePaise: 299900, // Rs 2,999
                govtFeesPaise: 0,
                gstPercent: 18,
            },
            estimatedDays: 5,
            offices: ['RERA Authority'],
        },
    },
    // ── Purchase Services ──
    {
        code: 'PUR-001',
        name: 'Property Registry (Sale Deed)',
        category: 'purchase',
        definition: {
            description: 'End-to-end property registration including stamp duty calculation, deed drafting, and registry execution.',
            steps: [
                { index: 0, name: 'Document Collection', slaDays: 3, description: 'Collect all required documents from buyer and seller' },
                { index: 1, name: 'Sale Deed Drafting', slaDays: 3, description: 'Draft sale deed with advocate review' },
                { index: 2, name: 'Stamp Duty Payment', slaDays: 2, description: 'Calculate and pay stamp duty online/offline' },
                { index: 3, name: 'Appointment Booking', slaDays: 2, description: 'Book appointment at sub-registrar office' },
                { index: 4, name: 'Registry Execution', slaDays: 1, description: 'Execute registration at sub-registrar office' },
                { index: 5, name: 'Registered Deed Collection', slaDays: 5, description: 'Collect registered sale deed copy' },
                { index: 6, name: 'Delivery', slaDays: 1, description: 'Deliver registered deed to customer' },
            ],
            requiredDocuments: [
                'buyer_id_proof', 'buyer_address_proof', 'buyer_pan', 'buyer_photo',
                'seller_id_proof', 'seller_address_proof', 'seller_pan', 'seller_photo',
                'original_sale_deed', 'property_map', 'noc_society', 'property_tax_receipt',
            ],
            fees: {
                basePricePaise: 999900, // Rs 9,999
                govtFeesPaise: 0, // Variable (stamp duty calculated separately)
                gstPercent: 18,
            },
            estimatedDays: 17,
            offices: ['Sub-Registrar Office', 'Stamp Office'],
        },
    },
    {
        code: 'PUR-002',
        name: 'Agreement to Sell',
        category: 'purchase',
        definition: {
            description: 'Draft and notarize Agreement to Sell between buyer and seller before final registration.',
            steps: [
                { index: 0, name: 'Detail Collection', slaDays: 2, description: 'Collect terms and conditions from both parties' },
                { index: 1, name: 'Agreement Drafting', slaDays: 2, description: 'Draft agreement with legal review' },
                { index: 2, name: 'Party Review', slaDays: 3, description: 'Both parties review and approve the draft' },
                { index: 3, name: 'Stamp Paper & Notarization', slaDays: 2, description: 'Print on stamp paper and get notarized' },
                { index: 4, name: 'Delivery', slaDays: 1, description: 'Deliver copies to both parties' },
            ],
            requiredDocuments: ['buyer_id_proof', 'seller_id_proof', 'property_details', 'payment_terms'],
            fees: {
                basePricePaise: 499900, // Rs 4,999
                govtFeesPaise: 10000, // Rs 100 stamp paper
                gstPercent: 18,
            },
            estimatedDays: 10,
            offices: ['Notary Office'],
        },
    },
    // ── Post-Purchase Services ──
    {
        code: 'POST-001',
        name: 'Property Mutation (Namantaran)',
        category: 'post_purchase',
        definition: {
            description: 'Transfer property records in revenue department from seller to buyer name after registration.',
            steps: [
                { index: 0, name: 'Application Preparation', slaDays: 2, description: 'Prepare mutation application with supporting docs' },
                { index: 1, name: 'Tehsil Submission', slaDays: 2, description: 'Submit application at tehsil/nagar nigam office' },
                { index: 2, name: 'Notice Period', slaDays: 15, description: 'Public notice period for objections' },
                { index: 3, name: 'Hearing (if needed)', slaDays: 5, description: 'Attend hearing if objections are raised' },
                { index: 4, name: 'Mutation Order', slaDays: 3, description: 'Obtain mutation order from tehsildar' },
                { index: 5, name: 'Updated Khatauni Collection', slaDays: 2, description: 'Collect updated revenue records' },
            ],
            requiredDocuments: ['registered_sale_deed', 'buyer_id_proof', 'property_tax_receipt', 'death_certificate_if_inheritance'],
            fees: {
                basePricePaise: 599900, // Rs 5,999
                govtFeesPaise: 100000, // Rs 1,000
                gstPercent: 18,
            },
            estimatedDays: 29,
            offices: ['Tehsil Office', 'Nagar Nigam'],
        },
    },
    {
        code: 'POST-002',
        name: 'Khata Transfer',
        category: 'post_purchase',
        definition: {
            description: 'Transfer Khata (property tax account) to new owner name in municipal corporation records.',
            steps: [
                { index: 0, name: 'Document Collection', slaDays: 2, description: 'Collect sale deed and tax receipts' },
                { index: 1, name: 'Application Filing', slaDays: 2, description: 'File Khata transfer application at municipal office' },
                { index: 2, name: 'Verification', slaDays: 5, description: 'Municipal verification of documents' },
                { index: 3, name: 'New Khata Issuance', slaDays: 3, description: 'Collection of updated Khata certificate' },
            ],
            requiredDocuments: ['registered_sale_deed', 'old_khata', 'buyer_id_proof', 'property_tax_paid_receipt'],
            fees: {
                basePricePaise: 399900, // Rs 3,999
                govtFeesPaise: 50000, // Rs 500
                gstPercent: 18,
            },
            estimatedDays: 12,
            offices: ['Municipal Corporation'],
        },
    },
    {
        code: 'POST-003',
        name: 'Property Tax Assessment',
        category: 'post_purchase',
        definition: {
            description: 'Get property assessed for property tax and ensure correct tax calculation by municipal authority.',
            steps: [
                { index: 0, name: 'Document Collection', slaDays: 2, description: 'Collect property and ownership documents' },
                { index: 1, name: 'Assessment Application', slaDays: 2, description: 'File assessment application' },
                { index: 2, name: 'Physical Inspection', slaDays: 5, description: 'Municipal inspector visits property' },
                { index: 3, name: 'Assessment Order', slaDays: 3, description: 'Receive property tax assessment order' },
            ],
            requiredDocuments: ['registered_sale_deed', 'building_plan', 'completion_certificate', 'buyer_id_proof'],
            fees: {
                basePricePaise: 299900, // Rs 2,999
                govtFeesPaise: 25000, // Rs 250
                gstPercent: 18,
            },
            estimatedDays: 12,
            offices: ['Municipal Corporation'],
        },
    },
    // ── Inheritance Services ──
    {
        code: 'INH-001',
        name: 'Legal Heir Certificate',
        category: 'inheritance',
        definition: {
            description: 'Obtain Legal Heir Certificate from tehsil/SDM office required for property inheritance.',
            steps: [
                { index: 0, name: 'Document Collection', slaDays: 2, description: 'Collect death certificate, family tree, affidavits' },
                { index: 1, name: 'Application Filing', slaDays: 2, description: 'File application at SDM/tehsil office' },
                { index: 2, name: 'Public Notice', slaDays: 30, description: 'Newspaper publication and objection period' },
                { index: 3, name: 'Hearing', slaDays: 5, description: 'Attend hearing before SDM/magistrate' },
                { index: 4, name: 'Certificate Issuance', slaDays: 3, description: 'Collect legal heir certificate' },
            ],
            requiredDocuments: ['death_certificate', 'family_tree_affidavit', 'heir_id_proofs', 'ration_card', 'newspaper_notice'],
            fees: {
                basePricePaise: 799900, // Rs 7,999
                govtFeesPaise: 200000, // Rs 2,000
                gstPercent: 18,
            },
            estimatedDays: 42,
            offices: ['SDM Office', 'Tehsil Office'],
        },
    },
    {
        code: 'INH-002',
        name: 'Succession Certificate',
        category: 'inheritance',
        definition: {
            description: 'Obtain Succession Certificate from civil court for movable and immovable property transfer.',
            steps: [
                { index: 0, name: 'Document Collection', slaDays: 3, description: 'Collect death certificate, property documents, heir proofs' },
                { index: 1, name: 'Petition Drafting', slaDays: 3, description: 'Draft succession petition with advocate' },
                { index: 2, name: 'Court Filing', slaDays: 2, description: 'File petition in civil court' },
                { index: 3, name: 'Notice Publication', slaDays: 30, description: 'Publication in newspaper and gazette' },
                { index: 4, name: 'Court Hearings', slaDays: 30, description: 'Attend hearings as scheduled by court' },
                { index: 5, name: 'Certificate Issuance', slaDays: 5, description: 'Obtain succession certificate from court' },
            ],
            requiredDocuments: ['death_certificate', 'property_documents', 'heir_id_proofs', 'affidavit', 'noc_from_other_heirs'],
            fees: {
                basePricePaise: 1499900, // Rs 14,999
                govtFeesPaise: 500000, // Rs 5,000 (court fees)
                gstPercent: 18,
            },
            estimatedDays: 73,
            offices: ['Civil Court'],
        },
    },
    {
        code: 'INH-003',
        name: 'Will Probate',
        category: 'inheritance',
        definition: {
            description: 'File and obtain probate of will from court to validate a deceased person\'s will.',
            steps: [
                { index: 0, name: 'Document Collection', slaDays: 3, description: 'Collect original will, death certificate, property docs' },
                { index: 1, name: 'Probate Petition Drafting', slaDays: 3, description: 'Draft probate petition' },
                { index: 2, name: 'Court Filing', slaDays: 2, description: 'File petition in district court' },
                { index: 3, name: 'Citation & Notice', slaDays: 30, description: 'Court issues citation to interested parties' },
                { index: 4, name: 'Court Proceedings', slaDays: 30, description: 'Attend court proceedings' },
                { index: 5, name: 'Probate Grant', slaDays: 5, description: 'Obtain probate order from court' },
            ],
            requiredDocuments: ['original_will', 'death_certificate', 'property_documents', 'heir_id_proofs', 'witness_statements'],
            fees: {
                basePricePaise: 1999900, // Rs 19,999
                govtFeesPaise: 750000, // Rs 7,500
                gstPercent: 18,
            },
            estimatedDays: 73,
            offices: ['District Court'],
        },
    },
    // ── Utility / Specialized Services ──
    {
        code: 'UTL-001',
        name: 'Electricity Connection Transfer',
        category: 'utility',
        definition: {
            description: 'Transfer electricity connection to new owner name after property purchase.',
            steps: [
                { index: 0, name: 'Document Collection', slaDays: 2, description: 'Collect sale deed, old electricity bill, NOC' },
                { index: 1, name: 'Application Filing', slaDays: 1, description: 'File name transfer application at discom office' },
                { index: 2, name: 'Meter Inspection', slaDays: 3, description: 'Discom officer inspects meter and connection' },
                { index: 3, name: 'Transfer Completion', slaDays: 3, description: 'New connection papers issued in buyer name' },
            ],
            requiredDocuments: ['registered_sale_deed', 'old_electricity_bill', 'noc_seller', 'buyer_id_proof'],
            fees: {
                basePricePaise: 199900, // Rs 1,999
                govtFeesPaise: 30000, // Rs 300
                gstPercent: 18,
            },
            estimatedDays: 9,
            offices: ['Electricity Board / Discom'],
        },
    },
    {
        code: 'UTL-002',
        name: 'Water Connection Transfer',
        category: 'utility',
        definition: {
            description: 'Transfer municipal water connection to new owner name.',
            steps: [
                { index: 0, name: 'Document Collection', slaDays: 2, description: 'Collect sale deed, old water bill, NOC' },
                { index: 1, name: 'Application Filing', slaDays: 1, description: 'File application at Jal Sansthan/Nigam' },
                { index: 2, name: 'Inspection', slaDays: 3, description: 'Inspector visits property' },
                { index: 3, name: 'Transfer Completion', slaDays: 3, description: 'Water account transferred to new owner' },
            ],
            requiredDocuments: ['registered_sale_deed', 'old_water_bill', 'noc_seller', 'buyer_id_proof'],
            fees: {
                basePricePaise: 149900, // Rs 1,499
                govtFeesPaise: 20000, // Rs 200
                gstPercent: 18,
            },
            estimatedDays: 9,
            offices: ['Jal Sansthan / Jal Nigam'],
        },
    },
    {
        code: 'SPL-001',
        name: 'Agricultural Land Conversion (NA)',
        category: 'specialized',
        definition: {
            description: 'Convert agricultural land to non-agricultural (NA) use for construction or commercial purposes.',
            steps: [
                { index: 0, name: 'Document Collection', slaDays: 3, description: 'Collect land records, map, and ownership docs' },
                { index: 1, name: 'Application Preparation', slaDays: 3, description: 'Prepare NA conversion application' },
                { index: 2, name: 'Tehsil Submission', slaDays: 2, description: 'Submit at district collector/tehsil office' },
                { index: 3, name: 'Site Inspection', slaDays: 10, description: 'Government officer inspects the land' },
                { index: 4, name: 'NOC Collection', slaDays: 10, description: 'Collect NOCs from various departments' },
                { index: 5, name: 'Conversion Order', slaDays: 15, description: 'Obtain NA conversion order' },
                { index: 6, name: 'Updated Records', slaDays: 5, description: 'Get updated land records reflecting NA status' },
            ],
            requiredDocuments: ['khasra_khatauni', 'land_map', 'owner_id_proof', 'purpose_declaration', 'noc_gram_panchayat'],
            fees: {
                basePricePaise: 2499900, // Rs 24,999
                govtFeesPaise: 1000000, // Rs 10,000 (varies)
                gstPercent: 18,
            },
            estimatedDays: 48,
            offices: ['District Collector', 'Tehsil Office', 'Gram Panchayat'],
        },
    },
];
function seedServiceDefinitions(prisma, cityIdMap) {
    return __awaiter(this, void 0, void 0, function () {
        var lucknowId, _i, serviceDefinitions_1, sd;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    lucknowId = cityIdMap['Lucknow'];
                    if (!lucknowId) {
                        throw new Error('Lucknow city must be seeded before service definitions');
                    }
                    _i = 0, serviceDefinitions_1 = serviceDefinitions;
                    _a.label = 1;
                case 1:
                    if (!(_i < serviceDefinitions_1.length)) return [3 /*break*/, 4];
                    sd = serviceDefinitions_1[_i];
                    return [4 /*yield*/, prisma.serviceDefinition.upsert({
                            where: { code: sd.code },
                            update: {
                                name: sd.name,
                                category: sd.category,
                                definition: sd.definition,
                                isActive: true,
                            },
                            create: {
                                code: sd.code,
                                name: sd.name,
                                category: sd.category,
                                definition: sd.definition,
                                isActive: true,
                                cityId: lucknowId,
                            },
                        })];
                case 2:
                    _a.sent();
                    _a.label = 3;
                case 3:
                    _i++;
                    return [3 /*break*/, 1];
                case 4:
                    console.log("Seeded ".concat(serviceDefinitions.length, " service definitions"));
                    return [2 /*return*/];
            }
        });
    });
}
