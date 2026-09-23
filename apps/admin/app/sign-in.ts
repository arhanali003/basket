import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  inMemoryPersistence,
  initializeAuth,
  browserPopupRedirectResolver,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import { request } from '@daybasket/api-client';
import type { User } from '@daybasket/types';

export function prepareAdminAuth() {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN;
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (!apiKey || !authDomain || !projectId) {
    throw new Error(
      'Owner sign-in is awaiting configuration. Please contact the store administrator.',
    );
  }
  const auth = getApps().length
    ? getAuth(getApp())
    : initializeAuth(initializeApp({ apiKey, authDomain, projectId }), {
        persistence: inMemoryPersistence,
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

export async function signInOwner(): Promise<User> {
  const auth = prepareAdminAuth();
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  try {
    const result = await signInWithPopup(auth, provider);
    return await request<User>('/auth/owner', 'POST', { token: await result.user.getIdToken() });
  } finally {
    await signOut(auth).catch(() => {});
  }
}
