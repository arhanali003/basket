import { test, expect, request as makeRequest, type APIRequestContext } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';

const base = process.env.CATEGORY_API_BASE_URL || 'http://localhost:4000/api/v1';
// These integration tests only use the disposable, local SQLite demo database.
const db = new PrismaClient({
  datasourceUrl: `file:${resolve('apps/api/prisma/daybasket.db')}`,
});
const categoryInput = (name: string) => ({
  name,
  image: 'https://example.com/category.png',
  color: '#e1f4d3',
});
let admin: APIRequestContext;
let contexts: APIRequestContext[] = [];
let categoryIds: string[] = [];
let productIds: string[] = [];
let orderIds: string[] = [];
let userIds: string[] = [];

async function staff(role = 'super_admin') {
  const ctx = await makeRequest.newContext();
  contexts.push(ctx);
  const response = await ctx.post(base + '/auth/staff', {
    data: { role, password: process.env.DEMO_STAFF_PASSWORD || 'daybasket-local-only' },
  });
  expect(response.status()).toBe(201);
  return ctx;
}

async function customer() {
  const ctx = await makeRequest.newContext();
  contexts.push(ctx);
  const phone = `9${String(BigInt('0x' + randomUUID().replaceAll('-', '').slice(0, 12)) % 1000000000n).padStart(9, '0')}`;
  const challenge = await ctx.post(base + '/auth/otp', { data: { phone } });
  expect(challenge.status()).toBe(201);
  const signedIn = await ctx.post(base + '/auth/verify', {
    data: { challenge: (await challenge.json()).challenge, code: '123456', name: 'Category test' },
  });
  expect(signedIn.status()).toBe(201);
  userIds.push((await signedIn.json()).id);
  return ctx;
}

async function createCategory(name: string) {
  const response = await admin.post(base + '/admin/categories', { data: categoryInput(name) });
  expect(response.status(), await response.text()).toBe(201);
  const category = await response.json();
  categoryIds.push(category.id);
  // Verify the API is using this local database before creating any direct fixtures.
  expect(await db.category.findUnique({ where: { id: category.id } })).not.toBeNull();
  return category;
}

test.beforeAll(async () => {
  expect(['localhost', '127.0.0.1']).toContain(new URL(base).hostname);
  const ctx = await makeRequest.newContext();
  try {
    expect((await (await ctx.get(base + '/health')).json()).mockProviders).toBe(true);
  } finally {
    await ctx.dispose();
  }
});

test.beforeEach(async () => {
  contexts = [];
  categoryIds = [];
  productIds = [];
  orderIds = [];
  userIds = [];
  admin = await staff();
});

test.afterEach(async () => {
  try {
    await db.$transaction(async (tx) => {
      await tx.order.deleteMany({ where: { id: { in: orderIds } } });
      await tx.cartItem.deleteMany({ where: { productId: { in: productIds } } });
      await tx.wishlist.deleteMany({ where: { productId: { in: productIds } } });
      await tx.inventory.deleteMany({ where: { productId: { in: productIds } } });
      await tx.inventoryMovement.deleteMany({ where: { productId: { in: productIds } } });
      await tx.product.deleteMany({ where: { id: { in: productIds } } });
      await tx.category.deleteMany({ where: { id: { in: categoryIds } } });
      await tx.auditLog.deleteMany({
        where: { entityId: { in: [...categoryIds, ...productIds] } },
      });
      await tx.user.deleteMany({ where: { id: { in: userIds } } });
    });
  } finally {
    for (const ctx of contexts) {
      await ctx.post(base + '/auth/logout', { data: {} }).catch(() => undefined);
      await ctx.dispose();
    }
  }
});

test.afterAll(async () => {
  await db.$disconnect();
});

test('category administration denies anonymous, customer and delivery access', async ({
  request,
}) => {
  const shopper = await customer();
  const driver = await staff('delivery');
  for (const [ctx, status] of [
    [request, 401],
    [shopper, 403],
    [driver, 403],
  ] as const) {
    expect((await ctx.get(base + '/admin/categories')).status()).toBe(status);
    expect(
      (
        await ctx.post(base + '/admin/categories', { data: categoryInput('Denied category') })
      ).status(),
    ).toBe(status);
    expect(
      (
        await ctx.put(base + '/admin/categories/missing', { data: categoryInput('Denied edit') })
      ).status(),
    ).toBe(status);
    expect((await ctx.delete(base + '/admin/categories/missing')).status()).toBe(status);
  }
});

test('owner validates, adds, renames and deletes empty categories with public catalogue updates', async ({
  request,
}) => {
  const unique = randomUUID();
  const name = `Personal picks ${unique}`;
  const category = await createCategory(`  Personal   picks ${unique}  `);
  expect(category).toMatchObject({ ...categoryInput(name), productCount: 0 });
  expect((await (await request.get(base + '/catalogue')).json()).categories).toEqual(
    expect.arrayContaining([expect.objectContaining({ id: category.id, name })]),
  );
  for (const duplicate of [name, `  PERSONAL   PICKS ${unique} `]) {
    const response = await admin.post(base + '/admin/categories', {
      data: categoryInput(duplicate),
    });
    expect(response.status()).toBe(409);
    expect((await response.json()).message).toContain('already exists');
  }
  for (const invalid of [
    { name: '   ' },
    { name: 'a'.repeat(81) },
    { color: 'red; display:none' },
    { image: 'javascript:alert(1)' },
    { image: 'http://example.com/category.png' },
  ]) {
    const response = await admin.post(base + '/admin/categories', {
      data: { ...categoryInput(`Invalid ${unique}`), ...invalid },
    });
    expect(response.status()).toBe(400);
  }
  const other = await createCategory(`Other ${unique}`);
  expect(
    (
      await admin.put(base + '/admin/categories/' + other.id, { data: categoryInput(name) })
    ).status(),
  ).toBe(409);
  const updated = {
    ...categoryInput(`Renamed ${unique}`),
    color: '#abc',
    image: '/api/v1/media/testphoto',
  };
  expect(
    (await admin.put(base + '/admin/categories/' + category.id, { data: updated })).status(),
  ).toBe(200);
  expect((await (await request.get(base + '/catalogue')).json()).categories).toEqual(
    expect.arrayContaining([expect.objectContaining({ id: category.id, ...updated })]),
  );
  expect((await admin.delete(base + '/admin/categories/' + category.id)).status()).toBe(200);
  expect((await (await request.get(base + '/catalogue')).json()).categories).not.toEqual(
    expect.arrayContaining([expect.objectContaining({ id: category.id })]),
  );
  expect((await admin.delete(base + '/admin/categories/' + category.id)).status()).toBe(404);
  expect(
    (await admin.put(base + '/admin/categories/' + category.id, { data: updated })).status(),
  ).toBe(404);
  const audit = await db.auditLog.findMany({ where: { entityId: category.id } });
  expect(audit.map((entry) => entry.action).sort()).toEqual([
    'create_category',
    'delete_category',
    'edit_category',
  ]);
});

test('deleting a populated category moves all products and preserves inventory, basket and order history', async () => {
  const unique = randomUUID();
  const source = await createCategory(`Source ${unique}`);
  const target = await createCategory(`Destination ${unique}`);
  const shopper = await customer();
  const shopperId = userIds[0];
  for (const state of ['active', 'inactive', 'deleted']) {
    const response = await admin.post(base + '/admin/products', {
      data: {
        name: `Category fixture ${state}`,
        slug: `category-fixture-${state}-${unique}`,
        categoryId: source.id,
        brand: 'Fixture',
        description: 'Category move verification',
        image: 'https://example.com/product.png',
        unit: '1 pack',
        price: 10000,
        mrp: 12000,
        active: state !== 'inactive',
      },
    });
    expect(response.status()).toBe(201);
    const product = await response.json();
    productIds.push(product.id);
    if (state === 'deleted')
      expect((await admin.delete(base + '/admin/products/' + product.id)).status()).toBe(200);
  }
  const before = await db.product.findMany({
    where: { id: { in: productIds } },
    orderBy: { id: 'asc' },
  });
  const stockBefore = await db.inventory.findMany({
    where: { productId: { in: productIds } },
    orderBy: { id: 'asc' },
  });
  await db.cartItem.create({ data: { userId: shopperId, productId: productIds[0], quantity: 1 } });
  await db.wishlist.create({ data: { userId: shopperId, productId: productIds[0] } });
  const order = await db.order.create({
    data: {
      userId: shopperId,
      storeId: 'indiranagar',
      idempotencyKey: unique,
      requestHash: unique,
      addressJson: '{}',
      subtotal: 10000,
      discount: 0,
      deliveryFee: 0,
      handlingFee: 0,
      tax: 0,
      total: 10000,
      paymentMethod: 'cod',
      paymentStatus: 'pending',
      deliveryCodeHash: 'test-only',
      items: {
        create: {
          productId: productIds[0],
          name: 'Historical product name',
          unit: '1 pack',
          image: 'https://example.com/product.png',
          quantity: 1,
          price: 10000,
        },
      },
      history: { create: { status: 'placed' } },
    },
    include: { items: true, history: true },
  });
  orderIds.push(order.id);
  const categories = await (await admin.get(base + '/admin/categories')).json();
  expect(categories).toEqual(
    expect.arrayContaining([expect.objectContaining({ id: source.id, productCount: 3 })]),
  );
  expect((await admin.delete(base + '/admin/categories/' + source.id)).status()).toBe(409);
  for (const replacementCategoryId of [source.id, randomUUID()]) {
    expect(
      (
        await admin.delete(base + '/admin/categories/' + source.id, {
          data: { replacementCategoryId },
        })
      ).status(),
    ).toBe(400);
  }
  expect(await db.product.count({ where: { categoryId: source.id } })).toBe(3);
  const deleted = await admin.delete(base + '/admin/categories/' + source.id, {
    data: { replacementCategoryId: target.id },
  });
  expect(deleted.status()).toBe(200);
  expect(await deleted.json()).toEqual({ ok: true, movedProducts: 3 });
  const after = await db.product.findMany({
    where: { id: { in: productIds } },
    orderBy: { id: 'asc' },
  });
  expect(after).toEqual(
    before.map((product) => ({ ...product, categoryId: target.id, updatedAt: expect.any(Date) })),
  );
  expect(
    await db.inventory.findMany({
      where: { productId: { in: productIds } },
      orderBy: { id: 'asc' },
    }),
  ).toEqual(stockBefore);
  expect(await db.cartItem.count({ where: { userId: shopperId, productId: productIds[0] } })).toBe(
    1,
  );
  expect(await db.wishlist.count({ where: { userId: shopperId, productId: productIds[0] } })).toBe(
    1,
  );
  expect(
    await db.order.findUnique({ where: { id: order.id }, include: { items: true, history: true } }),
  ).toEqual(order);
  expect((await shopper.get(base + '/orders/' + order.id)).status()).toBe(200);
  expect(await db.category.findUnique({ where: { id: source.id } })).toBeNull();
});
