/**
 * Razorpay Payout API client for fund accounts and payouts.
 * Uses RazorpayX Payouts API for dealer/lawyer disbursements.
 *
 * Story 9.8: Dealer Payout Execution
 * Story 12.7: Lawyer Payout Execution
 */

export interface RazorpayFundAccountRequest {
  contact_id: string;
  account_type: 'bank_account' | 'vpa';
  bank_account?: {
    name: string;
    ifsc: string;
    account_number: string;
  };
  vpa?: {
    address: string;
  };
}

export interface RazorpayFundAccountResponse {
  id: string;
  entity: string;
  contact_id: string;
  account_type: 'bank_account' | 'vpa';
  bank_account?: {
    ifsc: string;
    bank_name: string;
    name: string;
    notes: string[];
    account_number: string;
  };
  active: boolean;
  created_at: number;
}

export interface RazorpayContactRequest {
  name: string;
  email?: string;
  contact: string;
  type: 'vendor' | 'customer' | 'employee' | 'self';
  reference_id?: string;
  notes?: Record<string, string>;
}

export interface RazorpayContactResponse {
  id: string;
  entity: string;
  name: string;
  contact: string;
  email: string | null;
  type: string;
  reference_id: string | null;
  batch_id: string | null;
  active: boolean;
  created_at: number;
}

export interface RazorpayPayoutRequest {
  account_number: string; // Your RazorpayX account number
  fund_account_id: string;
  amount: number; // in paise
  currency: 'INR';
  mode: 'NEFT' | 'RTGS' | 'IMPS' | 'UPI';
  purpose: 'refund' | 'cashback' | 'payout' | 'salary' | 'utility bill' | 'vendor bill';
  queue_if_low_balance?: boolean;
  reference_id?: string;
  narration?: string;
  notes?: Record<string, string>;
}

export interface RazorpayPayoutResponse {
  id: string;
  entity: string;
  fund_account_id: string;
  amount: number;
  currency: string;
  fees: number;
  tax: number;
  status: 'queued' | 'pending' | 'processing' | 'processed' | 'reversed' | 'cancelled' | 'rejected';
  utr: string | null;
  mode: string;
  purpose: string;
  reference_id: string | null;
  narration: string | null;
  failure_reason: string | null;
  created_at: number;
}

export class RazorpayPayoutClient {
  private readonly keyId: string;
  private readonly keySecret: string;
  private readonly accountNumber: string;
  private readonly baseUrl = 'https://api.razorpay.com/v1';

  constructor(keyId: string, keySecret: string, accountNumber: string) {
    this.keyId = keyId;
    this.keySecret = keySecret;
    this.accountNumber = accountNumber;
  }

  private getAuthHeader(): string {
    return Buffer.from(`${this.keyId}:${this.keySecret}`).toString('base64');
  }

  /**
   * Creates a contact in RazorpayX for payout purposes.
   * Contacts are entities to whom payouts are made.
   */
  async createContact(contact: RazorpayContactRequest): Promise<RazorpayContactResponse> {
    const url = `${this.baseUrl}/contacts`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${this.getAuthHeader()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(contact),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Razorpay contact creation failed: ${response.status} ${errorBody}`);
    }

    return response.json() as Promise<RazorpayContactResponse>;
  }

  /**
   * Fetches a contact by ID.
   */
  async getContact(contactId: string): Promise<RazorpayContactResponse> {
    const url = `${this.baseUrl}/contacts/${contactId}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${this.getAuthHeader()}`,
      },
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Razorpay get contact failed: ${response.status} ${errorBody}`);
    }

    return response.json() as Promise<RazorpayContactResponse>;
  }

  /**
   * Creates a fund account (bank account or VPA) linked to a contact.
   * Fund accounts are the destination for payouts.
   */
  async createFundAccount(fundAccount: RazorpayFundAccountRequest): Promise<RazorpayFundAccountResponse> {
    const url = `${this.baseUrl}/fund_accounts`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${this.getAuthHeader()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(fundAccount),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Razorpay fund account creation failed: ${response.status} ${errorBody}`);
    }

    return response.json() as Promise<RazorpayFundAccountResponse>;
  }

  /**
   * Fetches a fund account by ID.
   */
  async getFundAccount(fundAccountId: string): Promise<RazorpayFundAccountResponse> {
    const url = `${this.baseUrl}/fund_accounts/${fundAccountId}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${this.getAuthHeader()}`,
      },
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Razorpay get fund account failed: ${response.status} ${errorBody}`);
    }

    return response.json() as Promise<RazorpayFundAccountResponse>;
  }

  /**
   * Creates a payout to a fund account.
   * This transfers money from your RazorpayX account to the beneficiary.
   */
  async createPayout(payout: Omit<RazorpayPayoutRequest, 'account_number'>): Promise<RazorpayPayoutResponse> {
    const url = `${this.baseUrl}/payouts`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${this.getAuthHeader()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...payout,
        account_number: this.accountNumber,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Razorpay payout creation failed: ${response.status} ${errorBody}`);
    }

    return response.json() as Promise<RazorpayPayoutResponse>;
  }

  /**
   * Fetches a payout by ID to check status.
   */
  async getPayout(payoutId: string): Promise<RazorpayPayoutResponse> {
    const url = `${this.baseUrl}/payouts/${payoutId}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${this.getAuthHeader()}`,
      },
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Razorpay get payout failed: ${response.status} ${errorBody}`);
    }

    return response.json() as Promise<RazorpayPayoutResponse>;
  }

  /**
   * Cancels a queued payout.
   * Only payouts in 'queued' status can be cancelled.
   */
  async cancelPayout(payoutId: string): Promise<RazorpayPayoutResponse> {
    const url = `${this.baseUrl}/payouts/${payoutId}/cancel`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${this.getAuthHeader()}`,
      },
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Razorpay cancel payout failed: ${response.status} ${errorBody}`);
    }

    return response.json() as Promise<RazorpayPayoutResponse>;
  }
}
