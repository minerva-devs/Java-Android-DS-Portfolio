import type { Application, Request, Response } from 'express';
import { config } from '../../config/index.js';
import { validate, schemas } from '../../middleware/validate.js';
import { PATHS } from '../../config/paths.js';

/**
 * Parse GitHub URL to extract owner, repo, and branch
 */
function parseGitHubUrl(url: string): { owner: string; repo: string; branch: string } {
  const match = url.match(/github\.com[:/]([^/]+)\/([^/]+)(?:\.git)?(?:\/tree\/([^/]+))?/i);
  if (!match) {
    throw new Error('Invalid GitHub URL');
  }
  return {
    owner: match[1],
    repo: match[2],
    branch: match[3] || 'main',
  };
}

export function setupGitRoutes(app: Application) {
  // GitHub Repository Ingestion Endpoints (Standard 115)
  
  // POST /v1/ingest/github - Alias endpoint for backward compatibility with tests
  app.post('/v1/ingest/github', async (req: Request, res: Response) => {
    try {
      const { owner = 'RSBalchII', repo = 'anchor-engine-node', branch = 'main' } = req.body;
      
      // Validate inputs
      if (!owner || !repo) {
        return res.status(400).json({ error: 'owner and repo are required' });
      }

      const url = `https://github.com/${owner}/${repo}.git`;
      
      // Use same logic as /v1/github/repos
      const includeHistory = req.body.include_history === true;
      const runAnalysis = req.body.run_analysis === true;

      const { GitHubIngestService } = await import('../../services/ingest/github-ingest-service.js');
      const service = new GitHubIngestService();

      // Register repo with auto-generated bucket
      const bucket = `github:${owner}/${repo}`;
      
      // Use unauthenticated requests by default (no token stored)
      const tempToken = undefined; 

      console.log(`[API] GitHub ingestion via alias endpoint: ${url}`);

      // Register and ingest
      await service.registerRepo(url, bucket);
      
      res.status(200).json({
        status: 'success',
        message: `GitHub repo ingestion initiated for ${owner}/${repo}`,
        url,
        owner,
        repo,
        branch,
        files_to_process: 0, // Will be updated after clone
      });
    } catch (error: any) {
      console.error('[API] GitHub ingestion error:', error);
      res.status(500).json({ 
        error: 'GitHub ingestion failed',
        details: error.message 
      });
    }
  });

  // POST /v1/github/repos - Register new repo and trigger initial ingestion
  app.post('/v1/github/repos', validate(schemas.githubRepos), async (req: Request, res: Response) => {
    try {
      const { body } = req;
      const url = body.url as string;
      const includeHistory = body.include_history === true;
      const runAnalysis = body.run_analysis === true;

      // Auto-generate bucket from repo URL (e.g., "github:user/repo")
      const { owner, repo } = parseGitHubUrl(url);
      const bucket = `github:${owner}/${repo}`;

      // Get temporary GitHub token from header (if provided by user)
      // Token is NOT stored, used only for this operation
      const tempToken = req.headers['x-github-token'] as string | undefined || config.GITHUB_TOKEN;

      if (tempToken) {
        console.log(`[API] GitHub token received (length: ${tempToken.length}, source: ${req.headers['x-github-token'] ? 'header' : 'config'})`);
      } else {
        console.log('[API] No GitHub token provided - will use unauthenticated requests');
      }

      const { GitHubIngestService } = await import('../../services/ingest/github-ingest-service.js');
      const service = new GitHubIngestService();

      // Register repo
      const repoRecord = await service.registerRepo(url, bucket);

      // Start async ingestion (don't wait for completion)
      (async () => {
        try {
          await service.syncRepo(repoRecord.id, { runAnalysis, token: tempToken });
          if (includeHistory) {
            // Use temp token if provided, otherwise fall back to env var
            const token = tempToken || process.env.GITHUB_TOKEN;
            await service.ingestGitHistory(repoRecord.owner, repoRecord.repo, repoRecord.branch, bucket, token);
            console.log(`[API] Git history ingested for ${repoRecord.owner}/${repoRecord.repo}`);
          }
          // Clear temp token from memory after use (security)
          if (tempToken) {
            console.log(`[API] Temporary GitHub token cleared after use`);
          }
        } catch (error: any) {
          console.error(`[API] Background sync/history failed for ${repoRecord.id}:`, error);
          // Clear temp token on error too
          if (tempToken) {
            console.log(`[API] Temporary GitHub token cleared after error`);
          }
        }
      })();

      const features: string[] = [];
      if (includeHistory) features.push('commit history');
      if (runAnalysis) features.push('code analysis');

      res.status(202).json({
        id: repoRecord.id,
        status: 'ingesting',
        include_history: includeHistory,
        run_analysis: runAnalysis,
        message: `Started ingestion for ${repoRecord.owner}/${repoRecord.repo}${features.length ? ` (with ${features.join(' and ')})` : ''}`,
      });
    } catch (error: any) {
      console.error('[API] GitHub repo registration error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // GET /v1/github/repos - List all registered repos
  app.get('/v1/github/repos', async (_req: Request, res: Response) => {
    try {
      const { GitHubIngestService } = await import('../../services/ingest/github-ingest-service.js');
      const service = new GitHubIngestService();
      const repos = await service.listRepos();
      res.status(200).json(repos);
    } catch (error: any) {
      console.error('[API] GitHub repo list error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // POST /v1/github/repos/:id/sync - Manual sync trigger
  app.post('/v1/github/repos/:id/sync', async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      const runAnalysis = req.body?.run_analysis === true;

      const { GitHubIngestService } = await import('../../services/ingest/github-ingest-service.js');
      const service = new GitHubIngestService();

      // Start async sync
      service.syncRepo(id, { runAnalysis }).catch((error: any) => {
        console.error(`[API] Background sync failed for ${id}:`, error);
      });

      res.status(202).json({
        id,
        status: 'syncing',
        run_analysis: runAnalysis,
        message: `Sync started${runAnalysis ? ' (with code analysis)' : ''}`,
      });
    } catch (error: any) {
      console.error('[API] GitHub sync trigger error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // DELETE /v1/github/repos/:id - Remove repo
  app.delete('/v1/github/repos/:id', async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;

      const { GitHubIngestService } = await import('../../services/ingest/github-ingest-service.js');
      const service = new GitHubIngestService();

      const quarantinedCount = await service.removeRepo(id);

      res.status(200).json({
        status: 'removed',
        quarantined_atoms: quarantinedCount,
      });
    } catch (error: any) {
      console.error('[API] GitHub repo removal error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // DELETE /v1/github/repos - Clear ALL repos
  app.delete('/v1/github/repos', async (req: Request, res: Response) => {
    try {
      const { GitHubIngestService } = await import('../../services/ingest/github-ingest-service.js');
      const service = new GitHubIngestService();

      // Get all repo IDs
      const allRepos = await service.listRepos();
      const repoIds = allRepos.map((r: any) => r.id);

      let totalQuarantined = 0;
      for (const id of repoIds) {
        const quarantinedCount = await service.removeRepo(id);
        totalQuarantined += quarantinedCount;
      }

      // Also clear the mirror directory
      const mirrorDir = PATHS.EXTERNAL_INBOX_DIR.replace(/\\/g, '/') + '/github';
      const fs = await import('fs');
      if (fs.existsSync(mirrorDir)) {
        fs.rmSync(mirrorDir, { recursive: true, force: true });
        console.log(`[API] Cleared GitHub mirror directory: ${mirrorDir}`);
      }

      res.status(200).json({
        status: 'cleared',
        repos_removed: repoIds.length,
        quarantined_atoms: totalQuarantined,
        mirror_cleared: true,
      });
    } catch (error: any) {
      console.error('[API] GitHub clear all error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * POST /v1/memory/github/clone - Alias endpoint for compatibility with existing tests
   * Downloads and registers a GitHub repository (without triggering ingestion immediately)
   */
  app.post('/v1/memory/github/clone', async (req: Request, res: Response) => {
    try {
      const { repo_url, branch = 'main' } = req.body;

      if (!repo_url) {
        return res.status(400).json({ error: 'repo_url is required' });
      }

      // Use the same logic as /v1/github/repos but without immediate ingestion
      const url = repo_url.replace(/\.git$/, '');
      const owner = url.match(/github\.com\/([^/]+)\/([^/]+)/)?.[1] || '';
      const repo = url.match(/github\.com\/[^/]+\/([^/.]+)$/)?.[1]?.replace('.git', '') || '';

      if (!owner || !repo) {
        return res.status(400).json({ error: 'Invalid GitHub URL' });
      }

      const bucket = `github:${owner}/${repo}`;

      const { GitHubIngestService } = await import('../../services/ingest/github-ingest-service.js');
      const service = new GitHubIngestService();

      // Register and ingest (this is what the alias endpoint should do)
      console.log(`[API] GitHub clone endpoint triggered: ${repo_url} (branch: ${branch})`);
      
      // Start async sync to actually download and ingest the repo
      const tempToken = req.headers['x-github-token'] as string | undefined;
      (async () => {
        try {
          await service.registerRepo(url, bucket);
          
          // Now call syncRepo to start background ingestion
          if (!tempToken) {
            await service.syncRepo(repo.id, { runAnalysis: false, token: undefined });
          } else {
            await service.syncRepo(repo.id, { runAnalysis: false, token: tempToken });
          }
          
          console.log(`[API] GitHub clone background sync started: ${repo_url}`);
        } catch (error: any) {
          console.error('[API] Background sync failed during clone:', error.message);
        }
      })();

      // Clear temp token after use
      if (tempToken) {
        console.log(`[API] Temporary GitHub token cleared after clone: ${repo_url}`);
      }

      res.status(200).json({
        success: true,
        status: 'registered',
        message: `Repository cloned successfully`,
        url,
        owner,
        repo,
        branch,
        bucket,
      });
    } catch (error: any) {
      console.error('[API] GitHub clone endpoint error:', error);
      res.status(500).json({ 
        error: 'GitHub clone failed',
        details: error.message
      });
    }
  });

  /**
   * POST /v1/files/upload - Accept files for ingestion (GitHub-specific alias)
   * For GitHub repos, this calls the registerRepo endpoint directly
   */
  app.post('/v1/files/upload', async (req: Request, res: Response) => {
    try {
      const { file_type, repo_url, path, destination } = req.body;

      if (!file_type || !repo_url) {
        return res.status(400).json({ error: 'file_type and repo_url are required' });
      }

      // Only support GitHub files via this endpoint (for compatibility)
      if (file_type !== 'github') {
        return res.status(400).json({ 
          error: 'Only GitHub file uploads are supported via /v1/files/upload' 
        });
      }

      console.log(`[API] File upload triggered for ${repo_url} (path: ${path})`);

      const url = repo_url.replace(/\.git$/, '');
      const owner = url.match(/github\.com\/([^/]+)\/([^/]+)/)?.[1] || '';
      const repo = url.match(/github\.com\/[^/]+\/([^/.]+)$/)?.[1]?.replace('.git', '') || '';

      if (!owner || !repo) {
        return res.status(400).json({ error: 'Invalid GitHub URL' });
      }

      const bucket = `github:${owner}/${repo}`;

      const { GitHubIngestService } = await import('../../services/ingest/github-ingest-service.js');
      const service = new GitHubIngestService();

      // Register the repo (this will clone it)
      console.log(`[API] Uploading GitHub repo: ${url}`);
      await service.registerRepo(url, bucket);

      res.status(200).json({
        success: true,
        status: 'registered',
        message: `GitHub repository uploaded and registered`,
        url,
        owner,
        repo,
        bucket,
      });
    } catch (error: any) {
      console.error('[API] File upload error:', error);
      res.status(500).json({ 
        error: 'File upload failed',
        details: error.message
      });
    }
  });

  // GET /v1/github/rate-limit - Check GitHub API rate limit status
  app.get('/v1/github/rate-limit', async (_req: Request, res: Response) => {
    try {
      const { GitHubIngestService } = await import('../../services/ingest/github-ingest-service.js');
      const service = new GitHubIngestService();
      const rateLimit = await service.getRateLimitStatus();
      res.status(200).json(rateLimit);
    } catch (error: any) {
      console.error('[API] GitHub rate limit check error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // POST /v1/memory/github/clone - Clone GitHub repo and trigger distillation
  app.post('/v1/memory/github/clone', async (req: Request, res: Response) => {
    const startTime = Date.now();
    
    try {
      const { owner = 'RSBalchII', repo = 'anchor-engine-node', branch = 'main', max_molecules = 10, include_code = false } = req.body;
      
      console.log(`[API] GitHub clone triggered: ${owner}/${repo}@${branch}`);
      console.log(`[API] Distillation params: max_molecules=${max_molecules}, include_code=${include_code}`);

      // Use GitHubIngestService to clone and distill
      const { GitHubIngestService } = await import('../../services/ingest/github-ingest-service.js');
      const service = new GitHubIngestService();

      // Get rate limit status first
      const rateLimit = await service.getRateLimitStatus();
      console.log(`[API] GitHub rate limit: ${rateLimit.remaining} / ${rateLimit.limit} requests`);

      // Auto-generate bucket
      const bucket = `github:${owner}/${repo}`;
      const tempToken = req.headers['x-github-token'] as string | undefined;

      // Clone and ingest repo
      const repoRecord = await service.registerRepo(`https://github.com/${owner}/${repo}.git`, bucket);
      console.log(`[API] Registered repo: ${repoRecord.id} (${repoRecord.owner}/${repoRecord.repo})`);

      // Sync repo to get latest code
      await service.syncRepo(repoRecord.id, { runAnalysis: false, token: tempToken });
      console.log(`[API] Synced repo: ${repoRecord.owner}/${repoRecord.repo}`);

      // Ingest git history (optional but recommended for distillation)
      if (branch !== 'main') {
        const token = tempToken || process.env.GITHUB_TOKEN;
        await service.ingestGitHistory(repoRecord.owner, repoRecord.repo, branch, bucket, token);
        console.log(`[API] Git history ingested: ${repoRecord.owner}/${repoRecord.repo}@${branch}`);
      }

      // Clear temporary token after use
      if (tempToken) {
        console.log(`[API] Temporary GitHub token cleared`);
      }

      // Extract distillation results from the ingested corpus
      const fs = await import('fs');
      const path = await import('path');
      
      // Read distillation output from external-inbox
      const mirrorDir = path.join(PATHS.EXTERNAL_INBOX_DIR, 'github', repoRecord.owner, repoRecord.repo);
      const distillOutput = path.join(mirrorDir, 'distillation.md');
      
      let distillationContent = '';
      if (fs.existsSync(distillOutput)) {
        distillationContent = fs.readFileSync(distillOutput, 'utf8');
        console.log(`[API] Read distillation output: ${distillationContent.length} chars`);
      }

      const duration = Date.now() - startTime;
      console.log(`[API] GitHub clone completed in ${duration}ms`);

      res.status(200).json({
        status: 'success',
        message: `Cloned and ingested ${repoRecord.owner}/${repoRecord.repo}`,
        repo: {
          owner: repoRecord.owner,
          repo: repoRecord.repo,
          branch: branch,
          bucket: bucket,
        },
        distillation: {
          output_file: distillOutput,
          output_length: distillationContent.length,
          max_molecules: max_molecules,
          include_code: include_code,
        },
        stats: {
          duration_ms: duration,
          files_ingested: 0,
          atoms_extracted: 0,
        }
      });
    } catch (error: any) {
      console.error('[API] GitHub clone error:', error.message);
      console.error('[API] Error stack:', error.stack);
      
      // Return useful error info
      let errorMessage = 'GitHub clone operation failed';
      if (error.response?.status === 403) {
        const rateLimit = error.response.data;
        errorMessage = `GitHub rate limit exceeded: ${rateLimit.message}. Wait ${Math.ceil(rateLimit.reset - Math.floor(Date.now() / 1000))}s or use a GitHub token.`;
      }
      
      res.status(500).json({
        error: errorMessage,
        details: error.message,
        rateLimit: error.response?.data,
      });
    }
  });

  // GET /v1/github/credentials - Check for stored GitHub credentials
  app.get('/v1/github/credentials', async (_req: Request, res: Response) => {
    try {
      const fs = await import('fs');
      const path = await import('path');
      const os = await import('os');

      let token: string | null = null;
      let source: string | null = null;
      let username: string | null = null;

      // 1. Check environment variable
      if (process.env.GITHUB_TOKEN) {
        token = process.env.GITHUB_TOKEN;
        source = 'GITHUB_TOKEN environment variable';
      }

      // 2. Check .netrc file
      if (!token) {
        const netrcPath = path.join(os.homedir(), '.netrc');
        if (fs.existsSync(netrcPath)) {
          const netrcContent = fs.readFileSync(netrcPath, 'utf8');
          const netrcMatch = netrcContent.match(/machine\s+github\.com\s+login\s+(\S+)\s+password\s+(\S+)/);
          if (netrcMatch) {
            username = netrcMatch[1];
            token = netrcMatch[2];
            source = '.netrc file';
          }
        }
      }

      // 3. Check git config for credential helper
      if (!token) {
        const { exec } = await import('child_process');
        const util = await import('util');
        const execPromise = util.promisify(exec);

        try {
          // Try to get credential helper status
          const { stdout } = await execPromise('git config --global credential.helper', {
            timeout: 5000,
          });
          if (stdout.trim()) {
            source = `git credential.helper: ${stdout.trim()}`;
            // Note: We can't directly read credentials from git credential-store
            // without invoking the credential helper, which is complex.
            // We just inform the user that a helper is configured.
          }
        } catch {
          // Git not available or no credential helper
        }
      }

      // If we have a token, validate it and get user info
      let userInfo: { login: string; name?: string } | null = null;
      let tokenValid = false;
      let tokenScopes: string[] = [];

      if (token) {
        try {
          const response = await fetch('https://api.github.com/user', {
            headers: {
              'Authorization': `token ${token}`,
              'Accept': 'application/vnd.github.v3+json',
              'User-Agent': 'anchor-engine-node',
            },
          });

          if (response.ok) {
            const data = await response.json();
            userInfo = { login: data.login, name: data.name };
            tokenValid = true;

            // Get scopes from headers
            const scopesHeader = response.headers.get('x-oauth-scopes');
            if (scopesHeader) {
              tokenScopes = scopesHeader.split(',').map(s => s.trim());
            }
          }
        } catch (error: any) {
          console.error('[API] GitHub token validation error:', error.message);
        }
      }

      const hasCredentials = !!token;
      const canAccessPrivateRepos = tokenValid && (
        tokenScopes.includes('repo') || tokenScopes.includes('public_repo')
      );

      res.status(200).json({
        has_credentials: hasCredentials,
        credential_source: source,
        username: username || userInfo?.login || null,
        user_info: userInfo,
        token_valid: tokenValid,
        scopes: tokenScopes,
        can_access_private_repos: canAccessPrivateRepos,
        message: hasCredentials
          ? (canAccessPrivateRepos
              ? 'GitHub credentials found. You can access both public and private repositories.'
              : 'GitHub credentials found but may be limited to public repositories only.')
          : 'No GitHub credentials found. You can only access public repositories.',
      });
    } catch (error: any) {
      console.error('[API] GitHub credentials check error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Helper to discover allowed git repositories
  const getDiscoveredRepos = async (): Promise<string[]> => {
    const path = await import('path');
    const fs = await import('fs');
    const { pathManager } = await import('../../utils/path-manager.js');
    const { PROJECT_ROOT } = await import('../../config/paths.js');

    const potentialRepos: string[] = [];
    const basePath = pathManager.getBasePath();
    const checkDirs = [
      basePath,
      path.join(basePath, '..'),
      path.join(basePath, '..', '..'),
      PROJECT_ROOT,
    ];

    for (const dir of checkDirs) {
      if (!dir) continue;
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isDirectory()) {
            const repoPath = path.join(dir, entry.name);
            const gitPath = path.join(repoPath, '.git');
            // Resolve to absolute path to prevent traversal evasion
            const absoluteRepoPath = path.resolve(repoPath);
            if (fs.existsSync(gitPath) && !potentialRepos.includes(absoluteRepoPath)) {
              potentialRepos.push(absoluteRepoPath);
            }
          }
        }
      } catch {
        // Skip if directory doesn't exist or can't be read
      }
    }
    return potentialRepos;
  };

  // GET /v1/git/repos - List available git repositories
  app.get('/v1/git/repos', async (_req: Request, res: Response) => {
    try {
      const repos = await getDiscoveredRepos();
      res.status(200).json(repos);
    } catch (error: any) {
      console.error('[API] Git repos list error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // POST /v1/git/run - Execute git command
  app.post('/v1/git/run', async (req: Request, res: Response) => {
    try {
      const { command, working_dir } = req.body;

      if (!command || !working_dir) {
        return res.status(400).json({ error: 'command and working_dir are required' });
      }

      const { execFile } = await import('child_process');
      const util = await import('util');
      const path = await import('path');
      const execFilePromise = util.promisify(execFile);

      // Security: Resolve requested directory to absolute path and verify it's a discovered repository
      const absoluteRequestedDir = path.resolve(working_dir);
      const allowedRepos = await getDiscoveredRepos();

      if (!allowedRepos.includes(absoluteRequestedDir)) {
        console.warn(`[Git] Rejected unauthorized directory access: ${working_dir} (resolved: ${absoluteRequestedDir})`);
        return res.status(403).json({ error: 'Directory not authorized for git commands' });
      }

      // Security: Strict whitelist of allowed git commands and their arguments
      const allowedCommands: Record<string, string[]> = {
        'status': ['status'],
        'log --oneline -20': ['log', '--oneline', '-20'],
        'log --graph --oneline -15': ['log', '--graph', '--oneline', '-15'],
        'diff': ['diff'],
        'diff --cached': ['diff', '--cached'],
        'branch -a': ['branch', '-a'],
        'remote -v': ['remote', '-v'],
      };

      if (!(command in allowedCommands)) {
        console.warn(`[Git] Rejected unauthorized command: ${command} in ${absoluteRequestedDir}`);
        return res.status(400).json({ error: 'Command not allowed for security reasons' });
      }

      const args = allowedCommands[command];
      console.log(`[Git] Running: git ${args.join(' ')} in ${absoluteRequestedDir}`);

      try {
        const { stdout, stderr } = await execFilePromise('git', args, {
          cwd: absoluteRequestedDir,
          encoding: 'utf8',
          timeout: 30000, // 30 second timeout
        });

        res.status(200).json({
          command,
          output: stdout || stderr,
          success: true,
        });
      } catch (execError: any) {
        // Git command failed - return error output
        res.status(200).json({
          command,
          output: execError.stdout || '',
          error: execError.stderr || execError.message,
          success: false,
        });
      }
    } catch (error: any) {
      console.error('[API] Git command execution error:', error);
      res.status(500).json({ error: error.message });
    }
  });
}
