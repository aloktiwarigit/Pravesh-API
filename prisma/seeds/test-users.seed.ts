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

import { PrismaClient } from '@prisma/client';

const SYSTEM_USER_ID = 'system-seed';

interface TestAgent {
  userId: string;
  name: string;
  phone: string;
  expertiseTags: string[];
}

interface TestDealer {
  userId: string;
  businessName: string;
}

interface TestLawyer {
  userId: string;
  barCouncilNumber: string;
  stateBarCouncil: string;
  admissionYear: number;
  practicingCertUrl: string;
}

interface TestBuilder {
  userId: string;
  companyName: string;
  reraNumber: string;
  gstNumber: string;
  contactPhone: string;
}

interface TestFranchise {
  ownerUserId: string;
  ownerName: string;
  ownerEmail: string;
  ownerPhone: string;
}

const testAgents: TestAgent[] = [
  {
    userId: 'test_agent_001',
    name: 'Rajesh Kumar',
    phone: '+919876500001',
    expertiseTags: ['mutation', 'registry', 'title_search'],
  },
];

const testDealers: TestDealer[] = [
  {
    userId: 'test_dealer_001',
    businessName: 'Sharma Property Consultants',
  },
];

const testLawyers: TestLawyer[] = [
  {
    userId: 'test_lawyer_001',
    barCouncilNumber: 'UP/1234/2015',
    stateBarCouncil: 'Bar Council of Uttar Pradesh',
    admissionYear: 2015,
    practicingCertUrl: 'https://storage.example.com/test/practicing_cert_001.pdf',
  },
];

const testBuilders: TestBuilder[] = [
  {
    userId: 'test_builder_001',
    companyName: 'Sunrise Developers Pvt Ltd',
    reraNumber: 'UPRERAPRJ0000TEST01',
    gstNumber: '09AAACS1234F1ZT',
    contactPhone: '+919876500005',
  },
];

const testFranchiseOwners: TestFranchise[] = [
  {
    ownerUserId: 'test_franchise_001',
    ownerName: 'Vikram Patel',
    ownerEmail: 'test_vikram.patel@propla.in',
    ownerPhone: '+919876500006',
  },
];

interface TestUser {
  firebaseUid: string;
  phone: string;
  displayName: string;
  roles: string[];
  primaryRole: string;
}

const testUsers: TestUser[] = [
  { firebaseUid: 'test_customer_001', phone: '+919876500000', displayName: 'Test Customer', roles: ['customer'], primaryRole: 'customer' },
  { firebaseUid: 'test_agent_001', phone: '+919876500001', displayName: 'Rajesh Kumar', roles: ['agent'], primaryRole: 'agent' },
  { firebaseUid: 'test_dealer_001', phone: '+919876500002', displayName: 'Test Dealer', roles: ['dealer'], primaryRole: 'dealer' },
  { firebaseUid: 'test_ops_001', phone: '+919876500003', displayName: 'Test Ops Manager', roles: ['ops_manager'], primaryRole: 'ops_manager' },
  { firebaseUid: 'test_support_001', phone: '+919876500004', displayName: 'Test Support', roles: ['support'], primaryRole: 'support' },
  { firebaseUid: 'test_builder_001', phone: '+919876500005', displayName: 'Sunrise Developers', roles: ['builder'], primaryRole: 'builder' },
  { firebaseUid: 'test_franchise_001', phone: '+919876500006', displayName: 'Vikram Patel', roles: ['franchise_owner'], primaryRole: 'franchise_owner' },
  { firebaseUid: 'test_lawyer_001', phone: '+919876500007', displayName: 'Test Lawyer', roles: ['lawyer'], primaryRole: 'lawyer' },
  { firebaseUid: 'test_superadmin_001', phone: '+919876500008', displayName: 'Test Super Admin', roles: ['super_admin'], primaryRole: 'super_admin' },
];

export async function seedTestUsers(
  prisma: PrismaClient,
  cityIdMap: Record<string, string>,
): Promise<void> {
  const lucknowId = cityIdMap['Lucknow'];
  if (!lucknowId) {
    throw new Error('Lucknow city must be seeded before test users');
  }

  // ── Seed User records (all test roles) ──
  for (const tu of testUsers) {
    await prisma.user.upsert({
      where: { firebaseUid: tu.firebaseUid },
      update: {
        displayName: tu.displayName,
        roles: tu.roles,
        primaryRole: tu.primaryRole,
        status: 'ACTIVE',
      },
      create: {
        firebaseUid: tu.firebaseUid,
        phone: tu.phone,
        displayName: tu.displayName,
        roles: tu.roles,
        primaryRole: tu.primaryRole,
        cityId: lucknowId,
        status: 'ACTIVE',
        languagePref: 'en',
      },
    });
  }
  console.log(`Seeded ${testUsers.length} User records`);

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

  // ── Seed Sample Service Requests (for dev E2E testing) ──
  // Look up the test agent and customer User records
  const customerUser = await prisma.user.findUnique({ where: { firebaseUid: 'test_customer_001' } });
  const agentRecord = await prisma.agent.findUnique({ where: { userId: 'test_agent_001' } });

  // Find a service definition (Title Search) to link instances to
  const titleSearchDef = await prisma.serviceDefinition.findFirst({
    where: { code: 'PRE-001', cityId: lucknowId },
  });

  if (customerUser && titleSearchDef) {
    // Use deterministic IDs so upserts are idempotent
    const instanceIds = [
      'a0000000-0000-4000-8000-000000000001',
      'a0000000-0000-4000-8000-000000000002',
      'a0000000-0000-4000-8000-000000000003',
    ];
    const requestIds = [
      'b0000000-0000-4000-8000-000000000001',
      'b0000000-0000-4000-8000-000000000002',
      'b0000000-0000-4000-8000-000000000003',
    ];

    // Instance 1: pending (no agent yet)
    await prisma.serviceInstance.upsert({
      where: { id: instanceIds[0] },
      update: {},
      create: {
        id: instanceIds[0],
        serviceDefinitionId: titleSearchDef.id,
        customerId: customerUser.id,
        cityId: lucknowId,
        state: 'requested',
        propertyAddress: '123 Hazratganj, Lucknow',
        propertyType: 'residential',
        propertyCity: 'Lucknow',
      },
    });
    await prisma.serviceRequest.upsert({
      where: { id: requestIds[0] },
      update: {},
      create: {
        id: requestIds[0],
        serviceInstanceId: instanceIds[0],
        customerId: customerUser.id,
        cityId: lucknowId,
        status: 'pending',
        requestNumber: 'REQ-TEST-001',
        customerName: 'Test Customer',
        customerPhone: '+919876500000',
        serviceName: 'Title Search & Verification',
        serviceCode: 'PRE-001',
        propertyAddress: '123 Hazratganj, Lucknow',
      },
    });

    // Instance 2: assigned to test agent
    if (agentRecord) {
      await prisma.serviceInstance.upsert({
        where: { id: instanceIds[1] },
        update: {},
        create: {
          id: instanceIds[1],
          serviceDefinitionId: titleSearchDef.id,
          customerId: customerUser.id,
          assignedAgentId: agentRecord.id,
          cityId: lucknowId,
          state: 'assigned',
          propertyAddress: '45 Gomti Nagar, Lucknow',
          propertyType: 'residential',
          propertyCity: 'Lucknow',
        },
      });
      await prisma.serviceRequest.upsert({
        where: { id: requestIds[1] },
        update: {},
        create: {
          id: requestIds[1],
          serviceInstanceId: instanceIds[1],
          customerId: customerUser.id,
          assignedAgentId: agentRecord.id,
          cityId: lucknowId,
          status: 'assigned',
          requestNumber: 'REQ-TEST-002',
          customerName: 'Test Customer',
          customerPhone: '+919876500000',
          serviceName: 'Title Search & Verification',
          serviceCode: 'PRE-001',
          propertyAddress: '45 Gomti Nagar, Lucknow',
        },
      });
    }

    // Instance 3: completed
    await prisma.serviceInstance.upsert({
      where: { id: instanceIds[2] },
      update: {},
      create: {
        id: instanceIds[2],
        serviceDefinitionId: titleSearchDef.id,
        customerId: customerUser.id,
        assignedAgentId: agentRecord?.id,
        cityId: lucknowId,
        state: 'completed',
        propertyAddress: '78 Aliganj, Lucknow',
        propertyType: 'commercial',
        propertyCity: 'Lucknow',
      },
    });
    await prisma.serviceRequest.upsert({
      where: { id: requestIds[2] },
      update: {},
      create: {
        id: requestIds[2],
        serviceInstanceId: instanceIds[2],
        customerId: customerUser.id,
        assignedAgentId: agentRecord?.id,
        cityId: lucknowId,
        status: 'completed',
        requestNumber: 'REQ-TEST-003',
        customerName: 'Test Customer',
        customerPhone: '+919876500000',
        serviceName: 'Title Search & Verification',
        serviceCode: 'PRE-001',
        propertyAddress: '78 Aliganj, Lucknow',
      },
    });

    console.log('Seeded 3 sample service instances + requests');
  } else {
    console.log('Skipped service request seeding (missing customer user or service definition)');
  }

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
}
