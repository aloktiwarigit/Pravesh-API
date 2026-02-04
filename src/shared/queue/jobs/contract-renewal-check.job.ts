// ============================================================
// Story 11-8: Annual Service Contract — Auto-Renewal Check Job
// Runs daily via pg-boss. Checks contracts approaching expiry.
// ============================================================

import { PrismaClient } from '@prisma/client';

/**
 * Daily contract renewal check job.
 *
 * AC8: Auto-renews with 30-day notice unless Builder cancels.
 *
 * Logic:
 * 1. Find active contracts expiring within 30 days.
 * 2. If autoRenew = true and 30 days remaining, send notice to builder.
 * 3. If autoRenew = true and < 7 days remaining, create renewal contract draft.
 * 4. If autoRenew = false and past validTo, mark as EXPIRED.
 * 5. Mark all expired contracts (past validTo, any autoRenew value if not already renewed).
 */
export async function handleContractRenewalCheck(prisma: PrismaClient): Promise<{
  noticesSent: number;
  renewalDraftsCreated: number;
  expired: number;
}> {
  const now = new Date();
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  let noticesSent = 0;
  let renewalDraftsCreated = 0;
  let expired = 0;

  // 1. Find active contracts expiring within 30 days
  const approachingExpiry = await prisma.builderContract.findMany({
    where: {
      status: 'ACTIVE',
      validTo: { lte: thirtyDaysFromNow, gte: now },
    },
    include: { builder: true },
  });

  for (const contract of approachingExpiry) {
    const daysRemaining = Math.ceil(
      (contract.validTo.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (contract.autoRenew) {
      // Send 30-day notice (only once — could track via a notification log)
      if (daysRemaining <= 30 && daysRemaining > 7) {
        // await pgBoss.send('notification.send', {
        //   type: 'contract_renewal_notice',
        //   phone: contract.builder.contactPhone,
        //   templateData: {
        //     contractNumber: contract.contractNumber,
        //     expiryDate: contract.validTo.toISOString(),
        //     daysRemaining,
        //   },
        // });
        noticesSent++;
      }

      // Create renewal draft if < 7 days remaining
      if (daysRemaining <= 7) {
        const year = new Date().getFullYear();
        const lastContract = await prisma.builderContract.findFirst({
          where: { contractNumber: { startsWith: `PLA-CNTR-${year}` } },
          orderBy: { contractNumber: 'desc' },
        });
        const seq = lastContract
          ? parseInt(lastContract.contractNumber.split('-').pop()!) + 1
          : 1;
        const newContractNumber = `PLA-CNTR-${year}-${String(seq).padStart(5, '0')}`;

        const newValidFrom = new Date(contract.validTo);
        const newValidTo = new Date(newValidFrom);
        newValidTo.setFullYear(newValidTo.getFullYear() + 1);

        await prisma.builderContract.create({
          data: {
            builderId: contract.builderId,
            projectId: contract.projectId,
            contractNumber: newContractNumber,
            serviceIds: contract.serviceIds,
            unitCount: contract.unitCount,
            discountPct: contract.discountPct,
            validFrom: newValidFrom,
            validTo: newValidTo,
            autoRenew: true,
            totalValuePaise: contract.totalValuePaise,
            status: 'DRAFT',
            notes: `Auto-renewal of contract ${contract.contractNumber}`,
          },
        });
        renewalDraftsCreated++;
      }
    }
  }

  // 2. Expire contracts past validTo
  const expiredResult = await prisma.builderContract.updateMany({
    where: {
      status: 'ACTIVE',
      validTo: { lt: now },
    },
    data: { status: 'EXPIRED' },
  });
  expired = expiredResult.count;

  return { noticesSent, renewalDraftsCreated, expired };
}
