import {
  ForbiddenException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth, type DecodedIdToken } from 'firebase-admin/auth';

function emailListed(email: string | null | undefined, list: string | undefined): boolean {
  return (
    !!email &&
    (list || '')
      .split(',')
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean)
      .includes(email.trim().toLowerCase())
  );
}

export function ownerEmailAllowed(email?: string | null): boolean {
  return emailListed(email, process.env.ADMIN_EMAILS);
}

export function staffRole(email?: string | null): 'super_admin' | 'staff' | null {
  if (ownerEmailAllowed(email)) return 'super_admin';
  return emailListed(email, process.env.STAFF_EMAILS) ? 'staff' : null;
}

export function requireStaff(identity: DecodedIdToken): 'super_admin' | 'staff' {
  if (identity.firebase.sign_in_provider !== 'google.com')
    throw new ForbiddenException('Please sign in with Google.');
  if (!identity.email_verified)
    throw new ForbiddenException(
      'Google has not verified this email address. Verify it in your Google account, then sign in again.',
    );
  const role = staffRole(identity.email);
  if (!role)
    throw new ForbiddenException(
      'This Google account does not have store access. Ask the owner to add your exact Google email to the owner or employee access list.',
    );
  return role;
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

// Multiple-accounts mode omits Firebase's primary email. Obtain it directly
// from Google and bind it to the Google subject in the verified Firebase token.
export async function resolveGoogleEmail(
  identity: DecodedIdToken,
  accessToken?: string,
): Promise<DecodedIdToken> {
  if (identity.email && identity.email_verified) return identity;
  const subjects = identity.firebase.identities?.['google.com'];
  if (identity.firebase.sign_in_provider !== 'google.com' || !subjects?.length || !accessToken)
    throw new UnauthorizedException('Please sign in with Google again to share your email.');
  let response: Response;
  try {
    response = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(10000),
    });
  } catch {
    throw new ServiceUnavailableException(
      'Google sign-in is temporarily unavailable. Please try again.',
    );
  }
  if (response.status >= 500 || response.status === 429)
    throw new ServiceUnavailableException(
      'Google sign-in is temporarily unavailable. Please try again.',
    );
  if (!response.ok)
    throw new UnauthorizedException('Google sign-in expired. Please sign in again.');
  const profile = (await response.json()) as {
    sub?: string;
    email?: string;
    email_verified?: boolean;
  };
  if (
    !profile.sub ||
    !subjects.includes(profile.sub) ||
    typeof profile.email !== 'string' ||
    !profile.email ||
    profile.email_verified !== true ||
    (identity.email && identity.email.toLowerCase() !== profile.email.toLowerCase())
  )
    throw new UnauthorizedException(
      'Google account identity does not match. Please sign in again.',
    );
  return { ...identity, email: profile.email, email_verified: true };
}
