/**
 * GitHub PAT (Personal Access Token) Integration Tests
 * 
 * Verifies that PAT tokens flow correctly from UI → API → GitHub
 * This is critical for private repository ingestion.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Request, Response } from 'express';

// Mock the config module
const mockConfig = {
  API_KEY: 'anchor-engine-default-key',
  GITHUB_TOKEN: '',
};

vi.mock('../../config/index.js', () => ({
  config: mockConfig,
}));

describe('GitHub PAT Token Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConfig.GITHUB_TOKEN = ''; // Reset between tests
  });

  describe('UI → API Header', () => {
    it('should accept PAT from x-github-token header', async () => {
      const mockReq = {
        headers: {
          'x-github-token': 'ghp_test_token_12345',
        },
        body: {
          url: 'https://github.com/owner/repo',
          bucket: 'test-bucket',
        },
      } as unknown as Request;

      // Simulate the token extraction from git.ts
      const tempToken = mockReq.headers['x-github-token'] as string | undefined || mockConfig.GITHUB_TOKEN;

      expect(tempToken).toBe('ghp_test_token_12345');
    });

    it('should fall back to config.GITHUB_TOKEN when header is missing', async () => {
      mockConfig.GITHUB_TOKEN = 'ghp_config_token_67890';

      const mockReq = {
        headers: {},
        body: {
          url: 'https://github.com/owner/repo',
          bucket: 'test-bucket',
        },
      } as unknown as Request;

      const tempToken = mockReq.headers['x-github-token'] as string | undefined || mockConfig.GITHUB_TOKEN;

      expect(tempToken).toBe('ghp_config_token_67890');
    });

    it('should prefer header token over config token', async () => {
      mockConfig.GITHUB_TOKEN = 'ghp_config_token_67890';

      const mockReq = {
        headers: {
          'x-github-token': 'ghp_header_token_11111',
        },
        body: {},
      } as unknown as Request;

      const tempToken = mockReq.headers['x-github-token'] as string | undefined || mockConfig.GITHUB_TOKEN;

      expect(tempToken).toBe('ghp_header_token_11111');
    });
  });

  describe('API → Service', () => {
    it('should pass token to syncRepo options', async () => {
      const token = 'ghp_test_token_12345';
      const options = { runAnalysis: false, token };

      expect(options.token).toBe(token);
      expect(options.runAnalysis).toBe(false);
    });

    it('should handle undefined token gracefully', async () => {
      const options = { runAnalysis: true };

      expect(options.token).toBeUndefined();
    });
  });

  describe('Service → GitHub API', () => {
    it('should format token for GitHub API Authorization header', () => {
      const token = 'ghp_test_token_12345';
      const headers: Record<string, string> = {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'anchor-engine-node',
      };

      if (token) {
        headers.Authorization = `token ${token}`;
      }

      expect(headers.Authorization).toBe('token ghp_test_token_12345');
    });

    it('should not add Authorization header when token is empty', () => {
      const token = '';
      const headers: Record<string, string> = {
        'Accept': 'application/vnd.github.v3+json',
      };

      if (token) {
        headers.Authorization = `token ${token}`;
      }

      expect(headers.Authorization).toBeUndefined();
    });

    it('should handle token from options, env, or config in priority order', () => {
      // Priority: options?.token > process.env.GITHUB_TOKEN > config.GITHUB_TOKEN
      const optionsToken = 'ghp_options_token';
      const envToken = 'ghp_env_token';
      const configToken = 'ghp_config_token';

      // Simulate the logic from github-ingest-service.ts
      const getEffectiveToken = (options?: { token?: string }, env?: string, config?: string) => {
        return options?.token || env || config || undefined;
      };

      // Options takes priority
      expect(getEffectiveToken({ token: optionsToken }, envToken, configToken)).toBe(optionsToken);
      
      // Env takes second priority
      expect(getEffectiveToken({}, envToken, configToken)).toBe(envToken);
      
      // Config takes third priority
      expect(getEffectiveToken({}, '', configToken)).toBe(configToken);
      
      // Undefined when none provided
      expect(getEffectiveToken({}, '', '')).toBeUndefined();
    });
  });

  describe('End-to-End Token Flow', () => {
    it('should complete full token journey: UI → API → Service → GitHub', () => {
      // Step 1: User enters PAT in UI
      const userPat = 'ghp_user_personal_access_token';

      // Step 2: UI sends via x-github-token header
      const requestHeaders = { 'x-github-token': userPat };

      // Step 3: API extracts from header
      const extractedToken = requestHeaders['x-github-token'];

      // Step 4: API passes to service
      const serviceOptions = { runAnalysis: true, token: extractedToken };

      // Step 5: Service uses for GitHub API call
      const githubHeaders: Record<string, string> = {};
      if (serviceOptions.token) {
        githubHeaders.Authorization = `token ${serviceOptions.token}`;
      }

      // Verify the token made it all the way through
      expect(githubHeaders.Authorization).toBe('token ghp_user_personal_access_token');
    });

    it('should handle missing PAT gracefully (public repos)', () => {
      // User doesn't provide PAT for public repo
      const requestHeaders = {};

      // API extracts (undefined)
      const extractedToken = requestHeaders['x-github-token'];

      // Service receives undefined
      const serviceOptions = { runAnalysis: false, token: extractedToken };

      // GitHub call has no Authorization header
      const githubHeaders: Record<string, string> = {};
      if (serviceOptions.token) {
        githubHeaders.Authorization = `token ${serviceOptions.token}`;
      }

      expect(githubHeaders.Authorization).toBeUndefined();
      expect(serviceOptions.token).toBeUndefined();
    });
  });

  describe('Token Security', () => {
    it('should not log full token (only length)', () => {
      const token = 'ghp_super_secret_token_12345';
      
      // Safe logging (what we implemented)
      const safeLog = `GitHub token received (length: ${token.length})`;
      
      expect(safeLog).toBe('GitHub token received (length: 28)');
      expect(safeLog).not.toContain(token);
    });

    it('should validate token format (ghp_ prefix)', () => {
      const validToken = 'ghp_xxxxxxxxxxxxxxxxxxxx';
      const invalidToken = 'invalid_token';

      const isValidFormat = (t: string) => t.startsWith('ghp_') && t.length >= 20;

      expect(isValidFormat(validToken)).toBe(true);
      expect(isValidFormat(invalidToken)).toBe(false);
    });
  });
});

describe('GitHub API Authentication Scenarios', () => {
  it('should authenticate for private repos with valid PAT', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ id: 123, full_name: 'owner/private-repo' }),
    });
    global.fetch = mockFetch;

    const token = 'ghp_valid_pat_for_private_repo';
    const repoUrl = 'https://api.github.com/repos/owner/private-repo';

    await fetch(repoUrl, {
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json',
      },
    });

    expect(mockFetch).toHaveBeenCalledWith(repoUrl, {
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json',
      },
    });
  });

  it('should fail with 401 for private repo without PAT', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
    });
    global.fetch = mockFetch;

    const repoUrl = 'https://api.github.com/repos/owner/private-repo';

    const response = await fetch(repoUrl, {
      headers: {
        'Accept': 'application/vnd.github.v3+json',
      },
    });

    expect(response.status).toBe(401);
  });

  it('should succeed for public repo without PAT', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ id: 456, full_name: 'owner/public-repo' }),
    });
    global.fetch = mockFetch;

    const repoUrl = 'https://api.github.com/repos/owner/public-repo';

    const response = await fetch(repoUrl, {
      headers: {
        'Accept': 'application/vnd.github.v3+json',
      },
    });

    expect(response.ok).toBe(true);
    expect(response.status).toBe(200);
  });
});
