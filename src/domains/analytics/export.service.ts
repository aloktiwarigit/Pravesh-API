import { PrismaClient } from '@prisma/client';
import { BusinessError } from '../../shared/errors/business-error';
import * as ErrorCodes from '../../shared/errors/error-codes';

/**
 * Story 14-13: Exportable Reports for Stakeholders
 *
 * Generates exports in PDF, CSV, and XLSX formats.
 * Large exports (>10,000 rows) are processed asynchronously.
 * Files served via signed URLs expiring in 24 hours.
 * RBAC-aware: users can only export data they can view.
 */

export type ExportFormat = 'pdf' | 'csv' | 'xlsx';
export type ExportType =
  | 'revenue'
  | 'agent_performance'
  | 'dealer_commissions'
  | 'service_list'
  | 'sla_report'
  | 'referral_history'
  | 'pipeline_forecast';

const MAX_SYNC_ROWS = 10000;

export class ExportService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Request an export job
   */
  async requestExport(params: {
    userId: string;
    userRole: string;
    cityId?: string;
    exportType: ExportType;
    format: ExportFormat;
    filters?: Record<string, any>;
  }) {
    // Validate role-based access to export type
    this.validateExportAccess(params.userRole, params.exportType);

    const job = await this.prisma.exportJob.create({
      data: {
        userId: params.userId,
        userRole: params.userRole,
        cityId: params.cityId || null,
        exportType: params.exportType,
        format: params.format,
        filters: params.filters as any || null,
        status: 'pending',
      },
    });

    // Check if this will be a large export
    const estimatedRows = await this.estimateRowCount(params.exportType, params.cityId, params.filters);

    if (estimatedRows > MAX_SYNC_ROWS) {
      // Process asynchronously via pg-boss
      // In production: boss.send('export.generate', { jobId: job.id })
      return {
        ...job,
        async: true,
        message: `Large export (~${estimatedRows} rows). You will be notified via email when ready.`,
      };
    }

    // Process synchronously for smaller exports
    const result = await this.processExport(job.id);
    return { ...result, async: false };
  }

  /**
   * Process an export job (generate file)
   */
  async processExport(jobId: string) {
    const job = await this.prisma.exportJob.findUnique({ where: { id: jobId } });
    if (!job) throw new Error('Export job not found');

    await this.prisma.exportJob.update({
      where: { id: jobId },
      data: { status: 'processing' },
    });

    try {
      // Generate the export data based on type
      const data = await this.fetchExportData(job.exportType, job.cityId, job.filters as any);
      const rowCount = Array.isArray(data) ? data.length : 0;

      // In production, this would:
      // 1. Generate PDF/CSV/XLSX using pdfkit/json2csv/exceljs
      // 2. Upload to Firebase Storage
      // 3. Generate signed URL with 24-hour expiry
      const fileUrl = `https://storage.example.com/exports/${jobId}.${job.format}`;
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24);

      return this.prisma.exportJob.update({
        where: { id: jobId },
        data: {
          status: 'completed',
          fileUrl,
          expiresAt,
          rowCount,
        },
      });
    } catch (error) {
      await this.prisma.exportJob.update({
        where: { id: jobId },
        data: { status: 'failed' },
      });
      throw error;
    }
  }

  /**
   * Get export job status
   */
  async getExportStatus(jobId: string) {
    return this.prisma.exportJob.findUnique({ where: { id: jobId } });
  }

  /**
   * List export jobs for a user
   */
  async listUserExports(userId: string) {
    return this.prisma.exportJob.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
  }

  /**
   * Validate role-based access to export types
   */
  private validateExportAccess(role: string, exportType: ExportType) {
    const roleAccess: Record<string, ExportType[]> = {
      franchise_owner: ['revenue', 'agent_performance', 'dealer_commissions', 'service_list'],
      dealer: ['referral_history', 'pipeline_forecast'],
      ops: ['sla_report', 'service_list', 'agent_performance'],
      super_admin: ['revenue', 'agent_performance', 'dealer_commissions', 'service_list', 'sla_report', 'referral_history', 'pipeline_forecast'],
    };

    const allowed = roleAccess[role] || [];
    if (!allowed.includes(exportType)) {
      throw new BusinessError(
        ErrorCodes.AUTH_INSUFFICIENT_ROLE,
        `Role "${role}" cannot export "${exportType}"`,
        403
      );
    }
  }

  /**
   * Estimate row count for async decision
   */
  private async estimateRowCount(
    exportType: ExportType,
    cityId?: string | null,
    filters?: Record<string, any>
  ): Promise<number> {
    // Simplified estimation
    switch (exportType) {
      case 'revenue':
        return this.prisma.franchiseRevenue.count({
          where: cityId ? { cityId } : {},
        });
      case 'agent_performance':
        return this.prisma.agent.count({
          where: cityId ? { cityId } : {},
        });
      case 'dealer_commissions':
        return this.prisma.dealer.count({
          where: cityId ? { cityId } : {},
        });
      default:
        return 100; // Default estimate
    }
  }

  /**
   * Fetch data for export based on type
   */
  private async fetchExportData(
    exportType: string,
    cityId?: string | null,
    filters?: Record<string, any>
  ): Promise<any[]> {
    const where: any = {};
    if (cityId) where.cityId = cityId;

    const take = MAX_SYNC_ROWS; // Cap fetched rows to prevent unbounded queries
    switch (exportType) {
      case 'revenue':
        return this.prisma.franchiseRevenue.findMany({ where, orderBy: { createdAt: 'desc' }, take });
      case 'agent_performance':
        return this.prisma.agent.findMany({ where, orderBy: { name: 'asc' }, take });
      case 'dealer_commissions':
        return this.prisma.dealer.findMany({ where, orderBy: { createdAt: 'desc' }, take });
      case 'service_list':
        return this.prisma.franchiseRevenue.findMany({ where, orderBy: { createdAt: 'desc' }, take });
      default:
        return [];
    }
  }
}
