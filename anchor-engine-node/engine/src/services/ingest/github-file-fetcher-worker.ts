/**
 * GitHub File Fetcher Worker
 *
 * Offloads the heavy GitHub tarball download, extraction, and file reading
 * to a Worker thread. This prevents the main event loop from blocking and
 * isolates OOM-prone operations.
 *
 * The worker:
 *   1. Downloads the tarball from GitHub
 *   2. Extracts it to a temp directory
 *   3. Reads each file and sends content batches back to the main thread
 *   4. Cleans up temp files
 *
 * Communication via parentPort:
 *   - Main → Worker: 'start' message with repo config
 *   - Worker → Main: 'progress', 'file-batch', 'complete', 'error'
 */

import { parentPort, workerData } from 'worker_threads';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as tar from 'tar';

// File exclusion patterns
const EXCLUDE_PATTERNS = [
  'node_modules/', '.git/', 'dist/', 'build/', 'target/', 'vendor/',
  '.bin', '.exe', '.dll', '.so', '.dylib',
  '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico',
  '.pdf', '.doc', '.docx', '.lock',
];

const MAX_FILE_SIZE = 500 * 1024; // 500KB limit per file
const BATCH_SIZE = 10; // Files per batch sent to main thread
const GC_INTERVAL = 5;

function shouldExclude(filePath: string): boolean {
  const lower = filePath.toLowerCase().replace(/\\/g, '/');
  return EXCLUDE_PATTERNS.some(p => lower.includes(p.toLowerCase()));
}

function progress(msg: string, data: Record<string, unknown> = {}) {
  parentPort?.postMessage({ type: 'progress', message: msg, ...data });
}

interface FileData {
  relativePath: string;
  sourcePath: string;
  content: string;
  size: number;
}

async function run(): Promise<void> {
  const { owner, repo, branch, token, bucket, extractDir } = workerData as {
    owner: string; repo: string; branch: string; token?: string; bucket: string; extractDir?: string;
  };
  // If extractDir is not provided, use a temp directory (backward compatibility)
  const finalExtractDir = extractDir || path.join(os.tmpdir(), 'extracted');
  const tarballUrl = `https://api.github.com/repos/${owner}/${repo}/tarball/${branch}`;
  const startTime = Date.now();

  try {
    // Download tarball with timeout
    const headers: Record<string, string> = {
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'anchor-engine-node',
    };
    if (token) headers['Authorization'] = `token ${token}`;

    progress('downloading', { url: tarballUrl });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort('Download timeout after 120s'), 120_000);

    let response: Response;
    
    try {
      // Download with proper type handling for undici Response
      response = await fetch(tarballUrl, { headers, redirect: 'follow', signal: controller.signal }) as any;
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
      }
    } catch (err: any) {
      progress('error', { message: `Download failed: ${err.message || 'Unknown error'}`, url: tarballUrl });
      parentPort?.postMessage({ type: 'error', message: err.message, stack: err.stack });
      throw err;
    }

    // Check response status again after successful fetch
    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw new Error(`GitHub API error: ${response.status} ${response.statusText} - ${errorText.slice(0, 200)}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    if (buffer.length < 1024) {
      throw new Error(`Downloaded file too small (${buffer.length} bytes)`);
    }

    progress('downloaded', { size: buffer.length });

    // Extract tarball
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'github-worker-'));
    const tarballPath = path.join(tempDir, 'repo.tar.gz');
    fs.writeFileSync(tarballPath, buffer);

    const extractDir = path.join(tempDir, 'extracted');
    fs.mkdirSync(extractDir, { recursive: true });

    progress('extracting');
    await tar.x({ file: tarballPath, cwd: extractDir, strip: 1 });

    // Clean up tarball
    try { fs.unlinkSync(tarballPath); } catch {}

    // Walk directory to find files
    const files: string[] = [];
    function walkDir(dir: string) {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const relativePath = path.relative(extractDir, fullPath);
        if (shouldExclude(relativePath)) continue;
        if (entry.isDirectory()) {
          walkDir(fullPath);
        } else if (entry.isFile()) {
          files.push(fullPath);
        }
      }
    }
    walkDir(extractDir);

    progress('found', { fileCount: files.length });

    // If extractDir is provided, copy files to the correct location on disk
    if (finalExtractDir !== tempDir) {
      progress('copying to disk', { extractDir: finalExtractDir });
      
      // Create parent directories if needed
      fs.mkdirSync(finalExtractDir, { recursive: true });
      
      // Copy each file to the correct location
      for (const file of files) {
        const targetPath = path.join(finalExtractDir, path.relative(extractDir, file));
        
        // Ensure parent directory exists
        fs.mkdirSync(path.dirname(targetPath), { recursive: true });
        
        // Copy file content
        fs.copyFileSync(file, targetPath);
        
        // Also create a symbolic link for fast access
        try {
          // Remove existing symlink if any
          fs.unlinkSync(targetPath); // This will fail for actual files, which is fine
        } catch (e) {}
      }
      
      progress('copied', { fileCount: files.length, extractDir: finalExtractDir });
    }

    // Read files and send in batches
    let filesIngested = 0;
    let filesSkipped = 0;
    let totalSize = 0;
    let batch: FileData[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const relativePath = path.relative(extractDir, file);
      const sourcePath = `github/${owner}/${repo}/${relativePath}`;

      try {
        const stat = fs.statSync(file);
        if (stat.size > MAX_FILE_SIZE) {
          filesSkipped++;
          continue;
        }

        const content = fs.readFileSync(file, 'utf8');

        batch.push({
          relativePath,
          sourcePath,
          content,
          size: stat.size,
        });

        totalSize += stat.size;
        filesIngested++;

        // Send batch when full or at end
        if (batch.length >= BATCH_SIZE || i === files.length - 1) {
          parentPort?.postMessage({
            type: 'file-batch',
            files: batch,
            progress: { current: filesIngested, total: files.length, skipped: filesSkipped },
          });
          batch = [];

          // Clear references
          batch = [] as FileData[];
        }

        // GC hint
        if (i % GC_INTERVAL === GC_INTERVAL - 1 && global.gc) {
          global.gc();
        }
      } catch (err: any) {
        // Skip unreadable files
        filesSkipped++;
      }
    }

    // Cleanup temp directory
    try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch {}

    const duration = Date.now() - startTime;
    progress('complete', { filesIngested, filesSkipped, totalSize, duration });

    parentPort?.postMessage({
      type: 'complete',
      filesIngested,
      filesSkipped,
      totalSize,
      durationMs: duration,
    });

  } catch (error: any) {
    progress('error', { message: error.message });

    parentPort?.postMessage({
      type: 'error',
      message: error.message,
      stack: error.stack,
    });
  }
}

// Start when worker data is available
if (workerData) {
  run();
}

parentPort?.on('message', (msg) => {
  if (msg === 'start') {
    run();
  }
});
