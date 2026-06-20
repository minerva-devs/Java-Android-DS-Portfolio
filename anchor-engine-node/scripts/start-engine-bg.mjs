#!/usr/bin/env node
/**
 * Anchor Engine Background Startup — spawns the engine as a fully detached
 * process and exits immediately. The engine survives any tool-call timeout.
 *
 * Usage: node scripts/start-engine-bg.mjs
 * Verify: curl -s http://localhost:3160/health
 */

import { spawn, execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.join(__dirname, '..');
const LOGS_DIR = path.join(os.homedir(), '.anchor', 'logs');

const DEFAULT_PORT = 3160;
const BUILD_DIR = path.join(PROJECT_ROOT, 'engine', 'dist');

if (!fs.existsSync(LOGS_DIR)) {
  fs.mkdirSync(LOGS_DIR, { recursive: true });
}

function log(message, level = 'info') {
  const timestamp = new Date().toISOString();
  const formatted = `[${timestamp}] ${message}`;
  if (level === 'error') console.error(formatted);
  else if (level === 'warn') console.warn(formatted);
  else console.log(formatted);
  const logFile = path.join(LOGS_DIR, `start-${Date.now()}.log`);
  fs.appendFileSync(logFile, formatted + '\n');
}

function checkBuildExists() {
  if (!fs.existsSync(BUILD_DIR)) return false;
  return fs.existsSync(path.join(BUILD_DIR, 'index.js'));
}

async function ensureBuilt() {
  if (checkBuildExists()) {
    log('Build OK', 'info');
    return;
  }
  log('Building...', 'info');
  const proc = spawn('npx', ['tsx', 'scripts/build.ts'], {
    cwd: PROJECT_ROOT,
    stdio: 'inherit',
  });
  await new Promise((resolve, reject) => {
    proc.on('close', code => code === 0 ? resolve() : reject(new Error(`Build exit ${code}`)));
  });
  log('Build complete', 'info');
}

function startEngine(port = DEFAULT_PORT) {
  const enginePath = path.join(PROJECT_ROOT, 'engine', 'dist', 'index.js');
  if (!fs.existsSync(enginePath)) throw new Error('engine/dist/index.js not found');

  // Capture stderr to a log file so crashes are debuggable.
  const errLog = path.join(os.homedir(), '.anchor', 'logs', 'engine-crash.log');
  const errFd = fs.openSync(errLog, 'a');

  const proc = spawn(
    process.env.NODE_EXE || 'node',
    ['--expose-gc', enginePath, `--port=${port}`],
    {
      cwd: path.join(PROJECT_ROOT, 'engine'),
      detached: true,
      stdio: ['ignore', 'ignore', errFd],  // stderr → crash log
      windowsHide: true,
    }
  );
  proc.unref();
  log(`Spawned PID ${proc.pid} on port ${port} (stderr → ${errLog})`, 'info');
}

async function main() {
  try {
    log('Anchor Engine Background Startup', 'info');

    log('[1/3] Build check...', 'info');
    await ensureBuilt();

    log('[2/3] Killing stale processes...', 'info');
    if (process.platform === 'win32') {
      // Use async spawn with stdio:inherit for PowerShell to avoid console hang
      const killProc = spawn('powershell', [
        '-NoProfile',
        '-Command',
        '(Get-NetTCPConnection -LocalPort 3160 -ErrorAction SilentlyContinue).OwningProcess | Where-Object { $_ } | ForEach-Object { Stop-Process -Id $_ -Force }'
      ], {
        cwd: PROJECT_ROOT,
        stdio: 'inherit', // Use inherit so PowerShell doesn't hang waiting for input
        windowsHide: false,
      });
      await new Promise(resolve => killProc.on('close', resolve));
    } else if (process.platform === 'darwin') {
      try { execSync('pkill -9 node', { timeout: 5000 }); } catch {}
    }

    log('[3/3] Spawning detached engine...', 'info');
    startEngine(DEFAULT_PORT);

    log(`Done. Verify: curl -s http://localhost:${DEFAULT_PORT}/health`, 'info');
    process.exit(0);
  } catch (error) {
    log(`Failed: ${error.message}`, 'error');
    process.exit(1);
  }
}

main();
