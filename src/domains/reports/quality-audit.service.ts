import { PrismaClient } from '@prisma/client';
import { AppError } from '../../core/errors/app-error.js';

export class QualityAuditService {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Select random completed services for quality audit.
   * Samples a percentage of recently completed services.
   */
  async selectAuditSample(cityId: string, samplePercent: number = 10) {
    // Get completed services from the last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const completedInstances = await this.prisma.serviceInstance.findMany({
      where: {
        cityId,
        state: { in: ['completed', 'delivered'] },
        updatedAt: { gte: sevenDaysAgo },
      },
      include: { serviceDefinition: true },
      orderBy: { updatedAt: 'desc' },
    });

    // Random sampling
    const sampleSize = Math.max(1, Math.ceil(completedInstances.length * (samplePercent / 100)));
    const shuffled = completedInstances.sort(() => Math.random() - 0.5);
    const sample = shuffled.slice(0, sampleSize);

    return {
      cityId,
      totalCompleted: completedInstances.length,
      sampleSize: sample.length,
      samplePercent,
      auditItems: sample.map(instance => ({
        serviceInstanceId: instance.id,
        serviceCode: instance.serviceDefinition.code,
        serviceName: instance.serviceDefinition.name,
        customerId: instance.customerId,
        assignedAgentId: instance.assignedAgentId,
        completedAt: instance.updatedAt.toISOString(),
        auditChecklist: this.getAuditChecklist(instance.serviceDefinition.category),
      })),
    };
  }

  private getAuditChecklist(category: string): Array<{ item: string; required: boolean }> {
    const common = [
      { item: 'All required documents collected and verified', required: true },
      { item: 'GPS evidence captured at government offices', required: true },
      { item: 'Photo evidence of key steps', required: true },
      { item: 'Customer acknowledgment received', required: true },
      { item: 'Final deliverable matches quality standards', required: true },
    ];

    const categorySpecific: Record<string, Array<{ item: string; required: boolean }>> = {
      pre_purchase: [
        { item: 'Title chain verified with revenue records', required: true },
        { item: 'Encumbrance check completed', required: true },
      ],
      purchase: [
        { item: 'Stamp duty calculated correctly', required: true },
        { item: 'Registration receipt obtained', required: true },
      ],
      post_purchase: [
        { item: 'Mutation application filed correctly', required: true },
        { item: 'Updated records obtained from authority', required: true },
      ],
      inheritance: [
        { item: 'Legal heir documentation verified', required: true },
        { item: 'Court order/certificate obtained', required: true },
      ],
    };

    return [...common, ...(categorySpecific[category] || [])];
  }
}
