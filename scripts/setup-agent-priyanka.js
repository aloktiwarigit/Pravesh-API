require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const admin = require('firebase-admin');

const p = new PrismaClient();

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    }),
  });
}

const CORRECT_USER_ID = 'b3cb832e-2ae0-4dc5-93b6-8f7d99d667b4';
const STALE_USER_ID = '5ad7e5c7-7af5-4e40-a1c5-eeb1248a594a';
const FIREBASE_UID = '8mS50wN9oJcsDfXjZnPRxnyQmQ93';
const LUCKNOW_CITY_ID = 'c842d713-59f0-44c3-adc9-8ff7809ac5c4';

async function main() {
  // 1. Delete the stale duplicate user record
  try {
    const stale = await p.user.findUnique({ where: { id: STALE_USER_ID } });
    if (stale) {
      await p.user.delete({ where: { id: STALE_USER_ID } });
      console.log('Deleted stale user record:', STALE_USER_ID);
    } else {
      console.log('Stale user record already gone');
    }
  } catch (e) {
    console.log('Could not delete stale user (may have FK constraints):', e.message);
  }

  // 2. Update the correct user record with cityId
  const user = await p.user.update({
    where: { id: CORRECT_USER_ID },
    data: {
      cityId: LUCKNOW_CITY_ID,
      roles: ['customer', 'agent'],
      primaryRole: 'agent',
      status: 'ACTIVE',
    },
  });
  console.log('\nUpdated user:');
  console.log('  id:', user.id);
  console.log('  roles:', JSON.stringify(user.roles));
  console.log('  primaryRole:', user.primaryRole);
  console.log('  cityId:', user.cityId);

  // 3. Create Agent record
  const agent = await p.agent.create({
    data: {
      userId: CORRECT_USER_ID,
      cityId: LUCKNOW_CITY_ID,
      name: user.displayName || 'Priyanka Mishra',
      phone: user.phone,
      isActive: true,
      maxConcurrentTasks: 5,
    },
  });
  console.log('\nCreated Agent record:');
  console.log('  id:', agent.id);
  console.log('  name:', agent.name);
  console.log('  cityId:', agent.cityId);
  console.log('  isActive:', agent.isActive);

  // 4. Sync Firebase claims
  await admin.auth().setCustomUserClaims(FIREBASE_UID, {
    roles: ['customer', 'agent'],
    primaryRole: 'agent',
    cityId: LUCKNOW_CITY_ID,
  });
  console.log('\nFirebase claims synced');

  console.log('\nDone! User should log out and log back in.');
  await p.$disconnect();
}

main().catch(e => { console.error('Failed:', e); p.$disconnect(); });
