"use strict";
/**
 * Seed Orchestrator
 * Runs all seed files in dependency order.
 * Idempotent -- safe to run multiple times (all seeds use upsert).
 *
 * Usage:
 *   npx ts-node prisma/seed.ts
 *   npm run seed
 */
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const cities_seed_1 = require("./seeds/cities.seed");
const service_definitions_seed_1 = require("./seeds/service-definitions.seed");
const roles_seed_1 = require("./seeds/roles.seed");
const test_users_seed_1 = require("./seeds/test-users.seed");
const notification_templates_seed_1 = require("./seeds/notification-templates.seed");
const support_templates_seed_1 = require("./seeds/support-templates.seed");
const prisma = new client_1.PrismaClient();
async function main() {
    console.log('=== Property Legal Agent -- Database Seed ===\n');
    const startTime = Date.now();
    // ── Phase 1: Foundation data (no dependencies) ──
    console.log('--- Phase 1: Foundation ---');
    const cityIdMap = await (0, cities_seed_1.seedCities)(prisma);
    await (0, roles_seed_1.seedRoles)();
    // ── Phase 2: Service catalog (depends on cities) ──
    console.log('\n--- Phase 2: Service Catalog ---');
    await (0, service_definitions_seed_1.seedServiceDefinitions)(prisma, cityIdMap);
    // ── Phase 3: Templates (no FK dependencies but logically grouped) ──
    console.log('\n--- Phase 3: Notification & Support Templates ---');
    await (0, notification_templates_seed_1.seedNotificationTemplates)(prisma);
    // Support templates seed uses create() not upsert(), so guard against duplicates
    const existingSupportTemplates = await prisma.supportTemplate.count();
    if (existingSupportTemplates === 0) {
        await (0, support_templates_seed_1.seedSupportTemplates)('system-seed');
    }
    else {
        console.log(`Support templates already seeded (${existingSupportTemplates} found) -- skipping`);
    }
    // ── Phase 4: Test users (depends on cities) ──
    console.log('\n--- Phase 4: Test Users ---');
    await (0, test_users_seed_1.seedTestUsers)(prisma, cityIdMap);
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
//# sourceMappingURL=seed.js.map