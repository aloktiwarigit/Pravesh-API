/**
 * Story 7-2: Notification Send Job
 * Stub for ChannelHandler interface used by FCM, SMS, and WhatsApp adapters.
 */

export interface ChannelHandler {
  send(params: {
    userId: string;
    subject: string | null;
    body: string;
    contextData: Record<string, string>;
    whatsappTemplateName?: string | null;
  }): Promise<{ messageId: string; status: string }>;
}
