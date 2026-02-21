/**
 * Support Ticket Controller - HTTP endpoints for ticket management
 *
 * Story 10.X: Support Ticket System
 */

import { Router } from 'express';
import { PrismaClient, TicketCategory, TicketPriority, TicketStatus } from '@prisma/client';
import { z } from 'zod';
import { TicketService } from './ticket.service';
import { authorize } from '../../middleware/authorize';

const createTicketSchema = z.object({
  serviceId: z.string().uuid().optional(),
  category: z.nativeEnum(TicketCategory),
  priority: z.nativeEnum(TicketPriority).optional(),
  subject: z.string().min(1).max(200),
  description: z.string().min(1).max(5000),
});

const updateTicketSchema = z.object({
  status: z.nativeEnum(TicketStatus).optional(),
  priority: z.nativeEnum(TicketPriority).optional(),
});

const assignTicketSchema = z.object({
  assignedTo: z.string().uuid(),
});

const addMessageSchema = z.object({
  message: z.string().min(1).max(5000),
  isInternal: z.boolean().optional(),
  attachments: z.array(z.string().url()).optional(),
});

const listTicketsSchema = z.object({
  status: z.nativeEnum(TicketStatus).optional(),
  priority: z.nativeEnum(TicketPriority).optional(),
  category: z.nativeEnum(TicketCategory).optional(),
  customerId: z.string().uuid().optional(),
  assignedTo: z.string().uuid().optional(),
  unassignedOnly: z.coerce.boolean().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export function createTicketController(prisma: PrismaClient): Router {
  const router = Router();
  const ticketService = new TicketService(prisma);

  /**
   * POST /api/v1/support/tickets
   * Create a new support ticket.
   * Roles: customer, support_agent, ops_manager
   */
  router.post(
    '/',
    authorize('customer', 'support_agent', 'ops_manager'),
    async (req, res, next) => {
      try {
        const input = createTicketSchema.parse(req.body);
        const user = (req as any).user!;

        const ticket = await ticketService.createTicket({
          customerId: user.id,
          serviceId: input.serviceId,
          category: input.category,
          priority: input.priority,
          subject: input.subject,
          description: input.description,
          cityId: user.cityId,
        });

        res.status(201).json({ success: true, data: ticket });
      } catch (error) {
        next(error);
      }
    },
  );

  /**
   * GET /api/v1/support/tickets
   * List tickets with filters.
   * Roles: customer, support_agent, ops_manager
   */
  router.get(
    '/',
    authorize('customer', 'support_agent', 'ops_manager'),
    async (req, res, next) => {
      try {
        const filters = listTicketsSchema.parse(req.query);
        const user = (req as any).user!;

        // Customers can only see their own tickets
        const customerId = user.role === 'customer' ? user.id : filters.customerId;

        // Support agents see tickets assigned to them or unassigned
        const assignedTo = user.role === 'support_agent' && !filters.assignedTo
          ? user.id
          : filters.assignedTo;

        const result = await ticketService.listTickets({
          ...filters,
          customerId,
          assignedTo: user.role === 'support_agent' ? undefined : assignedTo,
          unassignedOnly: user.role === 'support_agent' ? filters.unassignedOnly : false,
          cityId: user.role === 'super_admin' ? undefined : user.cityId,
        });

        res.json({ success: true, data: result });
      } catch (error) {
        next(error);
      }
    },
  );

  /**
   * GET /api/v1/support/tickets/metrics
   * Get ticket metrics for dashboard.
   * Roles: support_agent, ops_manager
   */
  router.get(
    '/metrics',
    authorize('support_agent', 'ops_manager'),
    async (req, res, next) => {
      try {
        const user = (req as any).user!;
        const cityId = user.role === 'super_admin' ? undefined : user.cityId;

        const metrics = await ticketService.getTicketMetrics(cityId);

        res.json({ success: true, data: metrics });
      } catch (error) {
        next(error);
      }
    },
  );

  /**
   * GET /api/v1/support/tickets/at-risk
   * Get tickets approaching SLA breach.
   * Roles: support_agent, ops_manager
   */
  router.get(
    '/at-risk',
    authorize('support_agent', 'ops_manager'),
    async (req, res, next) => {
      try {
        const user = (req as any).user!;
        const hoursUntilBreach = parseInt(req.query.hours as string) || 4;
        const cityId = user.role === 'super_admin' ? undefined : user.cityId;

        const tickets = await ticketService.getAtRiskTickets(cityId, hoursUntilBreach);

        res.json({ success: true, data: tickets });
      } catch (error) {
        next(error);
      }
    },
  );

  /**
   * GET /api/v1/support/tickets/:id
   * Get ticket details with messages.
   * Roles: customer, support_agent, ops_manager
   */
  router.get(
    '/:id',
    authorize('customer', 'support_agent', 'ops_manager'),
    async (req, res, next) => {
      try {
        const { id } = req.params;
        const user = (req as any).user!;

        const ticket = await ticketService.getTicket(id);

        // Customers can only see their own tickets
        if (user.role === 'customer' && ticket.customerId !== user.id) {
          return res.status(403).json({
            success: false,
            error: { code: 'FORBIDDEN', message: 'Not your ticket' },
          });
        }

        // Filter out internal messages for customers
        if (user.role === 'customer') {
          ticket.messages = ticket.messages.filter(m => !m.isInternal);
        }

        res.json({ success: true, data: ticket });
      } catch (error) {
        next(error);
      }
    },
  );

  /**
   * PATCH /api/v1/support/tickets/:id
   * Update ticket status or priority.
   * Roles: support_agent, ops_manager
   */
  router.patch(
    '/:id',
    authorize('support_agent', 'ops_manager'),
    async (req, res, next) => {
      try {
        const { id } = req.params;
        const input = updateTicketSchema.parse(req.body);

        const ticket = await ticketService.updateTicket(id, input);

        res.json({ success: true, data: ticket });
      } catch (error) {
        next(error);
      }
    },
  );

  /**
   * PATCH /api/v1/support/tickets/:id/assign
   * Assign ticket to a support agent.
   * Roles: ops_manager
   */
  router.patch(
    '/:id/assign',
    authorize('ops_manager'),
    async (req, res, next) => {
      try {
        const { id } = req.params;
        const { assignedTo } = assignTicketSchema.parse(req.body);

        const ticket = await ticketService.assignTicket(id, assignedTo);

        res.json({ success: true, data: ticket });
      } catch (error) {
        next(error);
      }
    },
  );

  /**
   * POST /api/v1/support/tickets/:id/resolve
   * Resolve a ticket.
   * Roles: support_agent, ops_manager
   */
  router.post(
    '/:id/resolve',
    authorize('support_agent', 'ops_manager'),
    async (req, res, next) => {
      try {
        const { id } = req.params;

        const ticket = await ticketService.resolveTicket(id);

        res.json({ success: true, data: ticket });
      } catch (error) {
        next(error);
      }
    },
  );

  /**
   * POST /api/v1/support/tickets/:id/close
   * Close a ticket.
   * Roles: support_agent, ops_manager
   */
  router.post(
    '/:id/close',
    authorize('support_agent', 'ops_manager'),
    async (req, res, next) => {
      try {
        const { id } = req.params;

        const ticket = await ticketService.closeTicket(id);

        res.json({ success: true, data: ticket });
      } catch (error) {
        next(error);
      }
    },
  );

  /**
   * POST /api/v1/support/tickets/:id/reopen
   * Reopen a resolved or closed ticket.
   * Roles: support_agent, ops_manager
   */
  router.post(
    '/:id/reopen',
    authorize('support_agent', 'ops_manager'),
    async (req, res, next) => {
      try {
        const { id } = req.params;

        const ticket = await ticketService.reopenTicket(id);

        res.json({ success: true, data: ticket });
      } catch (error) {
        next(error);
      }
    },
  );

  /**
   * POST /api/v1/support/tickets/:id/messages
   * Add a message to a ticket.
   * Roles: customer, support_agent, ops_manager
   */
  router.post(
    '/:id/messages',
    authorize('customer', 'support_agent', 'ops_manager'),
    async (req, res, next) => {
      try {
        const { id } = req.params;
        const input = addMessageSchema.parse(req.body);
        const user = (req as any).user!;

        // Verify access
        const ticket = await ticketService.getTicket(id);
        if (user.role === 'customer' && ticket.customerId !== user.id) {
          return res.status(403).json({
            success: false,
            error: { code: 'FORBIDDEN', message: 'Not your ticket' },
          });
        }

        // Customers cannot send internal messages
        const isInternal = user.role === 'customer' ? false : input.isInternal;

        const message = await ticketService.addMessage({
          ticketId: id,
          senderId: user.id,
          senderRole: user.role,
          message: input.message,
          isInternal,
          attachments: input.attachments,
        });

        res.status(201).json({ success: true, data: message });
      } catch (error) {
        next(error);
      }
    },
  );

  /**
   * GET /api/v1/support/tickets/:id/messages
   * Get messages for a ticket.
   * Roles: customer, support_agent, ops_manager
   */
  router.get(
    '/:id/messages',
    authorize('customer', 'support_agent', 'ops_manager'),
    async (req, res, next) => {
      try {
        const { id } = req.params;
        const user = (req as any).user!;

        // Verify access
        const ticket = await ticketService.getTicket(id);
        if (user.role === 'customer' && ticket.customerId !== user.id) {
          return res.status(403).json({
            success: false,
            error: { code: 'FORBIDDEN', message: 'Not your ticket' },
          });
        }

        // Customers cannot see internal messages
        const includeInternal = user.role !== 'customer';
        const messages = await ticketService.getMessages(id, includeInternal);

        res.json({ success: true, data: messages });
      } catch (error) {
        next(error);
      }
    },
  );

  return router;
}
