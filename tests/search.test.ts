import { normalizeSearch, searchProducts } from '../packages/types/src/search';

const categories = [
  { id: 'dairy', name: 'Dairy & breakfast' },
  { id: 'fruit', name: 'Fresh produce' },
  { id: 'custom', name: 'Homemade pickles' },
];
const milk = {
  id: 'milk',
  name: 'Fresh whole milk',
  brand: 'Amul',
  categoryId: 'dairy',
  description: 'Pasteurized and creamy',
  unit: '500 ml',
};
const strawberries = {
  ...milk,
  id: 'strawberries',
  name: 'Sweet strawberries',
  brand: 'The Orchard',
  categoryId: 'fruit',
  description: 'Juicy summer berries',
  unit: '250 g',
};
const pickle = {
  ...milk,
  id: 'pickle',
  name: 'Mango achar',
  brand: 'Gupta Kitchen',
  categoryId: 'custom',
  description: 'Traditional spiced mango',
  unit: '400 g',
};
const catalogue = [milk, strawberries, pickle];

describe('catalogue search', () => {
  test.each(['milk fresh', '  FRESH   Milk  ', 'fresh, milk!', 'milk milk fresh'])(
    'matches all words regardless of order, case, spacing or punctuation: %s',
    (query) => {
      expect(searchProducts(catalogue, categories, query)).toEqual({
        products: [milk],
        fuzzy: false,
      });
    },
  );

  test.each([
    ['amul', milk],
    ['dairy breakfast', milk],
    ['500ml', milk],
    ['pasteurized', milk],
    ['homemade pickles', pickle],
    ['gupta mango', pickle],
    ['straw', strawberries],
  ])('searches brand, category, pack size, description and prefixes: %s', (query, product) => {
    expect(searchProducts(catalogue, categories, query as string)).toEqual({
      products: [product],
      fuzzy: false,
    });
  });

  test('normalizes accents and punctuation while preserving non-Latin names', () => {
    const coffee = { ...milk, id: 'coffee', name: 'Café crème', brand: 'गुप्ता' };
    expect(normalizeSearch('  CAFÉ—Crème  ')).toBe('cafe creme');
    expect(searchProducts([coffee], categories, 'cafe creme').products).toEqual([coffee]);
    expect(searchProducts([coffee], categories, 'गुप्ता').products).toEqual([coffee]);
  });

  test.each(['strawberies', 'strawberreis', 'strawberriez'])(
    'uses a close spelling only when no direct result exists: %s',
    (query) => {
      expect(searchProducts(catalogue, categories, query)).toEqual({
        products: [strawberries],
        fuzzy: true,
      });
    },
  );

  test('does not mix approximate results into successful direct matches', () => {
    const direct = { ...strawberries, id: 'brand', name: 'Berry box', brand: 'Strawberies' };
    expect(searchProducts([...catalogue, direct], categories, 'strawberies')).toEqual({
      products: [direct],
      fuzzy: false,
    });
  });

  test('ranks an exact product name ahead of prefixes and description mentions', () => {
    const exact = { ...milk, id: 'exact', name: 'Milk' };
    const prefix = { ...milk, id: 'prefix', name: 'Milk chocolate' };
    const description = { ...milk, id: 'description', name: 'Tea', description: 'Serve with milk' };
    expect(searchProducts([description, prefix, exact], categories, 'milk').products).toEqual([
      exact,
      prefix,
      description,
    ]);
  });

  test.each(['spaceship', 'milk strawberry', 'milk unrelated', 'ilk'])(
    'does not show unrelated products or partial token sets: %s',
    (query) => {
      expect(searchProducts(catalogue, categories, query)).toEqual({ products: [], fuzzy: false });
    },
  );

  test('blank or punctuation-only searches restore the full original catalogue', () => {
    for (const query of ['', '   ', ' ! - ? ']) {
      const result = searchProducts(catalogue, categories, query);
      expect(result).toEqual({ products: catalogue, fuzzy: false });
      expect(result.products).not.toBe(catalogue);
    }
  });

  test('finds a product beyond the first 100 records without mutating the catalogue', () => {
    const many = Array.from({ length: 130 }, (_, index) => ({
      ...milk,
      id: `pantry-${index}`,
      name: `Pantry item ${index}`,
    }));
    const late = { ...pickle, id: 'late', name: 'Saffron threads' };
    const products = Object.freeze([...many, late]);
    expect(searchProducts(products, categories, 'saffron').products).toEqual([late]);
    expect(products.at(-1)).toBe(late);
  });
});
