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

function customerAuth() {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN;
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

  if (!apiKey || !authDomain || !projectId) {
    throw new Error('Sign-in is temporarily unavailable. Please try again shortly.');
  }

  return getApps().length
    ? getAuth(getApp())
    : initializeAuth(
        initializeApp({
          apiKey,
          authDomain,
          projectId,
        }),
        {
          persistence: inMemoryPersistence,
          popupRedirectResolver: browserPopupRedirectResolver,
        },
      );
}

export function signInError(error: unknown): string {
  const code = (error as { code?: string }).code;

  const messages: Record<string, string> = {
    'auth/popup-blocked': 'Please allow the Google sign-in popup and try again.',
    'auth/popup-closed-by-user': 'Sign-in was closed. Please try again.',
    'auth/too-many-requests': 'Too many attempts. Please wait before trying again.',
    'auth/unauthorized-domain':
      'Sign-in is not configured for this website. Please contact the store.',
    'auth/network-request-failed': 'Check your connection and try again.',
    'auth/operation-not-allowed':
      'Google sign-in is not enabled. Please contact the store.',
  };

  return (
    (code && messages[code]) ||
    (error instanceof Error ? error.message : 'Sign-in failed. Please try again.')
  );
}

export async function signInCustomer(): Promise<User> {
  const auth = customerAuth();

  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({
    prompt: 'select_account',
  });

  try {
    const result = await signInWithPopup(auth, provider);

    return await request<User>('/auth/firebase', 'POST', {
      token: await result.user.getIdToken(),
    });
  } finally {
    await signOut(auth);
  }
}
