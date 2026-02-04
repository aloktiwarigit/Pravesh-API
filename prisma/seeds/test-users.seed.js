"use strict";
/**
 * Test Users Seed Data
 * Creates one test user per role for development and QA.
 *
 * Since there is no User model in the schema, this seeds into the
 * role-specific tables that exist: Agent, Dealer, Lawyer, Builder, Franchise.
 * The userId fields reference Firebase Auth UIDs -- we use deterministic
 * test_ prefixed IDs so they can be matched in Firebase emulator.
 *
 * All test users are assigned to Lucknow city.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.seedTestUsers = seedTestUsers;
const SYSTEM_USER_ID = 'system-seed';
const testAgents = [
    {
        userId: 'test_agent_001',
        name: 'Rajesh Kumar',
        phone: '+919876500001',
        expertiseTags: ['mutation', 'registry', 'title_search'],
    },
];
const testDealers = [
    {
        userId: 'test_dealer_001',
        businessName: 'Sharma Property Consultants',
    },
];
const testLawyers = [
    {
        userId: 'test_lawyer_001',
        barCouncilNumber: 'UP/1234/2015',
        stateBarCouncil: 'Bar Council of Uttar Pradesh',
        admissionYear: 2015,
        practicingCertUrl: 'https://storage.example.com/test/practicing_cert_001.pdf',
    },
];
const testBuilders = [
    {
        userId: 'test_builder_001',
        companyName: 'Sunrise Developers Pvt Ltd',
        reraNumber: 'UPRERAPRJ0000TEST01',
        gstNumber: '09AAACS1234F1ZT',
        contactPhone: '+919876500005',
    },
];
const testFranchiseOwners = [
    {
        ownerUserId: 'test_franchise_001',
        ownerName: 'Vikram Patel',
        ownerEmail: 'test_vikram.patel@propla.in',
        ownerPhone: '+919876500006',
    },
];
async function seedTestUsers(prisma, cityIdMap) {
    const lucknowId = cityIdMap['Lucknow'];
    if (!lucknowId) {
        throw new Error('Lucknow city must be seeded before test users');
    }
    // ── Seed Agents ──
    for (const agent of testAgents) {
        await prisma.agent.upsert({
            where: { userId: agent.userId },
            update: {
                name: agent.name,
                phone: agent.phone,
                expertiseTags: agent.expertiseTags,
                isActive: true,
            },
            create: {
                userId: agent.userId,
                cityId: lucknowId,
                name: agent.name,
                phone: agent.phone,
                expertiseTags: agent.expertiseTags,
                isActive: true,
                trainingCompleted: true,
            },
        });
    }
    console.log(`Seeded ${testAgents.length} test agents`);
    // ── Seed Dealers ──
    for (const dealer of testDealers) {
        await prisma.dealer.upsert({
            where: { userId: dealer.userId },
            update: {
                businessName: dealer.businessName,
            },
            create: {
                userId: dealer.userId,
                cityId: lucknowId,
                businessName: dealer.businessName,
                dealerStatus: 'ACTIVE',
                currentTier: 'BRONZE',
            },
        });
    }
    console.log(`Seeded ${testDealers.length} test dealers`);
    // ── Seed Lawyers ──
    for (const lawyer of testLawyers) {
        await prisma.lawyer.upsert({
            where: { userId: lawyer.userId },
            update: {
                barCouncilNumber: lawyer.barCouncilNumber,
                stateBarCouncil: lawyer.stateBarCouncil,
            },
            create: {
                userId: lawyer.userId,
                cityId: lucknowId,
                barCouncilNumber: lawyer.barCouncilNumber,
                stateBarCouncil: lawyer.stateBarCouncil,
                admissionYear: lawyer.admissionYear,
                practicingCertUrl: lawyer.practicingCertUrl,
                lawyerStatus: 'VERIFIED',
                lawyerTier: 'STANDARD',
            },
        });
    }
    console.log(`Seeded ${testLawyers.length} test lawyers`);
    // ── Seed Builders ──
    for (const builder of testBuilders) {
        await prisma.builder.upsert({
            where: { userId: builder.userId },
            update: {
                companyName: builder.companyName,
                gstNumber: builder.gstNumber,
            },
            create: {
                userId: builder.userId,
                cityId: lucknowId,
                companyName: builder.companyName,
                reraNumber: builder.reraNumber,
                gstNumber: builder.gstNumber,
                contactPhone: builder.contactPhone,
                status: 'VERIFIED',
            },
        });
    }
    console.log(`Seeded ${testBuilders.length} test builders`);
    // ── Seed Franchise Owners ──
    // Franchise has @@unique([cityId]) so only one per city
    for (const fo of testFranchiseOwners) {
        await prisma.franchise.upsert({
            where: { cityId: lucknowId },
            update: {
                ownerName: fo.ownerName,
                ownerEmail: fo.ownerEmail,
                ownerPhone: fo.ownerPhone,
            },
            create: {
                cityId: lucknowId,
                ownerUserId: fo.ownerUserId,
                ownerName: fo.ownerName,
                ownerEmail: fo.ownerEmail,
                ownerPhone: fo.ownerPhone,
                contractTerms: {
                    revenueShareBps: 2500,
                    contractDurationMonths: 36,
                    minimumGuarantee: false,
                    territory: 'Lucknow Municipal Corporation',
                },
                isActive: true,
            },
        });
    }
    console.log(`Seeded ${testFranchiseOwners.length} test franchise owners`);
    console.log('Test user summary (Firebase Auth UIDs for development):');
    console.log('  customer:        test_customer_001   (+919876500000)');
    console.log('  agent:           test_agent_001      (+919876500001)');
    console.log('  dealer:          test_dealer_001     (+919876500002)');
    console.log('  ops:             test_ops_001        (+919876500003)');
    console.log('  support:         test_support_001    (+919876500004)');
    console.log('  builder:         test_builder_001    (+919876500005)');
    console.log('  franchise_owner: test_franchise_001  (+919876500006)');
    console.log('  lawyer:          test_lawyer_001     (+919876500007)');
    console.log('  super_admin:     test_superadmin_001 (+919876500008)');
    console.log('NOTE: customer, ops, support, and super_admin roles have no dedicated DB table.');
    console.log('      They exist only as Firebase Auth custom claims.');
}
//# sourceMappingURL=test-users.seed.js.map