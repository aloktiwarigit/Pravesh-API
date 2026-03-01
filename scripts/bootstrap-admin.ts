/**
 * One-time bootstrap script: Promotes a user to super_admin.
 *
 * Usage:
 *   npx ts-node scripts/bootstrap-admin.ts
 *
 * Prerequisites:
 *   - The user must have already registered/logged in through the app
 *   - .env must have DATABASE_URL and Firebase credentials
 *
 * After running:
 *   - The user logs out and logs back in → Firebase claims auto-sync
 *   - The user now sees the super_admin / admin panel view
 */

import { PrismaClient } from '@prisma/client';
import admin from 'firebase-admin';

const PHONE = '+12247151714'; // Alok's phone number

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
    // Find the user
    const user = await prisma.user.findUnique({ where: { phone: PHONE } });

    if (!user) {
      console.error(`\nUser with phone ${PHONE} not found.`);
      console.error('Please register/login through the app first, then re-run this script.\n');
      process.exit(1);
    }

    console.log(`\nFound user:`);
    console.log(`  ID:      ${user.id}`);
    console.log(`  Name:    ${user.displayName}`);
    console.log(`  Phone:   ${user.phone}`);
    console.log(`  Current: roles=${JSON.stringify(user.roles)}, primaryRole=${user.primaryRole}`);

    // Promote to super_admin (keep existing roles + add super_admin)
    const newRoles = Array.from(new Set([...user.roles, 'super_admin']));

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        roles: newRoles,
        primaryRole: 'super_admin',
        status: 'ACTIVE',
      },
    });

    console.log(`\n  Updated: roles=${JSON.stringify(updated.roles)}, primaryRole=${updated.primaryRole}`);

    // Sync Firebase custom claims
    if (admin.apps && admin.apps.length > 0) {
      try {
        await admin.auth().setCustomUserClaims(user.firebaseUid, {
          roles: newRoles,
          primaryRole: 'super_admin',
          cityId: user.cityId,
        });
        console.log('  Firebase claims synced successfully');
      } catch (err) {
        console.error('  Firebase claims sync failed (re-login will fix this):', err);
      }
    }

    console.log('\nDone! Log out and log back in to activate super_admin access.\n');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('Bootstrap failed:', err);
  process.exit(1);
});
