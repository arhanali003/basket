import type { NextConfig } from 'next';
const config: NextConfig = {
  devIndicators: false,
  transpilePackages: ['@daybasket/ui', '@daybasket/types', '@daybasket/api-client'],
  async rewrites() {
    const origin = process.env.API_ORIGIN;
    if (!origin) return [];
    const url = new URL(origin);
    if (url.protocol !== 'https:') throw new Error('API_ORIGIN must use HTTPS');
    return [{ source: '/api/v1/:path*', destination: `${url.origin}/api/v1/:path*` }];
  },
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
