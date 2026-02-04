/**
 * Roles Seed -- SKIPPED
 *
 * The Prisma schema does not define a Role or Permission table.
 * Roles in this application are managed externally (Firebase Auth custom claims
 * or application-level role strings like 'customer', 'agent', 'dealer', 'ops',
 * 'support', 'builder', 'lawyer', 'franchise_owner', 'super_admin').
 *
 * No database seeding is required for roles.
 * This file exists as a placeholder for documentation purposes.
 */

export async function seedRoles(): Promise<void> {
  console.log('Roles are enum/claim-based (no Role table in schema) -- skipping roles seed');
}
