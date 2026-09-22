import { z } from 'zod';
export const cartSchema = z
  .array(z.object({ productId: z.string().min(1), quantity: z.number().int().min(1).max(20) }))
  .min(1)
  .max(60)
  .refine(
    (items) => new Set(items.map((i) => i.productId)).size === items.length,
    'Duplicate items',
  );
export const addressSchema = z.object({
  label: z.string().max(30).default('Home'),
  recipient: z.string().min(2).max(80),
  phone: z.string().regex(/^[6-9]\d{9}$/),
  line: z.string().min(8).max(300),
  city: z.string().min(2).max(80),
  state: z.string().min(2).max(80),
  pincode: z.string().regex(/^\d{6}$/),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  instructions: z.string().max(300).default(''),
});
export const checkoutSchema = z.object({
  items: cartSchema,
  addressId: z.string(),
  paymentMethod: z.enum(['cod', 'mock']),
  coupon: z.string().max(30).optional(),
  idempotencyKey: z.string().uuid(),
});
export const productSchema = z
  .object({
    name: z.string().min(2).max(120),
    slug: z.string().regex(/^[a-z0-9-]+$/),
    categoryId: z.string(),
    brand: z.string().max(80),
    description: z.string().max(2000),
    image: z
      .string()
      .url()
      .refine((v) => v.startsWith('https://'), 'HTTPS image required'),
    unit: z.string().min(1).max(40),
    price: z.number().int().min(1).max(10000000),
    mrp: z.number().int().min(1).max(10000000),
    taxBps: z.number().int().min(0).max(2800).default(0),
    maxQuantity: z.number().int().min(1).max(20).default(10),
    active: z.boolean().default(true),
  })
  .refine((p) => p.mrp >= p.price, 'MRP cannot be below selling price');
export type CartLine = z.infer<typeof cartSchema>[number];
export type AddressInput = z.infer<typeof addressSchema>;
export interface Product {
  id: string;
  name: string;
  slug: string;
  categoryId: string;
  brand: string;
  description: string;
  image: string;
  unit: string;
  price: number;
  mrp: number;
  taxBps: number;
  maxQuantity: number;
  active: boolean;
  inventory: { available: number }[];
}
export interface Category {
  id: string;
  name: string;
  image: string;
  color: string;
}
export interface User {
  id: string;
  name: string;
  role: string;
  phone?: string | null;
}
export interface Address extends AddressInput {
  id: string;
}
export interface Quote {
  subtotal: number;
  discount: number;
  deliveryFee: number;
  handlingFee: number;
  tax: number;
  total: number;
}
export interface Order extends Quote {
  id: string;
  userId: string;
  status: string;
  paymentMethod: string;
  paymentStatus: string;
  driverId: string | null;
  addressJson: string;
  createdAt: string;
  items: {
    productId: string;
    name: string;
    unit: string;
    image: string;
    quantity: number;
    price: number;
  }[];
  history: { status: string; createdAt: string }[];
  locations: { latitude: number; longitude: number; accuracy: number; createdAt: string }[];
}
export const money = (paise: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: paise % 100 ? 2 : 0,
  }).format(paise / 100);
export const statuses = [
  'placed',
  'accepted',
  'picking',
  'packed',
  'ready_for_pickup',
  'assigned',
  'out_for_delivery',
  'arriving',
  'delivered',
] as const;
