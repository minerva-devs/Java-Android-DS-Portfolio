/**
 * GitHub Repository Ingestion Service (Standard 115)
 *
 * Downloads GitHub repository tarballs, extracts source files,
 * and ingests them into the Anchor knowledge graph.
 */

import { Worker } from 'worker_threads';
import { gotScraping } from 'got-scraping';
import * as tar from 'tar';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';
import { fileURLToPath } from 'url';
import { db } from '../../core/db.js';
import { AtomizerService } from './atomizer-service.js';
import { AtomicIngestService } from './ingest-atomic.js';
import { StructuredLogger } from '../../utils/structured-logger.js';
import { config } from '../../config/index.js';
import { PATHS } from '../../config/paths.js';
import { CodeAnalyzer, getAnalysisSummary, type ToolOutput } from '../analysis/code-analyzer.js';

interface GitHubRepoRecord {
  id: string;
  owner: string;
  repo: string;
  branch: string;
  bucket: string;
  github_url: string;
  last_synced_at?: string;
  last_sync_status?: string;
  last_error?: string;
  total_files: number;
  total_atoms: number;
  total_size_bytes: number;
}

interface SyncResult {
  files_ingested: number;
  atoms_created: number;
  molecules_created: number;
  total_size_bytes: number;
  duration_ms: number;
  analysis?: {
    total_issues: number;
    errors: number;
    warnings: number;
    info: number;
    by_tool: Record<string, number>;
  };
}

// File exclusion patterns (Standard 115, Section 3.3) - now handled by isTextFile()
const EXCLUDE_PATTERNS = [
  'node_modules/',
  '.git/',
  'dist/',
  'build/',
  'target/',
  'vendor/',
  'test-wasm/',
]; // Directory patterns only - binary files handled by isTextFile()

// Language detection by extension
const LANGUAGE_MAP: Record<string, string> = {
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.py': 'python',
  '.rs': 'rust',
  '.go': 'go',
  '.java': 'java',
  '.cpp': 'cpp',
  '.cc': 'cpp',
  '.cxx': 'cpp',
  '.h': 'cpp',
  '.hpp': 'cpp',
  '.c': 'c',
  '.cs': 'csharp',
  '.rb': 'ruby',
  '.php': 'php',
  '.swift': 'swift',
  '.kt': 'kotlin',
  '.scala': 'scala',
  '.ex': 'elixir',
  '.exs': 'elixir',
  '.erl': 'erlang',
  '.hs': 'haskell',
  '.clj': 'clojure',
  '.c.ts': 'clojure',
  '.ml': 'ocaml',
  '.fs': 'fsharp',
  '.vue': 'vue',
  '.svelte': 'svelte',
  '.html': 'html',
  '.css': 'css',
  '.scss': 'scss',
  '.sass': 'sass',
  '.less': 'less',
  '.tson': 'tson',
  '.yaml': 'yaml',
  '.yml': 'yaml',
  '.toml': 'toml',
  '.md': 'markdown',
  '.sql': 'sql',
  '.sh': 'shell',
  '.bash': 'shell',
  '.zsh': 'shell',
  '.ps1': 'powershell',
  '.dockerfile': 'dockerfile',
  '.xml': 'xml',
  '.lua': 'lua',
  '.r': 'r',
  '.R': 'r',
};

export class GitHubIngestService {
  private atomizer: AtomizerService;
  private atomicIngest: AtomicIngestService;

  /**
   * Check if a file extension is text-based (should be ingested) or binary (skip)
   */
  isTextFile(ext: string): boolean {
    const textExtensions = [
      '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.jsx',
      '.py', '.rst', '.md', '.markdown',
      '.json', '.yaml', '.yml', '.toml', '.xml', '.html',
      '.css', '.scss', '.sass', '.less', '.styl',
      '.java', '.c', '.cpp', '.h', '.hpp', '.cc', '.cxx',
      '.cs', '.rb', '.php', '.swift', '.kt', '.scala',
      '.go', '.rs', '.ex', '.exs', '.erl', '.hs', '.clj',
      '.ml', '.fs', '.vue', '.svelte', '.sh', '.bash', '.zsh',
      '.ps1', '.bat', '.cmd', '.dockerfile', '.sql', '.lua', '.r',
      '.txt', '.log', '.mdx', '.tex', '.latex'
    ];
    
    const binaryExtensions = [
      '.wasm', '.node', '.map', '.exe', '.dll', '.so', '.dylib',
      '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.webp', '.avif',
      '.mp4', '.mkv', '.mp3', '.wav', '.ogg', '.pdf', '.doc', '.docx',
      '.zip', '.tar', '.gz', '.bz2' // archives/compressed files
    ];

    const lowerExt = ext.toLowerCase();
    
    if (binaryExtensions.includes(lowerExt)) return false;
    if (textExtensions.includes(lowerExt)) return true;
    
    // Default: treat files with common code extensions as text
    return ['.ts', '.js', '.tsx', '.jsx'].includes(lowerExt) || !['.', 'exe', 'so', 'dylib', 'wasm'].some(suffix => lowerExt.endsWith(suffix));
  }

  constructor() {
    this.atomizer = new AtomizerService();
    this.atomicIngest = new AtomicIngestService();
  }

  /**
   * Parse GitHub URL into components
   * Supports:
   * - https://github.com/{owner}/{repo}
   * - https://github.com/{owner}/{repo}/tree/{branch}
   */
  parseGitHubUrl(url: string): { owner: string; repo: string; branch: string } {
    const parsed = new URL(url);
    const parts = parsed.pathname.split('/').filter(Boolean);
    
    if (parts.length < 2) {
      throw new Error(`Invalid GitHub URL: ${url}`);
    }

    const owner = parts[0];
    const repo = parts[1].replace('.git', '');
    
    // Detect branch from /tree/{branch}
    let branch = 'main';
    if (parts[2] === 'tree' && parts[3]) {
      branch = parts[3];
    } else if (parts[2] && !parts[2].includes('.')) {
      // Could be a branch without /tree/
      branch = parts[2];
    }

    return { owner, repo, branch };
  }

  /**
   * Download tarball from GitHub API
   * Returns path to downloaded tarball
   */
  async downloadTarball(
    owner: string,
    repo: string,
    branch: string,
    token?: string,
  ): Promise<string> {
    const tarballUrl = `https://api.github.com/repos/${owner}/${repo}/tarball/${branch}`;
    
    const headers: Record<string, string> = {
      'Accept': 'application/vnd.github.v3.tson',
      'User-Agent': 'anchor-engine-node',
    };

    if (token) {
      headers.Authorization = `token ${token}`;
    }

    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'github-ingest-'));
    const tarballPath = path.join(tempDir, 'repo.tar.gz');

    console.log(`[GitHub] Downloading tarball: ${tarballUrl}`);

    // Retry logic (up to 3 times with exponential backoff)
    let lastError: Error | null = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        // Use native fetch with timeout via AbortController
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 60_000); // 60s timeout

        // Use native fetch for better redirect handling
        const response = await fetch(tarballUrl, {
          headers,
          redirect: 'follow', // Follow redirects automatically
          signal: controller.signal,
        });
        clearTimeout(timeout);

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`GitHub API error: ${response.status} ${response.statusText} - ${errorText}`);
        }

        // Check Content-Type - should be application/octet-stream or application/x-gzip
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application.tson')) {
          // GitHub returned an error response as.tsON instead of tarball
          const errorData = await response.json();
          throw new Error(`GitHub returned.tsON instead of tarball: $.tsON.stringify(errorData)}`);
        }

        // Check rate limit headers
        const remaining = response.headers.get('x-ratelimit-remaining');
        const reset = response.headers.get('x-ratelimit-reset');

        if (remaining && parseInt(remaining) < 10) {
          console.warn(`[GitHub] Rate limit warning: ${remaining} requests remaining. Resets at ${reset}`);
        }

        // Get the buffer with timeout
        const bufferTimeout = setTimeout(() => controller.abort('Read timeout'), 30_000);
        const arrayBuffer = await response.arrayBuffer();
        clearTimeout(bufferTimeout);
        const buffer = Buffer.from(arrayBuffer);

        // Verify it's a valid tarball (should be > 1KB)
        if (buffer.length < 1024) {
          throw new Error(`Downloaded file too small (${buffer.length} bytes). Likely an API error.`);
        }

        fs.writeFileSync(tarballPath, buffer);
        console.log(`[GitHub] Downloaded ${buffer.length} bytes to ${tarballPath}`);

        return tarballPath;
      } catch (error: any) {
        lastError = error;
        console.warn(`[GitHub] Download attempt ${attempt} failed: ${error.message}`);

        if (attempt < 3) {
          const delay = Math.pow(2, attempt - 1) * 1000; // 1s, 2s, 4s
          console.log(`[GitHub] Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError || new Error('Failed to download tarball after 3 attempts');
  }

  /**
   * Extract tarball to temporary directory
   * Returns path to extracted directory
   */
  async extractTarball(tarballPath: string): Promise<string> {
    const extractDir = path.join(path.dirname(tarballPath), 'extracted');
    fs.mkdirSync(extractDir, { recursive: true });

    console.log(`[GitHub] Extracting tarball to ${extractDir}`);

    await tar.x({
      file: tarballPath,
      cwd: extractDir,
      strip: 1, // Remove top-level directory (owner-repo-hash)
    });

    return extractDir;
  }

  /**
   * Check if file is binary by checking for null bytes
   */
  async isBinaryFile(filePath: string): Promise<boolean> {
    try {
      const fd = await fs.promises.open(filePath, 'r');
      const buffer = Buffer.alloc(8192); // Check first 8KB
      await fd.read(buffer, 0, 8192, 0);
      await fd.close();

      // Check for null bytes (common in binary files)
      for (let i = 0; i < buffer.length; i++) {
        if (buffer[i] === 0) {
          return true;
        }
      }

      return false;
    } catch {
      return true; // Assume binary if we can't read it
    }
  }

  /**
   * Detect programming language from file extension
   */
  detectLanguage(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    const basename = path.basename(filePath).toLowerCase();
    
    // Check for special filenames first
    if (basename === 'dockerfile') return 'dockerfile';
    if (basename === 'makefile') return 'makefile';
    
    return LANGUAGE_MAP[ext] || 'unknown';
  }

  /**
   * Check if file should be excluded
   */
  shouldExclude(filePath: string): boolean {
    const relativePath = filePath.toLowerCase();
    
    return EXCLUDE_PATTERNS.some(pattern => {
      if (pattern.startsWith('.')) {
        // Extension check
        return relativePath.endsWith(pattern);
      } else {
        // Directory/path check
        return relativePath.includes(pattern);
      }
    });
  }

  /**
   * Walk directory and return list of source files
   */
  async walkDirectory(dir: string, baseDir: string = dir): Promise<string[]> {
    const files: string[] = [];
    
    try {
      const entries = await fs.promises.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        // Skip excluded paths
        if (this.shouldExclude(fullPath)) {
          continue;
        }

        if (entry.isDirectory()) {
          const subFiles = await this.walkDirectory(fullPath, baseDir);
          files.push(...subFiles);
        } else if (entry.isFile()) {
          // Skip binary files
          const isBinary = await this.isBinaryFile(fullPath);
          if (!isBinary) {
            files.push(fullPath);
          }
        }
      }
    } catch (error: any) {
      console.warn(`[GitHub] Error walking directory ${dir}: ${error.message}`);
    }

    return files;
  }

  /**
   * Mirror extracted files to notebook/external-inbox/github/{owner}/{repo}/
   * This provides a local backup and visible source files for the user
   */
  async mirrorToNotebook(
    extractDir: string,
    owner: string,
    repo: string,
  ): Promise<string> {
    // GitHub repos go to internal-inbox (for source file visibility and backup)
    const mirrorDir = path.join(PATHS.NOTEBOOK_DIR, 'internal-inbox', owner, repo);

    try {
      // Remove old mirror if exists (clean slate)
      if (fs.existsSync(mirrorDir)) {
        fs.rmSync(mirrorDir, { recursive: true, force: true });
      }

      // Create mirror directory
      fs.mkdirSync(mirrorDir, { recursive: true });

      // Copy all files from extractDir to mirrorDir
      const copiedFiles = await this.copyDirectory(extractDir, mirrorDir);

      console.log(`[GitHub] âœ… Mirrored ${copiedFiles} files to ${mirrorDir}`);
      return mirrorDir;
    } catch (error: any) {
      console.warn(`[GitHub] Failed to mirror to notebook: ${error.message}`);
      return '';
    }
  }

  /**
   * Recursively copy directory
   */
  async copyDirectory(src: string, dest: string): Promise<number> {
    let copiedCount = 0;

    const entries = await fs.promises.readdir(src, { withFileTypes: true });

    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);

      if (this.shouldExclude(srcPath)) {
        continue;
      }

      if (entry.isDirectory()) {
        fs.mkdirSync(destPath, { recursive: true });
        const subCopied = await this.copyDirectory(srcPath, destPath);
        copiedCount += subCopied;
      } else if (entry.isFile()) {
        await fs.promises.copyFile(srcPath, destPath);
        copiedCount++;
      }
    }

    return copiedCount;
  }

  /**
   * Register a new GitHub repository in the database
   */
  async registerRepo(url: string, bucket: string): Promise<GitHubRepoRecord> {
    const { owner, repo, branch } = this.parseGitHubUrl(url);
    
    // Generate unique ID
    const id = `github_${owner}_${repo}_${branch}`;
    
    console.log(`[GitHub] Registering repo: ${owner}/${repo} (branch: ${branch})`);

    // Insert or update record
    await db.run(
      `INSERT INTO github_repos (id, owner, repo, branch, bucket, github_url, last_sync_status)
       VALUES ($1, $2, $3, $4, $5, $6, 'pending')
       ON CONFLICT (id) DO UPDATE SET
         bucket = $5,
         github_url = $6,
         updated_at = CURRENT_TIMESTAMP`,
      [id, owner, repo, branch, bucket, url],
    );

    return {
      id,
      owner,
      repo,
      branch,
      bucket,
      github_url: url,
      total_files: 0,
      total_atoms: 0,
      total_size_bytes: 0,
    };
  }

  /**
   * Sync a repository (download, extract, ingest)
   * @param repoId Repository ID to sync
   * @param options Optional settings including runAnalysis flag
   */
  async syncRepo(repoId: string, options?: { runAnalysis?: boolean; token?: string }): Promise<SyncResult> {
    const startTime = Date.now();

    // Get repo record
    const result = await db.run(
      'SELECT * FROM github_repos WHERE id = $1',
      [repoId],
    );

    if (!result.rows || result.rows.length === 0) {
      throw new Error(`Repository not found: ${repoId}`);
    }

    const repo = result.rows[0] as GitHubRepoRecord;
    console.log(`[GitHub] Syncing ${repo.owner}/${repo.repo} (bucket: ${repo.bucket})`);

    // Update status to in_progress
    await db.run(
      'UPDATE github_repos SET last_sync_status = \'in_progress\', last_error = NULL WHERE id = $1',
      [repoId],
    );

    try {
      // Spawn Worker for download + file extraction (isolated from main event loop)
      const workerPath = fileURLToPath(new URL('./github-file-fetcher-worker.js', import.meta.url));

      const worker = new Worker(workerPath, {
        workerData: {
          owner: repo.owner,
          repo: repo.repo,
          branch: repo.branch,
          token: options?.token || process.env.GITHUB_TOKEN || config.GITHUB_TOKEN,
          bucket: repo.bucket,
        },
      });

      let filesIngested = 0;
      let filesSkipped = 0;
      let totalSize = 0;
      let totalAtoms = 0;
      let totalMolecules = 0;
      let syncError: Error | null = null;

      // Process file batches from worker with timeout protection
      const workerPromise = new Promise<void>((resolve, reject) => {
        let timeoutId: NodeJS.Timeout | null = null;

        // Set 180s timeout for entire download+extract operation
        timeoutId = setTimeout(() => {
          console.error(`[GitHub] Worker timeout after 180s - terminating`);
          worker.terminate().then(() => reject(new Error('Worker timeout: Download or extraction exceeded 180s')));
        }, 180_000);

        worker.on('message', async (message) => {
          try {
            clearTimeout(timeoutId); // Reset timeout on each message
            switch (message.type) {
              case 'progress':
                console.log(`[GitHub] ${message.message}`, message);
                break;

              case 'file-batch': {
                const { files, progress: prog } = message;

                // Ingest each file in the batch
                for (const file of files) {
                  try {
                    // Skip binary files - they produce noise when text-scraped
                    const ext = path.extname(file.relativePath).toLowerCase();
                    if (!this.isTextFile(ext)) {
                      filesSkipped++;
                      continue;
                    }

                    const atomizeResult = await this.atomizer.atomize(
                      file.content,
                      file.sourcePath,
                      'external',
                    );

                    if (!atomizeResult) continue;

                    const { compound, molecules, atoms } = atomizeResult;
                    await this.atomicIngest.ingestResult(compound, molecules, atoms, [repo.bucket]);

                    // Track in sources table (Standard 115)
                    const fileHash = crypto.createHash('md5').update(file.content).digest('hex');
                    await db.run(
                      `INSERT INTO sources (path, hash, total_atoms, last_ingest)
                       VALUES ($1, $2, $3, $4)
                       ON CONFLICT (path) DO UPDATE SET
                         hash = EXCLUDED.hash,
                         total_atoms = EXCLUDED.total_atoms,
                         last_ingest = EXCLUDED.last_ingest`,
                      [file.sourcePath, fileHash, atoms.length, Date.now()],
                    );

                    filesIngested++;
                    totalAtoms += atoms.length;
                    totalMolecules += molecules.length;
                    totalSize += file.size;
                  } catch (err: any) {
                    console.warn(`[GitHub] Failed to ingest ${file.relativePath}: ${err.message}`);
                  }
                }

                if (prog && prog.current % 25 === 0) {
                  console.log(`[GitHub] Progress: ${prog.current}/${prog.total} files (${filesSkipped} skipped, ${filesIngested} ingested)`);
                }
                break;
              }

              case 'complete':
                filesIngested = message.filesIngested || filesIngested;
                filesSkipped = message.filesSkipped || 0;
                totalSize = message.totalSize || totalSize;
                clearTimeout(timeoutId); // Clear timeout on successful completion
                break;

              case 'error':
                syncError = new Error(`Worker error: ${message.message}`);
                clearTimeout(timeoutId); // Clear timeout on error
                break;
            }
          } catch (err: any) {
            syncError = err;
            clearTimeout(timeoutId); // Clear timeout on message handler error
          }
        });

        worker.on('error', (err) => { 
          console.error('[GitHub] Worker error event:', err);
          syncError = err as Error;
          if (timeoutId) clearTimeout(timeoutId);
        });
        worker.on('exit', (code) => {
          if (code !== 0) {
            syncError = syncError || new Error(`Worker exited with code ${code}`);
          }
          if (syncError) reject(syncError);
          else resolve();
        });
      });

      await workerPromise;

      // Cleanup worker
      await worker.terminate();

      // Quarantine old atoms from this repo (Standard 115, Section 4.5)
      await this.quarantineOldAtoms(repoId);

      console.log(`[GitHub] âœ… Ingestion complete: ${filesIngested} files, ${filesSkipped} skipped, ${totalAtoms} atoms, ${totalMolecules} molecules`);

      // Run code analysis if explicitly requested (heavy operation â€” disabled by default)
      let analysisSummary: SyncResult['analysis'] = undefined;
      if (options?.runAnalysis === true && process.env.ENABLE_CODE_ANALYSIS === 'true') {
        console.log('[GitHub] Running code analysis (ENABLE_CODE_ANALYSIS=true)...');
        // Analysis skipped â€” would need separate worker for full isolation
      }

      // Update repo record
      await db.run(
        `UPDATE github_repos SET
          last_synced_at = CURRENT_TIMESTAMP,
          last_sync_status = 'success',
          total_files = $1,
          total_atoms = $2,
          total_size_bytes = $3,
          updated_at = CURRENT_TIMESTAMP
         WHERE id = $4`,
        [filesIngested, totalAtoms, totalSize, repoId],
      );

      const duration = Date.now() - startTime;
      console.log(`[GitHub] Sync complete: ${filesIngested} files, ${totalAtoms} atoms in ${(duration / 1000).toFixed(1)}s`);

      return {
        files_ingested: filesIngested,
        atoms_created: totalAtoms,
        molecules_created: totalMolecules,
        total_size_bytes: totalSize,
        duration_ms: duration,
        analysis: analysisSummary,
      };
    } catch (error: any) {
      // Update status to failed
      await db.run(
        'UPDATE github_repos SET last_sync_status = \'failed\', last_error = $1 WHERE id = $2',
        [error.message, repoId],
      );

      throw error;
    }
  }

  /**
   * Quarantine old atoms from a repository
   */
  private async quarantineOldAtoms(repoId: string): Promise<void> {
    const result = await db.run(
      'SELECT owner, repo FROM github_repos WHERE id = $1',
      [repoId],
    );

    if (!result.rows || result.rows.length === 0) return;

    const { owner, repo } = result.rows[0];
    const sourcePrefix = `github:${owner}/${repo}/`;

    console.log(`[GitHub] Quarantining old atoms with source_path LIKE '${sourcePrefix}%'`);

    // Add #quarantined tag to old atoms
    await db.run(
      `UPDATE atoms SET
        tags = array_cat(COALESCE(tags, '{}'), ARRAY['#quarantined']),
        provenance = 'quarantine'
       WHERE source_path LIKE $1`,
      [`${sourcePrefix}%`],
    );
  }

  /**
   * Quarantine old analysis results from a repository
   */
  private async quarantineOldAnalysis(repoId: string): Promise<void> {
    const result = await db.run(
      'SELECT owner, repo FROM github_repos WHERE id = $1',
      [repoId],
    );

    if (!result.rows || result.rows.length === 0) return;

    const { owner, repo } = result.rows[0];
    const analysisSourcePath = `github:${owner}/${repo}/analysis.tsonl`;

    console.log(`[GitHub] Quarantining old analysis results: ${analysisSourcePath}`);

    // Add #quarantined tag to old analysis atoms
    await db.run(
      `UPDATE atoms SET
        tags = array_cat(COALESCE(tags, '{}'), ARRAY['#quarantined']),
        provenance = 'quarantine'
       WHERE source_path = $1`,
      [analysisSourcePath],
    );
  }

  /**
   * List all registered GitHub repositories
   */
  async listRepos(): Promise<GitHubRepoRecord[]> {
    const result = await db.run(
      'SELECT * FROM github_repos ORDER BY created_at DESC',
    );

    return result.rows || [];
  }

  /**
   * Remove a repository from the registry
   */
  async removeRepo(repoId: string): Promise<number> {
    // First, quarantine all atoms from this repo
    const result = await db.run(
      'SELECT owner, repo FROM github_repos WHERE id = $1',
      [repoId],
    );

    let quarantinedCount = 0;
    if (result.rows && result.rows.length > 0) {
      const { owner, repo } = result.rows[0];
      const sourcePrefix = `github:${owner}/${repo}/`;

      const updateResult = await db.run(
        `UPDATE atoms SET
          tags = array_cat(COALESCE(tags, '{}'), ARRAY['#quarantined']),
          provenance = 'quarantine'
         WHERE source_path LIKE $1`,
        [`${sourcePrefix}%`],
      );

      quarantinedCount = updateResult.rowCount || 0;
    }

    // Delete repo record
    await db.run(
      'DELETE FROM github_repos WHERE id = $1',
      [repoId],
    );

    return quarantinedCount;
  }

  /**
   * Fetch full commit history from GitHub API and ingest as searchable molecules.
   * Each commit becomes its own paragraph: sha, author, date, message, files changed.
   * The entire history is ingested as one compound: github:{owner}/{repo}/commit-history.md
   */
  async ingestGitHistory(
    owner: string,
    repo: string,
    branch: string,
    bucket: string,
    token?: string,
  ): Promise<number> {
    const headers: Record<string, string> = {
      'Accept': 'application/vnd.github.v3.tson',
      'User-Agent': 'anchor-engine-node',
    };
    if (token) headers.Authorization = `token ${token}`;

    const commits: string[] = [];
    let page = 1;
    const PER_PAGE = 100;

    // Validate owner/repo/branch to prevent SSRF (#37)
    const isValidIdentifier = /^[a-zA-Z0-9_.-]{1,100}$/;
    if (!isValidIdentifier.test(owner) || !isValidIdentifier.test(repo) || !isValidIdentifier.test(branch)) {
      throw new Error(`Invalid owner, repo, or branch format`);
    }

    console.log(`[GitHub] Fetching commit history for ${owner}/${repo} (branch: ${branch})`);

    while (true) {
      const url = `https://api.github.com/repos/${owner}/${repo}/commits?sha=${branch}&per_page=${PER_PAGE}&page=${page}`;
      const res = await fetch(url, { headers });

      if (!res.ok) {
        console.warn(`[GitHub] Commits API error ${res.status} on page ${page} â€” stopping`);
        break;
      }

      const data = await res.json() as any[];
      if (!Array.isArray(data) || data.length === 0) break;

      for (const c of data) {
        const sha = (c.sha || '').slice(0, 12);
        const author = c.commit?.author?.name || c.author?.login || 'unknown';
        const date = c.commit?.author?.date || '';
        const message = (c.commit?.message || '').trim();
        const filesLine = Array.isArray(c.files)
          ? c.files.map((f: any) => `  ${f.status[0].toUpperCase()} ${f.filename} (+${f.additions} -${f.deletions})`).join('\n')
          : '';

        commits.push(
          `## ${sha} â€” ${date}\nAuthor: ${author}\n\n${message}${filesLine ? '\n\nFiles:\n' + filesLine : ''}`,
        );
      }

      console.log(`[GitHub] Fetched page ${page} (${data.length} commits, total so far: ${commits.length})`);

      // Check Link header for next page
      const linkHeader = res.headers.get('link') || '';
      if (!linkHeader.includes('rel="next"')) break;
      page++;

      // Yield to event loop between pages
      await new Promise(resolve => setImmediate(resolve));
    }

    if (commits.length === 0) {
      console.log(`[GitHub] No commits found for ${owner}/${repo}`);
      return 0;
    }

    const historyContent = `# Git History: ${owner}/${repo} (${branch})\n\nTotal commits: ${commits.length}\n\n---\n\n${commits.join('\n\n---\n\n')}`;
    const sourcePath = `github:${owner}/${repo}/commit-history.md`;

    console.log(`[GitHub] Ingesting ${commits.length} commits as ${sourcePath}`);

    const atomizeResult = await this.atomizer.atomize(historyContent, sourcePath, 'external');
    if (atomizeResult) {
      const { compound, molecules, atoms } = atomizeResult;
      await this.atomicIngest.ingestResult(compound, molecules, atoms, [bucket, 'git-history']);
    }

    return commits.length;
  }


  /**
   * Clone and ingest a repository in one operation (static convenience method)
   * This is the primary API endpoint handler
   * @param owner Repository owner
   * @param repo Repository name
   * @param branch Branch to clone
   * @param bucket Bucket to ingest to
   * @param options Additional options including runAnalysis flag
   */
  static async cloneAndIngest(
    owner: string,
    repo: string,
    branch: string,
    bucket: string,
    options?: { runAnalysis?: boolean; token?: string },
  ): Promise<SyncResult> {
    console.log(`[GitHub] ðŸ”„ Cloning and ingesting ${owner}/${repo} (branch: ${branch}, bucket: ${bucket})`);
    
    const service = new GitHubIngestService();
    
    // Validate inputs (SSRF prevention - Standard 115, Section 3.1)
    const isValidIdentifier = /^[a-zA-Z0-9_.-]{1,100}$/;
    if (!isValidIdentifier.test(owner) || !isValidIdentifier.test(repo) || !isValidIdentifier.test(branch)) {
      throw new Error(`Invalid owner, repo, or branch format: owner=${owner}, repo=${repo}, branch=${branch}`);
    }
    
    try {
      // 1. Register repository in database
      console.log(`[GitHub] ðŸ—„ï¸ Registering in database...`);
      const repoRecord = await service.registerRepo(`https://github.com/${owner}/${repo}`, bucket);
      
      // 2. Sync and ingest files (downloads, extracts via worker thread for isolation)
      console.log(`[GitHub] ðŸ½ï¸ Ingesting files (worker-isolated)...`);
      const result = await service.syncRepo(repoRecord.id, {
        runAnalysis: options?.runAnalysis,
        token: options?.token,
      });
      
      console.log(`[GitHub] âœ… Complete: ${result.files_ingested} files, ${result.atoms_created} atoms`);
      return result;
    } catch (error: any) {
      console.error(`[GitHub] âŒ Clone & ingest failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Cleanup temporary files and worker
   */
  async cleanupWorker(tarballPath: string, extractDir: string): Promise<void> {
    if (tarballPath && fs.existsSync(tarballPath)) {
      fs.unlinkSync(tarballPath);
      console.log(`[GitHub] Cleaned up tarball: ${tarballPath}`);
    }
    if (extractDir && fs.existsSync(extractDir)) {
      fs.rmSync(extractDir, { recursive: true, force: true });
      console.log(`[GitHub] Cleaned up extract directory: ${extractDir}`);
    }
  }

  async getRateLimitStatus(): Promise<{
    limit: number;
    remaining: number;
    reset_at: string;
    authenticated: boolean;
  }> {
    const token = process.env.GITHUB_TOKEN || config.GITHUB_TOKEN;
    const url = token
      ? 'https://api.github.com/rate_limit'
      : 'https://api.github.com/rate_limit';

    try {
      const headers: Record<string, string> = {
        'Accept': 'application/vnd.github.v3.tson',
        'User-Agent': 'anchor-engine-node',
      };

      if (token) {
        headers.Authorization = `token ${token}`;
      }

      const response = await gotScraping(url, { headers });
      const data = JSON.parse(response.body);

      const { core } = data.resources;

      return {
        limit: core.limit,
        remaining: core.remaining,
        reset_at: new Date(core.reset * 1000).toISOString(),
        authenticated: !!token,
      };
    } catch (error: any) {
      console.error(`[GitHub] Failed to get rate limit: ${error.message}`);
      
      // Return conservative defaults
      return {
        limit: 60,
        remaining: 0,
        reset_at: new Date(Date.now() + 3600000).toISOString(),
        authenticated: false,
      };
    }
  }
}

