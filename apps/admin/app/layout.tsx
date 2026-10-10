import type { Metadata } from 'next';
import { AssetRecovery } from '@daybasket/ui/src/asset-recovery';
import '@daybasket/ui/src/styles.css';
import './admin.css';
export const metadata: Metadata = {
  title: 'Gupta Mart — Store studio',
  applicationName: 'Gupta Mart Store Studio',
  icons: {
    icon: [{ url: '/icon.svg', type: 'image/svg+xml' }],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
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
