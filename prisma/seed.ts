/**
 * Seed Orchestrator
 * Runs all seed files in dependency order.
 * Idempotent -- safe to run multiple times (all seeds use upsert).
 *
 * Usage:
 *   npx ts-node prisma/seed.ts
 *   npm run seed
 */

import { PrismaClient } from '@prisma/client';
import { seedCities } from './seeds/cities.seed';
import { seedServiceDefinitions } from './seeds/service-definitions.seed';
import { seedRoles } from './seeds/roles.seed';
import { seedTestUsers } from './seeds/test-users.seed';
import { seedNotificationTemplates } from './seeds/notification-templates.seed';
import { seedSupportTemplates } from './seeds/support-templates.seed';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  console.log('=== Property Legal Agent -- Database Seed ===\n');

  const startTime = Date.now();

  // ── Phase 1: Foundation data (no dependencies) ──
  console.log('--- Phase 1: Foundation ---');

  const cityIdMap = await seedCities(prisma);
  await seedRoles();

  // ── Phase 2: Service catalog (depends on cities) ──
  console.log('\n--- Phase 2: Service Catalog ---');

  await seedServiceDefinitions(prisma, cityIdMap);

  // ── Phase 3: Templates (no FK dependencies but logically grouped) ──
  console.log('\n--- Phase 3: Notification & Support Templates ---');

  await seedNotificationTemplates(prisma);

  // Support templates seed uses create() not upsert(), so guard against duplicates
  const existingSupportTemplates = await prisma.supportTemplate.count();
  if (existingSupportTemplates === 0) {
    await seedSupportTemplates('system-seed');
  } else {
    console.log(`Support templates already seeded (${existingSupportTemplates} found) -- skipping`);
  }

  // ── Phase 4: Test users (depends on cities) ──
  console.log('\n--- Phase 4: Test Users ---');

  await seedTestUsers(prisma, cityIdMap);

  const elapsed = Date.now() - startTime;
  console.log(`\n=== Seed completed in ${elapsed}ms ===`);
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
