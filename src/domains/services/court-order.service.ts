// Story 13-11: Court Order Upload & Delivery Service
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

export class CourtOrderService {
  constructor(
    private prisma: PrismaClient,
    private boss: any // PgBoss instance - namespace import cannot be used as type
  ) {}

  async uploadCourtOrder(params: {
    serviceRequestId: string;
    hearingId?: string;
    caseNumber: string;
    orderDate: Date;
    orderType: string;
    outcome: 'favorable' | 'adverse' | 'partial';
    documentUrl: string;
    summary?: string;
    uploadedByUserId: string;
    cityId: string;
  }) {
    const order = await this.prisma.courtOrder.create({
      data: {
        id: crypto.randomUUID(),
        serviceRequestId: params.serviceRequestId,
        hearingId: params.hearingId || null,
        caseNumber: params.caseNumber,
        orderDate: params.orderDate,
        orderType: params.orderType,
        outcome: params.outcome,
        documentUrl: params.documentUrl,
        summary: params.summary || null,
        uploadedByUserId: params.uploadedByUserId,
        cityId: params.cityId,
      },
    });

    // Update hearing status if linked
    if (params.hearingId) {
      await this.prisma.courtHearing.update({
        where: { id: params.hearingId },
        data: {
          status: 'completed',
          outcome: params.summary || params.outcome,
        },
      });
    }

    // Send WhatsApp notification
    await this.boss.send('notification.send', {
      type: 'court_order_received',
      serviceRequestId: params.serviceRequestId,
      channel: 'whatsapp',
      data: {
        caseNumber: params.caseNumber,
        orderType: params.orderType,
        outcome: params.outcome,
      },
    });

    await this.prisma.courtOrder.update({
      where: { id: order.id },
      data: { customerNotified: true },
    });

    // Handle workflow based on outcome
    if (params.outcome === 'favorable') {
      // Auto-advance service workflow
      await this.boss.send('workflow.advance', {
        serviceRequestId: params.serviceRequestId,
        trigger: 'court_order_favorable',
      });
    } else if (params.outcome === 'adverse') {
      await this.boss.send('notification.send', {
        type: 'court_order_adverse_decision_required',
        serviceRequestId: params.serviceRequestId,
        channel: 'whatsapp',
        data: {
          caseNumber: params.caseNumber,
          options: ['appeal', 'close_case'],
        },
      });
    }

    return order;
  }

  async recordCustomerDecision(params: {
    courtOrderId: string;
    decision: 'appeal' | 'close_case';
    customerId: string;
  }) {
    const order = await this.prisma.courtOrder.update({
      where: { id: params.courtOrderId },
      data: { customerDecision: params.decision },
    });

    if (params.decision === 'appeal') {
      // Resume workflow for appeal process
      await this.boss.send('workflow.advance', {
        serviceRequestId: order.serviceRequestId,
        trigger: 'customer_appeals',
      });
    } else {
      await this.boss.send('workflow.advance', {
        serviceRequestId: order.serviceRequestId,
        trigger: 'customer_closes_case',
      });
    }

    return order;
  }

  async getOrdersForService(serviceRequestId: string) {
    return this.prisma.courtOrder.findMany({
      where: { serviceRequestId },
      orderBy: { orderDate: 'desc' },
    });
  }
}
