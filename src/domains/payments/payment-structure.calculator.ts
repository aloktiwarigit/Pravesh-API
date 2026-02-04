/**
 * Payment structure calculator for 30/70 split enforcement.
 * All calculations use BigInt integer arithmetic - no floating point.
 *
 * Story 4.3: Payment Structure Enforcement
 */

export interface PaymentStructure {
  serviceFeePaise: bigint;
  govtFeeEstimatePaise: bigint;
  advanceServiceFeePaise: bigint;   // 30% of service fee
  balanceServiceFeePaise: bigint;   // 70% of service fee (remainder)
  totalUpfrontPaise: bigint;        // 100% govt fee + 30% service fee
  totalBalancePaise: bigint;        // 70% service fee
  totalPaise: bigint;               // Total = service fee + govt fee
}

/**
 * Calculates the payment structure for a service request.
 * Enforces: 100% govt fees + 30% service fee upfront, 70% balance at completion.
 *
 * Uses BigInt integer division - remainder goes to balance (floor division).
 * advance = (serviceFee * 30n) / 100n
 * balance = serviceFee - advance (gets any remainder from integer division)
 */
export function calculatePaymentStructure(
  serviceFeePaise: bigint,
  govtFeeEstimatePaise: bigint,
): PaymentStructure {
  if (serviceFeePaise < 0n) {
    throw new Error('Service fee must be non-negative');
  }
  if (govtFeeEstimatePaise < 0n) {
    throw new Error('Government fee must be non-negative');
  }

  // 30% advance, integer division (floor)
  const advanceServiceFeePaise = (serviceFeePaise * 30n) / 100n;
  // 70% balance = total - advance (captures any remainder from division)
  const balanceServiceFeePaise = serviceFeePaise - advanceServiceFeePaise;

  // Upfront = all govt fees + 30% service fee
  const totalUpfrontPaise = govtFeeEstimatePaise + advanceServiceFeePaise;
  // Balance = 70% service fee
  const totalBalancePaise = balanceServiceFeePaise;
  // Grand total
  const totalPaise = serviceFeePaise + govtFeeEstimatePaise;

  return {
    serviceFeePaise,
    govtFeeEstimatePaise,
    advanceServiceFeePaise,
    balanceServiceFeePaise,
    totalUpfrontPaise,
    totalBalancePaise,
    totalPaise,
  };
}

/**
 * Validates that a payment amount matches the expected structure.
 */
export function validatePaymentAmount(
  paymentType: 'ADVANCE' | 'BALANCE' | 'FULL',
  amountPaise: bigint,
  structure: PaymentStructure,
): { valid: boolean; expectedPaise: bigint; message?: string } {
  let expectedPaise: bigint;

  switch (paymentType) {
    case 'ADVANCE':
      expectedPaise = structure.totalUpfrontPaise;
      break;
    case 'BALANCE':
      expectedPaise = structure.totalBalancePaise;
      break;
    case 'FULL':
      expectedPaise = structure.totalPaise;
      break;
    default:
      return { valid: false, expectedPaise: 0n, message: 'Invalid payment type' };
  }

  if (amountPaise !== expectedPaise) {
    return {
      valid: false,
      expectedPaise,
      message: `Expected ${expectedPaise.toString()} paise for ${paymentType}, got ${amountPaise.toString()}`,
    };
  }

  return { valid: true, expectedPaise };
}

/**
 * Status transition guard - validates that payment type is allowed
 * based on current service request payment status.
 *
 * Story 4.3 AC3
 */
export function canMakePayment(
  paymentType: 'ADVANCE' | 'BALANCE' | 'FULL',
  currentStatus: string,
): { allowed: boolean; reason?: string } {
  switch (paymentType) {
    case 'ADVANCE':
      if (currentStatus !== 'PENDING_PAYMENT') {
        return { allowed: false, reason: 'Advance payment only allowed when pending' };
      }
      return { allowed: true };

    case 'BALANCE':
      if (currentStatus !== 'BALANCE_DUE') {
        return { allowed: false, reason: 'Balance payment only allowed when balance is due' };
      }
      return { allowed: true };

    case 'FULL':
      if (currentStatus !== 'PENDING_PAYMENT') {
        return { allowed: false, reason: 'Full payment only allowed when pending' };
      }
      return { allowed: true };

    default:
      return { allowed: false, reason: 'Invalid payment type' };
  }
}
