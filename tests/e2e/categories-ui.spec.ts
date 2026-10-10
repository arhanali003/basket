import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';

const base = 'http://localhost:4000/api/v1';
const pixel = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAEUlEQVR4nGNQ6nD5D8IMMAYAQMAHtWj8xhMAAAAASUVORK5CYII=',
  'base64',
);

test('owner creates, edits and deletes categories and product editor uses the latest list', async ({
  page,
}) => {
  expect(
    (
      await page.request.post(base + '/auth/staff', {
        data: { role: 'super_admin', password: 'daybasket-local-only' },
      })
    ).ok(),
  ).toBeTruthy();
  const name = `Category UI ${randomUUID().slice(0, 8)}`;
  const renamed = `${name} updated`;
  const original = await (await page.request.get(base + '/admin/categories')).json();
  let createdId = '';
  try {
    await page.goto('http://localhost:3001');
    await page.getByRole('button', { name: 'Categories', exact: true }).click();
    await page.getByRole('button', { name: 'Add category', exact: true }).click();
    let dialog = page.getByRole('dialog', { name: 'Add category', exact: true });
    await expect(dialog.getByRole('button', { name: 'Save category' })).toBeDisabled();
    await dialog.getByLabel('Category name', { exact: true }).fill(name);
    await dialog.getByLabel('Category photo', { exact: true }).setInputFiles({
      name: 'category.png',
      mimeType: 'image/png',
      buffer: pixel,
    });
    await expect(dialog.locator('.photo-previews img')).toHaveCount(1);
    await dialog.getByRole('button', { name: 'Save category' }).click();
    await expect(dialog).toHaveCount(0);
    const created = (await (await page.request.get(base + '/admin/categories')).json()).find(
      (category: { name: string }) => category.name === name,
    );
    expect(created).toBeTruthy();
    createdId = created.id;
    let row = page.getByRole('row').filter({ hasText: name });
    await expect(row).toBeVisible();
    await row.getByRole('button', { name: 'Edit', exact: true }).click();
    dialog = page.getByRole('dialog', { name: 'Edit category', exact: true });
    if (original.length) {
      await dialog.getByLabel('Category name', { exact: true }).fill(original[0].name);
      await dialog.getByRole('button', { name: 'Save category' }).click();
      await expect(dialog.getByRole('alert')).toBeVisible();
      await expect(dialog).toBeVisible();
    }
    await dialog.getByLabel('Category name', { exact: true }).fill(renamed);
    await dialog.getByLabel('Background colour', { exact: true }).fill('#dce9f5');
    await dialog.getByRole('button', { name: 'Save category' }).click();
    await expect(dialog).toHaveCount(0);
    row = page.getByRole('row').filter({ hasText: renamed });
    await expect(row).toBeVisible();
    const catalogue = await (await page.request.get(base + '/catalogue')).json();
    expect(
      catalogue.categories.find((category: { id: string }) => category.id === createdId),
    ).toMatchObject({ name: renamed, color: '#dce9f5' });

    await page.getByRole('button', { name: 'Products', exact: true }).click();
    await page.getByRole('button', { name: 'Add product', exact: true }).click();
    const categorySelect = page.getByRole('combobox', { name: 'Category', exact: true });
    await categorySelect.selectOption({ label: renamed });
    await expect(categorySelect).toHaveValue(createdId);
    await page.getByRole('button', { name: 'Close dialog', exact: true }).click();
    await page.getByRole('button', { name: 'Categories', exact: true }).click();
    await row.getByRole('button', { name: 'Delete', exact: true }).click();
    await page.getByRole('button', { name: 'Keep category', exact: true }).click();
    await expect(row).toBeVisible();
    await row.getByRole('button', { name: 'Delete', exact: true }).click();
    await page.getByRole('button', { name: 'Delete category', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(row).toHaveCount(0);
    createdId = '';
    const after = await (await page.request.get(base + '/catalogue')).json();
    expect(after.categories.some((category: { name: string }) => category.name === renamed)).toBe(
      false,
    );
  } finally {
    if (!createdId) {
      const remaining = await (await page.request.get(base + '/admin/categories')).json();
      createdId =
        remaining.find((category: { name: string }) => [name, renamed].includes(category.name))
          ?.id || '';
    }
    if (createdId) await page.request.delete(base + '/admin/categories/' + createdId, { data: {} });
  }
});

test('populated-category confirmation requires a destination and submits a product move', async ({
  page,
}) => {
  expect(
    (
      await page.request.post(base + '/auth/staff', {
        data: { role: 'super_admin', password: 'daybasket-local-only' },
      })
    ).ok(),
  ).toBeTruthy();
  const suffix = randomUUID();
  const source = {
    id: `source-${suffix}`,
    name: 'Source category',
    image: 'https://example.com/category.png',
    color: '#eef2e5',
    productCount: 3,
  };
  const destination = {
    ...source,
    id: `destination-${suffix}`,
    name: 'Destination category',
    productCount: 0,
  };
  let deleted = false;
  let submitted: unknown;
  const corsHeaders = {
    'access-control-allow-origin': 'http://localhost:3001',
    'access-control-allow-credentials': 'true',
    'access-control-allow-methods': 'GET, DELETE, OPTIONS',
    'access-control-allow-headers': 'content-type',
  };
  // Isolate the confirmation behaviour without moving real or seeded products.
  await page.route(base + '/admin/categories', async (route) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: corsHeaders });
      return;
    }
    await route.fulfill({
      headers: corsHeaders,
      json: deleted ? [destination] : [source, destination],
    });
  });
  await page.route(base + '/admin/categories/' + source.id, async (route) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: corsHeaders });
      return;
    }
    expect(route.request().method()).toBe('DELETE');
    submitted = route.request().postDataJSON();
    deleted = true;
    await route.fulfill({ headers: corsHeaders, json: { ok: true, movedProducts: 3 } });
  });
  await page.goto('http://localhost:3001');
  await page.getByRole('button', { name: 'Categories', exact: true }).click();
  const row = page.getByRole('row').filter({ hasText: source.name });
  await row.getByRole('button', { name: 'Delete', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Delete category?' });
  await expect(dialog.getByText(/No products will be deleted/)).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Delete category', exact: true })).toBeDisabled();
  await dialog
    .getByRole('combobox', { name: 'Move products to', exact: true })
    .selectOption(destination.id);
  await dialog.getByRole('button', { name: 'Delete category', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(row).toHaveCount(0);
  expect(submitted).toEqual({ replacementCategoryId: destination.id });
});
