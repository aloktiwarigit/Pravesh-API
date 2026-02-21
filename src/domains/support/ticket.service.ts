/**
 * Support Ticket Service
 *
 * Story 10.X: Support Ticket System
 *
 * Handles:
 * - Ticket creation and management
 * - Ticket assignment and status transitions
 * - Ticket messaging with internal notes
 * - SLA tracking
 */

import { PrismaClient, TicketCategory, TicketPriority, TicketStatus } from '@prisma/client';
import { BusinessError } from '../../shared/errors/business-error';
import { nanoid } from 'nanoid';

export interface CreateTicketInput {
  customerId: string;
  serviceId?: string;
  category: TicketCategory;
  priority?: TicketPriority;
  subject: string;
  description: string;
  cityId: string;
  whatsappThreadId?: string;
}

export interface AddMessageInput {
  ticketId: string;
  senderId: string;
  senderRole: string;
  message: string;
  isInternal?: boolean;
  attachments?: string[];
}

export interface UpdateTicketInput {
  status?: TicketStatus;
  priority?: TicketPriority;
  assignedTo?: string;
}

// SLA deadlines based on priority (in hours)
const SLA_HOURS: Record<TicketPriority, number> = {
  LOW: 72,
  NORMAL: 48,
  HIGH: 24,
  URGENT: 4,
};

export class TicketService {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Creates a new support ticket.
   * AC1: Customer can create ticket from app or WhatsApp.
   */
  async createTicket(input: CreateTicketInput) {
    const {
      customerId,
      serviceId,
      category,
      priority = TicketPriority.NORMAL,
      subject,
      description,
      cityId,
      whatsappThreadId,
    } = input;

    // Generate unique ticket number
    const ticketNumber = `TKT-${nanoid(8).toUpperCase()}`;

    // Calculate SLA deadline
    const slaHours = SLA_HOURS[priority];
    const slaDeadline = new Date();
    slaDeadline.setHours(slaDeadline.getHours() + slaHours);

    const ticket = await this.prisma.supportTicket.create({
      data: {
        ticketNumber,
        customerId,
        serviceId,
        category,
        priority,
        status: TicketStatus.OPEN,
        subject,
        description,
        cityId,
        slaDeadline,
        whatsappThreadId,
      },
    });

    return ticket;
  }

  /**
   * Gets a ticket by ID with messages.
   */
  async getTicket(ticketId: string) {
    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id: ticketId },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!ticket) {
      throw new BusinessError('TICKET_NOT_FOUND', 'Support ticket not found', 404);
    }

    return ticket;
  }

  /**
   * Gets a ticket by ticket number.
   */
  async getTicketByNumber(ticketNumber: string) {
    const ticket = await this.prisma.supportTicket.findUnique({
      where: { ticketNumber },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!ticket) {
      throw new BusinessError('TICKET_NOT_FOUND', 'Support ticket not found', 404);
    }

    return ticket;
  }

  /**
   * Lists tickets with filters.
   * AC2: Support agents see tickets assigned to them or unassigned.
   */
  async listTickets(options: {
    cityId?: string;
    status?: TicketStatus;
    priority?: TicketPriority;
    category?: TicketCategory;
    customerId?: string;
    assignedTo?: string;
    unassignedOnly?: boolean;
    limit?: number;
    offset?: number;
  }) {
    const {
      cityId,
      status,
      priority,
      category,
      customerId,
      assignedTo,
      unassignedOnly,
      limit = 20,
      offset = 0,
    } = options;

    const where = {
      ...(cityId && { cityId }),
      ...(status && { status }),
      ...(priority && { priority }),
      ...(category && { category }),
      ...(customerId && { customerId }),
      ...(assignedTo && { assignedTo }),
      ...(unassignedOnly && { assignedTo: null }),
    };

    const [tickets, total] = await Promise.all([
      this.prisma.supportTicket.findMany({
        where,
        orderBy: [
          { priority: 'desc' }, // URGENT first
          { createdAt: 'asc' }, // Oldest first
        ],
        take: limit,
        skip: offset,
      }),
      this.prisma.supportTicket.count({ where }),
    ]);

    return {
      tickets,
      total,
      limit,
      offset,
    };
  }

  /**
   * Updates a ticket (status, priority, assignment).
   * AC3: Support agents can update ticket status.
   */
  async updateTicket(ticketId: string, input: UpdateTicketInput) {
    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id: ticketId },
    });

    if (!ticket) {
      throw new BusinessError('TICKET_NOT_FOUND', 'Support ticket not found', 404);
    }

    if (ticket.status === TicketStatus.CLOSED) {
      throw new BusinessError('TICKET_CLOSED', 'Cannot update a closed ticket', 422);
    }

    const { status, priority, assignedTo } = input;

    // Calculate new SLA deadline if priority changes
    let slaDeadline = ticket.slaDeadline;
    if (priority && priority !== ticket.priority) {
      const slaHours = SLA_HOURS[priority];
      slaDeadline = new Date();
      slaDeadline.setHours(slaDeadline.getHours() + slaHours);
    }

    const updateData: any = {
      ...(status && { status }),
      ...(priority && { priority, slaDeadline }),
      ...(assignedTo !== undefined && { assignedTo }),
    };

    // Set timestamps based on status
    if (status === TicketStatus.RESOLVED) {
      updateData.resolvedAt = new Date();
    } else if (status === TicketStatus.CLOSED) {
      updateData.closedAt = new Date();
    }

    const updatedTicket = await this.prisma.supportTicket.update({
      where: { id: ticketId },
      data: updateData,
    });

    return updatedTicket;
  }

  /**
   * Assigns a ticket to a support agent.
   * AC4: Ops managers can assign tickets to agents.
   */
  async assignTicket(ticketId: string, assignedTo: string) {
    return this.updateTicket(ticketId, { assignedTo });
  }

  /**
   * Adds a message to a ticket.
   * AC5: Two-way communication between customer and support.
   */
  async addMessage(input: AddMessageInput) {
    const { ticketId, senderId, senderRole, message, isInternal = false, attachments = [] } = input;

    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id: ticketId },
    });

    if (!ticket) {
      throw new BusinessError('TICKET_NOT_FOUND', 'Support ticket not found', 404);
    }

    if (ticket.status === TicketStatus.CLOSED) {
      throw new BusinessError('TICKET_CLOSED', 'Cannot add message to a closed ticket', 422);
    }

    // Create message
    const ticketMessage = await this.prisma.supportTicketMessage.create({
      data: {
        ticketId,
        senderId,
        senderRole,
        message,
        isInternal,
        attachments,
      },
    });

    // Auto-update ticket status based on sender
    if (senderRole === 'customer') {
      // Customer replied, move to OPEN if waiting on customer
      if (ticket.status === TicketStatus.WAITING_CUSTOMER) {
        await this.prisma.supportTicket.update({
          where: { id: ticketId },
          data: { status: TicketStatus.IN_PROGRESS },
        });
      }
    } else if (!isInternal) {
      // Support replied (non-internal), move to waiting on customer
      if (ticket.status === TicketStatus.OPEN || ticket.status === TicketStatus.IN_PROGRESS) {
        await this.prisma.supportTicket.update({
          where: { id: ticketId },
          data: { status: TicketStatus.WAITING_CUSTOMER },
        });
      }
    }

    return ticketMessage;
  }

  /**
   * Gets messages for a ticket.
   * AC6: Internal notes only visible to support staff.
   */
  async getMessages(ticketId: string, includeInternal: boolean = false) {
    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id: ticketId },
    });

    if (!ticket) {
      throw new BusinessError('TICKET_NOT_FOUND', 'Support ticket not found', 404);
    }

    const messages = await this.prisma.supportTicketMessage.findMany({
      where: {
        ticketId,
        ...(includeInternal ? {} : { isInternal: false }),
      },
      orderBy: { createdAt: 'asc' },
    });

    return messages;
  }

  /**
   * Resolves a ticket.
   */
  async resolveTicket(ticketId: string) {
    return this.updateTicket(ticketId, { status: TicketStatus.RESOLVED });
  }

  /**
   * Closes a ticket.
   */
  async closeTicket(ticketId: string) {
    return this.updateTicket(ticketId, { status: TicketStatus.CLOSED });
  }

  /**
   * Reopens a resolved ticket.
   */
  async reopenTicket(ticketId: string) {
    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id: ticketId },
    });

    if (!ticket) {
      throw new BusinessError('TICKET_NOT_FOUND', 'Support ticket not found', 404);
    }

    if (ticket.status !== TicketStatus.RESOLVED && ticket.status !== TicketStatus.CLOSED) {
      throw new BusinessError('TICKET_NOT_RESOLVED', 'Only resolved or closed tickets can be reopened', 422);
    }

    const updatedTicket = await this.prisma.supportTicket.update({
      where: { id: ticketId },
      data: {
        status: TicketStatus.OPEN,
        resolvedAt: null,
        closedAt: null,
      },
    });

    return updatedTicket;
  }

  /**
   * Gets tickets approaching SLA breach.
   * AC7: Monitor SLA compliance.
   */
  async getAtRiskTickets(cityId?: string, hoursUntilBreach: number = 4) {
    const breachThreshold = new Date();
    breachThreshold.setHours(breachThreshold.getHours() + hoursUntilBreach);

    const tickets = await this.prisma.supportTicket.findMany({
      where: {
        ...(cityId && { cityId }),
        status: { in: [TicketStatus.OPEN, TicketStatus.IN_PROGRESS, TicketStatus.WAITING_CUSTOMER] },
        slaDeadline: { lte: breachThreshold },
      },
      orderBy: { slaDeadline: 'asc' },
    });

    return tickets;
  }

  /**
   * Gets ticket metrics for dashboard.
   */
  async getTicketMetrics(cityId?: string) {
    const where = cityId ? { cityId } : {};

    const [
      total,
      open,
      inProgress,
      waitingCustomer,
      resolved,
      slaBreached,
    ] = await Promise.all([
      this.prisma.supportTicket.count({ where }),
      this.prisma.supportTicket.count({ where: { ...where, status: TicketStatus.OPEN } }),
      this.prisma.supportTicket.count({ where: { ...where, status: TicketStatus.IN_PROGRESS } }),
      this.prisma.supportTicket.count({ where: { ...where, status: TicketStatus.WAITING_CUSTOMER } }),
      this.prisma.supportTicket.count({ where: { ...where, status: TicketStatus.RESOLVED } }),
      this.prisma.supportTicket.count({
        where: {
          ...where,
          status: { in: [TicketStatus.OPEN, TicketStatus.IN_PROGRESS] },
          slaDeadline: { lt: new Date() },
        },
      }),
    ]);

    return {
      total,
      open,
      inProgress,
      waitingCustomer,
      resolved,
      slaBreached,
      activeTickets: open + inProgress + waitingCustomer,
    };
  }

  /**
   * Finds existing open ticket for a customer by WhatsApp thread ID.
   * Used for WhatsApp message routing.
   */
  async findOpenTicketByWhatsApp(whatsappThreadId: string) {
    return this.prisma.supportTicket.findFirst({
      where: {
        whatsappThreadId,
        status: { not: TicketStatus.CLOSED },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Finds existing open ticket for a customer.
   * Used for WhatsApp auto-ticket creation.
   */
  async findOpenTicketByCustomer(customerId: string) {
    return this.prisma.supportTicket.findFirst({
      where: {
        customerId,
        status: { not: TicketStatus.CLOSED },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
