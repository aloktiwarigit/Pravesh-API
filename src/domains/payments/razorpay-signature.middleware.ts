/**
 * Razorpay webhook signature verification middleware.
 * MUST be registered BEFORE express.json() for the webhook route.
 *
 * Story 4.10: Razorpay Webhook Idempotent Processing
 */
import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

/**
 * Express middleware that verifies Razorpay webhook signatures.
 * Requires raw body access (register before body-parser/express.json()).
 */
export function razorpaySignatureMiddleware(webhookSecret: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const signature = req.headers['x-razorpay-signature'] as string;

    if (!signature) {
      res.status(400).json({ error: 'Missing Razorpay signature header' });
      return;
    }

    // req.body is raw buffer when express.raw() is used
    const rawBody = typeof req.body === 'string'
      ? req.body
      : Buffer.isBuffer(req.body)
        ? req.body.toString('utf8')
        : JSON.stringify(req.body);

    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(rawBody)
      .digest('hex');

    const expectedBuf = Buffer.from(expectedSignature, 'hex');
    const signatureBuf = Buffer.from(signature, 'hex');
    const sigMismatch =
      expectedBuf.length !== signatureBuf.length ||
      !crypto.timingSafeEqual(expectedBuf, signatureBuf);

    if (sigMismatch) {
      res.status(400).json({ error: 'Invalid webhook signature' });
      return;
    }

    // Parse the raw body into JSON for downstream handlers
    if (Buffer.isBuffer(req.body)) {
      req.body = JSON.parse(req.body.toString('utf8'));
    } else if (typeof req.body === 'string') {
      req.body = JSON.parse(req.body);
    }

    next();
  };
}
