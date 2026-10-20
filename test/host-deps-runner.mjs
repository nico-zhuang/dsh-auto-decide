// Install pinned DSH Host packages outside the checkout and the user's profile.
// Any install or V4 replay failure is a failing release gate.
import { spawn } from 'node:child_process';
import { mkdtemp, realpath, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const host = [
  '@deepseek-ai/cordis@4.0.5',
  '@deepseek-ai/dsh-session@0.2.1-rc.2',
  '@deepseek-ai/dsh-session-persistence-jsonl@0.2.1-rc.2',
];
const run = (command, args, env = process.env) => new Promise((resolve, reject) => {
  const child = spawn(command, args, { stdio: 'inherit', env });
  child.on('error', reject);
  child.on('exit', (code, signal) => signal || code !== 0
    ? reject(new Error(`${command} ${args.join(' ')} failed (${signal ?? `exit ${code}`})`)) : resolve());
});

const root = await mkdtemp(join(tmpdir(), 'dsh-auto-decide-host-deps-'));
try {
  await run('npm', [
    'install', '--prefix', root, '--no-save', '--no-package-lock', '--ignore-scripts',
    '--no-audit', '--no-fund', ...host,
  ]);
  await run(process.execPath, [fileURLToPath(new URL('./host-v4-replay.mjs', import.meta.url))], {
    ...process.env, DSH_HOST_DEPS: join(root, 'node_modules'),
  });
} finally {
  // Delete only the unique directory mkdtemp made directly beneath OS temp.
  const actual = await realpath(root);
  if (dirname(actual) !== await realpath(tmpdir()) || !basename(actual).startsWith('dsh-auto-decide-host-deps-')) {
    throw new Error(`Refusing to remove unexpected Host dependency path: ${actual}`);
  }
  await rm(actual, { recursive: true, force: true });
}
