/**
 * WhatsApp Ticket Integration Service
 *
 * Story 3.2: WhatsApp to Ticket System Integration
 *
 * Handles:
 * - Auto-creating tickets from WhatsApp messages
 * - Routing WhatsApp messages to existing tickets
 * - Sending ticket updates via WhatsApp
 */

import { PrismaClient, TicketCategory, TicketPriority } from '@prisma/client';
import { TicketService } from './ticket.service';
import { BusinessError } from '../../shared/errors/business-error';

export interface WhatsAppMessage {
  from: string; // Phone number
  threadId: string; // WhatsApp thread/conversation ID
  message: string;
  timestamp: Date;
  mediaUrls?: string[];
}

export interface WhatsAppTicketResult {
  ticketId: string;
  ticketNumber: string;
  isNewTicket: boolean;
  messageId?: string;
}

// Keywords to auto-categorize tickets
const CATEGORY_KEYWORDS: Record<TicketCategory, string[]> = {
  PAYMENT_ISSUE: ['payment', 'pay', 'refund', 'money', 'charge', 'amount', 'invoice', 'receipt'],
  SERVICE_DELAY: ['delay', 'late', 'slow', 'waiting', 'when', 'status', 'pending', 'long'],
  DOCUMENT_ISSUE: ['document', 'paper', 'file', 'upload', 'certificate', 'copy'],
  REFUND_REQUEST: ['refund', 'return', 'cancel', 'money back'],
  GENERAL_INQUIRY: ['help', 'question', 'info', 'know', 'how', 'what'],
  COMPLAINT: ['complaint', 'issue', 'problem', 'bad', 'worst', 'terrible', 'unhappy'],
  TECHNICAL_ISSUE: ['app', 'error', 'bug', 'crash', 'not working', 'login', 'otp'],
  FEEDBACK: ['feedback', 'suggestion', 'improve', 'good', 'great', 'thanks'],
};

// Keywords to auto-set priority
const PRIORITY_KEYWORDS: Record<TicketPriority, string[]> = {
  URGENT: ['urgent', 'asap', 'immediately', 'emergency', 'critical'],
  HIGH: ['important', 'soon', 'quickly', 'fast'],
  NORMAL: [],
  LOW: [],
};

export class WhatsAppTicketService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly ticketService: TicketService,
  ) {}

  /**
   * Processes an incoming WhatsApp message.
   * Creates a new ticket if no open ticket exists, otherwise adds to existing ticket.
   */
  async processIncomingMessage(message: WhatsAppMessage): Promise<WhatsAppTicketResult> {
    const { from, threadId, message: text, timestamp, mediaUrls } = message;

    // Find customer by phone number
    const user = await this.prisma.user.findFirst({
      where: { phone: this.normalizePhone(from) },
    });

    if (!user) {
      // Unknown number - could create a guest ticket or reject
      throw new BusinessError(
        'CUSTOMER_NOT_FOUND',
        'No customer account found for this phone number',
        404,
      );
    }

    // Check for existing open ticket with this WhatsApp thread
    let existingTicket = await this.ticketService.findOpenTicketByWhatsApp(threadId);

    // If no ticket by thread, check by customer
    if (!existingTicket) {
      existingTicket = await this.ticketService.findOpenTicketByCustomer(user.id);
    }

    if (existingTicket) {
      // Add message to existing ticket
      const ticketMessage = await this.ticketService.addMessage({
        ticketId: existingTicket.id,
        senderId: user.id,
        senderRole: 'customer',
        message: text,
        isInternal: false,
        attachments: mediaUrls || [],
      });

      // Update WhatsApp thread ID if not set
      if (!existingTicket.whatsappThreadId) {
        await this.prisma.supportTicket.update({
          where: { id: existingTicket.id },
          data: { whatsappThreadId: threadId },
        });
      }

      return {
        ticketId: existingTicket.id,
        ticketNumber: existingTicket.ticketNumber,
        isNewTicket: false,
        messageId: ticketMessage.id,
      };
    }

    // Create new ticket
    const category = this.detectCategory(text);
    const priority = this.detectPriority(text);
    const subject = this.generateSubject(text);

    const ticket = await this.ticketService.createTicket({
      customerId: user.id,
      category,
      priority,
      subject,
      description: text,
      cityId: user.cityId || '',
      whatsappThreadId: threadId,
    });

    // Add attachments as first message if present
    if (mediaUrls && mediaUrls.length > 0) {
      await this.ticketService.addMessage({
        ticketId: ticket.id,
        senderId: user.id,
        senderRole: 'customer',
        message: `[Attachments from WhatsApp]`,
        isInternal: false,
        attachments: mediaUrls,
      });
    }

    return {
      ticketId: ticket.id,
      ticketNumber: ticket.ticketNumber,
      isNewTicket: true,
    };
  }

  /**
   * Sends a ticket update notification via WhatsApp.
   * Called when support agent replies to a ticket.
   */
  async sendTicketUpdate(ticketId: string, message: string): Promise<void> {
    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id: ticketId },
    });

    if (!ticket) {
      throw new BusinessError('TICKET_NOT_FOUND', 'Support ticket not found', 404);
    }

    if (!ticket.whatsappThreadId) {
      // Ticket not initiated via WhatsApp, skip
      return;
    }

    // Get customer phone
    const customer = await this.prisma.user.findUnique({
      where: { id: ticket.customerId },
      select: { phone: true, displayName: true },
    });

    if (!customer) {
      return;
    }

    // Queue WhatsApp notification
    // This would integrate with the existing notification system
    await this.prisma.notificationLog.create({
      data: {
        userId: ticket.customerId,
        templateCode: 'SUPPORT_TICKET_UPDATE',
        channel: 'whatsapp',
        language: 'en',
        subject: `Ticket ${ticket.ticketNumber}`,
        body: message,
        serviceInstanceId: ticket.serviceId,
        priority: 'normal',
        status: 'queued',
      },
    });
  }

  /**
   * Sends ticket creation confirmation via WhatsApp.
   */
  async sendTicketCreatedNotification(ticketId: string): Promise<void> {
    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id: ticketId },
    });

    if (!ticket || !ticket.whatsappThreadId) {
      return;
    }

    const message = `Your support ticket has been created!\n\n` +
      `Ticket Number: ${ticket.ticketNumber}\n` +
      `Subject: ${ticket.subject}\n` +
      `Priority: ${ticket.priority}\n\n` +
      `Our support team will get back to you soon. ` +
      `You can reply to this message to add more details.`;

    await this.sendTicketUpdate(ticketId, message);
  }

  /**
   * Sends ticket resolved notification via WhatsApp.
   */
  async sendTicketResolvedNotification(ticketId: string): Promise<void> {
    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id: ticketId },
    });

    if (!ticket || !ticket.whatsappThreadId) {
      return;
    }

    const message = `Your support ticket ${ticket.ticketNumber} has been resolved!\n\n` +
      `If you need further assistance, you can:\n` +
      `• Reply to this message to reopen the ticket\n` +
      `• Create a new ticket in the app\n\n` +
      `Thank you for using Pravesh!`;

    await this.sendTicketUpdate(ticketId, message);
  }

  /**
   * Detects ticket category from message text.
   */
  private detectCategory(text: string): TicketCategory {
    const lowerText = text.toLowerCase();

    for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
      if (keywords.some(keyword => lowerText.includes(keyword))) {
        return category as TicketCategory;
      }
    }

    return TicketCategory.GENERAL_INQUIRY;
  }

  /**
   * Detects ticket priority from message text.
   */
  private detectPriority(text: string): TicketPriority {
    const lowerText = text.toLowerCase();

    for (const [priority, keywords] of Object.entries(PRIORITY_KEYWORDS)) {
      if (keywords.some(keyword => lowerText.includes(keyword))) {
        return priority as TicketPriority;
      }
    }

    return TicketPriority.NORMAL;
  }

  /**
   * Generates a ticket subject from message text.
   * Truncates to first 100 characters or first sentence.
   */
  private generateSubject(text: string): string {
    // Take first sentence or first 100 chars
    const firstSentence = text.split(/[.!?]/)[0];
    const subject = firstSentence.length > 100
      ? firstSentence.substring(0, 97) + '...'
      : firstSentence;

    return subject.trim() || 'Support request via WhatsApp';
  }

  /**
   * Normalizes phone number to standard format.
   */
  private normalizePhone(phone: string): string {
    // Remove all non-digits
    let digits = phone.replace(/\D/g, '');

    // Remove country code if present (assuming India +91)
    if (digits.startsWith('91') && digits.length === 12) {
      digits = digits.substring(2);
    }

    return digits;
  }
}
