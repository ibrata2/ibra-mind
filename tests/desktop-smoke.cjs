const { spawn } = require('node:child_process');
const path = require('node:path');

if (process.platform !== 'win32') throw new Error('The packaged desktop smoke check must run on Windows.');

const executable = path.resolve('release', 'win-unpacked', 'IBRA MIND.exe');
const child = spawn(executable, [], {
  env: { ...process.env, IBRA_MIND_SMOKE: '1' },
  stdio: ['ignore', 'pipe', 'pipe'],
  windowsHide: true,
});

let stdout = '';
let stderr = '';
let finished = false;
const timeout = setTimeout(() => {
  if (finished) return;
  child.kill();
  process.stderr.write(`Packaged app did not finish its startup check in time.\n${stderr}`);
  process.exitCode = 1;
}, 60_000);

child.stdout.setEncoding('utf8').on('data', (chunk) => {
  stdout += chunk;
  if (stdout.includes('IBRA_MIND_RENDERER_OK')) {
    finished = true;
    clearTimeout(timeout);
    process.stdout.write('Packaged Windows app rendered the IBRA MIND dashboard.\n');
  }
  if (stdout.includes('IBRA_MIND_RENDERER_EMPTY')) {
    finished = true;
    clearTimeout(timeout);
    process.stderr.write('Packaged Windows app opened an empty renderer.\n');
    process.exitCode = 1;
    child.kill();
  }
});
child.stderr.setEncoding('utf8').on('data', (chunk) => { stderr += chunk; });
child.on('error', (error) => {
  finished = true;
  clearTimeout(timeout);
  process.stderr.write(`Could not start the packaged Windows app: ${error.message}\n`);
  process.exitCode = 1;
});
child.on('exit', (code) => {
  finished = true;
  clearTimeout(timeout);
  if (!stdout.includes('IBRA_MIND_RENDERER_OK') || code !== 0) {
    process.stderr.write(`Packaged app startup failed (exit ${code}).\n${stderr}\n${stdout}`);
    process.exitCode = 1;
  }
});
