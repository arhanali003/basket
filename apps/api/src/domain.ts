export function distanceKm(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
) {
  const rad = (v: number) => (v * Math.PI) / 180;
  const dLat = rad(b.latitude - a.latitude),
    dLon = rad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(h)));
}
export function priceCart(
  items: { price: number; quantity: number; taxBps: number }[],
  coupon?: { discountBps: number; minimum: number; maximum: number },
) {
  const subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0);
  if (!Number.isSafeInteger(subtotal) || subtotal < 0) throw new Error('Invalid total');
  if (coupon && subtotal < coupon.minimum) throw new Error('Coupon minimum not met');
  const discount = coupon
    ? Math.min(coupon.maximum, Math.floor((subtotal * coupon.discountBps) / 10000))
    : 0;
  const deliveryFee = subtotal >= 49900 ? 0 : 2900,
    handlingFee = 500;
  // All catalogue prices include GST. Allocate the discount proportionally before extracting GST.
  const tax = items.reduce(
    (s, i) =>
      s +
      Math.round(
        (i.price * i.quantity * (subtotal ? 1 - discount / subtotal : 1) * i.taxBps) /
          (10000 + i.taxBps),
      ),
    0,
  );
  return {
    subtotal,
    discount,
    deliveryFee,
    handlingFee,
    tax,
    total: subtotal - discount + deliveryFee + handlingFee,
  };
}
export const transitions: Record<string, string[]> = {
  placed: ['accepted', 'cancelled'],
  accepted: ['picking', 'cancelled'],
  picking: ['packed'],
  packed: ['ready_for_pickup'],
  ready_for_pickup: ['assigned', 'out_for_delivery'],
  assigned: ['out_for_delivery'],
  out_for_delivery: ['arriving', 'delivered'],
  arriving: ['delivered'],
  delivered: [],
  cancelled: [],
};
export function canTransition(from: string, to: string) {
  return transitions[from]?.includes(to) ?? false;
}
