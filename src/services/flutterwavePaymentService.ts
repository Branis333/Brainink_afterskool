// Flutterwave Payment Service (LIVE)
// All payment logic is backend-mediated — no secret keys in the app bundle.
// The backend creates Flutterwave checkout links; the app opens them in a browser.

export interface SubscriptionStatus {
  active: boolean;
  expiresAt?: string; // ISO
  lastPaymentId?: string;
}

export interface InitiatePaymentResult {
  checkoutUrl: string;
  paymentReference: string;
}

const API_BASE_URL = 'https://brainink-backend.onrender.com';

export const flutterwavePaymentService = {
  /**
   * Ask the backend to create a Flutterwave checkout session.
   * Returns a URL the user is redirected to for payment.
   */
  async initiateMonthlySubscription(userToken: string, userEmail?: string, currency: string = 'USD'): Promise<InitiatePaymentResult> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${userToken}`,
    };
    if (userEmail) {
      headers['X-User-Email'] = userEmail;
    }
    const res = await fetch(`${API_BASE_URL}/payments/flutterwave/initiate`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ amount: 5, currency, interval: 'monthly' }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(body || 'Failed to initiate subscription payment');
    }
    return res.json();
  },

  /**
   * Tell the backend to verify the payment and activate the subscription.
   */
  async verifyPayment(userToken: string, reference: string): Promise<SubscriptionStatus> {
    const res = await fetch(`${API_BASE_URL}/payments/flutterwave/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userToken}` },
      body: JSON.stringify({ reference }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(body || 'Failed to verify payment');
    }
    return res.json();
  },

  /**
   * Check the current subscription status for the logged-in user.
   */
  async getSubscriptionStatus(userToken: string): Promise<SubscriptionStatus> {
    const res = await fetch(`${API_BASE_URL}/subscriptions/status`, {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    if (!res.ok) {
      if (res.status === 404) return { active: false };
      throw new Error('Failed to fetch subscription status');
    }
    return res.json();
  },
};
