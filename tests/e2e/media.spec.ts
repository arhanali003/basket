import { test, expect } from '@playwright/test';
const base = 'http://localhost:4000/api/v1';
const pixel = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAEUlEQVR4nGNQ6nD5D8IMMAYAQMAHtWj8xhMAAAAASUVORK5CYII=',
  'base64',
);

test('owner uploads gallery photos, chooses cover, publishes homepage photos and deletes listing', async ({
  page,
  request,
}) => {
  await page.goto('http://localhost:3001');
  await page.getByLabel('Store password').fill('daybasket-local-only');
  await page.getByRole('button', { name: 'Open store studio' }).click();
  await page.getByRole('button', { name: 'Products', exact: true }).click();
  await page.getByRole('button', { name: 'Add product', exact: true }).click();
  const slug = 'gallery-check-' + Date.now();
  await page.getByLabel('Product name', { exact: true }).fill('Gallery check');
  await page.getByLabel('URL slug').fill(slug);
  await page.getByLabel('Brand', { exact: true }).fill('Test');
  await page.getByLabel('Selling price').fill('129');
  await page.getByLabel('MRP').fill('149');
  await page.getByLabel('Pack size').fill('500 g');
  await page.getByLabel('Description', { exact: true }).fill('Photo gallery verification');
  await page.getByLabel('Product photos', { exact: true }).setInputFiles([
    { name: 'front.png', mimeType: 'image/png', buffer: pixel },
    { name: 'back.png', mimeType: 'image/png', buffer: pixel },
  ]);
  await expect(page.locator('.photo-previews img')).toHaveCount(2);
  const cover = await page.locator('.photo-previews img').nth(1).getAttribute('src');
  await page.getByRole('button', { name: 'Make cover' }).click();
  await page.getByRole('button', { name: 'Save product' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const product = await (await request.get(base + '/products/' + slug)).json();
  expect(product.images).toHaveLength(2);
  expect(cover).toContain(product.image);
  await page.goto('http://localhost:3000/products/' + slug);
  await expect(page.getByRole('button', { name: 'View photo 2 of Gallery check' })).toBeVisible();
  await page.getByRole('button', { name: 'View photo 2 of Gallery check' }).click();
  await expect(page.locator('.gallery-main')).toHaveAttribute('src', /\/media\//);
  await page.goto('http://localhost:3001');
  const originalHomepage = await (await request.get(base + '/homepage')).json();
  await page.getByRole('button', { name: 'Homepage photos' }).click();
  await page
    .getByLabel('Main banner', { exact: true })
    .setInputFiles({ name: 'banner.png', mimeType: 'image/png', buffer: pixel });
  await expect(page.locator('.photo-previews img')).toHaveCount(1);
  await page.getByRole('button', { name: 'Save homepage photos' }).click();
  await expect(page.getByText('Changes saved', { exact: true })).toBeVisible();
  await page.goto('http://localhost:3000');
  await expect(page.locator('.hero-image')).toHaveAttribute('src', /\/api\/v1\/media\//);
  expect(
    await page.locator('.hero-image').evaluate((el) => (el as HTMLImageElement).naturalWidth),
  ).toBeGreaterThan(0);
  await page.request.put(base + '/admin/homepage', { data: originalHomepage });
  await page.goto('http://localhost:3001');
  await page.getByRole('button', { name: 'Products', exact: true }).click();
  const row = page.getByRole('row').filter({ hasText: 'Gallery check' });
  await row.getByRole('button', { name: 'Archive', exact: true }).click();
  await expect(row.getByText('Archived', { exact: true })).toBeVisible();
  expect((await request.get(base + '/products/' + slug)).status()).toBe(404);
  await row.getByRole('button', { name: 'Restore', exact: true }).click();
  await expect(row.getByText('Active', { exact: true })).toBeVisible();
  expect((await request.get(base + '/products/' + slug)).status()).toBe(200);
  await row.getByRole('button', { name: 'Delete', exact: true }).click();
  await page.getByRole('button', { name: 'Keep product' }).click();
  await expect(row).toBeVisible();
  await row.getByRole('button', { name: 'Delete', exact: true }).click();
  await page.getByRole('button', { name: 'Delete product', exact: true }).click();
  await expect(row).toHaveCount(0);
  expect((await request.get(base + '/products/' + slug)).status()).toBe(404);
});

test('media and homepage mutations require owner; invalid media is rejected', async ({
  request,
}) => {
  const photo = 'data:image/png;base64,' + pixel.toString('base64');
  expect((await request.post(base + '/admin/media', { data: { data: photo } })).status()).toBe(401);
  expect((await request.put(base + '/admin/homepage', { data: {} })).status()).toBe(401);
  expect((await request.delete(base + '/admin/products/avocado')).status()).toBe(401);
  await request.post(base + '/auth/staff', {
    data: { role: 'super_admin', password: 'daybasket-local-only' },
  });
  expect(
    (
      await request.post(base + '/admin/media', {
        data: { data: 'data:image/png;base64,aGVsbG8=' },
      })
    ).status(),
  ).toBe(400);
  expect(
    (
      await request.put(base + '/admin/homepage', { data: { hero: 'javascript:alert(1)' } })
    ).status(),
  ).toBe(400);
  const uploaded = await request.post(base + '/admin/media', { data: { data: photo } });
  expect(uploaded.status()).toBe(201);
  const media = await request.get('http://localhost:4000' + (await uploaded.json()).url);
  expect(media.headers()['content-type']).toContain('image/png');
  expect(await media.body()).toEqual(pixel);
});

test('customer login asks for a name and offers only Google', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  const google = page.getByRole('button', { name: 'Continue with Google', exact: true });
  await expect(google).toBeVisible();
  await expect(google).toBeDisabled();
  await page.getByLabel('Your name', { exact: true }).fill('  ');
  await expect(google).toBeDisabled();
  await page.getByLabel('Your name', { exact: true }).fill('Asha Kumar');
  await expect(google).toBeEnabled();
  await expect(page.getByLabel('Mobile number', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Send verification code' })).toHaveCount(0);
});
