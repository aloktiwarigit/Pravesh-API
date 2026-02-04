/**
 * Payment type definitions.
 *
 * Story 4.1: Razorpay SDK Integration
 */

export enum PaymentStatus {
  CREATED = 'CREATED',
  PROCESSING = 'PROCESSING',
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
  REFUNDED = 'REFUNDED',
}

export enum PaymentType {
  ADVANCE = 'ADVANCE',
  BALANCE = 'BALANCE',
  FULL = 'FULL',
}

export enum PaymentMethod {
  RAZORPAY = 'razorpay',
  PAYMENT_LINK = 'payment_link',
  CASH = 'cash',
  WIRE_TRANSFER = 'wire_transfer',
}

export interface PaymentOrderResponse {
  orderId: string;
  amountPaise: string;
  currency: string;
  razorpayKeyId: string;
  serviceRequestId: string;
  paymentType: string;
}

export interface PaymentVerificationResult {
  paymentId: string;
  status: PaymentStatus;
  amountPaise: string;
  serviceRequestId: string;
}

export interface PaymentBreakdownResult {
  serviceFeePaise: bigint;
  govtFeePaise: bigint;
  creditsAppliedPaise: bigint;
  razorpayChargePaise: bigint;
  totalPaise: bigint;
  creditBalancePaise: bigint;
  creditBalanceAfterPaise: bigint;
}
