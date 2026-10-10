import type { Metadata } from 'next';
import { AssetRecovery } from '@daybasket/ui/src/asset-recovery';
import '@daybasket/ui/src/styles.css';
import './delivery.css';
export const metadata: Metadata = {
  title: 'Gupta Mart — Delivery partner',
  applicationName: 'Gupta Mart Partner',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [{ url: '/icon.svg', type: 'image/svg+xml' }],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  appleWebApp: { title: 'Gupta Mart Partner' },
  robots: { index: false, follow: false },
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
