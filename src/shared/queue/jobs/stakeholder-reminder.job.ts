// Story 6.11c: pg-boss job for stakeholder document upload reminders
// Job name follows {domain}.{action} pattern per DA-4
import { logger } from '../../utils/logger';
import { prisma } from '../../prisma/client';

export const STAKEHOLDER_REMINDER_JOB = 'stakeholder.document-reminder';

/**
 * Daily scheduled job that sends reminders to stakeholders who haven't
 * uploaded required documents.
 * AC1: Send reminder at day 7 and day 14 after invitation acceptance
 * AC2: Only remind stakeholders with status 'accepted' and pending documents
 * AC3: Use WhatsApp notification channel
 */
export async function handleStakeholderReminder() {
  const now = new Date();
  const day7Ago = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const day14Ago = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  const day7Window = new Date(day7Ago.getTime() - 24 * 60 * 60 * 1000);
  const day14Window = new Date(day14Ago.getTime() - 24 * 60 * 60 * 1000);

  try {
    // Find stakeholders who accepted 7 days ago (within a 24h window)
    const day7Stakeholders = await prisma.serviceStakeholder.findMany({
      where: {
        status: 'accepted',
        acceptedAt: { gte: day7Window, lte: day7Ago },
      },
    });

    // Find stakeholders who accepted 14 days ago (within a 24h window)
    const day14Stakeholders = await prisma.serviceStakeholder.findMany({
      where: {
        status: 'accepted',
        acceptedAt: { gte: day14Window, lte: day14Ago },
      },
    });

    const allStakeholders = [
      ...day7Stakeholders.map((s) => ({ ...s, reminderDay: 7 })),
      ...day14Stakeholders.map((s) => ({ ...s, reminderDay: 14 })),
    ];

    let sentCount = 0;

    for (const stakeholder of allStakeholders) {
      // Check if stakeholder still has pending documents
      const pendingDocs = await prisma.document.count({
        where: {
          serviceInstanceId: stakeholder.serviceInstanceId,
          uploadedBy: stakeholder.userId || undefined,
          verificationStatus: { in: ['pending', 'needs_review', 'rejected'] },
        },
      });

      if (pendingDocs === 0) continue; // All documents are verified, skip

      // Find the primary applicant name for the notification
      const primary = await prisma.serviceStakeholder.findFirst({
        where: { serviceInstanceId: stakeholder.serviceInstanceId, role: 'primary' },
      });

      // Queue WhatsApp reminder via ServiceCommunication
      // ServiceCommunication has: serviceInstanceId, communicationType, channel, messageTemplate, messageContent, metadata, deliveryStatus
      await prisma.serviceCommunication.create({
        data: {
          serviceInstanceId: stakeholder.serviceInstanceId,
          communicationType: 'auto_reassurance',
          channel: 'whatsapp',
          messageTemplate: 'stakeholder-document-reminder',
          messageContent: `Reminder for ${stakeholder.name}: pending documents`,
          deliveryStatus: 'pending',
          metadata: {
            stakeholderId: stakeholder.id,
            recipientPhone: stakeholder.phone,
            reminderDay: stakeholder.reminderDay,
            pendingDocuments: pendingDocs,
            customerName: primary?.name || 'Customer',
            deepLink: `https://app.propertylegal.in/join/${stakeholder.serviceInstanceId}`,
          },
        },
      });

      sentCount++;
    }

    logger.info(
      { sentCount, day7: day7Stakeholders.length, day14: day14Stakeholders.length },
      '[stakeholder-reminder] Sent reminders',
    );
  } catch (error: unknown) {
    logger.error({ err: error }, '[stakeholder-reminder] Failed');
    throw error;
  }
}
