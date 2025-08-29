// Environment variables are accessed directly from process.env in Next.js API routes
import crypto from 'crypto';

const POLAR_API_URL = process.env.NEXT_PUBLIC_POLAR_API_URL || "https://api.polar.sh";

interface PolarCheckoutSession {
  id: string;
  amount: number;
  currency: string;
  status: string;
  customer_id: string | null;
  subscription_id: string | null;
  metadata: Record<string, any>;
  created_at: string;
  expires_at: string | null;
  url: string | null;
  success_url: string | null;
  cancel_url: string | null;
  product: {
    id: string;
    name: string;
    price_id: string;
    price_amount: number;
    price_currency: string;
  } | null;
}

export class PolarService {
  private static instance: PolarService;
  private apiKey: string;

  private constructor() {
    this.apiKey = process.env.POLAR_ACCESS_TOKEN || '';
    if (!this.apiKey) {
      console.warn('POLAR_ACCESS_TOKEN is not set. Polar integration will not work.');
    }
  }

  public static getInstance(): PolarService {
    if (!PolarService.instance) {
      PolarService.instance = new PolarService();
    }
    return PolarService.instance;
  }

  private async fetchFromPolar<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const url = `${POLAR_API_URL}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.apiKey}`,
      ...options?.headers,
    };

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || 'Failed to fetch from Polar API');
    }

    return response.json();
  }

  /**
   * Create a checkout session for a one-time purchase
   */
  public async createCheckoutSession(params: {
    priceId: string;
    successUrl: string;
    cancelUrl: string;
    customerEmail?: string;
    metadata?: Record<string, any>;
  }): Promise<{ url: string; sessionId: string }> {
    const response = await this.fetchFromPolar<{ url: string; id: string }>('/v1/checkout/sessions', {
      method: 'POST',
      body: JSON.stringify({
        items: [{
          price: params.priceId,
          quantity: 1,
        }],
        success_url: params.successUrl,
        cancel_url: params.cancelUrl,
        customer_email: params.customerEmail,
        metadata: params.metadata,
      }),
    });

    return {
      url: response.url,
      sessionId: response.id,
    };
  }

  /**
   * Create a portal session for customer management
   */
  public async createPortalSession(customerId: string, returnUrl: string): Promise<{ url: string }> {
    return this.fetchFromPortal('/v1/billing/portal', {
      method: 'POST',
      body: JSON.stringify({
        customer: customerId,
        return_url: returnUrl,
      }),
    });
  }

  /**
   * Get checkout session details
   */
  public async getCheckoutSession(sessionId: string): Promise<PolarCheckoutSession> {
    return this.fetchFromPolar<PolarCheckoutSession>(`/v1/checkout/sessions/${sessionId}`);
  }

  /**
   * Verify a webhook signature
   */
  public verifyWebhookSignature(payload: string, signature: string): boolean {
    const secret = process.env.POLAR_WEBHOOK_SECRET;
    
    if (!secret) {
      console.warn('POLAR_WEBHOOK_SECRET is not set. Webhook verification will fail.');
      return false;
    }

    const hmac = crypto.createHmac('sha256', secret);
    const digest = hmac.update(payload).digest('hex');
    return signature === digest;
  }

  // Helper method for portal API calls
  private async fetchFromPortal<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const url = `${POLAR_API_URL}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.apiKey}`,
      ...options?.headers,
    };

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || 'Failed to fetch from Polar Portal API');
    }

    return response.json();
  }
}

export const polarService = PolarService.getInstance();
