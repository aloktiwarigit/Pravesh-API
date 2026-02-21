// Story 13-7: POA Expiry Check Scheduled Job
import { PoaVerificationService } from './poa-verification.service.js';

export async function registerPoaExpiryJob(
  boss: any, // PgBoss instance - namespace import cannot be used as type
  service: PoaVerificationService
) {
  await boss.createQueue('poa.expiry-check');

  // Schedule daily at midnight UTC
  await boss.schedule('poa.expiry-check', '0 0 * * *');

  await boss.work('poa.expiry-check', async () => {
    await service.checkPoaExpiry();
  });
}
