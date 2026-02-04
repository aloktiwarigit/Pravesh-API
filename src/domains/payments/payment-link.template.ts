/**
 * Payment link notification templates (bilingual).
 *
 * Story 4.2: WhatsApp Payment Link Fallback
 */

export function getPaymentLinkMessage(params: {
  customerName: string;
  amountRupees: string;
  shortUrl: string;
  expiryMinutes: number;
  lang: 'en' | 'hi';
}): string {
  if (params.lang === 'hi') {
    return (
      `नमस्ते ${params.customerName},\n\n` +
      `कृपया इस लिंक का उपयोग करके INR ${params.amountRupees} का भुगतान करें:\n` +
      `${params.shortUrl}\n\n` +
      `यह लिंक ${params.expiryMinutes} मिनट में समाप्त हो जाएगा।\n\n` +
      `- प्रॉपर्टी लीगल एजेंट`
    );
  }

  return (
    `Hi ${params.customerName},\n\n` +
    `Please complete your payment of INR ${params.amountRupees} using this link:\n` +
    `${params.shortUrl}\n\n` +
    `This link expires in ${params.expiryMinutes} minutes.\n\n` +
    `- Property Legal Agent`
  );
}
