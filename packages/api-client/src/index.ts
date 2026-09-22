import type { Product, Category, User, Order, Address, Quote, CartLine } from '@daybasket/types';
export const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
export async function request<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const r = await fetch(API + path, {
    method,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const data = await r.json();
  if (!r.ok) throw new ApiError(data.message || 'Request failed', r.status);
  return data as T;
}
export const api = {
  catalogue: () => request<{ products: Product[]; categories: Category[] }>('/catalogue'),
  me: () => request<User>('/auth/me'),
  orders: () => request<Order[]>('/orders'),
  addresses: () => request<Address[]>('/addresses'),
  quote: (items: CartLine[], coupon?: string) =>
    request<Quote>('/checkout/quote', 'POST', { items, coupon }),
  order: (id: string) => request<Order & { deliveryCode?: string }>('/orders/' + id),
};
