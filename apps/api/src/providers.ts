import { createHmac, timingSafeEqual } from 'node:crypto';
export interface PaymentProvider {
  create(amountPaise: number, receipt: string): Promise<{ id: string; status: string }>;
  verifyWebhook(payload: Buffer, signature: string): boolean;
}
export class RazorpayProvider implements PaymentProvider {
  constructor(
    private key: string,
    private secret: string,
    private webhookSecret: string,
  ) {}
  async create(amount: number, receipt: string) {
    const response = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${this.key}:${this.secret}`).toString('base64')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ amount, currency: 'INR', receipt }),
    });
    if (!response.ok) throw new Error('Payment provider unavailable');
    return (await response.json()) as { id: string; status: string };
  }
  verifyWebhook(payload: Buffer, signature: string) {
    if (!/^[a-f0-9]{64}$/i.test(signature)) return false;
    const expected = createHmac('sha256', this.webhookSecret).update(payload).digest();
    return timingSafeEqual(expected, Buffer.from(signature, 'hex'));
  }
}
export class MockPaymentProvider implements PaymentProvider {
  async create(_amount: number, receipt: string) {
    if (process.env.NODE_ENV === 'production') throw new Error('Mock payments forbidden');
    return { id: `mock_${receipt}`, status: 'mock_paid' };
  }
  verifyWebhook() {
    return false;
  }
}
export interface NotificationProvider {
  send(recipient: string, template: string): Promise<void>;
}
export class MockNotificationProvider implements NotificationProvider {
  async send(_recipient: string, _template: string) {
    if (process.env.NODE_ENV === 'production') throw new Error('Mock notifications forbidden');
  }
}
// The Razorpay adapter is not exposed to checkout until asynchronous payment reservations,
// verified webhook reconciliation and refunds are implemented and tested. See docs/STATUS.md.
