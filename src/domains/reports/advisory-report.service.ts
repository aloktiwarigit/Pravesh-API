import { PrismaClient } from '@prisma/client';
import { AppError } from '../../core/errors/app-error.js';

export class AdvisoryReportService {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Generate an advisory report for a customer.
   * Compiles completed services, document status, and recommended next steps.
   */
  async generateReport(customerId: string, cityId: string) {
    // Get all service instances for the customer
    const instances = await this.prisma.serviceInstance.findMany({
      where: { customerId, cityId },
      include: { serviceDefinition: true },
      orderBy: { createdAt: 'desc' },
    });

    const completedServices = instances.filter(i => i.state === 'completed' || i.state === 'delivered');
    const activeServices = instances.filter(i => !['completed', 'delivered', 'cancelled'].includes(i.state));

    // Build recommended next steps based on completed services
    const completedCodes = completedServices.map(i => {
      const def = i.serviceDefinition.definition as any;
      return def?.serviceCode || i.serviceDefinition.code;
    });

    const recommendations = this.getRecommendations(completedCodes);

    return {
      customerId,
      generatedAt: new Date().toISOString(),
      summary: {
        totalServices: instances.length,
        completedCount: completedServices.length,
        activeCount: activeServices.length,
        cancelledCount: instances.filter(i => i.state === 'cancelled').length,
      },
      completedServices: completedServices.map(i => ({
        serviceCode: i.serviceDefinition.code,
        serviceName: i.serviceDefinition.name,
        completedAt: i.updatedAt.toISOString(),
        category: i.serviceDefinition.category,
      })),
      activeServices: activeServices.map(i => ({
        serviceCode: i.serviceDefinition.code,
        serviceName: i.serviceDefinition.name,
        currentState: i.state,
        currentStep: i.currentStepIndex,
        category: i.serviceDefinition.category,
      })),
      recommendations,
    };
  }

  private getRecommendations(completedCodes: string[]): Array<{ serviceCode: string; reason: string }> {
    const recommendations: Array<{ serviceCode: string; reason: string }> = [];

    // If title search done but no registration
    if (completedCodes.includes('title-search') && !completedCodes.includes('sale-deed-registration')) {
      recommendations.push({
        serviceCode: 'sale-deed-registration',
        reason: 'Title search completed. Proceed with sale deed registration.',
      });
    }

    // If sale deed done but no mutation
    if (completedCodes.includes('sale-deed-registration') && !completedCodes.includes('lda-mutation')) {
      recommendations.push({
        serviceCode: 'lda-mutation',
        reason: 'Sale deed registered. Apply for property mutation (name transfer).',
      });
    }

    // If mutation done, suggest utility transfers
    if (completedCodes.includes('lda-mutation')) {
      if (!completedCodes.includes('electricity-transfer')) {
        recommendations.push({
          serviceCode: 'electricity-transfer',
          reason: 'Property mutation complete. Transfer electricity connection.',
        });
      }
      if (!completedCodes.includes('water-connection-transfer')) {
        recommendations.push({
          serviceCode: 'water-connection-transfer',
          reason: 'Property mutation complete. Transfer water connection.',
        });
      }
      if (!completedCodes.includes('property-tax-name-change')) {
        recommendations.push({
          serviceCode: 'property-tax-name-change',
          reason: 'Property mutation complete. Update property tax records.',
        });
      }
    }

    // If registration done, suggest property insurance
    if (completedCodes.includes('sale-deed-registration') && !completedCodes.includes('property-insurance-assistance')) {
      recommendations.push({
        serviceCode: 'property-insurance-assistance',
        reason: 'Property registered. Consider property insurance for protection.',
      });
    }

    return recommendations;
  }
}
