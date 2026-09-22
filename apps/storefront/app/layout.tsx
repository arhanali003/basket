import type { Metadata } from 'next';
import '@daybasket/ui/src/styles.css';
import './store.css';
export const metadata: Metadata = {
  title: 'Daybasket — Everyday good, at your door',
  description:
    'Fresh groceries, pantry favourites and little everyday joys. Thoughtfully delivered in Bengaluru.',
  manifest: '/manifest.webmanifest',
  openGraph: {
    title: 'Daybasket — Everyday good',
    description: 'Your neighbourhood basket of fresh essentials.',
    type: 'website',
  },
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
