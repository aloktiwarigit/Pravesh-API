/**
 * Promotes a user (by email) to ops + ops_manager roles.
 *
 * Usage:
 *   npx ts-node scripts/promote-ops-admin.ts
 */

import { PrismaClient } from '@prisma/client';
import admin from 'firebase-admin';

const EMAIL = 'aloktiwari0630@yahoo.com';

async function main() {
  // Initialize Firebase Admin
  if (
    process.env.FIREBASE_PROJECT_ID &&
    process.env.FIREBASE_CLIENT_EMAIL &&
    process.env.FIREBASE_PRIVATE_KEY
  ) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      }),
    });
  } else {
    console.error('Firebase credentials not found in env — will update DB only (re-login will sync claims)');
  }

  const prisma = new PrismaClient();

  try {
    // Find the user by email
    const user = await prisma.user.findFirst({ where: { email: EMAIL } });

    if (!user) {
      console.error(`\nUser with email ${EMAIL} not found.`);
      console.error('Please register/login through the app first, then re-run this script.\n');
      process.exit(1);
    }

    console.log(`\nFound user:`);
    console.log(`  ID:      ${user.id}`);
    console.log(`  Name:    ${user.displayName}`);
    console.log(`  Phone:   ${user.phone}`);
    console.log(`  Email:   ${user.email}`);
    console.log(`  Current: roles=${JSON.stringify(user.roles)}, primaryRole=${user.primaryRole}`);

    // Add ops + ops_manager (keep existing roles)
    const newRoles = Array.from(new Set([...user.roles, 'ops', 'ops_manager']));
    const primaryRole = 'ops_manager';

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        roles: newRoles,
        primaryRole,
        status: 'ACTIVE',
      },
    });

    console.log(`\n  Updated: roles=${JSON.stringify(updated.roles)}, primaryRole=${updated.primaryRole}`);

    // Sync Firebase custom claims
    if (admin.apps && admin.apps.length > 0) {
      try {
        await admin.auth().setCustomUserClaims(user.firebaseUid, {
          roles: newRoles,
          primaryRole,
          cityId: user.cityId,
        });
        console.log('  Firebase claims synced successfully');
      } catch (err) {
        console.error('  Firebase claims sync failed (re-login will fix this):', err);
      }
    }

    console.log('\nDone! Log out and log back in to activate ops admin access.\n');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('Promote failed:', err);
  process.exit(1);
});
