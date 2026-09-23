import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  inMemoryPersistence,
  initializeAuth,
  browserPopupRedirectResolver,
  signInWithPopup,
  signOut,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  type ConfirmationResult,
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
    'auth/invalid-phone-number': 'Enter a valid 10-digit Indian mobile number.',
    'auth/invalid-verification-code': 'That code is incorrect. Check your SMS and try again.',
    'auth/code-expired': 'Your code expired. Request a new one.',
    'auth/too-many-requests': 'Too many attempts. Please wait before trying again.',
    'auth/quota-exceeded': 'SMS is temporarily unavailable. Please use Google sign-in.',
    'auth/operation-not-allowed': 'Phone sign-in is not enabled yet. Please use Google sign-in.',
    'auth/billing-not-enabled': 'SMS is not enabled for this store yet. Please use Google sign-in.',
    'auth/unauthorized-domain':
      'Sign-in is not configured for this website. Please contact the store.',
    'auth/captcha-check-failed': 'Verification failed. Please try sending the code again.',
    'auth/network-request-failed': 'Check your connection and try again.',
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

export async function sendPhoneCode(
  phone: string,
  container: HTMLElement,
): Promise<ConfirmationResult> {
  const auth = customerAuth();
  const verifier = new RecaptchaVerifier(auth, container, { size: 'invisible' });

  try {
    return await signInWithPhoneNumber(auth, `+91${phone}`, verifier);
  } finally {
    verifier.clear();
  }
}

export async function verifyPhoneCode(
  confirmation: ConfirmationResult,
  code: string,
): Promise<User> {
  const auth = customerAuth();

  try {
    const result = await confirmation.confirm(code);

    return await request<User>('/auth/firebase', 'POST', {
      token: await result.user.getIdToken(),
    });
  } finally {
    await signOut(auth);
  }
}
