import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  browserSessionPersistence,
  initializeAuth,
  browserPopupRedirectResolver,
  signInWithRedirect,
  getRedirectResult,
  signOut,
} from 'firebase/auth';
import { request } from '@daybasket/api-client';
import type { User } from '@daybasket/types';

export function prepareAdminAuth() {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  // Serve Firebase's helper from this origin so browser storage is first-party.
  const authDomain = window.location.host;
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (!apiKey || !authDomain || !projectId) {
    throw new Error(
      'Owner sign-in is awaiting configuration. Please contact the store administrator.',
    );
  }
  const auth = getApps().length
    ? getAuth(getApp())
    : initializeAuth(initializeApp({ apiKey, authDomain, projectId }), {
        persistence: browserSessionPersistence,
        popupRedirectResolver: browserPopupRedirectResolver,
      });
  return auth;
}

export function adminSignInError(error: unknown): string {
  const code = (error as { code?: string })?.code;
  const messages: Record<string, string> = {
    'auth/popup-blocked':
      'Your browser blocked Google sign-in. Allow popups for this site and try again, or open this page in Safari or Chrome.',
    'auth/popup-closed-by-user':
      'The Google window was closed before sign-in finished. Please try again.',
    'auth/cancelled-popup-request':
      'Another sign-in window is open. Finish that sign-in or try again.',
    'auth/unauthorized-domain':
      'Google sign-in is not enabled for this website address. Open https://basket-admin-delta.vercel.app and try again.',
    'auth/network-request-failed':
      'Could not reach Google. Check your internet connection and try again.',
    'auth/operation-not-allowed':
      'Google sign-in is not enabled for this store. Contact the owner.',
  };
  return (
    (code && messages[code]) ||
    (error instanceof Error ? error.message : 'Sign-in failed. Please try again.')
  );
}

const pendingKey = 'daybasket-owner-sign-in';
let redirectCompletion: Promise<User | null> | undefined;

export async function signInOwner(): Promise<never> {
  const auth = prepareAdminAuth();
  const provider = new GoogleAuthProvider();
  provider.addScope('email');
  provider.setCustomParameters({ prompt: 'select_account' });
  try {
    sessionStorage.setItem(pendingKey, '1');
  } catch {
    throw new Error(
      'This browser cannot store the sign-in session. Open this page in a regular browser window and try again.',
    );
  }
  try {
    return await signInWithRedirect(auth, provider);
  } catch (error) {
    sessionStorage.removeItem(pendingKey);
    throw error;
  }
}

// React may run startup effects twice. Exchange a redirect credential only once.
export function finishOwnerSignIn(): Promise<User | null> {
  return (redirectCompletion ??= completeRedirect());
}

async function completeRedirect(): Promise<User | null> {
  const auth = prepareAdminAuth();
  try {
    const result = await getRedirectResult(auth);
    if (!result) {
      if (sessionStorage.getItem(pendingKey)) {
        throw new Error(
          'Google sign-in did not finish. Please click Continue with Google to start again.',
        );
      }
      return null;
    }
    const token = await result.user.getIdToken();
    const googleAccessToken = GoogleAuthProvider.credentialFromResult(result)?.accessToken;
    return await request<User>('/auth/owner', 'POST', { token, googleAccessToken });
  } finally {
    sessionStorage.removeItem(pendingKey);
    await signOut(auth).catch(() => {});
  }
}
