import type { NextConfig } from 'next';
const config: NextConfig = {
  devIndicators: false,
  ...(process.env.API_ORIGIN ? { env: { NEXT_PUBLIC_API_URL: '/api/v1' } } : {}),
  async rewrites() {
    if (!process.env.API_ORIGIN) return [];
    const origin = new URL(process.env.API_ORIGIN);
    if (origin.protocol !== 'https:') throw new Error('API_ORIGIN must use HTTPS');
    return [{ source: '/api/v1/:path*', destination: `${origin.origin}/api/v1/:path*` }];
  },
  transpilePackages: ['@daybasket/ui', '@daybasket/types', '@daybasket/api-client'],
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
        ],
      },
    ];
  },
};
export default config;
