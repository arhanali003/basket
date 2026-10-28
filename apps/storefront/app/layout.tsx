import type { Metadata } from 'next';
import { AssetRecovery } from '@daybasket/ui/src/asset-recovery';
import '@daybasket/ui/src/styles.css';
import './store.css';
export const metadata: Metadata = {
  title: 'Gupta Mart — Everyday good, at your door',
  applicationName: 'Gupta Mart',
  description:
    'Fresh groceries, pantry favourites and little everyday joys. Thoughtfully delivered.',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [{ url: '/icon.svg', type: 'image/svg+xml' }],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  appleWebApp: { title: 'Gupta Mart' },
  openGraph: {
    title: 'Gupta Mart — Everyday good',
    description: 'Your neighbourhood basket of fresh essentials.',
    type: 'website',
  },
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AssetRecovery />
        {children}
      </body>
    </html>
  );
}
