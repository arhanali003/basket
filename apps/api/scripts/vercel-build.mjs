import { spawnSync } from 'node:child_process';

function run(command, args) {
  const result = spawnSync(command, args, { stdio: 'inherit', env: process.env });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}

run('prisma', ['generate', '--schema', 'prisma/schema.production.prisma']);
run('tsc', ['-p', 'tsconfig.build.json']);
// Preview deployments must never migrate or seed the production database.
if (process.env.VERCEL_ENV === 'production') {
  if (!process.env.DATABASE_URL) throw new Error('Connect PostgreSQL before deploying the API');
  run('prisma', ['migrate', 'deploy', '--schema', 'prisma/schema.production.prisma']);
  if (process.env.SEED_CATALOGUE === 'true') {
    process.env.NODE_ENV = 'production';
    run('node', ['--import', 'tsx', 'prisma/seed.ts']);
  }
}
