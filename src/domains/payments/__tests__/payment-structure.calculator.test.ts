import { describe, test, expect } from 'vitest';
import {
  calculatePaymentStructure,
  validatePaymentAmount,
  canMakePayment,
} from '../payment-structure.calculator';

describe('[P0] Payment Structure Calculator - 30/70 Split', () => {
  describe('[P0] Payment Structure Calculation', () => {
    test('30/70 split: advance = 30% of service fee, balance = 70%', () => {
      // Given: Service fee of 10,000 paise (100 rupees)
      const serviceFeePaise = 10000n;
      const govtFeePaise = 5000n;

      // When: Calculate payment structure
      const structure = calculatePaymentStructure(serviceFeePaise, govtFeePaise);

      // Then: 30% advance, 70% balance
      expect(structure.advanceServiceFeePaise).toBe(3000n); // 30% of 10000
      expect(structure.balanceServiceFeePaise).toBe(7000n); // 70% of 10000
      expect(structure.totalUpfrontPaise).toBe(8000n); // 5000 govt + 3000 advance
      expect(structure.totalBalancePaise).toBe(7000n); // balance only
      expect(structure.totalPaise).toBe(15000n); // 10000 + 5000
    });

    test('upfront = 100% govt fee + 30% service fee', () => {
      // Given: Govt fee 20,000, service fee 10,000
      const serviceFeePaise = 10000n;
      const govtFeePaise = 20000n;

      // When: Calculate structure
      const structure = calculatePaymentStructure(serviceFeePaise, govtFeePaise);

      // Then: Upfront includes all govt fees
      expect(structure.totalUpfrontPaise).toBe(23000n); // 20000 + 3000
      expect(structure.advanceServiceFeePaise).toBe(3000n);
    });

    test('full payment = total of service + govt fees', () => {
      // Given: Fees
      const serviceFeePaise = 50000n;
      const govtFeePaise = 30000n;

      // When: Calculate structure
      const structure = calculatePaymentStructure(serviceFeePaise, govtFeePaise);

      // Then: Total is sum
      expect(structure.totalPaise).toBe(80000n);
      expect(structure.serviceFeePaise).toBe(50000n);
      expect(structure.govtFeeEstimatePaise).toBe(30000n);
    });

    test('remainder handling with BigInt division', () => {
      // Given: Service fee not divisible by 100 (e.g., 10,001 paise)
      const serviceFeePaise = 10001n;
      const govtFeePaise = 0n;

      // When: Calculate structure
      const structure = calculatePaymentStructure(serviceFeePaise, govtFeePaise);

      // Then: Integer division floors, remainder goes to balance
      expect(structure.advanceServiceFeePaise).toBe(3000n); // (10001 * 30) / 100 = 3000 (floor)
      expect(structure.balanceServiceFeePaise).toBe(7001n); // 10001 - 3000 = 7001 (gets remainder)

      // Verify totals still match
      expect(
        structure.advanceServiceFeePaise + structure.balanceServiceFeePaise
      ).toBe(serviceFeePaise);
    });

    test('edge case: 0 service fee', () => {
      // Given: Only govt fees, no service fee
      const serviceFeePaise = 0n;
      const govtFeePaise = 10000n;

      // When: Calculate structure
      const structure = calculatePaymentStructure(serviceFeePaise, govtFeePaise);

      // Then: All amounts are govt fee only
      expect(structure.advanceServiceFeePaise).toBe(0n);
      expect(structure.balanceServiceFeePaise).toBe(0n);
      expect(structure.totalUpfrontPaise).toBe(10000n); // Only govt fee
      expect(structure.totalBalancePaise).toBe(0n);
      expect(structure.totalPaise).toBe(10000n);
    });

    test('edge case: 0 govt fee', () => {
      // Given: Only service fee, no govt fee
      const serviceFeePaise = 10000n;
      const govtFeePaise = 0n;

      // When: Calculate structure
      const structure = calculatePaymentStructure(serviceFeePaise, govtFeePaise);

      // Then: Split applies to service fee only
      expect(structure.advanceServiceFeePaise).toBe(3000n);
      expect(structure.balanceServiceFeePaise).toBe(7000n);
      expect(structure.totalUpfrontPaise).toBe(3000n); // No govt fee
      expect(structure.totalBalancePaise).toBe(7000n);
      expect(structure.govtFeeEstimatePaise).toBe(0n);
    });

    test('edge case: both fees are 0', () => {
      // Given: No fees at all
      const serviceFeePaise = 0n;
      const govtFeePaise = 0n;

      // When: Calculate structure
      const structure = calculatePaymentStructure(serviceFeePaise, govtFeePaise);

      // Then: All zeros
      expect(structure.advanceServiceFeePaise).toBe(0n);
      expect(structure.balanceServiceFeePaise).toBe(0n);
      expect(structure.totalUpfrontPaise).toBe(0n);
      expect(structure.totalBalancePaise).toBe(0n);
      expect(structure.totalPaise).toBe(0n);
    });

    test('very large amounts maintain precision', () => {
      // Given: Very large fees (e.g., high-value property)
      const serviceFeePaise = 100000000n; // 10 lakh rupees in paise
      const govtFeePaise = 500000000n; // 50 lakh rupees in paise

      // When: Calculate structure
      const structure = calculatePaymentStructure(serviceFeePaise, govtFeePaise);

      // Then: Calculations are precise
      expect(structure.advanceServiceFeePaise).toBe(30000000n); // 30% of 1 crore paise
      expect(structure.balanceServiceFeePaise).toBe(70000000n); // 70%
      expect(structure.totalUpfrontPaise).toBe(530000000n); // 500M + 30M
      expect(structure.totalPaise).toBe(600000000n); // 100M + 500M
    });

    test('negative service fee throws error', () => {
      // Given: Negative service fee
      const serviceFeePaise = -1000n;
      const govtFeePaise = 5000n;

      // When/Then: Throws error
      expect(() => calculatePaymentStructure(serviceFeePaise, govtFeePaise)).toThrow(
        'Service fee must be non-negative'
      );
    });

    test('negative govt fee throws error', () => {
      // Given: Negative govt fee
      const serviceFeePaise = 10000n;
      const govtFeePaise = -5000n;

      // When/Then: Throws error
      expect(() => calculatePaymentStructure(serviceFeePaise, govtFeePaise)).toThrow(
        'Government fee must be non-negative'
      );
    });

    test('structure fields are all BigInt', () => {
      // Given: Any valid fees
      const structure = calculatePaymentStructure(10000n, 5000n);

      // Then: All numeric fields are BigInt
      expect(typeof structure.serviceFeePaise).toBe('bigint');
      expect(typeof structure.govtFeeEstimatePaise).toBe('bigint');
      expect(typeof structure.advanceServiceFeePaise).toBe('bigint');
      expect(typeof structure.balanceServiceFeePaise).toBe('bigint');
      expect(typeof structure.totalUpfrontPaise).toBe('bigint');
      expect(typeof structure.totalBalancePaise).toBe('bigint');
      expect(typeof structure.totalPaise).toBe('bigint');
    });
  });

  describe('[P0] Payment Amount Validation', () => {
    test('validatePaymentAmount for ADVANCE - exact match passes', () => {
      // Given: Payment structure
      const structure = calculatePaymentStructure(10000n, 5000n);

      // When: Validate ADVANCE payment with correct amount
      const result = validatePaymentAmount(
        'ADVANCE',
        8000n, // 5000 govt + 3000 advance
        structure
      );

      // Then: Validation passes
      expect(result.valid).toBe(true);
      expect(result.expectedPaise).toBe(8000n);
      expect(result.message).toBeUndefined();
    });

    test('validatePaymentAmount for ADVANCE - wrong amount fails', () => {
      // Given: Payment structure
      const structure = calculatePaymentStructure(10000n, 5000n);

      // When: Validate ADVANCE with incorrect amount
      const result = validatePaymentAmount('ADVANCE', 7000n, structure);

      // Then: Validation fails
      expect(result.valid).toBe(false);
      expect(result.expectedPaise).toBe(8000n);
      expect(result.message).toBe(
        'Expected 8000 paise for ADVANCE, got 7000'
      );
    });

    test('validatePaymentAmount for BALANCE - exact match passes', () => {
      // Given: Payment structure
      const structure = calculatePaymentStructure(10000n, 5000n);

      // When: Validate BALANCE payment
      const result = validatePaymentAmount('BALANCE', 7000n, structure);

      // Then: Passes
      expect(result.valid).toBe(true);
      expect(result.expectedPaise).toBe(7000n);
    });

    test('validatePaymentAmount for BALANCE - wrong amount fails', () => {
      // Given: Payment structure
      const structure = calculatePaymentStructure(10000n, 5000n);

      // When: Validate BALANCE with wrong amount
      const result = validatePaymentAmount('BALANCE', 8000n, structure);

      // Then: Fails
      expect(result.valid).toBe(false);
      expect(result.expectedPaise).toBe(7000n);
      expect(result.message).toContain('Expected 7000 paise for BALANCE');
    });

    test('validatePaymentAmount for FULL - exact match passes', () => {
      // Given: Payment structure
      const structure = calculatePaymentStructure(10000n, 5000n);

      // When: Validate FULL payment
      const result = validatePaymentAmount('FULL', 15000n, structure);

      // Then: Passes
      expect(result.valid).toBe(true);
      expect(result.expectedPaise).toBe(15000n);
    });

    test('validatePaymentAmount for FULL - wrong amount fails', () => {
      // Given: Payment structure
      const structure = calculatePaymentStructure(10000n, 5000n);

      // When: Validate FULL with wrong amount
      const result = validatePaymentAmount('FULL', 14000n, structure);

      // Then: Fails
      expect(result.valid).toBe(false);
      expect(result.message).toBe('Expected 15000 paise for FULL, got 14000');
    });

    test('validatePaymentAmount with 0 amount', () => {
      // Given: Structure with 0 fees
      const structure = calculatePaymentStructure(0n, 0n);

      // When: Validate 0 ADVANCE
      const result = validatePaymentAmount('ADVANCE', 0n, structure);

      // Then: Passes (0 is valid)
      expect(result.valid).toBe(true);
      expect(result.expectedPaise).toBe(0n);
    });

    test('validatePaymentAmount rejects overpayment', () => {
      // Given: Structure
      const structure = calculatePaymentStructure(10000n, 5000n);

      // When: Amount is higher than expected
      const result = validatePaymentAmount('ADVANCE', 9000n, structure);

      // Then: Rejected (must be exact)
      expect(result.valid).toBe(false);
    });

    test('validatePaymentAmount rejects underpayment', () => {
      // Given: Structure
      const structure = calculatePaymentStructure(10000n, 5000n);

      // When: Amount is lower than expected
      const result = validatePaymentAmount('BALANCE', 6000n, structure);

      // Then: Rejected
      expect(result.valid).toBe(false);
    });
  });

  describe('[P0] State Transition Guards - canMakePayment', () => {
    test('ADVANCE allowed when status is PENDING_PAYMENT', () => {
      // Given: Service request in PENDING_PAYMENT state
      const currentStatus = 'PENDING_PAYMENT';

      // When: Check if ADVANCE payment allowed
      const result = canMakePayment('ADVANCE', currentStatus);

      // Then: Allowed
      expect(result.allowed).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    test('ADVANCE rejected when status is not PENDING_PAYMENT', () => {
      // Given: Service request in BALANCE_DUE state
      const currentStatus = 'BALANCE_DUE';

      // When: Check if ADVANCE payment allowed
      const result = canMakePayment('ADVANCE', currentStatus);

      // Then: Not allowed
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('Advance payment only allowed when pending');
    });

    test('ADVANCE rejected after completion', () => {
      // Given: Completed service
      const currentStatus = 'COMPLETED';

      // When: Attempting ADVANCE
      const result = canMakePayment('ADVANCE', currentStatus);

      // Then: Rejected
      expect(result.allowed).toBe(false);
    });

    test('BALANCE allowed when status is BALANCE_DUE', () => {
      // Given: Service in BALANCE_DUE state
      const currentStatus = 'BALANCE_DUE';

      // When: Check BALANCE payment
      const result = canMakePayment('BALANCE', currentStatus);

      // Then: Allowed
      expect(result.allowed).toBe(true);
    });

    test('BALANCE rejected when status is not BALANCE_DUE', () => {
      // Given: Service still pending
      const currentStatus = 'PENDING_PAYMENT';

      // When: Check BALANCE payment
      const result = canMakePayment('BALANCE', currentStatus);

      // Then: Not allowed
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('Balance payment only allowed when balance is due');
    });

    test('BALANCE rejected when already completed', () => {
      // Given: Completed service
      const currentStatus = 'COMPLETED';

      // When: Attempting BALANCE
      const result = canMakePayment('BALANCE', currentStatus);

      // Then: Rejected
      expect(result.allowed).toBe(false);
    });

    test('FULL allowed when status is PENDING_PAYMENT', () => {
      // Given: Service in PENDING_PAYMENT state
      const currentStatus = 'PENDING_PAYMENT';

      // When: Check FULL payment
      const result = canMakePayment('FULL', currentStatus);

      // Then: Allowed
      expect(result.allowed).toBe(true);
    });

    test('FULL rejected when status is not PENDING_PAYMENT', () => {
      // Given: Balance due state
      const currentStatus = 'BALANCE_DUE';

      // When: Check FULL payment
      const result = canMakePayment('FULL', currentStatus);

      // Then: Not allowed
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('Full payment only allowed when pending');
    });

    test('FULL rejected after partial payment', () => {
      // Given: Advance already paid
      const currentStatus = 'IN_PROGRESS';

      // When: Attempting FULL
      const result = canMakePayment('FULL', currentStatus);

      // Then: Rejected
      expect(result.allowed).toBe(false);
    });

    test('invalid payment type rejected', () => {
      // Given: Invalid payment type
      const currentStatus = 'PENDING_PAYMENT';

      // When: Check invalid type
      const result = canMakePayment('PARTIAL' as any, currentStatus);

      // Then: Not allowed
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('Invalid payment type');
    });
  });

  describe('[P0] Integration Scenarios', () => {
    test('complete payment flow: ADVANCE then BALANCE', () => {
      // Given: Service with fees
      const structure = calculatePaymentStructure(20000n, 10000n);

      // When: Step 1 - Validate ADVANCE payment
      const advanceValidation = validatePaymentAmount(
        'ADVANCE',
        16000n, // 10000 govt + 6000 advance (30% of 20000)
        structure
      );
      const canPayAdvance = canMakePayment('ADVANCE', 'PENDING_PAYMENT');

      // Then: ADVANCE is valid
      expect(advanceValidation.valid).toBe(true);
      expect(canPayAdvance.allowed).toBe(true);

      // When: Step 2 - After advance paid, validate BALANCE
      const balanceValidation = validatePaymentAmount(
        'BALANCE',
        14000n, // 70% of 20000
        structure
      );
      const canPayBalance = canMakePayment('BALANCE', 'BALANCE_DUE');

      // Then: BALANCE is valid
      expect(balanceValidation.valid).toBe(true);
      expect(canPayBalance.allowed).toBe(true);

      // And: Total matches
      expect(advanceValidation.expectedPaise + balanceValidation.expectedPaise).toBe(
        structure.totalPaise
      );
    });

    test('complete payment flow: FULL payment', () => {
      // Given: Service with fees
      const structure = calculatePaymentStructure(20000n, 10000n);

      // When: Single FULL payment
      const fullValidation = validatePaymentAmount('FULL', 30000n, structure);
      const canPayFull = canMakePayment('FULL', 'PENDING_PAYMENT');

      // Then: FULL is valid
      expect(fullValidation.valid).toBe(true);
      expect(canPayFull.allowed).toBe(true);
      expect(fullValidation.expectedPaise).toBe(structure.totalPaise);
    });

    test('remainder from division goes to balance', () => {
      // Given: Service fee with remainder (e.g., 99 paise)
      const structure = calculatePaymentStructure(99n, 0n);

      // When: Calculate split
      // Then: advance = (99 * 30) / 100 = 29 (floor)
      //       balance = 99 - 29 = 70 (gets remainder)
      expect(structure.advanceServiceFeePaise).toBe(29n);
      expect(structure.balanceServiceFeePaise).toBe(70n);

      // And: Sum equals original
      expect(
        structure.advanceServiceFeePaise + structure.balanceServiceFeePaise
      ).toBe(99n);
    });
  });
});
