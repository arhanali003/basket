import {
  Body,
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Param,
  Query,
  Req,
  Res,
  Inject,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Prisma } from '@prisma/client';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { randomUUID, createHmac } from 'node:crypto';
import {
  addressSchema,
  cartSchema,
  checkoutSchema,
  productSchema,
} from '../../../packages/types/src';
import { Database } from './database';
import { requireOwner, verifyFirebaseIdentity } from './firebase-identity';
import { Auth, mockMode, hash, equal, sessionToken } from './auth';
import { canTransition, distanceKm, priceCart } from './domain';
import { notifyOrder } from './realtime';
const includeOrder = {
  items: true,
  history: { orderBy: { createdAt: 'asc' as const } },
  locations: { orderBy: { createdAt: 'desc' as const }, take: 1 },
};
const challenges = new Map<string, { phone: string; expires: number; attempts: number }>();
const staff = ['super_admin'];
const deliveryCode = (id: string) =>
  String(
    (parseInt(
      createHmac('sha256', process.env.DELIVERY_CODE_SECRET || 'local-development-only')
        .update(id)
        .digest('hex')
        .slice(0, 8),
      16,
    ) %
      9000) +
      1000,
  );
@ApiTags('Daybasket')
@Controller('api/v1')
export class ApiController {
  constructor(
    @Inject(Database) private db: Database,
    @Inject(Auth) private auth: Auth,
  ) {}
  @Get('health') health() {
    return { status: 'ok', mockProviders: mockMode };
  }
  @Get('ready') async ready() {
    await this.db.$queryRaw`SELECT 1`;
    return { status: 'ready' };
  }
  @Get('config') config() {
    return {
      brand: 'Daybasket',
      developmentPlaceholder: true,
      mockProviders: mockMode,
      promise: '30–60 minutes',
      minimumOrder: 9900,
      store: { latitude: 12.9784, longitude: 77.6408, radiusKm: 8 },
    };
  }
  @Post('auth/otp')
  @ApiOperation({ summary: 'Start local mock phone login; demo OTP is 123456' })
  otp(@Body() body: unknown) {
    if (!mockMode) throw new ServiceUnavailableException('Use Firebase sign-in');
    const { phone } = z.object({ phone: z.string().regex(/^[6-9]\d{9}$/) }).parse(body);
    for (const [id, c] of challenges) {
      if (c.expires < Date.now()) challenges.delete(id);
    }
    if ([...challenges.values()].some((c) => c.phone === phone && c.expires > Date.now() + 240000))
      throw new BadRequestException('Wait 60 seconds before requesting another code');
    const challenge = randomUUID();
    challenges.set(challenge, { phone, expires: Date.now() + 300000, attempts: 0 });
    return { challenge, developmentCode: '123456', expiresIn: 300 };
  }
  @Post('auth/verify') async verify(
    @Body() body: unknown,
    @Res({ passthrough: true }) res: Response,
  ) {
    if (!mockMode) throw new ServiceUnavailableException();
    const { challenge, code, name } = z
      .object({
        challenge: z.string(),
        code: z.string(),
        name: z.string().min(2).max(80).default('Neighbour'),
      })
      .parse(body);
    const c = challenges.get(challenge);
    if (!c || c.expires < Date.now() || c.attempts >= 5)
      throw new BadRequestException('Code expired. Request another.');
    c.attempts++;
    if (!equal(code, '123456')) throw new BadRequestException('Incorrect code');
    challenges.delete(challenge);
    let user = await this.db.user.findUnique({ where: { phone: c.phone } });
    if (user && user.role !== 'customer')
      throw new ForbiddenException('Use staff login for this account');
    user ??= await this.db.user.create({ data: { phone: c.phone, name } });
    return this.auth.signIn(user.id, res);
  }
  @Post('auth/firebase') async firebase(
    @Body() body: unknown,
    @Res({ passthrough: true }) res: Response,
  ) {
    if (mockMode) throw new BadRequestException('Firebase disabled in mock mode');
    const { token } = z.object({ token: z.string().max(10000) }).parse(body);
    const identity = await verifyFirebaseIdentity(token);
    let user = await this.db.user.findUnique({ where: { firebaseUid: identity.uid } });
    if (!user)
      user = await this.db.user.create({
        data: {
          firebaseUid: identity.uid,
          name: identity.name || 'Neighbour',
          email: identity.email,
        },
      });
    return this.auth.signIn(user.id, res);
  }
  @Post('auth/owner') async owner(
    @Body() body: unknown,
    @Res({ passthrough: true }) res: Response,
  ) {
    if (mockMode) throw new BadRequestException('Use local staff login in development');
    const { token } = z.object({ token: z.string().min(1).max(10000) }).parse(body);
    const identity = await verifyFirebaseIdentity(token);
    requireOwner(identity);
    const user = await this.db.user.upsert({
      where: { firebaseUid: identity.uid },
      create: {
        firebaseUid: identity.uid,
        email: identity.email,
        name: identity.name || 'Store owner',
        role: 'super_admin',
      },
      update: { email: identity.email, role: 'super_admin' },
    });
    return this.auth.signIn(user.id, res);
  }
  @Post('auth/staff') async loginStaff(
    @Body() body: unknown,
    @Res({ passthrough: true }) res: Response,
  ) {
    if (!mockMode)
      throw new ForbiddenException(
        'Production staff use Firebase identities with provisioned roles',
      );
    const { role, password } = z
      .object({ role: z.enum(['super_admin', 'delivery']), password: z.string() })
      .parse(body);
    if (!equal(password, process.env.DEMO_STAFF_PASSWORD || ''))
      throw new ForbiddenException('Incorrect password');
    return this.auth.signIn(role === 'delivery' ? 'demo-driver' : 'demo-admin', res);
  }
  @Get('auth/me') async me(@Req() req: Request) {
    const user = await this.auth.user(req);
    return { id: user.id, name: user.name, phone: user.phone, role: user.role };
  }
  @Post('auth/logout') async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Body() body: { all?: boolean },
  ) {
    const user = await this.auth.user(req);
    await this.db.session.deleteMany({
      where: body?.all ? { userId: user.id } : { id: hash(sessionToken(req.headers.cookie) || '') },
    });
    res.clearCookie('db_session', { path: '/' });
    return { ok: true };
  }
  @Get('catalogue') async catalogue(@Query('q') q = '', @Query('category') category = '') {
    return {
      products: await this.db.product.findMany({
        where: {
          active: true,
          ...(category ? { categoryId: category } : {}),
          ...(q
            ? {
                OR: [
                  { name: { contains: q.slice(0, 100) } },
                  { brand: { contains: q.slice(0, 100) } },
                ],
              }
            : {}),
        },
        include: { inventory: { where: { storeId: 'indiranagar' }, select: { available: true } } },
        orderBy: { createdAt: 'asc' },
        take: 100,
      }),
      categories: await this.db.category.findMany(),
    };
  }
  @Get('products/:id') async product(@Param('id') id: string) {
    const product = await this.db.product.findFirst({
      where: { OR: [{ id }, { slug: id }], active: true },
      include: { inventory: true },
    });
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }
  @Get('addresses') async addresses(@Req() req: Request) {
    const u = await this.auth.user(req);
    return this.db.address.findMany({ where: { userId: u.id } });
  }
  async eligible(address: { latitude: number; longitude: number }) {
    const stores = await this.db.store.findMany({ where: { active: true } });
    return stores
      .filter((s) => distanceKm(s, address) <= s.radiusKm)
      .sort((a, b) => distanceKm(a, address) - distanceKm(b, address))[0];
  }
  @Post('serviceability') async serviceability(@Body() body: unknown) {
    const a = z
      .object({ latitude: z.number().min(-90).max(90), longitude: z.number().min(-180).max(180) })
      .parse(body);
    const store = await this.eligible(a);
    return { serviceable: !!store, store: store ? { id: store.id, name: store.name } : null };
  }
  @Post('addresses') async saveAddress(@Req() req: Request, @Body() body: unknown) {
    const u = await this.auth.user(req);
    const address = addressSchema.parse(body);
    if (!(await this.eligible(address)))
      throw new BadRequestException('This address is outside our delivery area');
    return this.db.address.create({ data: { ...address, userId: u.id } });
  }
  @Get('cart') async cart(@Req() req: Request) {
    const u = await this.auth.user(req);
    return this.db.cartItem.findMany({
      where: { userId: u.id },
      select: { productId: true, quantity: true },
    });
  }
  @Put('cart') async saveCart(@Req() req: Request, @Body() body: unknown) {
    const u = await this.auth.user(req);
    const items = z
      .array(z.object({ productId: z.string(), quantity: z.number().int().min(1).max(20) }))
      .max(60)
      .parse(body);
    if (new Set(items.map((i) => i.productId)).size !== items.length)
      throw new BadRequestException('Duplicate products');
    await this.db.$transaction(async (tx) => {
      await tx.cartItem.deleteMany({ where: { userId: u.id } });
      for (const item of items) await tx.cartItem.create({ data: { ...item, userId: u.id } });
    });
    return { ok: true };
  }
  @Get('wishlist') async wishlist(@Req() req: Request) {
    const u = await this.auth.user(req);
    return this.db.wishlist.findMany({ where: { userId: u.id }, select: { productId: true } });
  }
  @Post('wishlist/:id') async wish(@Req() req: Request, @Param('id') id: string) {
    const u = await this.auth.user(req);
    const existing = await this.db.wishlist.findUnique({
      where: { userId_productId: { userId: u.id, productId: id } },
    });
    if (existing) await this.db.wishlist.delete({ where: { id: existing.id } });
    else await this.db.wishlist.create({ data: { userId: u.id, productId: id } });
    return { saved: !existing };
  }
  async calculate(
    tx: Prisma.TransactionClient,
    items: z.infer<typeof cartSchema>,
    couponCode?: string,
  ) {
    const products = await tx.product.findMany({
      where: { id: { in: items.map((i) => i.productId) }, active: true },
    });
    const lines = items.map((i) => {
      const p = products.find((p) => p.id === i.productId);
      if (!p || i.quantity > p.maxQuantity)
        throw new BadRequestException('A product is unavailable or exceeds its quantity limit');
      return { ...i, price: p.price, taxBps: p.taxBps, product: p };
    });
    const coupon = couponCode
      ? await tx.coupon.findUnique({ where: { code: couponCode.toUpperCase() } })
      : null;
    if (couponCode && (!coupon || !coupon.active))
      throw new BadRequestException('Coupon is invalid');
    let quote;
    try {
      quote = priceCart(lines, coupon ?? undefined);
    } catch (e) {
      throw new BadRequestException((e as Error).message);
    }
    if (quote.subtotal < 9900) throw new BadRequestException('Minimum order is ₹99');
    return { lines, quote };
  }
  @Post('checkout/quote') async quote(@Body() body: unknown) {
    const input = z.object({ items: cartSchema, coupon: z.string().optional() }).parse(body);
    return (await this.calculate(this.db, input.items, input.coupon)).quote;
  }
  @Post('orders') async checkout(@Req() req: Request, @Body() body: unknown) {
    const user = await this.auth.user(req, ['customer']);
    const input = checkoutSchema.parse(body);
    if (input.paymentMethod === 'mock' && !mockMode)
      throw new BadRequestException('Mock payment is disabled');
    const requestHash = hash(
      JSON.stringify({
        ...input,
        items: [...input.items].sort((a, b) => a.productId.localeCompare(b.productId)),
      }),
    );
    const previous = await this.db.order.findUnique({
      where: { userId_idempotencyKey: { userId: user.id, idempotencyKey: input.idempotencyKey } },
      include: includeOrder,
    });
    if (previous) {
      if (previous.requestHash !== requestHash)
        throw new ConflictException('Idempotency key reused with different input');
      return this.publicOrder(previous, user);
    }
    const address = await this.db.address.findFirst({
      where: { id: input.addressId, userId: user.id },
    });
    if (!address) throw new BadRequestException('Choose your saved address');
    const store = await this.eligible(address);
    if (!store) throw new BadRequestException('Address is not serviceable');
    try {
      const order = await this.db.$transaction(
        async (tx) => {
          const { lines, quote } = await this.calculate(tx, input.items, input.coupon);
          for (const line of lines) {
            const result = await tx.inventory.updateMany({
              where: {
                storeId: store.id,
                productId: line.productId,
                available: { gte: line.quantity },
              },
              data: { available: { decrement: line.quantity }, sold: { increment: line.quantity } },
            });
            if (result.count !== 1)
              throw new ConflictException(`${line.product.name} does not have enough stock`);
          }
          const id = randomUUID();
          const order = await tx.order.create({
            data: {
              id,
              userId: user.id,
              storeId: store.id,
              idempotencyKey: input.idempotencyKey,
              requestHash,
              addressJson: JSON.stringify(address),
              ...quote,
              paymentMethod: input.paymentMethod,
              paymentStatus: input.paymentMethod === 'mock' ? 'mock_paid' : 'cod_due',
              deliveryCodeHash: hash(deliveryCode(id)),
              items: {
                create: lines.map((l) => ({
                  productId: l.productId,
                  name: l.product.name,
                  unit: l.product.unit,
                  image: l.product.image,
                  quantity: l.quantity,
                  price: l.price,
                })),
              },
              history: { create: { status: 'placed' } },
            },
            include: includeOrder,
          });
          for (const line of lines)
            await tx.inventoryMovement.create({
              data: {
                storeId: store.id,
                productId: line.productId,
                quantity: -line.quantity,
                reason: 'order placed',
                reference: id,
              },
            });
          await tx.cartItem.deleteMany({ where: { userId: user.id } });
          return order;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
      return this.publicOrder(order, user);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        const o = await this.db.order.findUnique({
          where: {
            userId_idempotencyKey: { userId: user.id, idempotencyKey: input.idempotencyKey },
          },
          include: includeOrder,
        });
        if (o && o.requestHash === requestHash) return this.publicOrder(o, user);
      }
      throw e;
    }
  }
  publicOrder<T extends { id: string; userId: string; deliveryCodeHash: string }>(
    order: T,
    user: { id: string },
  ) {
    const { deliveryCodeHash: _secret, ...safe } = order;
    return {
      ...safe,
      ...(order.userId === user.id ? { deliveryCode: deliveryCode(order.id) } : {}),
    };
  }
  @Get('orders') async orders(@Req() req: Request) {
    const u = await this.auth.user(req);
    const orders = await this.db.order.findMany({
      where:
        u.role === 'super_admin'
          ? {}
          : u.role === 'delivery'
            ? { driverId: u.id }
            : { userId: u.id },
      include: includeOrder,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return orders.map((o) => this.publicOrder(o, u));
  }
  @Get('orders/:id') async order(@Req() req: Request, @Param('id') id: string) {
    const u = await this.auth.user(req);
    const o = await this.db.order.findUnique({ where: { id }, include: includeOrder });
    if (!o || !(o.userId === u.id || o.driverId === u.id || u.role === 'super_admin'))
      throw new NotFoundException('Order not found');
    return this.publicOrder(o, u);
  }
  @Post('orders/:id/cancel') async cancel(@Req() req: Request, @Param('id') id: string) {
    const u = await this.auth.user(req);
    await this.db.$transaction(async (tx) => {
      const o = await tx.order.findUnique({ where: { id }, include: { items: true } });
      if (!o || !(o.userId === u.id || u.role === 'super_admin')) throw new NotFoundException();
      if (!canTransition(o.status, 'cancelled'))
        throw new ConflictException('This order can no longer be cancelled');
      const changed = await tx.order.updateMany({
        where: { id, status: o.status },
        data: {
          status: 'cancelled',
          paymentStatus: o.paymentMethod === 'mock' ? 'mock_refunded' : 'cancelled',
        },
      });
      if (changed.count !== 1) throw new ConflictException('Order changed; refresh');
      for (const i of o.items) {
        await tx.inventory.update({
          where: { storeId_productId: { storeId: o.storeId, productId: i.productId } },
          data: { available: { increment: i.quantity }, sold: { decrement: i.quantity } },
        });
        await tx.inventoryMovement.create({
          data: {
            storeId: o.storeId,
            productId: i.productId,
            quantity: i.quantity,
            reason: 'order cancelled',
            reference: id,
          },
        });
      }
      await tx.orderHistory.create({ data: { orderId: id, status: 'cancelled' } });
      await tx.auditLog.create({ data: { actorId: u.id, action: 'cancel_order', entityId: id } });
    });
    notifyOrder(id);
    return { ok: true };
  }
  @Get('admin/products') async adminProducts(@Req() req: Request) {
    await this.auth.user(req, staff);
    return this.db.product.findMany({
      include: { inventory: true },
      orderBy: { createdAt: 'asc' },
    });
  }
  @Post('admin/products') async createProduct(@Req() req: Request, @Body() body: unknown) {
    const u = await this.auth.user(req, staff);
    const data = productSchema.parse(body);
    return this.db.$transaction(async (tx) => {
      const p = await tx.product.create({
        data: { ...data, inventory: { create: { storeId: 'indiranagar', available: 0 } } },
      });
      await tx.auditLog.create({
        data: { actorId: u.id, action: 'create_product', entityId: p.id },
      });
      return p;
    });
  }
  @Put('admin/products/:id') async editProduct(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const u = await this.auth.user(req, staff);
    const data = productSchema.parse(body);
    return this.db.$transaction(async (tx) => {
      const p = await tx.product.update({ where: { id }, data });
      await tx.auditLog.create({ data: { actorId: u.id, action: 'edit_product', entityId: id } });
      return p;
    });
  }
  @Post('admin/inventory/:id') async stock(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const u = await this.auth.user(req, staff);
    const input = z
      .object({
        change: z.number().int().min(-10000).max(10000),
        reason: z.string().min(3).max(200),
      })
      .parse(body);
    return this.db.$transaction(async (tx) => {
      const changed = await tx.inventory.updateMany({
        where: {
          productId: id,
          storeId: 'indiranagar',
          ...(input.change < 0 ? { available: { gte: -input.change } } : {}),
        },
        data: { available: { increment: input.change } },
      });
      if (!changed.count) throw new ConflictException('Insufficient stock');
      await tx.inventoryMovement.create({
        data: {
          storeId: 'indiranagar',
          productId: id,
          quantity: input.change,
          reason: input.reason,
          reference: u.id,
        },
      });
      await tx.auditLog.create({
        data: { actorId: u.id, action: 'inventory_adjustment', entityId: id },
      });
      return { ok: true };
    });
  }
  @Patch('orders/:id/status') async status(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const u = await this.auth.user(req, ['super_admin', 'delivery']);
    const { status, code } = z
      .object({ status: z.string(), code: z.string().optional() })
      .parse(body);
    await this.db.$transaction(async (tx) => {
      const o = await tx.order.findUnique({ where: { id } });
      if (!o || (u.role === 'delivery' && o.driverId !== u.id)) throw new NotFoundException();
      if (u.role === 'delivery' && !['out_for_delivery', 'arriving', 'delivered'].includes(status))
        throw new ForbiddenException();
      if (status === 'assigned' || status === 'cancelled' || !canTransition(o.status, status))
        throw new ConflictException('Invalid order transition');
      if (status === 'delivered' && !equal(hash(code || ''), o.deliveryCodeHash))
        throw new BadRequestException('Ask the customer for the delivery code');
      const result = await tx.order.updateMany({
        where: { id, status: o.status },
        data: {
          status,
          ...(status === 'delivered' && o.paymentMethod === 'cod'
            ? { paymentStatus: 'cod_collected' }
            : {}),
        },
      });
      if (result.count !== 1) throw new ConflictException('Order changed; refresh');
      await tx.orderHistory.create({ data: { orderId: id, status } });
      await tx.auditLog.create({
        data: { actorId: u.id, action: `status:${status}`, entityId: id },
      });
    });
    notifyOrder(id);
    return { ok: true };
  }
  @Get('admin/drivers') async drivers(@Req() req: Request) {
    await this.auth.user(req, staff);
    return this.db.user.findMany({ where: { role: 'delivery' }, select: { id: true, name: true } });
  }
  @Post('admin/orders/:id/assign') async assign(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const u = await this.auth.user(req, staff);
    const { driverId } = z.object({ driverId: z.string() }).parse(body);
    if (!(await this.db.user.findFirst({ where: { id: driverId, role: 'delivery' } })))
      throw new BadRequestException('Invalid driver');
    await this.db.$transaction(async (tx) => {
      const changed = await tx.order.updateMany({
        where: { id, status: 'ready_for_pickup' },
        data: { driverId, status: 'assigned' },
      });
      if (!changed.count) throw new ConflictException('Order must be ready for pickup');
      await tx.orderHistory.create({ data: { orderId: id, status: 'assigned' } });
      await tx.auditLog.create({ data: { actorId: u.id, action: 'assign_driver', entityId: id } });
    });
    notifyOrder(id);
    return { ok: true };
  }
  @Post('delivery/:id/location') async location(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const u = await this.auth.user(req, ['delivery']);
    const point = z
      .object({
        latitude: z.number().min(-90).max(90),
        longitude: z.number().min(-180).max(180),
        accuracy: z.number().min(0).max(100000),
      })
      .parse(body);
    const o = await this.db.order.findFirst({
      where: { id, driverId: u.id, status: { in: ['out_for_delivery', 'arriving'] } },
    });
    if (!o) throw new NotFoundException('No active delivery');
    const sample = await this.db.locationSample.create({ data: { orderId: id, ...point } });
    notifyOrder(id);
    return { createdAt: sample.createdAt };
  }
  @Get('admin/analytics') async analytics(@Req() req: Request) {
    await this.auth.user(req, staff);
    const orders = await this.db.order.findMany();
    const settled = orders.filter((o) => o.status === 'delivered');
    const revenue = settled.reduce((s, o) => s + o.total, 0);
    return {
      orders: orders.length,
      revenue,
      aov: settled.length ? Math.round(revenue / settled.length) : 0,
      active: orders.filter((o) => !['cancelled', 'delivered'].includes(o.status)).length,
      cancelled: orders.filter((o) => o.status === 'cancelled').length,
      customers: await this.db.user.count({ where: { role: 'customer' } }),
      lowStock: await this.db.inventory.count({ where: { available: { lte: 5 } } }),
      salesByDay: Array.from({ length: 7 }, (_, i) => {
        const day = new Date(Date.now() - (6 - i) * 86400000).toISOString().slice(0, 10);
        return {
          day,
          total: settled
            .filter((o) => o.createdAt.toISOString().startsWith(day))
            .reduce((s, o) => s + o.total, 0),
        };
      }),
    };
  }
  @Get('admin/audit') async audit(@Req() req: Request) {
    await this.auth.user(req, staff);
    return this.db.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: 100 });
  }
  @Delete('auth/sessions') async revoke(@Req() req: Request) {
    const u = await this.auth.user(req);
    await this.db.session.deleteMany({ where: { userId: u.id } });
    return { ok: true };
  }
}
