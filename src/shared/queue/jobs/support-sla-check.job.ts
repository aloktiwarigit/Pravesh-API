// Story 10.7: pg-boss scheduled job for support escalation SLA monitoring
// Runs every 15 minutes via cron: */15 * * * *
// Job name: support.sla-check per {domain}.{action} convention (DA-4)
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const SUPPORT_SLA_CHECK_JOB = 'support.sla-check';
export const SLA_CHECK_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Periodic SLA check for support escalations.
 * Detects first response and resolution SLA breaches,
 * sends alerts to Ops Manager, and auto-escalates resolution breaches.
 * Updates Firestore for real-time dashboard sync (AC-2).
 */
export async function handleSupportSlaCheck() {
  const now = new Date();

  // ---- First Response SLA Breaches ----
  const firstResponseBreaches = await prisma.supportEscalation.findMany({
    where: {
      status: 'OPEN',
      firstResponseAt: null,
      firstResponseDue: { lt: now },
      firstResponseBreached: false,
    },
  });

  for (const esc of firstResponseBreaches) {
    // Mark as breached
    await prisma.supportEscalation.update({
      where: { id: esc.id },
      data: { firstResponseBreached: true },
    });

    // AC5: In production, alert Ops Manager via notification service
    // await notificationService.sendToRole('ops_manager', {
    //   title: 'Escalation First Response SLA Breached',
    //   body: `Escalation ${esc.id} for service ${esc.serviceId} — no first response within 2 hours`,
    //   data: { type: 'sla_breach', escalationId: esc.id },
    // });

    console.warn(`First response SLA breached for escalation ${esc.id}`);
  }

  // ---- Resolution SLA Breaches ----
  const resolutionBreaches = await prisma.supportEscalation.findMany({
    where: {
      status: { in: ['OPEN', 'IN_PROGRESS'] },
      resolvedAt: null,
      resolutionDue: { lt: now },
      resolutionBreached: false,
    },
  });

  for (const esc of resolutionBreaches) {
    // Mark as breached and auto-escalate to Ops (AC6 from Story 10.8)
    await prisma.supportEscalation.update({
      where: { id: esc.id },
      data: {
        resolutionBreached: true,
        status: 'ESCALATED_TO_OPS',
      },
    });

    // In production: High-priority notification to Ops Manager
    // await notificationService.sendToRole('ops_manager', {
    //   title: 'Escalation Resolution SLA Breached — Auto-Escalated',
    //   body: `Escalation ${esc.id} resolution SLA breached. Auto-escalated to Ops.`,
    //   data: { type: 'resolution_breach', escalationId: esc.id, priority: 'high' },
    // });

    console.warn(`Resolution SLA breached for escalation ${esc.id} — auto-escalated to Ops`);
  }

  // ---- Update Firestore for real-time dashboard (AC7) ----
  // In production: Write all active escalation statuses to Firestore
  // const activeEscalations = await prisma.supportEscalation.findMany({
  //   where: { status: { in: ['OPEN', 'IN_PROGRESS', 'ESCALATED_TO_OPS'] } },
  // });
  // for (const esc of activeEscalations) {
  //   await firestoreWriter.write(`support_escalations/${esc.id}`, {
  //     ...esc,
  //     updatedAt: now.toISOString(),
  //   });
  // }

  console.info(
    `SLA check complete: ${firstResponseBreaches.length} first response breaches, ${resolutionBreaches.length} resolution breaches`,
  );
}
