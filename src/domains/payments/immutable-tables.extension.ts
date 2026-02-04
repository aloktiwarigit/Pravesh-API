/**
 * Prisma Client Extension to block UPDATE/DELETE on immutable payment tables.
 *
 * Story 4.9: Immutable Payment Audit Trail
 *
 * Immutable tables: payments (financial fields), cash_receipts, payment_state_changes, refunds
 * These tables are append-only per NFR42.
 */
import { Prisma } from '@prisma/client';

/**
 * List of models where UPDATE and DELETE are blocked.
 * Status fields on Payment may be updated by the system, but financial data is immutable.
 */
const FULLY_IMMUTABLE_MODELS = [
  'PaymentStateChange',
  'CashReceipt',
  'Refund',
];

const UPDATE_RESTRICTED_FIELDS = {
  Payment: ['amountPaise', 'paymentMethod', 'razorpayPaymentId', 'razorpayOrderId', 'customerId', 'serviceRequestId'],
};

/**
 * Creates a Prisma extension that enforces immutability on payment tables.
 * Attach this to the Prisma client via prisma.$extends(immutableTablesExtension).
 */
export const immutableTablesExtension = Prisma.defineExtension({
  name: 'immutable-payment-tables',
  query: {
    $allOperations({ model, operation, args, query }) {
      // Block all DELETE operations on immutable tables
      if (model && FULLY_IMMUTABLE_MODELS.includes(model)) {
        if (operation === 'delete' || operation === 'deleteMany') {
          throw new Error(
            `DELETE operation is not allowed on immutable table: ${model}. ` +
            'This table is append-only per NFR42.',
          );
        }
        if (operation === 'update' || operation === 'updateMany') {
          throw new Error(
            `UPDATE operation is not allowed on immutable table: ${model}. ` +
            'This table is append-only per NFR42.',
          );
        }
      }

      // For Payment model, block updates to financial fields
      if (model === 'Payment' && (operation === 'update' || operation === 'updateMany')) {
        const restrictedFields = UPDATE_RESTRICTED_FIELDS.Payment;
        const data = (args as { data?: Record<string, unknown> }).data;

        if (data) {
          for (const field of restrictedFields) {
            if (field in data) {
              throw new Error(
                `Cannot update immutable field '${field}' on Payment table. ` +
                'Financial data is append-only per NFR42. ' +
                'Use payment_state_changes for status transitions.',
              );
            }
          }
        }
      }

      return query(args);
    },
  },
});
