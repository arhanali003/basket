const mockRequest = jest.fn();
const mockRedirect = jest.fn();
const mockResult = jest.fn();
const mockSignOut = jest.fn();
const mockInitialize = jest.fn(() => ({}));
jest.mock(
  'firebase/app',
  () => ({
    getApps: () => [],
    initializeApp: (config: unknown) => config,
  }),
  { virtual: true },
);
jest.mock(
  'firebase/auth',
  () => ({
    initializeAuth: (...args: unknown[]) => mockInitialize(...(args as [])),
    browserSessionPersistence: 'session',
    browserPopupRedirectResolver: 'resolver',
    GoogleAuthProvider: class {
      setCustomParameters() {}
    },
    signInWithRedirect: (...args: unknown[]) => mockRedirect(...args),
    getRedirectResult: (...args: unknown[]) => mockResult(...args),
    signOut: (...args: unknown[]) => mockSignOut(...args),
  }),
  { virtual: true },
);
jest.mock(
  '@daybasket/api-client',
  () => ({
    request: (...args: unknown[]) => mockRequest(...args),
  }),
  { virtual: true },
);

const memory = new Map<string, string>();
beforeEach(() => {
  jest.resetModules();
  jest.clearAllMocks();
  process.env.NEXT_PUBLIC_FIREBASE_API_KEY = 'test-key';
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = 'test-project';
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { location: { host: 'admin.example.com' } },
  });
  Object.defineProperty(globalThis, 'sessionStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => memory.get(key) ?? null,
      setItem: (key: string, value: string) => {
        memory.set(key, value);
      },
      removeItem: (key: string) => {
        memory.delete(key);
      },
    },
  });
  memory.clear();
  mockSignOut.mockResolvedValue(undefined);
  mockResult.mockResolvedValue(null);
});
afterAll(() => {
  delete (globalThis as { window?: unknown }).window;
  delete (globalThis as { sessionStorage?: unknown }).sessionStorage;
});
test('uses the admin origin and session persistence for the redirect', async () => {
  const { signInOwner } = await import('../apps/admin/app/sign-in');
  await signInOwner();
  expect(mockInitialize).toHaveBeenCalledWith(
    expect.objectContaining({ authDomain: 'admin.example.com' }),
    expect.objectContaining({ persistence: 'session' }),
  );
  expect(mockRedirect).toHaveBeenCalledTimes(1);
  expect(memory.get('daybasket-owner-sign-in')).toBe('1');
});
test('exchanges a returned Google credential once even with repeated startup calls', async () => {
  mockResult.mockResolvedValue({ user: { getIdToken: async () => 'verified-token' } });
  mockRequest.mockResolvedValue({ id: 'owner', role: 'super_admin' });
  const { finishOwnerSignIn } = await import('../apps/admin/app/sign-in');
  const results = await Promise.all([finishOwnerSignIn(), finishOwnerSignIn()]);
  expect(results[0]).toEqual({ id: 'owner', role: 'super_admin' });
  expect(mockRequest).toHaveBeenCalledTimes(1);
  expect(mockRequest).toHaveBeenCalledWith('/auth/owner', 'POST', { token: 'verified-token' });
  expect(mockSignOut).toHaveBeenCalledTimes(1);
});
test('keeps backend access rejection visible and clears temporary identity', async () => {
  mockResult.mockResolvedValue({ user: { getIdToken: async () => 'token' } });
  mockRequest.mockRejectedValue(new Error('This account does not have store access'));
  const { finishOwnerSignIn } = await import('../apps/admin/app/sign-in');
  await expect(finishOwnerSignIn()).rejects.toThrow('store access');
  expect(mockSignOut).toHaveBeenCalledTimes(1);
});
test('shows a recoverable error if a redirect returns without its credential', async () => {
  memory.set('daybasket-owner-sign-in', '1');
  const { finishOwnerSignIn } = await import('../apps/admin/app/sign-in');
  await expect(finishOwnerSignIn()).rejects.toThrow('did not finish');
  expect(memory.size).toBe(0);
  expect(mockRequest).not.toHaveBeenCalled();
});
test('an ordinary page visit has no redirect error or account provisioning', async () => {
  const { finishOwnerSignIn } = await import('../apps/admin/app/sign-in');
  await expect(finishOwnerSignIn()).resolves.toBeNull();
  expect(mockRequest).not.toHaveBeenCalled();
});
test('blocked session storage is reported before leaving the page', async () => {
  sessionStorage.setItem = () => {
    throw new Error('blocked');
  };
  const { signInOwner } = await import('../apps/admin/app/sign-in');
  await expect(signInOwner()).rejects.toThrow('cannot store');
  expect(mockRedirect).not.toHaveBeenCalled();
});
