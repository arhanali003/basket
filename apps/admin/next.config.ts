import type { NextConfig } from 'next';
const config: NextConfig = {
  devIndicators: false,
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
