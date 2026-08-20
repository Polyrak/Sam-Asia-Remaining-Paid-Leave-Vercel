import { spawn, execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Dev-only tool: killing whatever holds the port and silently swallowing
// crashes is exactly what you don't want in production, where the hosting
// platform's own restart policy should be the one seeing (and reacting to)
// a crash. Refuse to run there even if `npm run dev` gets invoked by mistake.
if (process.env.NODE_ENV === 'production') {
  console.error('[run-with-retry] refusing to run with NODE_ENV=production — use "npm start" instead.');
  process.exit(1);
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.join(__dirname, '..');
const port = process.env.PORT || 4000;

// nodemon restarts this wrapper (not the app directly) on file changes, but
// on Windows that's often a hard kill — the app child can be left orphaned,
// still holding the port. Freeing the port before every start (both the
// first one and every crash-retry) makes sure a stale process never blocks
// the new one from binding.
function freePort() {
  try {
    if (process.platform === 'win32') {
      const output = execSync('netstat -ano', { encoding: 'utf-8' });
      const pids = new Set();
      for (const line of output.split('\n')) {
        const match = line.match(/TCP\s+\S*:(\d+)\s+\S+\s+LISTENING\s+(\d+)/);
        if (match && Number(match[1]) === Number(port)) pids.add(match[2]);
      }
      for (const pid of pids) {
        try {
          execSync(`taskkill /PID ${pid} /F`, { stdio: 'ignore' });
          console.log(`[run-with-retry] freed port ${port} (killed stray pid ${pid})`);
        } catch {
          // already gone
        }
      }
    } else {
      const output = execSync(`lsof -ti tcp:${port}`, { encoding: 'utf-8' }).trim();
      for (const pid of output.split('\n').filter(Boolean)) {
        try {
          execSync(`kill -9 ${pid}`, { stdio: 'ignore' });
          console.log(`[run-with-retry] freed port ${port} (killed stray pid ${pid})`);
        } catch {
          // already gone
        }
      }
    }
  } catch {
    // nothing listening on the port — nothing to free
  }
}

const MIN_DELAY = 1000;
const MAX_DELAY = 5000;
let delay = MIN_DELAY;
let stopping = false;
let child = null;

function run() {
  freePort();
  child = spawn(process.execPath, ['src/index.js'], { cwd: backendRoot, stdio: 'inherit' });
  const startedAt = Date.now();

  child.on('exit', (code) => {
    if (stopping) return;
    if (code === 0) return;

    // Ran fine for a while before this crash — treat it as a fresh problem
    // rather than piling onto the backoff from an earlier, unrelated crash.
    if (Date.now() - startedAt > 10000) delay = MIN_DELAY;

    console.log(`[run-with-retry] app crashed (exit code ${code}), restarting in ${delay}ms...`);
    const thisDelay = delay;
    delay = Math.min(delay * 1.5, MAX_DELAY);
    setTimeout(run, thisDelay);
  });
}

function shutdown(signal) {
  stopping = true;
  if (child) child.kill(signal);
  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

run();
