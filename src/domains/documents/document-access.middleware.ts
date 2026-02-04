// Story 6.10: Scoped document access middleware for lawyers and role-based access
import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';

export function documentAccessMiddleware(prisma: PrismaClient) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const userId = (req as any).user!.id;
    const userRole = (req as any).user!.role;
    const serviceInstanceId = req.query.service_instance_id as string
      || req.params.serviceInstanceId;

    if (!serviceInstanceId) {
      return next(); // Non-scoped endpoints handled by RBAC
    }

    // Customers can access their own service instances
    if (userRole === 'customer') {
      // Verify the customer owns this service instance
      const serviceInstance = await prisma.serviceInstance.findFirst({
        where: {
          id: serviceInstanceId,
          customerId: userId,
        },
      });

      if (!serviceInstance) {
        return res.status(403).json({
          success: false,
          error: { code: 'ACCESS_DENIED', message: 'You do not have access to this service instance' },
        });
      }

      return next();
    }

    // Lawyers: check assignment and case status (AC3, AC6, AC7)
    if (userRole === 'lawyer') {
      const assignment = await prisma.lawyerCaseAssignment.findFirst({
        where: {
          lawyerId: userId,
          serviceInstanceId,
        },
      });

      if (!assignment) {
        return res.status(403).json({
          success: false,
          error: { code: 'ACCESS_DENIED', message: 'You are not assigned to this case' },
        });
      }

      // Check if case is closed (AC6, AC7)
      if (assignment.status === 'closed' || assignment.status === 'completed') {
        return res.status(403).json({
          success: false,
          error: { code: 'CASE_CLOSED', message: 'Case is closed. Document access has been revoked.' },
        });
      }

      return next();
    }

    // Agents: check service assignment via assigned_agent_id
    if (userRole === 'agent') {
      const serviceInstance = await prisma.serviceInstance.findFirst({
        where: {
          id: serviceInstanceId,
          assignedAgentId: userId,
        },
      });

      if (!serviceInstance) {
        return res.status(403).json({
          success: false,
          error: { code: 'ACCESS_DENIED', message: 'You are not assigned to this service instance' },
        });
      }

      return next();
    }

    // Ops, Admin, Super Admin: full access
    if (['ops', 'admin', 'super_admin', 'franchise_owner'].includes(userRole)) {
      return next();
    }

    return res.status(403).json({
      success: false,
      error: { code: 'ACCESS_DENIED', message: 'Access denied' },
    });
  };
}
