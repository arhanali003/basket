import { test, expect, request as makeRequest, type APIRequestContext } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { io } from 'socket.io-client';
const base = 'http://localhost:4000/api/v1';
async function customer(phone: string) {
  const ctx = await makeRequest.newContext();
  const start = await ctx.post(base + '/auth/otp', { data: { phone } });
  expect(start.ok()).toBeTruthy();
  const { challenge } = await start.json();
  const verify = await ctx.post(base + '/auth/verify', {
    data: { challenge, code: '123456', name: 'Test Neighbour' },
  });
  expect(verify.ok()).toBeTruthy();
  return ctx;
}
async function staff(role = 'super_admin') {
  const ctx = await makeRequest.newContext();
  expect(
    (
      await ctx.post(base + '/auth/staff', { data: { role, password: 'daybasket-local-only' } })
    ).ok(),
  ).toBeTruthy();
  return ctx;
}
async function address(ctx: APIRequestContext) {
  const r = await ctx.post(base + '/addresses', {
    data: {
      recipient: 'Test Neighbour',
      phone: '9876501234',
      line: '204 Maple House, 12th Main Road',
      city: 'Bengaluru',
      state: 'Karnataka',
      pincode: '560038',
      latitude: 12.9784,
      longitude: 77.6408,
    },
  });
  expect(r.ok()).toBeTruthy();
  return (await r.json()).id as string;
}
const uniquePhone = () => `9${String(Date.now()).slice(-7)}${Math.floor(Math.random() * 90 + 10)}`;
test('customer storefront: search, cart, login, location, mock checkout and tracking', async ({
  page,
}) => {
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'Everyday good. At your doorstep.' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Add Farm-fresh avocados', exact: true }).click();
  await page.getByRole('button', { name: 'My basket' }).click();
  await expect(page.getByRole('heading', { name: 'Your basket · 1 items' })).toBeVisible();
  await page.getByRole('button', { name: 'Sign in to continue' }).click();
  await page.getByLabel('Your name').fill('Demo Neighbour');
  await page.getByLabel('Mobile number', { exact: true }).fill(uniquePhone());
  await page.getByRole('button', { name: 'Send verification code' }).click();
  await page.getByLabel('Verification code').fill('123456');
  await page.getByRole('button', { name: 'Verify & continue' }).click();
  await expect(page.getByRole('heading', { name: 'Where’s your little corner?' })).toBeVisible();
  await page.getByLabel('Flat / house, building & street').fill('204 Maple House, 12th Main Road');
  await page.getByRole('button', { name: 'Check availability & save' }).click();
  await page.getByRole('radio', { name: /Test online payment/ }).check();
  await page.getByRole('button', { name: /Place order ·/ }).click();
  await expect(page.getByRole('heading', { name: 'Your basket’s little journey' })).toBeVisible();
  await expect(page.getByText('No driver location yet', { exact: true })).toBeVisible();
  await expect(page.getByText('Test payment only. No money has been charged.')).toBeVisible();
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await page.getByLabel('Search products').fill('strawberries');
  await expect(page.locator('.product-card')).toHaveCount(1);
});
test('admin can create catalogue products', async ({ page }) => {
  await page.goto('http://localhost:3001');
  await page.getByLabel('Store password').fill('daybasket-local-only');
  await page.getByRole('button', { name: 'Open store studio' }).click();
  await page.getByRole('button', { name: 'Products', exact: true }).click();
  await page.getByRole('button', { name: 'Add product', exact: true }).click();
  const slug = 'test-apples-' + Date.now();
  await page.getByLabel('Product name', { exact: true }).fill('Test orchard apples');
  await page.getByLabel('URL slug').fill(slug);
  await page.getByLabel('Brand', { exact: true }).fill('The Good Farm');
  await page.getByLabel('Selling price').fill('129');
  await page.getByLabel('MRP').fill('149');
  await page.getByLabel('Pack size').fill('500 g');
  await page
    .getByLabel('Product photos HTTPS URL')
    .fill('https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6');
  await page.getByRole('button', { name: 'Add photo', exact: true }).click();
  await page
    .getByLabel('Description', { exact: true })
    .fill('Fresh apples for automated catalogue verification.');
  await page.getByRole('button', { name: 'Save product' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByLabel('Search products').fill('Test orchard apples');
  await expect(page.getByRole('cell', { name: /Test orchard apples/ }).first()).toBeVisible();
});
test('server pricing, idempotency, IDOR prevention, fulfilment, authenticated tracking and delivery proof', async () => {
  const a = await customer(uniquePhone()),
    b = await customer(uniquePhone()),
    admin = await staff(),
    driver = await staff('delivery');
  const aid = await address(a);
  const input = {
    items: [{ productId: 'avocado', quantity: 1, price: 1 }],
    addressId: aid,
    paymentMethod: 'mock',
    idempotencyKey: randomUUID(),
    total: 1,
  };
  const made = await a.post(base + '/orders', { data: input });
  expect(made.status()).toBe(201);
  const order = await made.json();
  expect(order.total).toBe(15300);
  expect(order.deliveryCode).toMatch(/^\d{4}$/);
  expect(order.deliveryCodeHash).toBeUndefined();
  const retry = await a.post(base + '/orders', { data: input });
  expect((await retry.json()).id).toBe(order.id);
  expect(
    (
      await a.post(base + '/orders', {
        data: { ...input, items: [{ productId: 'milk', quantity: 2 }] },
      })
    ).status(),
  ).toBe(409);
  expect((await b.get(base + '/orders/' + order.id)).status()).toBe(404);
  expect((await a.get(base + '/admin/products')).status()).toBe(403);
  expect((await driver.get(base + '/orders/' + order.id)).status()).toBe(404);
  const cookies = (await a.storageState()).cookies.map((c) => `${c.name}=${c.value}`).join('; ');
  const socket = io('http://localhost:4000', {
    extraHeaders: { Cookie: cookies },
    transports: ['websocket'],
    reconnection: false,
  });
  await new Promise<void>((resolve, reject) => {
    socket.on('connect', () =>
      socket.emit('subscribe', order.id, (r: { ok: boolean }) =>
        r.ok ? resolve() : reject(new Error('subscription denied')),
      ),
    );
    socket.on('connect_error', reject);
  });
  const updateEvent = new Promise<void>((resolve) => socket.once('order:update', () => resolve()));
  expect(
    (
      await admin.patch(base + `/orders/${order.id}/status`, { data: { status: 'delivered' } })
    ).status(),
  ).toBe(409);
  for (const status of ['accepted', 'picking', 'packed', 'ready_for_pickup'])
    expect(
      (await admin.patch(base + `/orders/${order.id}/status`, { data: { status } })).ok(),
    ).toBeTruthy();
  await updateEvent;
  expect(
    (
      await admin.post(base + `/admin/orders/${order.id}/assign`, {
        data: { driverId: 'demo-driver' },
      })
    ).ok(),
  ).toBeTruthy();
  expect(
    (
      await driver.patch(base + `/orders/${order.id}/status`, {
        data: { status: 'out_for_delivery' },
      })
    ).ok(),
  ).toBeTruthy();
  expect(
    (
      await driver.post(base + `/delivery/${order.id}/location`, {
        data: { latitude: 12.979, longitude: 77.641, accuracy: 10 },
      })
    ).ok(),
  ).toBeTruthy();
  const tracked = await (await a.get(base + '/orders/' + order.id)).json();
  expect(tracked.locations[0].latitude).toBe(12.979);
  expect(
    (
      await driver.patch(base + `/orders/${order.id}/status`, {
        data: { status: 'delivered', code: '0000' },
      })
    ).status(),
  ).toBe(400);
  expect(
    (
      await driver.patch(base + `/orders/${order.id}/status`, {
        data: { status: 'delivered', code: order.deliveryCode },
      })
    ).ok(),
  ).toBeTruthy();
  expect(
    (
      await driver.post(base + `/delivery/${order.id}/location`, {
        data: { latitude: 12.979, longitude: 77.641, accuracy: 10 },
      })
    ).status(),
  ).toBe(404);
  const outsiderCookies = (await b.storageState()).cookies
    .map((c) => `${c.name}=${c.value}`)
    .join('; ');
  const outsider = io('http://localhost:4000', {
    extraHeaders: { Cookie: outsiderCookies },
    transports: ['websocket'],
    reconnection: false,
  });
  const allowed = await new Promise<boolean>((resolve) =>
    outsider.on('connect', () =>
      outsider.emit('subscribe', order.id, (r: { ok: boolean }) => resolve(r.ok)),
    ),
  );
  expect(allowed).toBe(false);
  socket.disconnect();
  outsider.disconnect();
  await Promise.all([a.dispose(), b.dispose(), admin.dispose(), driver.dispose()]);
});
test('concurrent checkout cannot oversell; cancellation restores exactly once; nationwide address accepted', async () => {
  const a = await customer(uniquePhone()),
    admin = await staff();
  const aid = await address(a);
  const p = await admin.post(base + '/admin/products', {
    data: {
      name: 'Concurrency fixture',
      slug: 'concurrency-' + Date.now(),
      categoryId: 'produce',
      brand: 'Test',
      description: 'Single stock unit',
      image: 'https://example.com/test.jpg',
      unit: '1 pack',
      price: 19900,
      mrp: 19900,
    },
  });
  const product = await p.json();
  expect(p.ok()).toBeTruthy();
  expect(
    (
      await admin.post(base + '/admin/inventory/' + product.id, {
        data: { change: 1, reason: 'Test fixture' },
      })
    ).ok(),
  ).toBeTruthy();
  const payload = {
    items: [{ productId: product.id, quantity: 1 }],
    addressId: aid,
    paymentMethod: 'cod',
  };
  const responses = await Promise.all([
    a.post(base + '/orders', { data: { ...payload, idempotencyKey: randomUUID() } }),
    a.post(base + '/orders', { data: { ...payload, idempotencyKey: randomUUID() } }),
  ]);
  expect(responses.filter((r) => r.status() === 201)).toHaveLength(1);
  expect(responses.filter((r) => r.status() === 409)).toHaveLength(1);
  const order = await responses.find((r) => r.status() === 201)!.json();
  expect((await a.post(base + `/orders/${order.id}/cancel`, { data: {} })).ok()).toBeTruthy();
  expect((await a.post(base + `/orders/${order.id}/cancel`, { data: {} })).status()).toBe(409);
  const restored = await (await a.get(base + '/products/' + product.id)).json();
  expect(restored.inventory[0].available).toBe(1);
  const remote = await a.post(base + '/serviceability', {
    data: { latitude: 28.6139, longitude: 77.209 },
  });
  expect((await remote.json()).serviceable).toBe(true);
  await a.dispose();
  await admin.dispose();
});
test('mobile catalogue fits viewport and basket remains usable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.locator('.product-card').first()).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.getByRole('button', { name: 'Add Fresh whole milk', exact: true }).click();
  await page
    .getByRole('navigation', { name: 'Mobile navigation' })
    .getByRole('button', { name: /Basket/ })
    .click();
  await expect(page.getByRole('dialog')).toBeVisible();
});

test('partner UI shares consented GPS and completes delivery with customer code', async ({
  page,
  context,
}) => {
  const a = await customer(uniquePhone()),
    admin = await staff();
  const aid = await address(a);
  const made = await a.post(base + '/orders', {
    data: {
      items: [{ productId: 'avocado', quantity: 1 }],
      addressId: aid,
      paymentMethod: 'cod',
      idempotencyKey: randomUUID(),
    },
  });
  expect(made.ok()).toBeTruthy();
  const order = await made.json();
  for (const status of ['accepted', 'picking', 'packed', 'ready_for_pickup'])
    expect(
      (await admin.patch(base + `/orders/${order.id}/status`, { data: { status } })).ok(),
    ).toBeTruthy();
  expect(
    (
      await admin.post(base + `/admin/orders/${order.id}/assign`, {
        data: { driverId: 'demo-driver' },
      })
    ).ok(),
  ).toBeTruthy();
  await context.grantPermissions(['geolocation'], { origin: 'http://localhost:3002' });
  await context.setGeolocation({ latitude: 12.9795, longitude: 77.641, accuracy: 8 });
  await page.goto('http://localhost:3002');
  await page.getByLabel('Partner password').fill('daybasket-local-only');
  await page.getByRole('button', { name: 'Let’s get going' }).click();
  const card = page
    .locator('.delivery-card')
    .filter({ hasText: order.id.slice(0, 8).toUpperCase() });
  await card.getByRole('button', { name: 'Confirm pickup & start delivery' }).click();
  await card.getByRole('button', { name: 'Consent & share my live location' }).click();
  await expect(card.getByText(/Last sent/)).toBeVisible();
  const tracked = await (await a.get(base + '/orders/' + order.id)).json();
  expect(tracked.locations[0].latitude).toBe(12.9795);
  await card.getByRole('button', { name: 'I’m arriving' }).click();
  await card.getByRole('button', { name: 'Confirm delivery', exact: true }).click();
  await page.getByLabel('Customer’s delivery code').fill(order.deliveryCode);
  await page.getByRole('button', { name: 'Delivered with care' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(card).toHaveCount(0);
  expect((await (await a.get(base + '/orders/' + order.id)).json()).paymentStatus).toBe(
    'cod_collected',
  );
  await a.dispose();
  await admin.dispose();
});
