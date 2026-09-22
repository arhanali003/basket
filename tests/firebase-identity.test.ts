import type { DecodedIdToken } from 'firebase-admin/auth';
import { getAuth } from 'firebase-admin/auth';
import {
  ownerEmailAllowed,
  requireOwner,
  verifyFirebaseIdentity,
} from '../apps/api/src/firebase-identity';

jest.mock('firebase-admin/app', () => ({ getApps: () => [{}], initializeApp: jest.fn() }));
jest.mock('firebase-admin/auth', () => ({ getAuth: jest.fn() }));
const identity = {
  uid: 'owner-uid',
  email: 'owner@example.com',
  email_verified: true,
  auth_time: 200,
  firebase: { sign_in_provider: 'google.com' },
} as DecodedIdToken;
const verify = jest.fn();
const originalFetch = global.fetch;
const previous = { ...process.env };
beforeEach(() => {
  process.env.ADMIN_EMAILS = 'owner@example.com, second@example.com';
  process.env.FIREBASE_PROJECT_ID = 'test-project';
  process.env.FIREBASE_WEB_API_KEY = 'public-test-key';
  (getAuth as jest.Mock).mockReturnValue({ verifyIdToken: verify });
  verify.mockReset().mockResolvedValue(identity);
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({
      users: [
        {
          localId: identity.uid,
          email: identity.email,
          emailVerified: true,
          validSince: '100',
          disabled: false,
        },
      ],
    }),
  });
});
afterAll(() => {
  global.fetch = originalFetch;
  process.env = previous;
});

test('only verified Google identities on the exact allowlist can become owners', () => {
  expect(() => requireOwner(identity)).not.toThrow();
  for (const change of [
    { email: 'stranger@example.com' },
    { email: 'owner@example.com.evil' },
    { email_verified: false },
    { firebase: { sign_in_provider: 'password' } },
  ]) {
    expect(() => requireOwner({ ...identity, ...change } as DecodedIdToken)).toThrow();
  }
  process.env.ADMIN_EMAILS = '';
  expect(() => requireOwner(identity)).toThrow();
});
test('owner allowlist removal takes effect without restarting the process', () => {
  expect(ownerEmailAllowed('OWNER@example.com')).toBe(true);
  process.env.ADMIN_EMAILS = 'second@example.com';
  expect(ownerEmailAllowed(identity.email)).toBe(false);
});
test('validates signature before checking current Firebase account state', async () => {
  await expect(verifyFirebaseIdentity('token')).resolves.toEqual(identity);
  expect(verify).toHaveBeenCalledWith('token', false);
  expect(global.fetch).toHaveBeenCalledTimes(1);
});
test('forged, expired, or wrong-project tokens are rejected before account lookup', async () => {
  verify.mockRejectedValue(new Error('invalid token'));
  await expect(verifyFirebaseIdentity('forged')).rejects.toThrow('invalid');
  expect(global.fetch).not.toHaveBeenCalled();
});
test.each([
  { disabled: true },
  { validSince: '201' },
  { localId: 'other-uid' },
  { email: 'changed@example.com' },
  { emailVerified: false },
  { validSince: 'bad' },
])('rejects disabled, revoked, or changed accounts: %j', async (change) => {
  (global.fetch as jest.Mock).mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({
      users: [
        {
          localId: identity.uid,
          email: identity.email,
          emailVerified: true,
          validSince: '100',
          ...change,
        },
      ],
    }),
  });
  await expect(verifyFirebaseIdentity('token')).rejects.toThrow('revoked');
});
test('fails closed when Firebase is unavailable', async () => {
  (global.fetch as jest.Mock).mockRejectedValue(new Error('offline'));
  await expect(verifyFirebaseIdentity('token')).rejects.toThrow('temporarily unavailable');
});
test('retains credential-based revocation checking when no web key is configured', async () => {
  delete process.env.FIREBASE_WEB_API_KEY;
  await verifyFirebaseIdentity('token');
  expect(verify).toHaveBeenCalledWith('token', true);
  expect(global.fetch).not.toHaveBeenCalled();
});
