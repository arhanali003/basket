import { expect, test, type Page } from '@playwright/test';

test.use({ serviceWorkers: 'block' });

const pixel = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAEUlEQVR4nGNQ6nD5D8IMMAYAQMAHtWj8xhMAAAAASUVORK5CYII=',
  'base64',
);
const milk = {
  id: 'search-milk',
  name: 'Fresh whole milk',
  slug: 'search-milk',
  categoryId: 'dairy',
  brand: 'Amul',
  description: 'Pasteurized and creamy',
  image: '/__search/product.png',
  unit: '500 ml',
  price: 3000,
  mrp: 3500,
  taxBps: 0,
  maxQuantity: 10,
  active: true,
  inventory: [{ available: 10 }],
};
const strawberries = {
  ...milk,
  id: 'search-berries',
  slug: 'search-berries',
  name: 'Sweet strawberries',
  categoryId: 'produce',
  brand: 'The Orchard',
  description: 'Juicy summer berries',
  unit: '250 g',
};
const pickle = {
  ...milk,
  id: 'search-pickle',
  slug: 'search-pickle',
  name: 'Mango achar',
  categoryId: 'custom-pickles',
  brand: 'Gupta Kitchen',
  description: 'Traditional spiced mango',
  unit: '400 g',
};
const products = [
  milk,
  strawberries,
  ...Array.from({ length: 101 }, (_, index) => ({
    ...milk,
    id: `search-pantry-${index}`,
    slug: `search-pantry-${index}`,
    name: `Pantry staple ${index}`,
    brand: 'Store brand',
    categoryId: 'pantry',
    description: 'Cupboard essentials',
    unit: '1 kg',
  })),
  pickle,
];

test.beforeEach(async ({ page }) => {
  // Public catalogue fixtures keep search/category verification independent of account mutations.
  await page.route('**/api/v1/**', async (route) => {
    const headers = {
      'access-control-allow-origin': 'http://localhost:3000',
      'access-control-allow-credentials': 'true',
      'access-control-allow-headers': 'content-type',
      'access-control-allow-methods': 'GET, POST, OPTIONS',
    };
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers });
      return;
    }
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/catalogue')) {
      await route.fulfill({
        headers,
        json: {
          products,
          categories: [
            { id: 'dairy', name: 'Dairy & breakfast', image: milk.image, color: '#eeeeee' },
            { id: 'produce', name: 'Fresh produce', image: milk.image, color: '#eeeeee' },
            { id: 'pantry', name: 'Pantry staples', image: milk.image, color: '#eeeeee' },
            { id: 'custom-pickles', name: 'Homemade pickles', image: milk.image, color: '#eeeeee' },
          ],
        },
      });
    } else if (path.endsWith('/homepage')) {
      await route.fulfill({ headers, json: { hero: '/__search/product.png' } });
    } else {
      await route.fulfill({ status: 401, headers, json: { message: 'Not signed in' } });
    }
  });
  await page.route('https://images.unsplash.com/**', (route) =>
    route.fulfill({ contentType: 'image/png', body: pixel }),
  );
  await page.route('**/__search/*.png*', (route) =>
    route.fulfill({ contentType: 'image/png', body: pixel }),
  );
});

async function openStore(page: Page) {
  await page.goto('/');
  await expect(page.locator('.product-card')).toHaveCount(products.length);
}

test('live search puts ranked results first, and clear restores browsing', async ({ page }) => {
  await openStore(page);
  await page.getByLabel('Search products').fill('milk fresh');
  await expect(page.locator('.product-card')).toHaveCount(1);
  await expect(page.locator('.product-card')).toContainText(milk.name);
  await expect(page.getByRole('region', { name: 'Weekly specials' })).toHaveCount(0);
  await expect(page.locator('#catalogue').getByRole('status')).toHaveText('1 product found');
  await expect(page.getByLabel('Search products')).toHaveAttribute('aria-expanded', 'true');
  await page.getByLabel('Clear search').click();
  await expect(page.getByLabel('Search products')).toHaveValue('');
  await expect(page.locator('.product-card')).toHaveCount(products.length);
  await expect(page.getByRole('region', { name: 'Weekly specials' })).toBeVisible();
});

test('case, repeated spaces, brand, category, pack size and close spelling work', async ({
  page,
}) => {
  await openStore(page);
  for (const query of ['  MiLk   FRESH  ', 'amul', '500ml', 'pasteurized']) {
    await page.getByLabel('Search products').fill(query);
    await expect(page.locator('.product-card')).toHaveCount(1);
    await expect(page.locator('.product-card')).toContainText(milk.name);
  }
  await page.getByLabel('Search products').fill('homemade pickles');
  await expect(page.locator('.product-card')).toHaveCount(1);
  await expect(page.locator('.product-card')).toContainText(pickle.name);
  await page.getByLabel('Search products').fill('strawberies');
  await expect(page.locator('.product-card')).toHaveCount(1);
  await expect(page.locator('.product-card')).toContainText(strawberries.name);
  await expect(page.locator('#catalogue').getByRole('status')).toContainText(
    'Showing close matches',
  );
});

test('unmatched searches explain the empty state and allow returning to all products', async ({
  page,
}) => {
  await openStore(page);
  await page.getByLabel('Search products').fill('spaceship');
  await expect(page.locator('.product-card')).toHaveCount(0);
  await expect(
    page.getByRole('heading', { name: 'No products found for “spaceship”' }),
  ).toBeVisible();
  await expect(page.getByRole('listbox', { name: 'Product suggestions' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Explore everything', exact: true }).click();
  await expect(page.getByLabel('Search products')).toHaveValue('');
  await expect(page.locator('.product-card')).toHaveCount(products.length);
});

test('keyboard suggestions open a product, while a plain Enter keeps the result list', async ({
  page,
}) => {
  await openStore(page);
  const search = page.getByLabel('Search products');
  await search.fill('milk');
  await search.press('Enter');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('.product-card')).toHaveCount(1);
  await search.focus();
  await search.press('ArrowDown');
  await expect(search).toHaveAttribute('aria-activedescendant', 'product-suggestion-0');
  await search.press('Enter');
  await expect(
    page.getByRole('dialog').getByRole('heading', { name: milk.name, exact: true }),
  ).toBeVisible();
});

test('ArrowUp from the input selects the last suggestion and Escape closes suggestions', async ({
  page,
}) => {
  await openStore(page);
  const search = page.getByLabel('Search products');
  await search.fill('pantry');
  await expect(
    page.getByRole('listbox', { name: 'Product suggestions' }).getByRole('option'),
  ).toHaveCount(5);
  await search.press('ArrowUp');
  await expect(search).toHaveAttribute('aria-activedescendant', 'product-suggestion-4');
  await search.press('Escape');
  await expect(search).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('.product-card')).toHaveCount(101);
});

test('clicking a suggestion opens its product without blur losing the click', async ({ page }) => {
  await openStore(page);
  await page.getByLabel('Search products').fill('milk');
  await page.getByRole('option', { name: /Fresh whole milk/ }).click();
  await expect(
    page.getByRole('dialog').getByRole('heading', { name: milk.name, exact: true }),
  ).toBeVisible();
});

test('custom API categories appear in navigation and filter products beyond the first 100', async ({
  page,
}) => {
  await openStore(page);
  await page
    .getByRole('navigation', { name: 'Store categories' })
    .getByRole('button', { name: 'Homemade pickles', exact: true })
    .click();
  await expect(page.locator('.product-card')).toHaveCount(1);
  await expect(page.locator('.product-card')).toContainText(pickle.name);
  await page.getByLabel('Search products').fill('milk');
  await expect(page.locator('.product-card')).toHaveCount(1);
  await expect(page.locator('.product-card')).toContainText(milk.name);
  await page.getByLabel('Search products').fill('mango');
  await expect(page.locator('.product-card')).toHaveCount(1);
  await expect(page.locator('.product-card')).toContainText(pickle.name);
});

test.describe('phone search', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test('a touch suggestion opens the product and search stays within the phone viewport', async ({
    page,
  }) => {
    await openStore(page);
    await page.getByLabel('Search products').fill('milk');
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await page.getByRole('option', { name: /Fresh whole milk/ }).tap();
    await expect(
      page.getByRole('dialog').getByRole('heading', { name: milk.name, exact: true }),
    ).toBeVisible();
  });
});
