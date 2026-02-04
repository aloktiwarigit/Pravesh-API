import { PrismaClient } from '@prisma/client';
import { scoreAgents } from '../../../domains/agents/agent-scoring.service';
import { logger } from '../../utils/logger';

export const ASSIGN_AGENT_JOB = 'assign-agent';
export const ASSIGN_AGENT_CRON = '*/5 * * * *'; // Every 5 minutes

export interface AssignAgentPayload {
  serviceInstanceId?: string; // If set, process only this instance; otherwise batch all pending
}

/**
 * Register the assign-agent pg-boss job.
 * AC1: Runs every 5 minutes via cron AND immediately upon new service request.
 * AC4: Assignment within Prisma transaction.
 * AC5: Queues notification after successful assignment.
 * AC6: Alerts ops when no agent available.
 * AC7: Logs all assignment decisions.
 * AC8: Idempotent - skips already-assigned requests.
 *
 * NOTE: agentAssignmentLog model does not exist in schema. Assignment decisions
 * are logged via console/logger instead.
 */
export function registerAssignAgentJob(boss: any, prisma: PrismaClient) {
  // Register the handler
  boss.work(
    ASSIGN_AGENT_JOB,
    { teamSize: 1, teamConcurrency: 1 },
    async (job: any) => {
      const { serviceInstanceId } = job.data;
      logger.info(
        { jobId: job.id, serviceInstanceId },
        'assign-agent job started',
      );

      // Find pending instances
      const whereClause: any = { state: 'requested' };
      if (serviceInstanceId) {
        whereClause.id = serviceInstanceId;
      }

      const pendingInstances = await prisma.serviceInstance.findMany({
        where: whereClause,
        orderBy: { createdAt: 'asc' },
      });

      if (pendingInstances.length === 0) {
        logger.info('No pending instances to assign');
        return;
      }

      logger.info(
        { count: pendingInstances.length },
        'Processing pending instances',
      );

      for (const instance of pendingInstances) {
        // AC8: Idempotency - skip if already assigned
        if (instance.assignedAgentId) {
          logger.info({ instanceId: instance.id }, 'Already assigned, skipping');
          continue;
        }

        const result = await scoreAgents(
          prisma,
          instance.cityId,
          0, // propertyLat - not available on ServiceInstance
          0, // propertyLng - not available on ServiceInstance
        );

        if (result.selectedAgentId) {
          // AC4: Assign within transaction
          await prisma.$transaction(async (tx) => {
            await tx.serviceInstance.update({
              where: { id: instance.id },
              data: {
                state: 'assigned',
                assignedAgentId: result.selectedAgentId,
              },
            });

            // AC7: Log assignment decision via state history
            await tx.serviceStateHistory.create({
              data: {
                serviceInstanceId: instance.id,
                fromState: instance.state,
                toState: 'assigned',
                changedBy: 'system:assign-agent',
                reason: result.reason,
                metadata: { candidates: result.candidates } as any,
              },
            });
          });

          // AC5: Queue notification job
          await boss.send(
            'notify-agent-assignment',
            {
              serviceInstanceId: instance.id,
              agentId: result.selectedAgentId,
            },
            {
              singletonKey: `notify-${instance.id}`,
            },
          );

          logger.info(
            {
              instanceId: instance.id,
              agentId: result.selectedAgentId,
              score: result.candidates[0]?.score,
            },
            'Agent assigned successfully',
          );
        } else {
          // AC6: No agent available - alert ops
          // TODO: agentAssignmentLog model does not exist in schema.
          // Logging via ServiceStateHistory instead.
          await prisma.serviceStateHistory.create({
            data: {
              serviceInstanceId: instance.id,
              fromState: instance.state,
              toState: instance.state, // no change
              changedBy: 'system:assign-agent',
              reason: `No agent available: ${result.reason}`,
              metadata: { candidates: result.candidates } as any,
            },
          });

          await boss.send('ops-alert', {
            type: 'no_agent_available',
            serviceInstanceId: instance.id,
            cityId: instance.cityId,
            reason: result.reason,
          });

          logger.warn(
            {
              instanceId: instance.id,
              reason: result.reason,
            },
            'No agent available for assignment',
          );
        }
      }
    },
  );

  // Register cron schedule (AC1: every 5 minutes)
  boss.schedule(ASSIGN_AGENT_JOB, ASSIGN_AGENT_CRON, {}, {
    tz: 'Asia/Kolkata',
  });

  logger.info('assign-agent job registered with 5-minute cron');
}
