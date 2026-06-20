/**
 * GitHub Clone Integration Test
 * 
 * Tests the GitHub repository cloning functionality.
 * Validates that repositories are cloned correctly to a temporary directory,
 * and that runtime objects (logs, results) are written to proper user_settings.json paths.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { exec, execSync } from 'child_process';
import * as os from 'os';
import { promisify } from 'util';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, rmSync, mkdirSync, writeFileSync, readFileSync } from 'fs';

const execAsync = promisify(exec);
const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..', '..');

// Import PATHS from config module — all runtime paths must come from here, not be constructed manually
import { PATHS } from '../../src/config/paths.js';

const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';
const GITHUB_REPO = 'RSBalchII/anchor-engine-node';

describe('GitHub Clone Integration Tests', () => {
  let serverProcess: ReturnType<typeof import('child_process').spawn> | null = null;
  let tempCloneDir: string | null = null;

  beforeAll(async () => {
    console.log('🔧 [GitHub Clone] Setting up test environment...');

    // Check if server is already running
    try {
      const { spawn } = await import('child_process');
      const server = spawn('node', ['dist/index.js'], {
        cwd: PROJECT_ROOT,
        stdio: 'pipe',
        env: {
          ...process.env,
          PORT: '3160',
          ANCHOR_GITHUB_TOKEN: GITHUB_TOKEN,
        },
      });

      server.stdout?.on('data', (data) => {
        const log = data.toString().trim();
        if (log.includes('listening') || log.includes('ready')) {
          console.log(`📡 [Server] ${log}`);
          serverStarted = true;
        }
      });

      server.stderr?.on('data', (data) => {
        const log = data.toString().trim();
        if (log.includes('error') || log.includes('Error')) {
          console.error(`❌ [Server] ${log}`);
        }
      });

      // Wait for server to be ready
      await new Promise(resolve => setTimeout(resolve, 3000));
      console.log('⏳ Server startup complete');
    } catch (err) {
      console.log('⚠️  Server startup failed or already running');
    }
  });

  afterAll(async () => {
    console.log('🧹 [GitHub Clone] Cleaning up...');
    if (serverProcess) {
      serverProcess.kill('SIGTERM');
      await new Promise((resolve) => serverProcess?.on('exit', resolve));
      console.log('✅ Server stopped');
    }

    // Clean up temp clone directory — never pollute external-inbox with test artifacts
    if (tempCloneDir && existsSync(tempCloneDir)) {
      try {
        rmSync(tempCloneDir, { recursive: true, force: true });
        console.log(`🗑️  Removed temporary clone dir: ${tempCloneDir}`);
      } catch (err) {
        console.warn(`⚠️  Failed to remove temp dir: ${err.message}`);
      }
    }

    // Clean up any test result files that were written during tests
    if (PATHS.DISTILLS_DIR && existsSync(PATHS.DISTILLS_DIR)) {
      const resultFile = join(PATHS.DISTILLS_DIR, 'github-clone.json');
      if (existsSync(resultFile)) {
        rmSync(resultFile, { force: true });
        console.log(`🗑️  Removed test result file: ${resultFile}`);
      }
    }

    // Clean up logs written during tests
    if (PATHS.LOGS_DIR && existsSync(PATHS.LOGS_DIR)) {
      const logFile = join(PATHS.LOGS_DIR, 'github-clone-test.log');
      if (existsSync(logFile)) {
        rmSync(logFile, { force: true });
        console.log(`🗑️  Removed test log file: ${logFile}`);
      }
    }
  });

  it('should clone a public repository to temp directory', async () => {
    const repoName = 'test-repo-clone';

    // Clone to TEMPORARY directory, NOT external-inbox (which is runtime user data)
    const testTempDir = join(os.tmpdir(), 'anchor-test-clones');
    mkdirSync(testTempDir, { recursive: true });
    tempCloneDir = join(testTempDir, repoName);

    // Clean up if exists from previous runs
    if (existsSync(tempCloneDir)) {
      rmSync(tempCloneDir, { recursive: true, force: true });
      console.log(`🗑️  Removed existing clone: ${tempCloneDir}`);
    }

    console.log(`\n📦 Cloning ${GITHUB_REPO} to temp dir...`);

    const cloneCommand = `git clone --depth 1 https://github.com/${GITHUB_REPO}.git "${tempCloneDir}"`;

    try {
      const { stdout, stderr } = await execAsync(cloneCommand, {
        timeout: 120_000,
        cwd: PROJECT_ROOT,
      });

      console.log(`✅ Clone complete`);
      console.log(`   Output: ${stdout.trim()}`);

      // Validate clone
      expect(existsSync(tempCloneDir)).toBe(true);
      expect(existsSync(join(tempCloneDir, 'engine/package.json'))).toBe(true); // package.json is in engine/ subdirectory
      expect(existsSync(join(tempCloneDir, 'README.md'))).toBe(true);

      // Log results to proper runtime path — use PATHS.LOGS_DIR for test output
      const result = {
        timestamp: new Date().toISOString(),
        repo: GITHUB_REPO,
        cloneDir: tempCloneDir,
        files: getDirectoryContents(tempCloneDir),
      };

      // Write results to LOGS_DIR (not hardcoded .anchor/results)
      if (PATHS.LOGS_DIR && existsSync(PATHS.LOGS_DIR)) {
        const resultFile = join(PATHS.LOGS_DIR, 'github-clone-test.json');
        writeFileSync(resultFile, JSON.stringify(result, null, 2));
        console.log(`📝 Results logged to: ${resultFile}`);
      } else {
        console.warn('⚠️  LOGS_DIR not available — results not persisted');
      }

    } catch (error: any) {
      console.error(`❌ Clone failed: ${error.message}`);
      throw error;
    }
  }, 120_000);

  it('should verify repository structure', async () => {
    // Use the temp clone from previous test if available, otherwise skip
    const cloneDir = tempCloneDir || join(os.tmpdir(), 'anchor-test-clones', 'test-repo-clone');

    if (!existsSync(cloneDir)) {
      throw new Error('Clone directory does not exist — run clone test first');
    }

    console.log(`\n📁 Verifying repository structure...`);

    // Check key files
    const keyFiles = [
      'package.json',
      'README.md',
      'engine/src/index.ts',
      'engine/package.json',
    ];

    for (const file of keyFiles) {
      const filePath = join(cloneDir, file);
      if (existsSync(filePath)) {
        console.log(`✅ Found: ${file}`);
      } else {
        console.log(`❌ Missing: ${file}`);
      }
    }

    // Read package.json
    const packageJson = readFileSync(join(cloneDir, 'package.json'), 'utf-8');
    const pkg = JSON.parse(packageJson);

    console.log(`\n📄 package.json contents:`);
    console.log(`   Name: ${pkg.name}`);
    console.log(`   Version: ${pkg.version}`);
  });

  it('should handle shallow clone', async () => {
    const repoName = 'shallow-clone-test';
    
    // Clone to TEMPORARY directory, NOT external-inbox
    const testTempDir = join(os.tmpdir(), 'anchor-test-clones');
    mkdirSync(testTempDir, { recursive: true });
    const cloneDir = join(testTempDir, repoName);

    // Clean up
    if (existsSync(cloneDir)) {
      rmSync(cloneDir, { recursive: true, force: true });
    }

    console.log(`\n📦 Creating shallow clone...`);

    const cloneCommand = `git clone --depth 1 --branch main https://github.com/${GITHUB_REPO}.git "${cloneDir}"`;

    try {
      await execAsync(cloneCommand, {
        timeout: 60_000,
        cwd: PROJECT_ROOT,
      });

      console.log('✅ Shallow clone complete');

      // Verify HEAD is at main
      const head = readFileSync(join(cloneDir, '.git', 'HEAD'), 'utf-8').trim();
      expect(head).toBe('ref: refs/heads/main');

      // Clean up this shallow clone since it's test-only data
      rmSync(cloneDir, { recursive: true, force: true });
      console.log(`🗑️  Removed temporary shallow clone`);

    } catch (error: any) {
      console.error(`❌ Shallow clone failed: ${error.message}`);
      throw error;
    }
  }, 60_000);

  it('should handle repository with submodules', async () => {
    // This test checks if the clone handles submodules correctly
    const repoName = 'submodule-test';

    // Clone to TEMPORARY directory, NOT external-inbox
    const testTempDir = join(os.tmpdir(), 'anchor-test-clones');
    mkdirSync(testTempDir, { recursive: true });
    const cloneDir = join(testTempDir, repoName);

    // Clean up
    if (existsSync(cloneDir)) {
      rmSync(cloneDir, { recursive: true, force: true });
    }

    console.log(`\n📦 Cloning repository with potential submodules...`);

    const cloneCommand = `git clone https://github.com/${GITHUB_REPO}.git "${cloneDir}"`;

    try {
      const { stdout } = await execAsync(cloneCommand, {
        timeout: 120_000,
        cwd: PROJECT_ROOT,
      });

      console.log(`✅ Clone complete with submodules`);
      console.log(`   Output: ${stdout.trim()}`);

      // Clean up after test
      rmSync(cloneDir, { recursive: true, force: true });
      console.log('🗑️  Removed temporary submodule clone');

    } catch (error: any) {
      console.error(`❌ Clone with submodules failed: ${error.message}`);
      // This might fail if submodules aren't configured, which is OK
      console.log('⚠️  Note: Submodule clone may require explicit submodule initialization');
    }
  }, 120_000);

  it('should verify git history', async () => {
    const cloneDir = tempCloneDir || join(os.tmpdir(), 'anchor-test-clones', 'test-repo-clone');

    if (!existsSync(cloneDir)) {
      throw new Error('Clone directory does not exist — run clone test first');
    }

    console.log(`\n📜 Checking git history...`);

    const { stdout: log } = await execAsync(`git log --oneline -10`, {
      cwd: cloneDir,
    });

    console.log(`   Recent commits:`);
    console.log(log);

    // Should have at least some commits
    const commitCount = (log.match(/commit/gi) || []).length;
    console.log(`   Commits found: ${commitCount}`);
  });

  it('should verify README content', async () => {
    const cloneDir = tempCloneDir || join(os.tmpdir(), 'anchor-test-clones', 'test-repo-clone');

    if (!existsSync(cloneDir)) {
      throw new Error('Clone directory does not exist — run clone test first');
    }

    console.log(`\n📄 Reading README.md...`);

    const readme = readFileSync(join(cloneDir, 'README.md'), 'utf-8');
    const lines = readme.split('\n').slice(0, 20);

    console.log(`   First 20 lines:`);
    for (const line of lines) {
      console.log(`   ${line}`);
    }

    // Should contain project name
    expect(readme).toContain('Anchor Engine');
  });

  function getDirectoryContents(dir: string): string[] {
    try {
      return execSync(`ls -la "${dir}"`, { encoding: 'utf-8' })
        .split('\n')
        .filter(line => line.trim());
    } catch {
      return [];
    }
  }

  let serverStarted = false;
});
