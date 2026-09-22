import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  inMemoryPersistence,
  setPersistence,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import { request } from '@daybasket/api-client';
import type { User } from '@daybasket/types';

export async function signInOwner(): Promise<User> {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN;
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (!apiKey || !authDomain || !projectId) {
    throw new Error(
      'Owner sign-in is awaiting configuration. Please contact the store administrator.',
    );
  }
  const app = getApps().length ? getApp() : initializeApp({ apiKey, authDomain, projectId });
  const auth = getAuth(app);
  await setPersistence(auth, inMemoryPersistence);
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  try {
    const result = await signInWithPopup(auth, provider);
    return await request<User>('/auth/owner', 'POST', { token: await result.user.getIdToken() });
  } finally {
    await signOut(auth);
  }
}
