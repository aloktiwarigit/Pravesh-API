/**
 * Journey test data cleanup.
 *
 * Deletes records created by journey tests, identified by:
 * - ServiceInstance.propertyAddress containing 'Journey Test'
 * - SupportTicket.subject containing 'Journey Test'
 * - LegalCase.issueSummary containing 'Journey Test'
 * - BuilderProject.name containing 'Journey Test'
 *
 * Deletes in reverse dependency order to avoid FK violations.
 * Preserves all seed data.
 */
import { PrismaClient } from '@prisma/client';

let _prisma: PrismaClient | null = null;

function getPrisma(): PrismaClient {
  if (!_prisma) {
    _prisma = new PrismaClient();
  }
  return _prisma;
}

/** Safe deleteMany — swallows errors from non-existent models or missing data. */
async function safeDelete(
  model: { deleteMany: (args: any) => Promise<any> } | undefined,
  where: Record<string, unknown>,
): Promise<void> {
  if (!model) return;
  try {
    await model.deleteMany({ where });
  } catch {
    // Non-fatal — the table might not exist or rows might already be gone
  }
}

export async function cleanupJourneyData(): Promise<void> {
  const prisma = getPrisma();

  try {
    // ── 1. Find service instances created by journey tests ──────────
    const testInstances = await prisma.serviceInstance.findMany({
      where: { propertyAddress: { contains: 'Journey Test' } },
      select: { id: true },
    });
    const instanceIds = testInstances.map((i) => i.id);

    // ── 2. Find service requests linked to those instances ──────────
    let requestIds: string[] = [];
    if (instanceIds.length > 0) {
      const testRequests = await prisma.serviceRequest.findMany({
        where: { serviceInstanceId: { in: instanceIds } },
        select: { id: true },
      });
      requestIds = testRequests.map((r) => r.id);
    }

    // ── 3. Delete dependents of service requests (reverse FK order) ─
    if (requestIds.length > 0) {
      // Status logs
      await safeDelete(prisma.serviceRequestStatusLog, {
        serviceRequestId: { in: requestIds },
      });

      // Agent assignment logs
      await safeDelete(prisma.agentAssignmentLog, {
        serviceRequestId: { in: requestIds },
      });

      // Cash receipts
      await safeDelete(prisma.cashReceipt, {
        serviceRequestId: { in: requestIds },
      });

      // Ratings (model is ServiceRating, not Rating)
      await safeDelete(prisma.serviceRating, {
        serviceRequestId: { in: requestIds },
      });

      // Legal opinions linked to legal cases linked to these SRs
      const testCases = await prisma.legalCase
        .findMany({
          where: { serviceRequestId: { in: requestIds } },
          select: { id: true },
        })
        .catch(() => []);
      const caseIds = testCases.map((c) => c.id);
      if (caseIds.length > 0) {
        await safeDelete(prisma.legalOpinion, {
          legalCaseId: { in: caseIds },
        });
        await safeDelete(prisma.legalCase, {
          id: { in: caseIds },
        });
      }

      // Payments
      await safeDelete(prisma.payment, {
        serviceRequestId: { in: requestIds },
      });

      // Service requests themselves
      await safeDelete(prisma.serviceRequest, {
        id: { in: requestIds },
      });
    }

    // ── 4. Delete service instances ─────────────────────────────────
    if (instanceIds.length > 0) {
      // Service state history
      await safeDelete(prisma.serviceStateHistory, {
        serviceInstanceId: { in: instanceIds },
      });

      // Ratings by instance
      await safeDelete(prisma.serviceRating, {
        serviceInstanceId: { in: instanceIds },
      });

      await safeDelete(prisma.serviceInstance, {
        id: { in: instanceIds },
      });
    }

    // ── 5. Delete support tickets created by journey tests ──────────
    await safeDelete(prisma.supportTicket, {
      subject: { contains: 'Journey Test' },
    });

    // ── 6. Delete legal opinions/cases identified by summary ────────
    await safeDelete(prisma.legalOpinion, {
      summary: { contains: 'Journey Test' },
    });
    await safeDelete(prisma.legalCase, {
      issueSummary: { contains: 'Journey Test' },
    });

    // ── 7. Delete builder projects/units from journey tests ─────────
    const testProjects = await prisma.builderProject
      .findMany({
        where: { name: { contains: 'Journey Test' } },
        select: { id: true },
      })
      .catch(() => []);
    const projectIds = testProjects.map((p) => p.id);
    if (projectIds.length > 0) {
      await safeDelete(prisma.projectUnit, {
        projectId: { in: projectIds },
      });
      await safeDelete(prisma.builderProject, {
        id: { in: projectIds },
      });
    }
  } catch (error) {
    // Log but don't fail tests — cleanup is best-effort
    console.warn('[journey-cleanup] Cleanup error (non-fatal):', error);
  }
}

export async function disconnectCleanup(): Promise<void> {
  if (_prisma) {
    await _prisma.$disconnect();
    _prisma = null;
  }
}
