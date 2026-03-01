require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  const CORRECT_UID = '8mS50wN9oJcsDfXjZnPRxnyQmQ93';
  const EMAIL = 'primishra1987@gmail.com';

  // Check if there's already a user with the correct UID
  const existingCorrect = await p.user.findUnique({ where: { firebaseUid: CORRECT_UID } });
  console.log('User with correct UID already?', existingCorrect ? `YES (id: ${existingCorrect.id})` : 'NO');

  // Find user by email
  const user = await p.user.findFirst({ where: { email: EMAIL } });
  if (!user) {
    console.error('User not found by email');
    return;
  }

  console.log('\nCurrent state:');
  console.log('  id:', user.id);
  console.log('  firebaseUid:', user.firebaseUid);
  console.log('  roles:', JSON.stringify(user.roles));
  console.log('  primaryRole:', user.primaryRole);

  if (existingCorrect && existingCorrect.id !== user.id) {
    console.log('\nWARNING: Another user record exists with the correct UID!');
    console.log('  id:', existingCorrect.id);
    console.log('  email:', existingCorrect.email);
    console.log('  roles:', JSON.stringify(existingCorrect.roles));
    return;
  }

  // Update the user with correct UID and sync roles with Firebase claims
  const updated = await p.user.update({
    where: { id: user.id },
    data: {
      firebaseUid: CORRECT_UID,
      roles: ['customer', 'agent'],
      primaryRole: 'agent',
    },
  });

  console.log('\nUpdated:');
  console.log('  firebaseUid:', updated.firebaseUid);
  console.log('  roles:', JSON.stringify(updated.roles));
  console.log('  primaryRole:', updated.primaryRole);

  await p.$disconnect();
}

main().catch(e => { console.error(e); p.$disconnect(); });
