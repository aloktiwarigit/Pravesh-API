import { PrismaClient } from '@prisma/client';

export class CustomerDashboardService {
  constructor(private readonly prisma: PrismaClient) {}

  async getDashboard(customerId: string) {
    const [activeServiceCount, documentsCount, pendingPayments] =
      await Promise.all([
        // Active services: anything not completed/cancelled/delivered
        this.prisma.serviceRequest.count({
          where: {
            customerId,
            status: {
              notIn: ['completed', 'cancelled'],
            },
          },
        }),

        // Documents uploaded by this customer
        this.prisma.document.count({
          where: {
            uploadedByUserId: customerId,
          },
        }),

        // Pending payments
        this.prisma.payment.count({
          where: {
            customerId,
            status: 'pending',
          },
        }),
      ]);

    return {
      activeServiceCount,
      documentsCount,
      pendingPayments,
    };
  }
}
