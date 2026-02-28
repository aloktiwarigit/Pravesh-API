import { Router, Request, Response, NextFunction } from 'express';
import { authorize } from '../../middleware/authorize';
import { supportService } from './support.service';
import {
  customerSearchSchema,
  serviceFilterSchema,
  sendMessageSchema,
  createTemplateSchema,
  updateTemplateSchema,
  logTemplateUsageSchema,
  createReminderSchema,
  updateReminderSchema,
  reminderFilterSchema,
  logPatternSchema,
  addPerformanceNoteSchema,
  createEscalationSchema,
  resolveEscalationSchema,
  sendCustomerMessageSchema,
  performanceFilterSchema,
} from './support.validation';
import { autoEscalationService } from './auto-escalation.service';

const router = Router();

// Helper for async route handlers
const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) =>
  (req: Request, res: Response, next: NextFunction) => fn(req, res, next).catch(next);

// ============================================================
// Story 10.1: Customer Search & Case Lookup
// ============================================================

// GET /api/v1/support/customers/search?query=...&searchType=...
router.get(
  '/customers/search',
  authorize('support', 'ops_manager'),
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = customerSearchSchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: parsed.error.flatten() });
    }
    const results = await supportService.searchCustomers(parsed.data);
    return res.json({ success: true, data: results });
  }),
);

// GET /api/v1/support/customers/:customerId/profile
router.get(
  '/customers/:customerId/profile',
  authorize('support', 'ops_manager'),
  asyncHandler(async (req: Request, res: Response) => {
    const profile = await supportService.getCustomerProfile(req.params.customerId);
    return res.json({ success: true, data: profile });
  }),
);

// GET /api/v1/support/customers/:customerId/services
router.get(
  '/customers/:customerId/services',
  authorize('support', 'ops_manager'),
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = serviceFilterSchema.safeParse({
      ...req.query,
      customerId: req.params.customerId,
    });
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: parsed.error.flatten() });
    }
    const services = await supportService.getCustomerServices(parsed.data);
    return res.json({ success: true, data: services });
  }),
);

// ============================================================
// Story 10.2: Internal Messaging with Field Agents
// ============================================================

// POST /api/v1/support/messages
router.post(
  '/messages',
  authorize('support', 'ops_manager', 'agent'),
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = sendMessageSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: parsed.error.flatten() });
    }
    const message = await supportService.sendMessage((req as any).user.id, parsed.data);
    return res.status(201).json({ success: true, data: message });
  }),
);

// GET /api/v1/support/messages/unread-count
// NOTE: Must be registered BEFORE /messages/:serviceId to avoid route shadowing
router.get(
  '/messages/unread-count',
  authorize('support', 'agent'),
  asyncHandler(async (req: Request, res: Response) => {
    const count = await supportService.getUnreadCount((req as any).user.id);
    return res.json({ success: true, data: { unreadCount: count } });
  }),
);

// GET /api/v1/support/messages/:serviceId
router.get(
  '/messages/:serviceId',
  authorize('support', 'ops_manager', 'agent'),
  asyncHandler(async (req: Request, res: Response) => {
    const messages = await supportService.getThreadMessages(
      req.params.serviceId,
      (req as any).user.id,
    );
    return res.json({ success: true, data: messages });
  }),
);

// PATCH /api/v1/support/messages/:serviceId/resolve
router.patch(
  '/messages/:serviceId/resolve',
  authorize('support'),
  asyncHandler(async (req: Request, res: Response) => {
    await supportService.markThreadResolved(req.params.serviceId);
    return res.json({ success: true });
  }),
);

// PATCH /api/v1/support/messages/:serviceId/read
router.patch(
  '/messages/:serviceId/read',
  authorize('support', 'agent'),
  asyncHandler(async (req: Request, res: Response) => {
    await supportService.markMessagesRead(req.params.serviceId, (req as any).user.id);
    return res.json({ success: true });
  }),
);

// ============================================================
// Story 10.3: Pre-Built Communication Templates
// ============================================================

// GET /api/v1/support/templates?category=...
router.get(
  '/templates',
  authorize('support', 'ops_manager'),
  asyncHandler(async (req: Request, res: Response) => {
    const templates = await supportService.getTemplates(req.query.category as string);
    return res.json({ success: true, data: templates });
  }),
);

// POST /api/v1/support/templates (ops only)
router.post(
  '/templates',
  authorize('ops_manager'),
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = createTemplateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: parsed.error.flatten() });
    }
    const template = await supportService.createTemplate((req as any).user.id, parsed.data);
    return res.status(201).json({ success: true, data: template });
  }),
);

// PUT /api/v1/support/templates/:id (ops only)
router.put(
  '/templates/:id',
  authorize('ops_manager'),
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = updateTemplateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: parsed.error.flatten() });
    }
    const template = await supportService.updateTemplate(req.params.id, parsed.data);
    return res.json({ success: true, data: template });
  }),
);

// DELETE /api/v1/support/templates/:id (ops only - soft delete)
router.delete(
  '/templates/:id',
  authorize('ops_manager'),
  asyncHandler(async (req: Request, res: Response) => {
    await supportService.deleteTemplate(req.params.id);
    return res.json({ success: true });
  }),
);

// POST /api/v1/support/templates/usage
router.post(
  '/templates/usage',
  authorize('support'),
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = logTemplateUsageSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: parsed.error.flatten() });
    }
    await supportService.logTemplateUsage(
      (req as any).user.id,
      parsed.data.templateId,
      parsed.data.serviceId,
    );
    return res.json({ success: true });
  }),
);

// ============================================================
// Story 10.4: Follow-Up Reminder Scheduling
// ============================================================

// POST /api/v1/support/reminders
router.post(
  '/reminders',
  authorize('support'),
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = createReminderSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: parsed.error.flatten() });
    }
    const reminder = await supportService.createReminder((req as any).user.id, parsed.data);
    return res.status(201).json({ success: true, data: reminder });
  }),
);

// GET /api/v1/support/reminders
router.get(
  '/reminders',
  authorize('support'),
  asyncHandler(async (req: Request, res: Response) => {
    const filters = reminderFilterSchema.safeParse(req.query);
    const reminders = await supportService.getReminders(
      (req as any).user.id,
      filters.success ? filters.data : undefined,
    );
    return res.json({ success: true, data: reminders });
  }),
);

// GET /api/v1/support/reminders/overdue-count
// NOTE: Must be registered BEFORE /reminders/:id to avoid route shadowing
router.get(
  '/reminders/overdue-count',
  authorize('support'),
  asyncHandler(async (req: Request, res: Response) => {
    const count = await supportService.getOverdueCount((req as any).user.id);
    return res.json({ success: true, data: { count } });
  }),
);

// PATCH /api/v1/support/reminders/:id
router.patch(
  '/reminders/:id',
  authorize('support'),
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = updateReminderSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: parsed.error.flatten() });
    }
    const reminder = await supportService.updateReminder(
      req.params.id,
      (req as any).user.id,
      parsed.data,
    );
    return res.json({ success: true, data: reminder });
  }),
);

// ============================================================
// Story 10.5: Case Pattern Logging
// ============================================================

// POST /api/v1/support/cases/:id/log-pattern
router.post(
  '/cases/:id/log-pattern',
  authorize('support'),
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = logPatternSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: parsed.error.flatten() });
    }
    const patterns = await supportService.logPatterns(
      req.params.id,
      (req as any).user.id,
      parsed.data.patterns,
    );
    return res.status(201).json({ success: true, data: patterns });
  }),
);

// GET /api/v1/support/patterns/report?dateFrom=...&dateTo=...
router.get(
  '/patterns/report',
  authorize('ops_manager'),
  asyncHandler(async (req: Request, res: Response) => {
    const dateFrom = new Date(req.query.dateFrom as string || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());
    const dateTo = new Date(req.query.dateTo as string || new Date().toISOString());
    const report = await supportService.getPatternReport(dateFrom, dateTo);
    return res.json({ success: true, data: report });
  }),
);

// GET /api/v1/support/cases/:id/patterns
router.get(
  '/cases/:id/patterns',
  authorize('support', 'ops_manager'),
  asyncHandler(async (req: Request, res: Response) => {
    const patterns = await supportService.getPatternsByService(req.params.id);
    return res.json({ success: true, data: patterns });
  }),
);

// ============================================================
// Story 10.6: Agent Performance Notes
// ============================================================

// POST /api/v1/support/agents/performance-notes
router.post(
  '/agents/performance-notes',
  authorize('support'),
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = addPerformanceNoteSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: parsed.error.flatten() });
    }
    const note = await supportService.addPerformanceNote((req as any).user.id, parsed.data);
    return res.status(201).json({ success: true, data: note });
  }),
);

// GET /api/v1/support/agents/:agentId/performance-notes
router.get(
  '/agents/:agentId/performance-notes',
  authorize('ops_manager', 'franchise_owner', 'support'),
  asyncHandler(async (req: Request, res: Response) => {
    // AC5: Agents cannot view their own performance notes
    if ((req as any).user?.role === 'agent') {
      return res.status(403).json({
        success: false,
        error: {
          code: 'AUTH_INSUFFICIENT_ROLE',
          message: 'Agents cannot view their own performance notes',
        },
      });
    }
    const notes = await supportService.getAgentPerformanceNotes(req.params.agentId);
    return res.json({ success: true, data: notes });
  }),
);

// GET /api/v1/support/agents/:agentId/performance-notes/count
router.get(
  '/agents/:agentId/performance-notes/count',
  authorize('support', 'ops_manager'),
  asyncHandler(async (req: Request, res: Response) => {
    const count = await supportService.getAgentNoteCount(req.params.agentId);
    return res.json({ success: true, data: { count } });
  }),
);

// ============================================================
// Story 10.7: Escalation SLA Tracking
// ============================================================

// POST /api/v1/support/escalations
router.post(
  '/escalations',
  authorize('support', 'ops_manager'),
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = createEscalationSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: parsed.error.flatten() });
    }
    const escalation = await supportService.createEscalation(parsed.data);
    return res.status(201).json({ success: true, data: escalation });
  }),
);

// GET /api/v1/support/escalations?assignedAgentId=...
router.get(
  '/escalations',
  authorize('support', 'ops_manager'),
  asyncHandler(async (req: Request, res: Response) => {
    const escalations = await supportService.getEscalationsQueue(
      req.query.assignedAgentId as string,
    );
    return res.json({ success: true, data: escalations });
  }),
);

// PATCH /api/v1/support/escalations/:id/first-response
router.patch(
  '/escalations/:id/first-response',
  authorize('support'),
  asyncHandler(async (req: Request, res: Response) => {
    const escalation = await supportService.recordFirstResponse(
      req.params.id,
      (req as any).user.id,
    );
    return res.json({ success: true, data: escalation });
  }),
);

// PATCH /api/v1/support/escalations/:id/resolve
router.patch(
  '/escalations/:id/resolve',
  authorize('support', 'ops_manager'),
  asyncHandler(async (req: Request, res: Response) => {
    const escalation = await supportService.resolveEscalation(req.params.id);
    return res.json({ success: true, data: escalation });
  }),
);

// ============================================================
// Story 10.8: Auto-Escalation on SLA Breach
// ============================================================

// POST /api/v1/support/escalations/auto (internal system endpoint — requires system or ops role)
router.post(
  '/escalations/auto',
  authorize('system', 'ops_manager'),
  asyncHandler(async (req: Request, res: Response) => {
    const { serviceId } = req.body;
    if (!serviceId) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'serviceId required' } });
    }
    const escalation = await autoEscalationService.createAutoEscalation(serviceId);
    return res.status(201).json({ success: true, data: escalation });
  }),
);

// ============================================================
// Story 10.10: Customer Communication
// ============================================================

// POST /api/v1/support/customers/messages
router.post(
  '/customers/messages',
  authorize('support'),
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = sendCustomerMessageSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: parsed.error.flatten() });
    }
    const message = await supportService.sendCustomerMessage(
      (req as any).user.id,
      parsed.data,
    );
    return res.status(201).json({ success: true, data: message });
  }),
);

// GET /api/v1/support/services/:serviceId/communications
router.get(
  '/services/:serviceId/communications',
  authorize('support', 'ops_manager', 'customer'),
  asyncHandler(async (req: Request, res: Response) => {
    const messages = await supportService.getServiceCommunications(req.params.serviceId);
    return res.json({ success: true, data: messages });
  }),
);

// POST /api/v1/support/customers/reply (customer-facing)
router.post(
  '/customers/reply',
  authorize('customer'),
  asyncHandler(async (req: Request, res: Response) => {
    const { serviceId, messageText } = req.body;
    const message = await supportService.handleCustomerReply(
      (req as any).user.id,
      serviceId,
      messageText,
    );
    return res.status(201).json({ success: true, data: message });
  }),
);

// ============================================================
// Story 10.11: Overview Metrics
// ============================================================

// GET /api/v1/support/overview
router.get(
  '/overview',
  authorize('support'),
  asyncHandler(async (req: Request, res: Response) => {
    const metrics = await supportService.getOverviewMetrics((req as any).user.id);
    return res.json({ success: true, data: metrics });
  }),
);

// ============================================================
// Story 10.12: Agent Performance Metrics
// ============================================================

// GET /api/v1/support/agents/performance
router.get(
  '/agents/performance',
  authorize('ops_manager', 'franchise_owner'),
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = performanceFilterSchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: parsed.error.flatten() });
    }

    const data = await supportService.getAgentPerformance(parsed.data);

    // CSV export
    if (parsed.data.format === 'csv') {
      const csv = supportService.generateCsv(data);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=support-performance.csv');
      return res.send(csv);
    }

    return res.json({ success: true, data });
  }),
);

// GET /api/v1/support/agents/:agentId/detailed-metrics
router.get(
  '/agents/:agentId/detailed-metrics',
  authorize('ops_manager', 'franchise_owner'),
  asyncHandler(async (req: Request, res: Response) => {
    const data = await supportService.getAgentDetailedMetrics(req.params.agentId);
    return res.json({ success: true, data });
  }),
);

export default router;
