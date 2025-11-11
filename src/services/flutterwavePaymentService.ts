// Flutterwave Payment Service (Test Mode)
// NOTE: Do NOT ship real secret keys inside the app bundle. Use secure backend-mediated charges.
// This client handles creating a subscription payment via Flutterwave Checkout (hosted page) and verifying status.

export interface SubscriptionStatus {
  active: boolean;
  expiresAt?: string; // ISO
  lastPaymentId?: string;
}

export interface InitiatePaymentResult {
  checkoutUrl: string;
  paymentReference: string;
}

const FLUTTERWAVE_PUBLIC_KEY = process.env.EXPO_PUBLIC_FLUTTERWAVE_PUBLIC_KEY || ''; // Load from env (eas secret)
// Backend endpoints expected (adjust paths as backend implements):
// POST /payments/flutterwave/initiate { amount, currency, interval }
// POST /payments/flutterwave/verify { reference }
// GET  /subscriptions/status

const API_BASE_URL = 'https://brainink-backend.onrender.com'; // Replace if different.

export const flutterwavePaymentService = {
  async initiateMonthlySubscription(userToken: string): Promise<InitiatePaymentResult> {
    const res = await fetch(`${API_BASE_URL}/payments/flutterwave/initiate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userToken}` },
      body: JSON.stringify({ amount: 5, currency: 'USD', interval: 'monthly' })
    });
    if (!res.ok) throw new Error('Failed to initiate subscription payment');
    return res.json();
  },

  async verifyPayment(userToken: string, reference: string): Promise<SubscriptionStatus> {
    const res = await fetch(`${API_BASE_URL}/payments/flutterwave/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userToken}` },
      body: JSON.stringify({ reference })
    });
    if (!res.ok) throw new Error('Failed to verify payment');
    return res.json();
  },

  async getSubscriptionStatus(userToken: string): Promise<SubscriptionStatus> {
    const res = await fetch(`${API_BASE_URL}/subscriptions/status`, {
      headers: { Authorization: `Bearer ${userToken}` }
    });
    if (!res.ok) {
      if (res.status === 404) return { active: false };
      throw new Error('Failed to fetch subscription status');
    }
    return res.json();
  }
};
