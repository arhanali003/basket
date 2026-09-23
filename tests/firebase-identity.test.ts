import type { DecodedIdToken } from 'firebase-admin/auth';
import { getAuth } from 'firebase-admin/auth';
import {
  ownerEmailAllowed,
  requireOwner,
  requireCustomer,
  requireStaff,
  staffRole,
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
  process.env.STAFF_EMAILS = 'employee@example.com';
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

test.each([true, false, undefined])(
  'customers can use Google with email_verified=%s',
  (email_verified) => {
    const customer = { ...identity, email: 'customer@example.com', email_verified };
    expect(() => requireCustomer(customer)).not.toThrow();
    expect(() => requireOwner(customer)).toThrow();
  },
);
test('customers still need a Google identity', () => {
  expect(() =>
    requireCustomer({
      ...identity,
      firebase: { ...identity.firebase, sign_in_provider: 'password' },
    }),
  ).toThrow();
});
test('valid Google accounts without email verification pass account validation', async () => {
  const customer = { ...identity, email_verified: false };
  verify.mockResolvedValue(customer);
  (global.fetch as jest.Mock).mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({
      users: [
        { localId: customer.uid, email: customer.email, emailVerified: false, validSince: '100' },
      ],
    }),
  });
  const verified = await verifyFirebaseIdentity('valid-google-token');
  expect(() => requireCustomer(verified)).not.toThrow();
});

test('approved employees get staff access and owners retain owner access', () => {
  expect(requireStaff(identity)).toBe('super_admin');
  const employee = { ...identity, email: 'EMPLOYEE@example.com' };
  expect(requireStaff(employee)).toBe('staff');
  expect(() => requireOwner(employee)).toThrow();
  expect(() => requireStaff({ ...employee, email_verified: false })).toThrow('verified');
  expect(() => requireStaff({ ...identity, email: 'employee@example.com.evil' })).toThrow('access');
  expect(() =>
    requireStaff({ ...employee, firebase: { ...identity.firebase, sign_in_provider: 'password' } }),
  ).toThrow();
});
test('access lists support multiple emails and removal immediately changes role eligibility', () => {
  process.env.STAFF_EMAILS = 'employee@example.com, other@example.com, owner@example.com';
  expect(staffRole('other@example.com')).toBe('staff');
  expect(staffRole('owner@example.com')).toBe('super_admin');
  process.env.STAFF_EMAILS = '';
  expect(staffRole('employee@example.com')).toBeNull();
  expect(staffRole(undefined)).toBeNull();
});
