// Story 10.8: Auto-Escalation to Support on SLA Breach
import { PrismaClient } from '@prisma/client';
import { supportService } from './support.service';

const prisma = new PrismaClient();

// Complex service types that receive 72hr resolution SLA
const COMPLEX_SERVICE_TYPES = [
  'title-search',
  'mutation',
  'legal-opinion',
  'court-case',
  'inheritance-transfer',
  'property-registration',
];

export class AutoEscalationService {
  /**
   * Called by Epic 5/8 SLA monitoring when a service SLA breach is detected.
   * Creates a support escalation with round-robin agent assignment.
   * AC7: Prevents duplicate escalations for the same service.
   */
  async createAutoEscalation(serviceId: string) {
    // AC7: Check for existing active escalation
    const existing = await prisma.supportEscalation.findFirst({
      where: {
        serviceId,
        status: { in: ['OPEN', 'IN_PROGRESS'] },
      },
    });

    if (existing) {
      console.info(
        `Auto-escalation skipped for service ${serviceId} — active escalation ${existing.id} already exists`,
      );
      return existing;
    }

    // Get service details for severity classification
    const service = await prisma.payment.findFirst({
      where: { serviceRequestId: serviceId },
      select: {
        customerId: true,
      },
    });

    if (!service) {
      console.error(`Auto-escalation failed — service ${serviceId} not found`);
      return null;
    }

    // Determine severity based on service type
    // In production, this would query the service_requests table for service type
    const severity = 'STANDARD'; // Default; in real implementation: check service type

    // AC1: Create escalation
    const escalation = await supportService.createEscalation({
      serviceId,
      customerId: service.customerId,
      escalationType: 'AUTO_GENERATED',
      escalationReason: 'Service SLA breached — auto-escalated for support follow-up',
      severity,
    });

    // AC3: Round-robin assignment (least-loaded strategy)
    const assignedAgent = await this.assignRoundRobin();
    if (assignedAgent) {
      await prisma.supportEscalation.update({
        where: { id: escalation.id },
        data: { assignedAgentId: assignedAgent.id },
      });
    }

    console.info({
      escalationId: escalation.id,
      serviceId,
      assignedAgentId: assignedAgent?.id,
      severity,
    }, 'Auto-escalation created from SLA breach');

    return escalation;
  }

  /**
   * Round-robin assignment among active support agents.
   * Picks the agent with the fewest active escalations.
   */
  private async assignRoundRobin() {
    // Get support agents ordered by active escalation count ascending
    const agentsWithCounts = await prisma.$queryRaw<Array<{ id: string; name: string; count: number }>>`
      SELECT
        u.id,
        u.name,
        COUNT(se.id) AS count
      FROM users u
      LEFT JOIN support_escalations se
        ON se.assigned_agent_id = u.id
        AND se.status IN ('OPEN', 'IN_PROGRESS')
      WHERE u.role = 'SUPPORT_AGENT'
        AND u.is_active = true
      GROUP BY u.id, u.name
      ORDER BY count ASC
      LIMIT 1
    `;

    return agentsWithCounts[0] ?? null;
  }
}

export const autoEscalationService = new AutoEscalationService();
