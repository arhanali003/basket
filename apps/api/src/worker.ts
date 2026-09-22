import 'dotenv/config';
import { Worker, Queue } from 'bullmq';
import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();
const url = new URL(process.env.REDIS_URL || 'redis://localhost:6379');
const connection = {
  host: url.hostname,
  port: Number(url.port) || 6379,
  password: url.password || undefined,
  ...(url.protocol === 'rediss:' ? { tls: {} } : {}),
};
const queue = new Queue('maintenance', { connection });
const worker = new Worker(
  'maintenance',
  async (job) => {
    if (job.name === 'privacy-retention') {
      const retention = Number(process.env.LOCATION_RETENTION_DAYS) || 7;
      await db.locationSample.deleteMany({
        where: { createdAt: { lt: new Date(Date.now() - retention * 86400000) } },
      });
      await db.session.deleteMany({ where: { expiresAt: { lt: new Date() } } });
    }
  },
  { connection },
);
queue
  .upsertJobScheduler(
    'privacy-retention',
    { every: 3600000 },
    { name: 'privacy-retention', data: {} },
  )
  .catch(() => {
    console.error('Queue connection failed');
    process.exit(1);
  });
async function close() {
  await worker.close();
  await queue.close();
  await db.$disconnect();
  process.exit(0);
}
process.on('SIGTERM', close);
process.on('SIGINT', close);
