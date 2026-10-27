import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const selfPath = fileURLToPath(import.meta.url);
let child = null;
let shuttingDown = false;

function stop(signal) {
  shuttingDown = true;
  if (child && child.exitCode === null && !child.killed) {
    child.kill(signal);
    return;
  }
  process.exit(0);
}

process.on('SIGTERM', () => stop('SIGTERM'));
process.on('SIGINT', () => stop('SIGINT'));

function run(command, args, options = {}) {
  return new Promise((resolve) => {
    const subprocess = spawn(command, args, {
      stdio: 'inherit',
      env: process.env,
      ...options,
    });
    child = subprocess;
    subprocess.on('error', (error) => {
      console.error(error);
      resolve(1);
    });
    subprocess.on('exit', (code, signal) => {
      if (child === subprocess) {
        child = null;
      }
      resolve(shuttingDown || signal ? 0 : (code ?? 1));
    });
  });
}

async function main() {
  if (typeof process.getuid === 'function' && process.getuid() === 0) {
    mkdirSync('/app/storage', { recursive: true });
    execFileSync('chown', ['-R', 'node:node', '/app/storage'], {
      stdio: 'inherit',
    });
    const uid = Number(
      execFileSync('id', ['-u', 'node'], { encoding: 'utf8' }).trim(),
    );
    const gid = Number(
      execFileSync('id', ['-g', 'node'], { encoding: 'utf8' }).trim(),
    );
    const dropped = spawn(
      process.execPath,
      [selfPath, ...process.argv.slice(2)],
      {
        stdio: 'inherit',
        uid,
        gid,
        env: process.env,
      },
    );
    child = dropped;
    dropped.on('exit', (code, signal) => {
      process.exit(shuttingDown || signal ? 0 : (code ?? 1));
    });
    return;
  }

  if (process.env.RUN_MIGRATIONS === 'true') {
    const migrated = await run(
      '/app/node_modules/.bin/prisma',
      ['migrate', 'deploy', '--config', 'prisma7.config.ts'],
      { cwd: '/app/apps/api' },
    );
    if (migrated !== 0) {
      process.exit(migrated);
    }
  }

  const command = process.argv.slice(2);
  if (command.length === 0) {
    console.error('docker-entrypoint: command is required');
    process.exit(1);
  }

  const status = await run(command[0], command.slice(1), { cwd: '/app' });
  process.exit(status);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
