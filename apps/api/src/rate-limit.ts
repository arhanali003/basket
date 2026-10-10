// Session checks and sign-out are normal API traffic, not credential attempts.
// Counting them against sign-in limits can lock out users simply opening tabs.
export function rateLimitBucket(method: string, path: string): 'auth' | 'api' {
  const route = path.toLowerCase().replace(/\/+$/, '');
  return method === 'POST' && route.startsWith('/api/v1/auth/') && route !== '/api/v1/auth/logout'
    ? 'auth'
    : 'api';
}
