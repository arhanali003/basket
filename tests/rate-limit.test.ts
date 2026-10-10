import { rateLimitBucket } from '../apps/api/src/rate-limit';

describe('credential rate-limit classification', () => {
  test.each(['otp', 'verify', 'password', 'firebase', 'owner', 'staff'])(
    '%s keeps the stricter sign-in limit',
    (action) => {
      expect(rateLimitBucket('POST', `/api/v1/auth/${action}`)).toBe('auth');
      expect(rateLimitBucket('POST', `/api/v1/auth/${action}/`)).toBe('auth');
      expect(rateLimitBucket('POST', `/API/V1/AUTH/${action.toUpperCase()}`)).toBe('auth');
    },
  );

  test.each([
    ['GET', '/api/v1/auth/me'],
    ['HEAD', '/api/v1/auth/me'],
    ['POST', '/api/v1/auth/logout'],
    ['POST', '/api/v1/auth/logout/'],
    ['OPTIONS', '/api/v1/auth/password'],
    ['GET', '/api/v1/catalogue'],
    ['POST', '/api/v1/orders'],
  ])('%s %s does not exhaust credential attempts', (method, path) => {
    expect(rateLimitBucket(method, path)).toBe('api');
  });

  test('future authentication POST endpoints default to the strict bucket', () => {
    expect(rateLimitBucket('POST', '/api/v1/auth/new-method')).toBe('auth');
  });
});
