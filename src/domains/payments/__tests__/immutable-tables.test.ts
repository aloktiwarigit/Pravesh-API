import { describe, test, expect, vi, beforeEach } from 'vitest';
import { Prisma } from '@prisma/client';
import { immutableTablesExtension } from '../immutable-tables.extension';

describe('[P0] Immutable Tables Extension - Audit Trail Protection', () => {
  let mockQuery: ReturnType<typeof vi.fn>;
  let extensionQuery: any;

  beforeEach(() => {
    // Mock the query function
    mockQuery = vi.fn((args) => Promise.resolve({ id: 'test-result' }));

    // Extract the query handler from the extension
    const extension = immutableTablesExtension as any;
    const queryHandler = extension.query.$allOperations;

    // Create a wrapper that calls the extension's query handler
    extensionQuery = (params: {
      model?: string;
      operation: string;
      args?: any;
    }) => {
      return queryHandler({
        model: params.model,
        operation: params.operation,
        args: params.args || {},
        query: mockQuery,
      });
    };
  });

  describe('[P0] DELETE Operations - Fully Immutable Models', () => {
    test('DELETE blocked on PaymentStateChange', async () => {
      // Given: DELETE operation on PaymentStateChange
      // When: Attempt to delete
      // Then: Throws error
      await expect(
        extensionQuery({
          model: 'PaymentStateChange',
          operation: 'delete',
          args: { where: { id: 'state-1' } },
        })
      ).rejects.toThrow(
        'DELETE operation is not allowed on immutable table: PaymentStateChange'
      );
      expect(mockQuery).not.toHaveBeenCalled();
    });

    test('DELETE blocked on CashReceipt', async () => {
      // Given: DELETE operation on CashReceipt
      // When: Attempt to delete
      // Then: Throws error
      await expect(
        extensionQuery({
          model: 'CashReceipt',
          operation: 'delete',
          args: { where: { id: 'receipt-1' } },
        })
      ).rejects.toThrow(
        'DELETE operation is not allowed on immutable table: CashReceipt'
      );
      expect(mockQuery).not.toHaveBeenCalled();
    });

    test('DELETE blocked on Refund', async () => {
      // Given: DELETE operation on Refund
      // When: Attempt to delete
      // Then: Throws error
      await expect(
        extensionQuery({
          model: 'Refund',
          operation: 'delete',
          args: { where: { id: 'refund-1' } },
        })
      ).rejects.toThrow(
        'DELETE operation is not allowed on immutable table: Refund'
      );
      expect(mockQuery).not.toHaveBeenCalled();
    });

    test('deleteMany blocked on PaymentStateChange', async () => {
      // Given: deleteMany operation
      // When: Attempt bulk delete
      // Then: Throws error
      await expect(
        extensionQuery({
          model: 'PaymentStateChange',
          operation: 'deleteMany',
          args: { where: { paymentId: 'payment-123' } },
        })
      ).rejects.toThrow(
        'DELETE operation is not allowed on immutable table: PaymentStateChange'
      );
    });

    test('deleteMany blocked on CashReceipt', async () => {
      // Given: deleteMany on CashReceipt
      // When: Attempt to delete
      // Then: Blocked
      await expect(
        extensionQuery({
          model: 'CashReceipt',
          operation: 'deleteMany',
          args: {},
        })
      ).rejects.toThrow('DELETE operation is not allowed on immutable table');
    });

    test('deleteMany blocked on Refund', async () => {
      // Given: deleteMany on Refund
      // When: Attempt to delete
      // Then: Blocked
      await expect(
        extensionQuery({
          model: 'Refund',
          operation: 'deleteMany',
          args: { where: { status: 'processed' } },
        })
      ).rejects.toThrow('DELETE operation is not allowed on immutable table');
    });

    test('error message mentions NFR42', async () => {
      // Given: DELETE on immutable table
      // When: Attempt to delete
      // Then: Error mentions NFR42
      await expect(
        extensionQuery({
          model: 'PaymentStateChange',
          operation: 'delete',
          args: { where: { id: '1' } },
        })
      ).rejects.toThrow('This table is append-only per NFR42');
    });
  });

  describe('[P0] UPDATE Operations - Fully Immutable Models', () => {
    test('UPDATE blocked on PaymentStateChange', async () => {
      // Given: UPDATE operation on PaymentStateChange
      // When: Attempt to update
      // Then: Throws error
      await expect(
        extensionQuery({
          model: 'PaymentStateChange',
          operation: 'update',
          args: {
            where: { id: 'state-1' },
            data: { status: 'modified' },
          },
        })
      ).rejects.toThrow(
        'UPDATE operation is not allowed on immutable table: PaymentStateChange'
      );
      expect(mockQuery).not.toHaveBeenCalled();
    });

    test('UPDATE blocked on CashReceipt', async () => {
      // Given: UPDATE on CashReceipt
      // When: Attempt to update
      // Then: Blocked
      await expect(
        extensionQuery({
          model: 'CashReceipt',
          operation: 'update',
          args: {
            where: { id: 'receipt-1' },
            data: { amount: 5000 },
          },
        })
      ).rejects.toThrow(
        'UPDATE operation is not allowed on immutable table: CashReceipt'
      );
    });

    test('UPDATE blocked on Refund', async () => {
      // Given: UPDATE on Refund
      // When: Attempt to update
      // Then: Blocked
      await expect(
        extensionQuery({
          model: 'Refund',
          operation: 'update',
          args: {
            where: { id: 'refund-1' },
            data: { refundAmountPaise: 10000 },
          },
        })
      ).rejects.toThrow(
        'UPDATE operation is not allowed on immutable table: Refund'
      );
    });

    test('updateMany blocked on PaymentStateChange', async () => {
      // Given: updateMany on PaymentStateChange
      // When: Attempt to update
      // Then: Blocked
      await expect(
        extensionQuery({
          model: 'PaymentStateChange',
          operation: 'updateMany',
          args: {
            where: { paymentId: 'payment-123' },
            data: { status: 'void' },
          },
        })
      ).rejects.toThrow(
        'UPDATE operation is not allowed on immutable table: PaymentStateChange'
      );
    });

    test('updateMany blocked on CashReceipt', async () => {
      // Given: updateMany on CashReceipt
      // When: Attempt bulk update
      // Then: Blocked
      await expect(
        extensionQuery({
          model: 'CashReceipt',
          operation: 'updateMany',
          args: {
            where: { dealerId: 'dealer-1' },
            data: { verified: true },
          },
        })
      ).rejects.toThrow('UPDATE operation is not allowed on immutable table');
    });

    test('updateMany blocked on Refund', async () => {
      // Given: updateMany on Refund
      // When: Attempt to update
      // Then: Blocked
      await expect(
        extensionQuery({
          model: 'Refund',
          operation: 'updateMany',
          args: {},
        })
      ).rejects.toThrow('UPDATE operation is not allowed on immutable table');
    });
  });

  describe('[P0] Payment Model - Restricted Field Updates', () => {
    test('UPDATE blocked on Payment.amountPaise', async () => {
      // Given: UPDATE on financial field
      // When: Attempt to change amountPaise
      // Then: Blocked
      await expect(
        extensionQuery({
          model: 'Payment',
          operation: 'update',
          args: {
            where: { id: 'payment-1' },
            data: { amountPaise: 999999 },
          },
        })
      ).rejects.toThrow(
        "Cannot update immutable field 'amountPaise' on Payment table"
      );
      expect(mockQuery).not.toHaveBeenCalled();
    });

    test('UPDATE blocked on Payment.razorpayPaymentId', async () => {
      // Given: UPDATE on razorpayPaymentId
      // When: Attempt to change
      // Then: Blocked
      await expect(
        extensionQuery({
          model: 'Payment',
          operation: 'update',
          args: {
            where: { id: 'payment-1' },
            data: { razorpayPaymentId: 'fake-id' },
          },
        })
      ).rejects.toThrow(
        "Cannot update immutable field 'razorpayPaymentId' on Payment table"
      );
    });

    test('UPDATE blocked on Payment.razorpayOrderId', async () => {
      // Given: UPDATE on razorpayOrderId
      // When: Attempt to change
      // Then: Blocked
      await expect(
        extensionQuery({
          model: 'Payment',
          operation: 'update',
          args: {
            where: { id: 'payment-1' },
            data: { razorpayOrderId: 'fake-order' },
          },
        })
      ).rejects.toThrow(
        "Cannot update immutable field 'razorpayOrderId' on Payment table"
      );
    });

    test('UPDATE blocked on Payment.paymentMethod', async () => {
      // Given: UPDATE on paymentMethod
      // When: Attempt to change
      // Then: Blocked
      await expect(
        extensionQuery({
          model: 'Payment',
          operation: 'update',
          args: {
            where: { id: 'payment-1' },
            data: { paymentMethod: 'CASH' },
          },
        })
      ).rejects.toThrow(
        "Cannot update immutable field 'paymentMethod' on Payment table"
      );
    });

    test('UPDATE blocked on Payment.customerId', async () => {
      // Given: UPDATE on customerId
      // When: Attempt to change
      // Then: Blocked
      await expect(
        extensionQuery({
          model: 'Payment',
          operation: 'update',
          args: {
            where: { id: 'payment-1' },
            data: { customerId: 'different-customer' },
          },
        })
      ).rejects.toThrow(
        "Cannot update immutable field 'customerId' on Payment table"
      );
    });

    test('UPDATE blocked on Payment.serviceRequestId', async () => {
      // Given: UPDATE on serviceRequestId
      // When: Attempt to change
      // Then: Blocked
      await expect(
        extensionQuery({
          model: 'Payment',
          operation: 'update',
          args: {
            where: { id: 'payment-1' },
            data: { serviceRequestId: 'different-request' },
          },
        })
      ).rejects.toThrow(
        "Cannot update immutable field 'serviceRequestId' on Payment table"
      );
    });

    test('UPDATE allowed on Payment.status field', async () => {
      // Given: UPDATE on status field (allowed)
      // When: Change status
      const result = await extensionQuery({
        model: 'Payment',
        operation: 'update',
        args: {
          where: { id: 'payment-1' },
          data: { status: 'COMPLETED' },
        },
      });

      // Then: Allowed (passes through to query)
      expect(mockQuery).toHaveBeenCalledWith({
        where: { id: 'payment-1' },
        data: { status: 'COMPLETED' },
      });
      expect(result).toEqual({ id: 'test-result' });
    });

    test('UPDATE allowed on Payment non-financial fields', async () => {
      // Given: UPDATE on allowed fields
      // When: Update notes or other metadata
      const result = await extensionQuery({
        model: 'Payment',
        operation: 'update',
        args: {
          where: { id: 'payment-1' },
          data: { notes: 'Payment verified', status: 'VERIFIED' },
        },
      });

      // Then: Allowed
      expect(mockQuery).toHaveBeenCalled();
      expect(result).toEqual({ id: 'test-result' });
    });

    test('updateMany blocked on Payment.amountPaise', async () => {
      // Given: updateMany on financial field
      // When: Attempt bulk update
      // Then: Blocked
      await expect(
        extensionQuery({
          model: 'Payment',
          operation: 'updateMany',
          args: {
            where: { status: 'PENDING' },
            data: { amountPaise: 0 },
          },
        })
      ).rejects.toThrow("Cannot update immutable field 'amountPaise'");
    });

    test('updateMany allowed on Payment.status', async () => {
      // Given: updateMany on status
      // When: Bulk status update
      const result = await extensionQuery({
        model: 'Payment',
        operation: 'updateMany',
        args: {
          where: { status: 'PENDING' },
          data: { status: 'EXPIRED' },
        },
      });

      // Then: Allowed
      expect(mockQuery).toHaveBeenCalled();
      expect(result).toEqual({ id: 'test-result' });
    });

    test('error message mentions NFR42 and payment_state_changes', async () => {
      // Given: Blocked update on Payment
      // When: Attempt to update financial field
      // Then: Error message is helpful
      await expect(
        extensionQuery({
          model: 'Payment',
          operation: 'update',
          args: {
            where: { id: 'payment-1' },
            data: { amountPaise: 123 },
          },
        })
      ).rejects.toThrow('Financial data is append-only per NFR42');

      await expect(
        extensionQuery({
          model: 'Payment',
          operation: 'update',
          args: {
            where: { id: 'payment-1' },
            data: { razorpayPaymentId: 'fake' },
          },
        })
      ).rejects.toThrow('Use payment_state_changes for status transitions');
    });
  });

  describe('[P0] Non-Immutable Models', () => {
    test('non-immutable models allow DELETE', async () => {
      // Given: Non-immutable model
      // When: DELETE operation
      const result = await extensionQuery({
        model: 'User',
        operation: 'delete',
        args: { where: { id: 'user-1' } },
      });

      // Then: Allowed
      expect(mockQuery).toHaveBeenCalledWith({ where: { id: 'user-1' } });
      expect(result).toEqual({ id: 'test-result' });
    });

    test('non-immutable models allow UPDATE', async () => {
      // Given: Non-immutable model
      // When: UPDATE operation
      const result = await extensionQuery({
        model: 'ServiceRequest',
        operation: 'update',
        args: {
          where: { id: 'request-1' },
          data: { status: 'COMPLETED' },
        },
      });

      // Then: Allowed
      expect(mockQuery).toHaveBeenCalled();
      expect(result).toEqual({ id: 'test-result' });
    });

    test('non-immutable models allow deleteMany', async () => {
      // Given: Non-immutable model
      // When: deleteMany
      const result = await extensionQuery({
        model: 'Agent',
        operation: 'deleteMany',
        args: { where: { inactive: true } },
      });

      // Then: Allowed
      expect(mockQuery).toHaveBeenCalled();
    });

    test('non-immutable models allow updateMany', async () => {
      // Given: Non-immutable model
      // When: updateMany
      const result = await extensionQuery({
        model: 'Dealer',
        operation: 'updateMany',
        args: {
          where: { cityId: 'city-123' },
          data: { verified: true },
        },
      });

      // Then: Allowed
      expect(mockQuery).toHaveBeenCalled();
    });

    test('operations without model pass through', async () => {
      // Given: Operation without model (e.g., $executeRaw)
      // When: Execute
      const result = await extensionQuery({
        operation: 'executeRaw',
        args: {},
      });

      // Then: Passes through
      expect(mockQuery).toHaveBeenCalled();
    });
  });

  describe('[P0] Edge Cases', () => {
    test('CREATE operations are allowed on all models', async () => {
      // Given: CREATE on immutable tables (append-only)
      // When: Create PaymentStateChange
      const result1 = await extensionQuery({
        model: 'PaymentStateChange',
        operation: 'create',
        args: { data: { paymentId: 'pay-1', status: 'CAPTURED' } },
      });

      // Then: Allowed (append-only)
      expect(mockQuery).toHaveBeenCalled();

      vi.clearAllMocks();

      // When: Create CashReceipt
      const result2 = await extensionQuery({
        model: 'CashReceipt',
        operation: 'create',
        args: { data: { amountPaise: 10000 } },
      });

      // Then: Allowed
      expect(mockQuery).toHaveBeenCalled();

      vi.clearAllMocks();

      // When: Create Refund
      const result3 = await extensionQuery({
        model: 'Refund',
        operation: 'create',
        args: { data: { refundAmountPaise: 5000 } },
      });

      // Then: Allowed
      expect(mockQuery).toHaveBeenCalled();
    });

    test('createMany allowed on immutable tables', async () => {
      // Given: createMany on immutable table
      // When: Bulk create
      const result = await extensionQuery({
        model: 'PaymentStateChange',
        operation: 'createMany',
        args: {
          data: [
            { paymentId: 'pay-1', status: 'CAPTURED' },
            { paymentId: 'pay-2', status: 'FAILED' },
          ],
        },
      });

      // Then: Allowed (append-only)
      expect(mockQuery).toHaveBeenCalled();
    });

    test('READ operations pass through on all models', async () => {
      // Given: READ operations
      const operations = [
        'findUnique',
        'findFirst',
        'findMany',
        'count',
        'aggregate',
        'groupBy',
      ];

      for (const op of operations) {
        vi.clearAllMocks();

        // When: Read operation on immutable table
        await extensionQuery({
          model: 'PaymentStateChange',
          operation: op,
          args: {},
        });

        // Then: Allowed
        expect(mockQuery).toHaveBeenCalled();
      }
    });

    test('multiple restricted fields in same UPDATE all blocked', async () => {
      // Given: UPDATE with multiple restricted fields
      // When: Attempt to update multiple financial fields
      // Then: First field in check order triggers error
      await expect(
        extensionQuery({
          model: 'Payment',
          operation: 'update',
          args: {
            where: { id: 'payment-1' },
            data: {
              amountPaise: 999,
              razorpayPaymentId: 'fake-id',
              customerId: 'fake-customer',
            },
          },
        })
      ).rejects.toThrow("Cannot update immutable field");
    });

    test('UPDATE with empty data object passes through', async () => {
      // Given: UPDATE with no data
      // When: Empty update
      const result = await extensionQuery({
        model: 'Payment',
        operation: 'update',
        args: {
          where: { id: 'payment-1' },
          data: {},
        },
      });

      // Then: Passes through (no restricted fields)
      expect(mockQuery).toHaveBeenCalled();
    });

    test('UPDATE with null data passes through', async () => {
      // Given: UPDATE with undefined data
      // When: No data provided
      const result = await extensionQuery({
        model: 'Payment',
        operation: 'update',
        args: {
          where: { id: 'payment-1' },
        },
      });

      // Then: Passes through
      expect(mockQuery).toHaveBeenCalled();
    });

    test('case-sensitive model names', async () => {
      // Given: Wrong case for model name
      // When: Different case
      const result = await extensionQuery({
        model: 'paymentStateChange', // lowercase
        operation: 'delete',
        args: {},
      });

      // Then: Not blocked (case-sensitive check)
      expect(mockQuery).toHaveBeenCalled();
    });

    test('all fully immutable models are protected', async () => {
      // Given: List of fully immutable models
      const fullyImmutableModels = [
        'PaymentStateChange',
        'CashReceipt',
        'Refund',
      ];

      // When/Then: Each blocks DELETE
      for (const model of fullyImmutableModels) {
        await expect(
          extensionQuery({
            model,
            operation: 'delete',
            args: { where: { id: '1' } },
          })
        ).rejects.toThrow(`DELETE operation is not allowed on immutable table: ${model}`);
      }

      // When/Then: Each blocks UPDATE
      for (const model of fullyImmutableModels) {
        await expect(
          extensionQuery({
            model,
            operation: 'update',
            args: { where: { id: '1' }, data: {} },
          })
        ).rejects.toThrow(`UPDATE operation is not allowed on immutable table: ${model}`);
      }
    });

    test('all Payment restricted fields are protected', async () => {
      // Given: All restricted fields
      const restrictedFields = [
        'amountPaise',
        'paymentMethod',
        'razorpayPaymentId',
        'razorpayOrderId',
        'customerId',
        'serviceRequestId',
      ];

      // When/Then: Each field is blocked
      for (const field of restrictedFields) {
        await expect(
          extensionQuery({
            model: 'Payment',
            operation: 'update',
            args: {
              where: { id: 'payment-1' },
              data: { [field]: 'fake-value' },
            },
          })
        ).rejects.toThrow(`Cannot update immutable field '${field}' on Payment table`);
      }
    });
  });
});
