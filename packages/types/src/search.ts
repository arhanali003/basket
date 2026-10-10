type SearchableProduct = {
  name: string;
  brand: string;
  categoryId: string;
  description: string;
  unit: string;
};
type SearchCategory = { id: string; name: string };

export function normalizeSearch(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase()
    .replace(/(\d)(\p{L})/gu, '$1 $2')
    .replace(/(\p{L})(\d)/gu, '$1 $2')
    .replace(/[^\p{L}\p{N}\p{M}]+/gu, ' ')
    .trim();
}

// One inserted, missing, substituted or transposed letter; short words stay exact.
function nearbyWord(a: string, b: string) {
  if (a.length < 4 || b.length < 4 || Math.abs(a.length - b.length) > 1) return false;
  if (a.length === b.length) {
    const differences = [...a].map((c, i) => (c === b[i] ? -1 : i)).filter((i) => i >= 0);
    return (
      differences.length <= 1 ||
      (differences.length === 2 &&
        differences[1] === differences[0] + 1 &&
        a[differences[0]] === b[differences[1]] &&
        a[differences[1]] === b[differences[0]])
    );
  }
  const [short, long] = a.length < b.length ? [a, b] : [b, a];
  let i = 0;
  while (i < short.length && short[i] === long[i]) i++;
  return short.slice(i) === long.slice(i + 1);
}

export function searchProducts<T extends SearchableProduct>(
  products: readonly T[],
  categories: readonly SearchCategory[],
  query: string,
): { products: T[]; fuzzy: boolean } {
  const normalized = normalizeSearch(query.slice(0, 100));
  if (!normalized) return { products: [...products], fuzzy: false };
  const tokens = [...new Set(normalized.split(/\s+/))];
  const categoryNames = new Map(categories.map((category) => [category.id, category.name]));
  const indexed = products.map((product) => ({
    product,
    name: normalizeSearch(product.name),
    fields: [
      [product.name, 12],
      [product.brand, 8],
      [categoryNames.get(product.categoryId) || '', 6],
      [product.unit, 4],
      [product.description, 2],
    ].map(([value, weight]) => ({
      words: normalizeSearch(String(value)).split(/\s+/),
      weight: Number(weight),
    })),
  }));
  function rank(fuzzy: boolean) {
    return indexed
      .map(({ product, name, fields }) => {
        let score = name === normalized ? 100 : name.startsWith(normalized) ? 40 : 0;
        for (const token of tokens) {
          let best = 0;
          for (const { words, weight } of fields)
            for (const word of words) {
              const match =
                word === token
                  ? 3
                  : word.startsWith(token)
                    ? 2
                    : fuzzy && nearbyWord(token, word)
                      ? 1
                      : 0;
              best = Math.max(best, match * weight);
            }
          if (!best) return { product, score: 0 };
          score += best;
        }
        return { product, score };
      })
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((item) => item.product);
  }
  const exact = rank(false);
  if (exact.length) return { products: exact, fuzzy: false };
  const approximate = rank(true);
  return { products: approximate, fuzzy: approximate.length > 0 };
}
