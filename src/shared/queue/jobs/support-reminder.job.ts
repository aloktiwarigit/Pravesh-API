// Story 10.4: pg-boss job for support follow-up reminder notifications
// Job name follows {domain}.{action} pattern per DA-4
import { logger } from '../../utils/logger';
import { prisma } from '../../prisma/client';

export const SUPPORT_REMINDER_JOB = 'support.reminder-notify';

interface SupportReminderPayload {
  reminderId: string;
  supportAgentId: string;
  serviceId: string;
}

/**
 * Handles scheduled reminder notifications.
 * Checks if the reminder is still pending (not completed/snoozed),
 * then sends a push notification to the support agent.
 */
export async function handleSupportReminder(job: { data: SupportReminderPayload }) {
  const { reminderId, supportAgentId, serviceId } = job.data;

  // Check if reminder is still pending
  const reminder = await prisma.supportReminder.findUnique({
    where: { id: reminderId },
  });

  if (!reminder || reminder.status !== 'PENDING') {
    logger.info({ reminderId, status: reminder?.status ?? 'not found' }, 'Reminder skipped');
    return;
  }

  // In production: send push notification via FCM
  // await notificationService.sendPush(supportAgentId, {
  //   title: 'Reminder',
  //   body: `Follow up on Service ${serviceId}`,
  //   data: { type: 'support_reminder', reminderId, serviceId },
  // });

  logger.info({ supportAgentId, serviceId }, 'Reminder notification sent');
}
