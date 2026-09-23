import { notFound } from 'next/navigation';
import { money, type Product } from '@daybasket/types';
import { Logo, ProductGallery } from '@daybasket/ui';
export const dynamic = 'force-dynamic';
export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const response = await fetch(
    `${process.env.API_ORIGIN ? `${process.env.API_ORIGIN}/api/v1` : process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1'}/products/${encodeURIComponent(slug)}`,
    { cache: 'no-store' },
  );
  if (!response.ok) notFound();
  const p = (await response.json()) as Product;
  return (
    <main className="policies">
      <Logo />
      <div className="product-detail" style={{ marginTop: 40 }}>
        <ProductGallery image={p.image} images={p.images} name={p.name} />
        <div>
          <span className="eyebrow">{p.brand}</span>
          <h1 style={{ fontSize: 32 }}>{p.name}</h1>
          <p>{p.unit}</p>
          <div className="detail-price">{money(p.price)}</div>
          <p>{p.description}</p>
          <a className="primary" href="/">
            Shop the neighbourhood →
          </a>
        </div>
      </div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Product',
            name: p.name,
            image: p.image,
            description: p.description,
            offers: {
              '@type': 'Offer',
              price: (p.price / 100).toFixed(2),
              priceCurrency: 'INR',
              availability: p.inventory[0]?.available
                ? 'https://schema.org/InStock'
                : 'https://schema.org/OutOfStock',
            },
          }).replaceAll('<', '\\u003c'),
        }}
      />
    </main>
  );
}
