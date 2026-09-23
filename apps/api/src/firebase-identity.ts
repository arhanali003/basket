import {
  ForbiddenException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth, type DecodedIdToken } from 'firebase-admin/auth';

export function ownerEmailAllowed(email?: string | null): boolean {
  return (
    !!email &&
    (process.env.ADMIN_EMAILS || '')
      .split(',')
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean)
      .includes(email.trim().toLowerCase())
  );
}

// Customer accounts need a valid Google identity, not the owner's verified-email policy.
export function requireCustomer(identity: DecodedIdToken) {
  if (identity.firebase.sign_in_provider !== 'google.com')
    throw new UnauthorizedException('Please continue with Google to sign in.');
}

export function requireOwner(identity: DecodedIdToken) {
  if (
    !identity.email_verified ||
    identity.firebase.sign_in_provider !== 'google.com' ||
    !ownerEmailAllowed(identity.email)
  ) {
    throw new ForbiddenException('This Google account does not have store owner access.');
  }
}

export async function verifyFirebaseIdentity(token: string): Promise<DecodedIdToken> {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  if (!projectId) throw new ServiceUnavailableException('Sign-in is not configured');
  if (!getApps().length) initializeApp({ projectId });
  const apiKey = process.env.FIREBASE_WEB_API_KEY;
  let identity: DecodedIdToken;
  try {
    // With a web API key, revocation is checked via the account lookup below.
    // Other hosts can retain the Admin SDK's credential-based revocation check.
    identity = await getAuth().verifyIdToken(token, !apiKey);
  } catch {
    throw new UnauthorizedException('Google sign-in expired or is invalid. Please sign in again.');
  }
  if (!apiKey) return identity;
  let response: Response;
  try {
    response = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken: token }),
        signal: AbortSignal.timeout(10000),
      },
    );
  } catch {
    throw new ServiceUnavailableException('Google sign-in is temporarily unavailable');
  }
  if (response.status >= 500 || response.status === 429)
    throw new ServiceUnavailableException('Google sign-in is temporarily unavailable');
  if (!response.ok) throw new UnauthorizedException('Please sign in again');
  const data = (await response.json()) as {
    users?: Array<{
      localId: string;
      disabled?: boolean;
      validSince?: string;
      email?: string;
      emailVerified?: boolean;
    }>;
  };
  const account = data.users?.[0];
  const validSince = Number(account?.validSince ?? 0);
  if (
    !account ||
    account.localId !== identity.uid ||
    account.disabled ||
    !Number.isFinite(validSince) ||
    !Number.isFinite(identity.auth_time) ||
    identity.auth_time < validSince ||
    account.email !== identity.email ||
    (!!identity.email_verified && !account.emailVerified)
  ) {
    throw new UnauthorizedException(
      'Account changed or sign-in was revoked. Please sign in again.',
    );
  }
  return identity;
}
