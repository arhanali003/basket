import { spawn } from 'node:child_process';
const children = [
  spawn(process.execPath, ['--import', 'tsx', 'apps/api/src/main.ts'], {
    stdio: 'inherit',
    env: { ...process.env, TSX_TSCONFIG_PATH: 'apps/api/tsconfig.json' },
  }),
  ...['storefront', 'admin', 'delivery'].map((name, i) =>
    spawn(
      process.execPath,
      [
        'node_modules/next/dist/bin/next',
        'dev',
        'apps/' + name,
        '--webpack',
        '--port',
        String(3000 + i),
      ],
      { stdio: 'inherit' },
    ),
  ),
];
for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, () => {
    children.forEach((c) => c.kill(signal));
    process.exit(0);
  });
