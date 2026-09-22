import { Inject, Injectable, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import type { Request, Response } from 'express';
import { Database } from './database';
import { ownerEmailAllowed } from './firebase-identity';
export const mockMode =
  process.env.MOCK_PROVIDERS === 'true' && process.env.NODE_ENV !== 'production';
export const hash = (s: string) => createHash('sha256').update(s).digest('hex');
export function equal(a: string, b: string) {
  const x = Buffer.from(a),
    y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
export function sessionToken(cookie?: string) {
  return cookie
    ?.split(';')
    .map((s) => s.trim())
    .find((s) => s.startsWith('db_session='))
    ?.slice(11);
}
@Injectable()
export class Auth {
  constructor(@Inject(Database) private db: Database) {}
  async user(req: Pick<Request, 'headers'>, roles?: string[]) {
    const token = sessionToken(req.headers.cookie);
    if (!token) throw new UnauthorizedException('Please sign in');
    const session = await this.db.session.findUnique({
      where: { id: hash(token) },
      include: { user: true },
    });
    if (!session || session.expiresAt < new Date())
      throw new UnauthorizedException('Session expired');
    if (
      process.env.NODE_ENV === 'production' &&
      session.user.role === 'super_admin' &&
      !ownerEmailAllowed(session.user.email)
    )
      throw new ForbiddenException('Store owner access has been removed');
    if (roles && !roles.includes(session.user.role))
      throw new ForbiddenException('This action is not allowed for your role');
    return session.user;
  }
  async signIn(userId: string, res: Response) {
    const token = randomBytes(32).toString('hex');
    await this.db.session.create({
      data: { id: hash(token), userId, expiresAt: new Date(Date.now() + 86400000) },
    });
    res.cookie('db_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 86400000,
      path: '/',
    });
    return this.db.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, role: true, phone: true },
    });
  }
}
