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
export declare function seedTestUsers(prisma: PrismaClient, cityIdMap: Record<string, string>): Promise<void>;
//# sourceMappingURL=test-users.seed.d.ts.map