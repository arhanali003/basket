import type { Metadata } from 'next';
import '@daybasket/ui/src/styles.css';
import './admin.css';
export const metadata: Metadata = {
  title: 'Daybasket — Store studio',
  robots: { index: false, follow: false },
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
