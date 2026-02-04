// Story 6.13: Document Access Audit Log Query API
import { Router, Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { auditQuerySchema } from './documents.validation.js';

export function auditQueryRoutes(prisma: PrismaClient): Router {
  const router = Router();

  // GET /api/v1/audit/documents — query audit logs (AC4)
  router.get('/documents', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = auditQuerySchema.parse(req.query);
      const where: any = { resourceType: 'document' };

      if (query.user_id) where.userId = query.user_id;
      if (query.document_id) where.resourceId = query.document_id;
      if (query.service_instance_id) where.serviceInstanceId = query.service_instance_id;
      if (query.action) where.action = query.action;
      if (query.date_from || query.date_to) {
        where.createdAt = {};
        if (query.date_from) where.createdAt.gte = new Date(query.date_from);
        if (query.date_to) where.createdAt.lte = new Date(query.date_to);
      }

      const [logs, total] = await Promise.all([
        prisma.auditLog.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (query.page - 1) * query.limit,
          take: query.limit,
        }),
        prisma.auditLog.count({ where }),
      ]);

      // CSV export (AC8)
      if (query.format === 'csv') {
        const csvHeader = 'id,user_id,user_role,action,resource_type,resource_id,service_instance_id,ip_address,created_at\n';
        const csvRows = logs.map((l) =>
          `${l.id},${l.userId},${l.userRole},${l.action},${l.resourceType},${l.resourceId},${l.serviceInstanceId || ''},${l.ipAddress || ''},${l.createdAt.toISOString()}`
        ).join('\n');
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=audit-log.csv');
        return res.send(csvHeader + csvRows);
      }

      res.json({
        success: true,
        data: logs,
        meta: {
          page: query.page,
          limit: query.limit,
          total,
          totalPages: Math.ceil(total / query.limit),
          hasMore: query.page * query.limit < total,
        },
      });
    } catch (error) {
      next(error);
    }
  });

  // GET /api/v1/audit/documents/summary — admin report (AC5)
  router.get('/documents/summary', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

      const [recentCount, byRole, lawyerAccesses] = await Promise.all([
        prisma.auditLog.count({
          where: { resourceType: 'document', createdAt: { gte: last24h } },
        }),
        prisma.$queryRaw`
          SELECT user_role, COUNT(*)::int as count
          FROM audit_logs
          WHERE resource_type = 'document' AND created_at >= ${last24h}
          GROUP BY user_role
        ` as Promise<Array<{ user_role: string; count: number }>>,
        prisma.auditLog.findMany({
          where: {
            resourceType: 'document',
            userRole: 'lawyer',
            createdAt: { gte: last24h },
          },
          orderBy: { createdAt: 'desc' },
          take: 50,
        }),
      ]);

      res.json({
        success: true,
        data: {
          recent_access_count_24h: recentCount,
          access_by_role: byRole,
          lawyer_accesses: lawyerAccesses,
        },
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
