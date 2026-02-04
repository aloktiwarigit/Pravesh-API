/**
 * Razorpay webhook controller.
 * Handles incoming webhook POST requests.
 *
 * Story 4.10: Razorpay Webhook Idempotent Processing
 */
import { Request, Response } from 'express';
import { RazorpayWebhookHandler, RazorpayWebhookPayload } from './razorpay-webhook.handler.js';

export class RazorpayWebhookController {
  constructor(private readonly webhookHandler: RazorpayWebhookHandler) {}

  handleWebhook = async (req: Request, res: Response) => {
    try {
      const payload = req.body as RazorpayWebhookPayload;
      const razorpayEventId = req.headers['x-razorpay-event-id'] as string;

      if (!razorpayEventId) {
        res.status(400).json({ error: 'Missing event ID header' });
        return;
      }

      const result = await this.webhookHandler.handleWebhook(razorpayEventId, payload);

      // Always return 200 to Razorpay to prevent retries for known events
      res.status(200).json(result);
    } catch (error) {
      console.error('Webhook processing error:', error);
      // Return 200 even on error to prevent Razorpay from retrying
      // The event is already logged for manual review
      res.status(200).json({
        processed: false,
        message: 'Error processing webhook, logged for review',
      });
    }
  };
}
