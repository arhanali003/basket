import type { Metadata } from 'next';
import '@daybasket/ui/src/styles.css';
import './delivery.css';
export const metadata: Metadata = {
  title: 'Daybasket — Delivery partner',
  manifest: '/manifest.webmanifest',
  robots: { index: false, follow: false },
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
