require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  // Check user record
  const user = await p.user.findFirst({
    where: { email: 'primishra1987@gmail.com' },
    select: { id: true, displayName: true, email: true, phone: true, roles: true, primaryRole: true, status: true, cityId: true, firebaseUid: true }
  });
  console.log('User record:', JSON.stringify(user, null, 2));

  if (!user) {
    console.log('\nUser not found in database.');
    await p.$disconnect();
    return;
  }

  // Check if there's an Agent record linked to this user
  const agent = await p.agent.findFirst({
    where: { userId: user.id },
    select: { id: true, name: true, phone: true, cityId: true, isActive: true, userId: true }
  });
  console.log('\nAgent record:', JSON.stringify(agent, null, 2));

  // Also check by firebaseUid
  const agentByFbUid = await p.agent.findFirst({
    where: { userId: user.firebaseUid },
    select: { id: true, name: true, phone: true, cityId: true, isActive: true, userId: true }
  });
  console.log('Agent by firebaseUid:', JSON.stringify(agentByFbUid, null, 2));

  await p.$disconnect();
}

main().catch(e => { console.error(e); p.$disconnect(); });
