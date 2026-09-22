import { priceCart, distanceKm, canTransition } from '../apps/api/src/domain';
import { addressSchema, checkoutSchema, cartSchema } from '../packages/types/src';
import { RazorpayProvider } from '../apps/api/src/providers';
import { createHmac } from 'node:crypto';
describe('server pricing in integer paise', () => {
  test('charges exact fees and never adds included GST twice', () => {
    expect(priceCart([{ price: 11800, quantity: 1, taxBps: 1800 }])).toEqual({
      subtotal: 11800,
      discount: 0,
      deliveryFee: 2900,
      handlingFee: 500,
      tax: 1800,
      total: 15200,
    });
  });
  test('delivery threshold is inclusive', () => {
    expect(priceCart([{ price: 49900, quantity: 1, taxBps: 0 }]).deliveryFee).toBe(0);
    expect(priceCart([{ price: 49899, quantity: 1, taxBps: 0 }]).deliveryFee).toBe(2900);
  });
  test('caps discounts and enforces coupon minimum', () => {
    const coupon = { minimum: 29900, maximum: 10000, discountBps: 1000 };
    expect(priceCart([{ price: 200000, quantity: 1, taxBps: 0 }], coupon).discount).toBe(10000);
    expect(() => priceCart([{ price: 29899, quantity: 1, taxBps: 0 }], coupon)).toThrow('minimum');
  });
  test('discounts reduce inclusive tax', () => {
    const q = priceCart([{ price: 11800, quantity: 1, taxBps: 1800 }], {
      minimum: 0,
      maximum: 5000,
      discountBps: 1000,
    });
    expect(q.tax).toBe(1620);
    expect(Number.isInteger(q.total)).toBe(true);
  });
});
describe('serviceability and transitions', () => {
  test('zero distance and remote city', () => {
    const store = { latitude: 12.9784, longitude: 77.6408 };
    expect(distanceKm(store, store)).toBe(0);
    expect(distanceKm(store, { latitude: 28.6139, longitude: 77.209 })).toBeGreaterThan(1500);
  });
  test('blocks skipping stages and cancelling picked orders', () => {
    expect(canTransition('placed', 'accepted')).toBe(true);
    expect(canTransition('placed', 'delivered')).toBe(false);
    expect(canTransition('picking', 'cancelled')).toBe(false);
    expect(canTransition('delivered', 'placed')).toBe(false);
  });
});
describe('request contracts', () => {
  test('rejects duplicate quantities and negative quantities', () => {
    expect(
      cartSchema.safeParse([
        { productId: 'a', quantity: 1 },
        { productId: 'a', quantity: 1 },
      ]).success,
    ).toBe(false);
    expect(cartSchema.safeParse([{ productId: 'a', quantity: -1 }]).success).toBe(false);
  });
  test('strips frontend prices from checkout', () => {
    const input = checkoutSchema.parse({
      items: [{ productId: 'a', quantity: 1, price: 1 }],
      addressId: 'a',
      paymentMethod: 'cod',
      idempotencyKey: crypto.randomUUID(),
      total: 1,
    });
    expect(input).not.toHaveProperty('total');
    expect(input.items[0]).not.toHaveProperty('price');
  });
  test('rejects invalid coordinates and phone', () => {
    expect(addressSchema.safeParse({ latitude: 200, longitude: 0, phone: '123' }).success).toBe(
      false,
    );
  });
});
test('Razorpay verification uses exact raw payload and rejects malformed/replayed-payload signatures', () => {
  const provider = new RazorpayProvider('test', 'test', 'webhook-secret');
  const raw = Buffer.from('{"id":"event1"}');
  const signature = createHmac('sha256', 'webhook-secret').update(raw).digest('hex');
  expect(provider.verifyWebhook(raw, signature)).toBe(true);
  expect(provider.verifyWebhook(Buffer.from('{}'), signature)).toBe(false);
  expect(provider.verifyWebhook(raw, 'bad')).toBe(false);
});
