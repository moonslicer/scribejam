import { spawn } from 'node:child_process';
import process from 'node:process';
import electronPath from 'electron';

const timeoutMs = 20_000;

const child = spawn(electronPath, ['.'], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    SCRIBEJAM_SMOKE: '1'
  },
  stdio: ['ignore', 'pipe', 'pipe']
});

let stderr = '';
let stdout = '';
let finished = false;

const timeout = setTimeout(() => {
  if (finished) {
    return;
  }
  finished = true;
  child.kill('SIGKILL');
  process.stderr.write('Smoke check timed out waiting for Electron startup.\n');
  process.exit(1);
}, timeoutMs);

child.stdout.on('data', (chunk) => {
  stdout += chunk.toString();
});

child.stderr.on('data', (chunk) => {
  stderr += chunk.toString();
});

child.on('error', (error) => {
  if (finished) {
    return;
  }
  finished = true;
  clearTimeout(timeout);
  process.stderr.write(`Failed to launch Electron for smoke check: ${error.message}\n`);
  process.exit(1);
});

child.on('exit', (code, signal) => {
  if (finished) {
    return;
  }
  finished = true;
  clearTimeout(timeout);

  if (code === 0) {
    process.stdout.write('Electron startup smoke check passed.\n');
    return;
  }

  process.stderr.write(`Electron startup smoke check failed (code=${code}, signal=${signal}).\n`);
  if (stdout.trim().length > 0) {
    process.stderr.write(`stdout:\n${stdout}\n`);
  }
  if (stderr.trim().length > 0) {
    process.stderr.write(`stderr:\n${stderr}\n`);
  }
  process.exit(1);
});
