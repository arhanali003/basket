import { spawnSync } from 'node:child_process';

function run(command, args) {
  const result = spawnSync(command, args, { stdio: 'inherit', env: process.env });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}

function deployMigrations() {
  for (let attempt = 1; attempt <= 3; attempt++) {
    const result = spawnSync('prisma', ['migrate', 'deploy', '--schema', 'prisma/schema.production.prisma'], {
      encoding: 'utf8',
      env: process.env,
    });
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
    if (result.error) throw result.error;
    if (result.status === 0) return;
    const output = `${result.stdout || ''}\n${result.stderr || ''}`;
    if (!output.includes('P1002') || !output.includes('advisory lock') || attempt === 3)
      process.exit(result.status || 1);
    console.log(`Database migration lock is busy; retrying (${attempt}/3).`);
  }
}

run('prisma', ['generate', '--schema', 'prisma/schema.production.prisma']);
run('tsc', ['-p', 'tsconfig.build.json']);
// Preview deployments must never migrate or seed the production database.
if (process.env.VERCEL_ENV === 'production') {
  if (!process.env.DATABASE_URL) throw new Error('Connect PostgreSQL before deploying the API');
  deployMigrations();
  if (process.env.SEED_CATALOGUE === 'true') {
    process.env.NODE_ENV = 'production';
    run('node', ['--import', 'tsx', 'prisma/seed.ts']);
  }
}
