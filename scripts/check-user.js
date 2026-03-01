const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  const u = await p.user.findFirst({
    where: { email: 'aloktiwari0630@yahoo.com' },
    select: { id: true, cityId: true, roles: true, primaryRole: true, status: true, firebaseUid: true }
  });
  console.log(JSON.stringify(u, null, 2));

  // Also list available cities
  const cities = await p.city.findMany({ select: { id: true, name: true }, take: 10 });
  console.log('\nAvailable cities:');
  console.log(JSON.stringify(cities, null, 2));

  await p.$disconnect();
}

main().catch(e => { console.error(e); p.$disconnect(); });
