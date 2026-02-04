// Story 13-7: POA Expiry Check Scheduled Job
import { PoaVerificationService } from './poa-verification.service.js';

export function registerPoaExpiryJob(
  boss: any, // PgBoss instance - namespace import cannot be used as type
  service: PoaVerificationService
) {
  // Schedule daily at midnight UTC
  boss.schedule('poa.expiry-check', '0 0 * * *');

  boss.work('poa.expiry-check', async () => {
    await service.checkPoaExpiry();
  });
}
