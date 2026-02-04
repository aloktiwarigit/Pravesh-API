import { PrismaClient } from '@prisma/client';

/**
 * Story 12-3: 24-Hour Case Acceptance Timeout
 *
 * When a legal case is created and assigned to a lawyer, a 24-hour
 * timeout job is scheduled. If the lawyer has not accepted or declined
 * the case within 24 hours, Ops is notified to reassign.
 */

export interface LegalCaseTimeoutPayload {
  caseId: string;
  lawyerId: string;
}

export function registerLegalCaseTimeoutJob(boss: any, prisma: PrismaClient) {
  (boss as any).work(
    'legal-case.acceptance-timeout',
    async (job: { data: LegalCaseTimeoutPayload }) => {
      const { caseId, lawyerId } = job.data;

      // Check if case is still in ASSIGNED status (not accepted/declined)
      const legalCase = await prisma.legalCase.findUnique({
        where: { id: caseId },
      });

      if (!legalCase) {
        return; // Case no longer exists
      }

      if (legalCase.caseStatus !== 'ASSIGNED') {
        return; // Already handled (accepted, declined, reassigned)
      }

      // Case is still unresponded after 24 hours
      // Enqueue notification to Ops for reassignment
      await boss.send('notification.send', {
        template: 'legal-case-unresponded',
        recipientRole: 'ops',
        data: {
          caseId,
          caseNumber: legalCase.caseNumber,
          lawyerId,
          message: `Lawyer has not responded to case ${legalCase.caseNumber} within 24 hours. Please reassign.`,
        },
      });
    },
  );
}

/**
 * Schedule a 24-hour timeout when a case is created.
 * Call this after creating a legal case.
 */
export async function scheduleCaseTimeout(
  boss: any,
  caseId: string,
  lawyerId: string,
) {
  const twentyFourHours = 24 * 60 * 60; // seconds
  await boss.send(
    'legal-case.acceptance-timeout',
    { caseId, lawyerId },
    { startAfter: twentyFourHours },
  );
}
