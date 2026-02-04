// Story 6.4: AI Verification Accuracy Metrics Service
import { PrismaClient } from '@prisma/client';

export class VerificationMetricsService {
  constructor(private prisma: PrismaClient) {}

  async getAccuracyMetrics(dateRange?: { from: Date; to: Date }) {
    const where: any = {};
    if (dateRange) {
      where.createdAt = { gte: dateRange.from, lte: dateRange.to };
    }

    const documents = await this.prisma.document.findMany({
      where: {
        ...where,
        aiVerificationResult: { not: null },
      },
      select: {
        docType: true,
        aiVerificationResult: true,
        verificationStatus: true,
        verificationOverriddenBy: true,
      },
    });

    // Calculate accuracy: AI correct = no human override needed
    const total = documents.length;
    const overridden = documents.filter((d) => d.verificationOverriddenBy).length;
    const accuracy = total > 0 ? ((total - overridden) / total) * 100 : 0;

    // Per-type breakdown
    const byType: Record<string, { total: number; correct: number; accuracy: number }> = {};
    for (const doc of documents) {
      const type = doc.docType;
      if (!byType[type]) byType[type] = { total: 0, correct: 0, accuracy: 0 };
      byType[type].total++;
      if (!doc.verificationOverriddenBy) byType[type].correct++;
    }

    // Calculate per-type accuracy
    for (const type of Object.keys(byType)) {
      byType[type].accuracy = byType[type].total > 0
        ? Math.round((byType[type].correct / byType[type].total) * 10000) / 100
        : 0;
    }

    return {
      overall_accuracy: Math.round(accuracy * 100) / 100,
      total_verified: total,
      total_overridden: overridden,
      by_document_type: byType,
    };
  }
}
