import { Server } from 'socket.io';
import type { Server as HttpServer } from 'node:http';
import { Auth } from './auth';
import { Database } from './database';
let io: Server | undefined;
export function initializeTracking(
  server: HttpServer,
  auth: Auth,
  db: Database,
  origins: string[],
) {
  io = new Server(server, {
    cors: { origin: origins, credentials: true },
    maxHttpBufferSize: 10000,
  });
  io.use(async (socket, next) => {
    try {
      const user = await auth.user({ headers: socket.request.headers });
      socket.data.user = user;
      next();
    } catch {
      next(new Error('Authentication required'));
    }
  });
  io.on('connection', (socket) => {
    socket.on('subscribe', async (id: unknown, ack?: (r: { ok: boolean }) => void) => {
      try {
        if (typeof id !== 'string' || id.length > 100) return ack?.({ ok: false });
        const user = await auth.user({ headers: socket.request.headers });
        const order = await db.order.findUnique({ where: { id } });
        if (
          !order ||
          !(
            order.userId === user.id ||
            order.driverId === user.id ||
            ['super_admin', 'staff'].includes(user.role)
          )
        )
          return ack?.({ ok: false });
        await socket.join(id);
        ack?.({ ok: true });
      } catch {
        ack?.({ ok: false });
      }
    });
  });
  // Periodically revalidate sessions so logout/revocation closes existing subscriptions.
  const timer = setInterval(async () => {
    for (const socket of io?.sockets.sockets.values() ?? []) {
      try {
        await auth.user({ headers: socket.request.headers });
      } catch {
        socket.disconnect(true);
      }
    }
  }, 15000);
  timer.unref();
}
export function notifyOrder(id: string) {
  io?.to(id).emit('order:update', { id });
}
