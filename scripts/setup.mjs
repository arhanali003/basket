import { existsSync, copyFileSync, closeSync, openSync } from 'node:fs';
import { execSync } from 'node:child_process';
if (!existsSync('.env')) copyFileSync('.env.example', '.env');
if (!existsSync('apps/api/prisma/daybasket.db'))
  closeSync(openSync('apps/api/prisma/daybasket.db', 'a'));
for (const command of ['npm run db:generate', 'npm run db:push', 'npm run db:seed'])
  execSync(command, { stdio: 'inherit' });
