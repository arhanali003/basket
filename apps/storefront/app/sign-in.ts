import { request } from '@daybasket/api-client';
import type { User } from '@daybasket/types';

export function signInError(error: unknown): string {
  return error instanceof Error ? error.message : 'Sign-in failed. Please try again.';
}

export function signInCustomer(name: string, phone: string, password: string): Promise<User> {
  return request<User>('/auth/password', 'POST', { name, phone, password });
}
