import 'reflect-metadata';
import 'dotenv/config';
import { Module, Catch, ExceptionFilter, ArgumentsHost, HttpException } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import helmet from 'helmet';
import { randomUUID } from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import { ApiController } from './controller';
import { Database } from './database';
import { Auth } from './auth';
import { initializeTracking } from './realtime';
@Module({ controllers: [ApiController], providers: [Database, Auth] })
class AppModule {}
@Catch()
class Errors implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const status =
      error instanceof ZodError
        ? 400
        : error instanceof HttpException
          ? error.getStatus()
          : error instanceof Prisma.PrismaClientKnownRequestError &&
              ['P2002', 'P2034', 'P2028'].includes(error.code)
            ? 409
            : 500;
    res
      .status(status)
      .json({
        statusCode: status,
        message:
          error instanceof ZodError
            ? error.issues.map((i) => i.message).join('; ')
            : error instanceof HttpException
              ? error.message
              : status === 409
                ? 'Conflict. Refresh and try again.'
                : 'Unexpected server error',
        requestId: res.getHeader('X-Request-ID'),
      });
  }
}
async function bootstrap() {
  if (
    process.env.NODE_ENV === 'production' &&
    (!process.env.DELIVERY_CODE_SECRET || process.env.MOCK_PROVIDERS === 'true')
  )
    throw new Error('Production requires real providers and DELIVERY_CODE_SECRET');
  const app = await NestFactory.create(AppModule, { rawBody: true });
  app.enableShutdownHooks();
  app.use(helmet());
  const origins = (
    process.env.CORS_ORIGINS || 'http://localhost:3000,http://localhost:3001,http://localhost:3002'
  ).split(',');
  app.enableCors({ origin: origins, credentials: true });
  const rates = new Map<string, { count: number; reset: number }>();
  app.use((req: Request, res: Response, next: NextFunction) => {
    res.setHeader('X-Request-ID', randomUUID());
    res.setHeader('Cache-Control', 'no-store');
    const origin = req.headers.origin;
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && origin && !origins.includes(origin))
      return res.status(403).json({ message: 'Origin not allowed' });
    const key = (req.ip || 'local') + (req.path.includes('/auth/') ? 'auth' : 'api');
    const now = Date.now();
    if (rates.size > 10000) for (const [k, v] of rates) if (v.reset < now) rates.delete(k);
    const rate = rates.get(key);
    if (!rate || rate.reset < now) rates.set(key, { count: 1, reset: now + 60000 });
    else if (++rate.count > (key.endsWith('auth') ? 30 : 600))
      return res.status(429).json({ message: 'Too many requests. Try again shortly.' });
    next();
  });
  app.useGlobalFilters(new Errors());
  SwaggerModule.setup(
    'api/docs',
    app,
    SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('Daybasket API')
        .setVersion('1')
        .addCookieAuth('db_session')
        .build(),
    ),
  );
  await app.listen(Number(process.env.PORT) || 4000, '0.0.0.0');
  initializeTracking(app.getHttpServer(), app.get(Auth), app.get(Database), origins);
  console.log('Daybasket API: http://localhost:4000/api/docs');
}
bootstrap().catch((e) => {
  console.error(e instanceof Error ? e.message : 'API startup failed');
  process.exit(1);
});
