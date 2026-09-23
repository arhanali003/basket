import type { NextConfig } from 'next';
const config: NextConfig = {
  devIndicators: false,
  ...(process.env.API_ORIGIN ? { env: { NEXT_PUBLIC_API_URL: '/api/v1' } } : {}),
  async rewrites() {
    const rules = [];
    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    if (projectId) {
      if (!/^[a-z0-9-]+$/.test(projectId)) throw new Error('Invalid Firebase project ID');
      rules.push({
        source: '/__/auth/:path*',
        destination: `https://${projectId}.firebaseapp.com/__/auth/:path*`,
      });
    }
    if (process.env.API_ORIGIN) {
      const origin = new URL(process.env.API_ORIGIN);
      if (origin.protocol !== 'https:') throw new Error('API_ORIGIN must use HTTPS');
      rules.push({ source: '/api/v1/:path*', destination: `${origin.origin}/api/v1/:path*` });
    }
    return rules;
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
      {
        source: '/__/auth/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Cache-Control', value: 'no-store' },
        ],
      },
    ];
  },
};
export default config;
