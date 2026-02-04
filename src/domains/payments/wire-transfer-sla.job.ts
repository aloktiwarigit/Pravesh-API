// Story 13-2: Wire Transfer SLA Monitoring pg-boss Job
import { WireTransferService } from './wire-transfer.service.js';

export function registerWireTransferSlaJob(
  boss: any,
  service: WireTransferService
) {
  // Schedule daily at 9 AM IST (3:30 AM UTC)
  boss.schedule('wire-transfer.sla-check', '30 3 * * *');

  boss.work('wire-transfer.sla-check', async () => {
    const expiring = await service.getExpiringSoonTransfers();
    for (const wt of expiring) {
      const daysPending = Math.ceil(
        (Date.now() - wt.createdAt.getTime()) / (1000 * 60 * 60 * 24)
      );
      // Send notification to Ops about SLA-at-risk transfers
      await boss.send('notification.send', {
        type: 'wire_transfer_sla_warning',
        wireTransferId: wt.id,
        referenceCode: wt.referenceCode,
        daysPending,
        amountPaise: wt.amountPaise,
      });
    }
  });
}
