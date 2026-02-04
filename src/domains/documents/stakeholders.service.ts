// Story 6.11a + 6.11c: Stakeholder management service
import { PrismaClient } from '@prisma/client';

export class StakeholderService {
  constructor(
    private prisma: PrismaClient,
    private boss: any, // PgBoss instance - namespace import cannot be used as type
  ) {}

  async addStakeholder(input: {
    serviceInstanceId: string;
    name: string;
    phone: string;
    relationship: string;
    cityId: string;
  }) {
    const stakeholder = await this.prisma.serviceStakeholder.create({
      data: {
        serviceInstanceId: input.serviceInstanceId,
        name: input.name,
        phone: input.phone,
        relationship: input.relationship,
        role: 'stakeholder',
        status: 'invited',
        cityId: input.cityId,
      },
    });

    // Send WhatsApp invitation (AC2)
    await this.boss.send('notification.send', {
      phone: input.phone,
      templateId: 'stakeholder-invitation',
      channel: 'whatsapp',
      data: {
        stakeholderName: input.name,
        deepLink: `https://app.propertylegal.in/join/${input.serviceInstanceId}`,
        serviceInstanceId: input.serviceInstanceId,
      },
    });

    return stakeholder;
  }

  async getStakeholders(serviceInstanceId: string) {
    return this.prisma.serviceStakeholder.findMany({
      where: { serviceInstanceId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async getStakeholderCount(serviceInstanceId: string): Promise<number> {
    return this.prisma.serviceStakeholder.count({
      where: { serviceInstanceId },
    });
  }

  async acceptInvitation(serviceInstanceId: string, userId: string, phone: string) {
    const stakeholder = await this.prisma.serviceStakeholder.findFirst({
      where: { serviceInstanceId, phone, status: 'invited' },
    });

    if (!stakeholder) throw new Error('No pending invitation found for this phone number');

    return this.prisma.serviceStakeholder.update({
      where: { id: stakeholder.id },
      data: {
        userId,
        status: 'accepted',
        acceptedAt: new Date(),
      },
    });
  }

  // Story 6.11c: Send manual reminder
  async sendManualReminder(stakeholderId: string) {
    const stakeholder = await this.prisma.serviceStakeholder.findUnique({
      where: { id: stakeholderId },
    });
    if (!stakeholder) throw new Error('Stakeholder not found');

    const primary = await this.prisma.serviceStakeholder.findFirst({
      where: { serviceInstanceId: stakeholder.serviceInstanceId, role: 'primary' },
    });

    await this.boss.send('notification.send', {
      phone: stakeholder.phone,
      templateId: 'stakeholder-document-reminder',
      channel: 'whatsapp',
      data: {
        customerName: primary?.name || 'Customer',
        deepLink: `https://app.propertylegal.in/join/${stakeholder.serviceInstanceId}`,
      },
    });
  }
}
