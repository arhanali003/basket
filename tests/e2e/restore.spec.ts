import { test, expect, type Page } from '@playwright/test';

// These simulate browser lifecycle events; they do not reproduce an OS evicting a mobile tab.
test.use({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
  serviceWorkers: 'block',
});

const pixel = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAEUlEQVR4nGNQ6nD5D8IMMAYAQMAHtWj8xhMAAAAASUVORK5CYII=',
  'base64',
);
const product = {
  id: 'restore-avocado',
  name: 'Farm-fresh avocados',
  slug: 'restore-avocado',
  categoryId: 'produce',
  brand: 'Test farm',
  description: 'A local browser test fixture.',
  image: '/__restore/product.png',
  unit: '2 pieces',
  price: 12900,
  mrp: 14900,
  taxBps: 0,
  maxQuantity: 10,
  active: true,
  inventory: [{ available: 10 }],
};

test.beforeEach(async ({ page }) => {
  // No account mutations or live catalogue dependencies are needed for asset recovery.
  await page.route('**/api/v1/**', async (route) => {
    const request = route.request();
    const headers = {
      'access-control-allow-origin': 'http://localhost:3000',
      'access-control-allow-credentials': 'true',
      'access-control-allow-headers': 'content-type',
      'access-control-allow-methods': 'GET, POST, OPTIONS',
    };
    if (request.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers });
      return;
    }
    const path = new URL(request.url()).pathname;
    if (path.endsWith('/catalogue')) {
      await route.fulfill({
        headers,
        json: {
          products: [product],
          categories: [
            { id: 'produce', name: 'Fresh produce', image: product.image, color: '#eef4e5' },
          ],
        },
      });
    } else if (path.endsWith('/homepage')) {
      await route.fulfill({ headers, json: { hero: '/__restore/hero.png' } });
    } else if (path.endsWith('/checkout/quote')) {
      await route.fulfill({
        headers,
        json: {
          subtotal: 12900,
          discount: 0,
          deliveryFee: 2000,
          handlingFee: 400,
          tax: 0,
          total: 15300,
        },
      });
    } else {
      await route.fulfill({ status: 401, headers, json: { message: 'Not signed in' } });
    }
  });
  await page.route('https://images.unsplash.com/**', (route) =>
    route.fulfill({ contentType: 'image/png', body: pixel }),
  );
  await page.route('**/__restore/*.png*', (route) =>
    route.fulfill({ contentType: 'image/png', body: pixel }),
  );
});

async function openStore(page: Page) {
  await page.goto('/');
  await expect(
    page.getByRole('button', { name: `View ${product.name}`, exact: true }),
  ).toBeVisible();
  await expect(page.locator('.site-header')).toHaveCSS('position', 'sticky');
  await expect
    .poll(() =>
      page
        .locator('link[rel="stylesheet"]')
        .evaluateAll(
          (links) =>
            links.length > 0 && links.every((link) => Boolean((link as HTMLLinkElement).sheet)),
        ),
    )
    .toBe(true);
  await page.evaluate(() => {
    Object.defineProperty(window, '__restoreDocument', { value: 'original document' });
  });
}

async function expectOriginalDocument(page: Page) {
  expect(await page.evaluate(() => Reflect.get(window, '__restoreDocument'))).toBe(
    'original document',
  );
}

async function resume(page: Page) {
  await page.evaluate(() => {
    window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
  });
}

async function removeStylesheets(page: Page) {
  return page.locator('link[rel="stylesheet"]').evaluateAll((links) => {
    const hrefs = links.map((link) => (link as HTMLLinkElement).href);
    links.forEach((link) => link.remove());
    return hrefs;
  });
}

test('a saved basket survives initial hydration and a normal reload', async ({ page }) => {
  await page.addInitScript(
    ({ id }) => {
      if (!sessionStorage.getItem('basket-fixture')) {
        localStorage.setItem('daybasket-cart', JSON.stringify([{ productId: id, quantity: 2 }]));
        sessionStorage.setItem('basket-fixture', 'ready');
      }
    },
    { id: product.id },
  );
  await openStore(page);
  await expect(page.locator('.basket-button > span')).toHaveText('2');
  await page.reload();
  await expect(page.locator('.basket-button > span')).toHaveText('2');
  expect(
    await page.evaluate(() => JSON.parse(localStorage.getItem('daybasket-cart') || '[]')),
  ).toEqual([{ productId: product.id, quantity: 2 }]);
});

test('blocked basket storage does not crash shopping', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === 'daybasket-cart')
        throw new DOMException('Storage unavailable', 'QuotaExceededError');
      return original.call(this, key, value);
    };
  });
  await openStore(page);
  await page.getByRole('button', { name: `Add ${product.name}`, exact: true }).click();
  await expect(page.locator('.basket-button > span')).toHaveText('1');
  await page.locator('.basket-button').click();
  await expect(page.getByRole('dialog')).toBeVisible();
  expect(errors).toEqual([]);
});

test('Gupta Mart fits a phone and healthy resumes preserve the current basket and search', async ({
  page,
}) => {
  await openStore(page);
  await expect(page).toHaveTitle(/Gupta Mart/);
  await expect(
    page.getByRole('link', { name: 'Gupta Mart home', exact: true }).first(),
  ).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.getByRole('button', { name: `Add ${product.name}`, exact: true }).click();
  await page.getByLabel('Search products').fill('avocados');
  const originalLinks = await page.locator('link[rel="stylesheet"]').evaluateAll((links) => {
    links.forEach((link) => link.setAttribute('data-healthy-restore-test', 'original'));
    return links.length;
  });

  await resume(page);
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await page.waitForTimeout(1500);

  await expectOriginalDocument(page);
  await expect(page.getByLabel('Search products')).toHaveValue('avocados');
  await expect(
    page.locator('link[rel="stylesheet"][data-healthy-restore-test="original"]'),
  ).toHaveCount(originalLinks);
  await expect(page.locator('.basket-button > span')).toHaveText('1');
  await page.locator('.basket-button').click();
  await expect(page.getByRole('heading', { name: 'Your basket · 1 items' })).toBeVisible();
});

test('a restored phone tab recovers missing CSS without losing the basket or typed input', async ({
  page,
}) => {
  await openStore(page);
  await page.getByRole('button', { name: `Add ${product.name}`, exact: true }).click();
  await page.getByLabel('Search products').fill('avocados');
  const hrefs = await removeStylesheets(page);
  expect(hrefs.length).toBeGreaterThan(0);
  await expect(page.locator('.site-header')).toHaveCSS('position', 'static');

  await resume(page);

  await expect(page.locator('.site-header')).toHaveCSS('position', 'sticky');
  await expectOriginalDocument(page);
  await expect(page.getByLabel('Search products')).toHaveValue('avocados');
  await expect(page.locator('.basket-button > span')).toHaveText('1');
  const recovered = await page
    .locator('link[rel="stylesheet"]')
    .evaluateAll((links) => links.map((link) => new URL((link as HTMLLinkElement).href).pathname));
  expect(recovered).toEqual(expect.arrayContaining(hrefs.map((href) => new URL(href).pathname)));
  await page.locator('.basket-button').click();
  await expect(page.getByRole('heading', { name: 'Your basket · 1 items' })).toBeVisible();
});

test('recovering the first stylesheet preserves the original CSS cascade order', async ({
  page,
}) => {
  await openStore(page);
  // Production may bundle all app CSS into one file. Add a later sheet with a
  // conflicting rule so this also verifies the actual cascade after recovery.
  await page.route('**/__restore/cascade.css*', (route) =>
    route.fulfill({ contentType: 'text/css', body: '.site-header { position: relative; }' }),
  );
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = '/__restore/cascade.css';
        link.onload = () => resolve();
        link.onerror = () => reject(new Error('Cascade fixture failed to load'));
        document.head.appendChild(link);
      }),
  );
  await expect(page.locator('.site-header')).toHaveCSS('position', 'relative');
  await resume(page);
  // Let the healthy-resume handler remember the additional, loaded stylesheet.
  await page.waitForTimeout(500);
  const stylesheets = page.locator('link[rel="stylesheet"]');
  const originalOrder = await stylesheets.evaluateAll((links) =>
    links.map((link) => new URL((link as HTMLLinkElement).href).pathname),
  );
  expect(originalOrder.length).toBeGreaterThanOrEqual(2);
  await stylesheets.first().evaluate((link) => link.remove());

  await resume(page);

  await expect(stylesheets).toHaveCount(originalOrder.length);
  await expect
    .poll(() =>
      stylesheets.evaluateAll((links) =>
        links.every((link) => Boolean((link as HTMLLinkElement).sheet)),
      ),
    )
    .toBe(true);
  const recoveredOrder = await stylesheets.evaluateAll((links) =>
    links.map((link) => new URL((link as HTMLLinkElement).href).pathname),
  );
  expect(recoveredOrder).toEqual(originalOrder);
  await expect(page.locator('.site-header')).toHaveCSS('position', 'relative');
  await expectOriginalDocument(page);
});

test('a failed photo is retried on resume while healthy images and the document stay intact', async ({
  page,
}) => {
  await openStore(page);
  let attempts = 0;
  let available = false;
  await page.route('**/__restore/interrupted.png*', async (route) => {
    attempts++;
    if (!available) await route.abort('failed');
    else await route.fulfill({ contentType: 'image/png', body: pixel });
  });
  await page.locator('.hero-image').evaluate((image) => {
    (image as HTMLImageElement).src = '/__restore/interrupted.png';
  });
  await expect
    .poll(() =>
      page.locator('.hero-image').evaluate((image) => {
        const photo = image as HTMLImageElement;
        return photo.complete && photo.naturalWidth === 0;
      }),
    )
    .toBe(true);
  const beforeResume = attempts;
  const healthyImage = page.locator('.hero-side img');
  await expect
    .poll(() => healthyImage.evaluate((image) => (image as HTMLImageElement).naturalWidth))
    .toBeGreaterThan(0);
  const healthySource = await healthyImage.getAttribute('src');
  available = true;

  await resume(page);

  await expect
    .poll(() =>
      page.locator('.hero-image').evaluate((image) => (image as HTMLImageElement).naturalWidth),
    )
    .toBeGreaterThan(0);
  expect(attempts).toBeGreaterThan(beforeResume);
  await expect(healthyImage).toHaveAttribute('src', healthySource!);
  await expectOriginalDocument(page);
});

test('offline resumes do not reload or discard input, and CSS recovers after reconnecting', async ({
  page,
  context,
}) => {
  await openStore(page);
  await page.getByLabel('Search products').fill('avocados');
  await context.setOffline(true);
  await expect.poll(() => page.evaluate(() => navigator.onLine)).toBe(false);
  await removeStylesheets(page);

  await resume(page);
  // Allow the debounced resume handler to run while the browser is still offline.
  await page.waitForTimeout(1000);
  await expectOriginalDocument(page);
  await expect(page.getByLabel('Search products')).toHaveValue('avocados');

  await context.setOffline(false);
  await expect(page.locator('.site-header')).toHaveCSS('position', 'sticky');
  await expectOriginalDocument(page);
  await expect(page.getByLabel('Search products')).toHaveValue('avocados');
});

test('unavailable deployment CSS triggers at most one reload in a recovery window and retains the saved basket', async ({
  page,
}) => {
  await openStore(page);
  await page.getByRole('button', { name: `Add ${product.name}`, exact: true }).click();
  await expect(page.locator('.basket-button > span')).toHaveText('1');
  let navigations = 0;
  page.on('request', (request) => {
    if (request.isNavigationRequest() && request.frame() === page.mainFrame()) navigations++;
  });
  await page.route(/\/_next\/static\/.*\.css(?:\?.*)?$/, (route) =>
    route.fulfill({ status: 404, contentType: 'text/plain', body: 'Deployment asset unavailable' }),
  );
  await removeStylesheets(page);

  const reloaded = page.waitForRequest(
    (request) => request.isNavigationRequest() && request.frame() === page.mainFrame(),
  );
  await resume(page);
  await reloaded;
  await page.waitForFunction(() => !Reflect.has(window, '__restoreDocument'));
  await page.waitForLoadState('load');
  await expect(page.locator('.basket-button > span')).toHaveText('1');
  expect(navigations).toBe(1);

  // Keep the failed assets unavailable across subsequent restore events.
  await resume(page);
  await page.waitForTimeout(1500);
  await resume(page);
  await page.waitForTimeout(1500);
  expect(navigations).toBe(1);
  await expect(page.locator('.basket-button > span')).toHaveText('1');
});
