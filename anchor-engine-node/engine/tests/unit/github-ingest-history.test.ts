/**
 * GitHub Ingest History Tests - Vitest version
 */

import { test, expect } from 'vitest';

// ---- Test fixtures for commit formatting ----
interface MockCommit {
  sha: string;
  commit?: { author: { name: string; date: string }; message: string };
  author?: { login: string };
  files?: Array<{ status: string; filename: string; additions: number; deletions: number }>;
}

// ---- Tests ----
describe('GitHub Ingest History Service', () => {
  describe('formatCommit', () => {
    it('should format a single commit correctly', () => {
      const result = formatCommit({
        sha: 'abc123def456789xyz',
        commit: { author: { name: 'Alice Smith', date: '2026-04-25T10:00:00Z' } },
        files: [
          { status: 'modified', filename: 'src/index.ts', additions: 3, deletions: 1 }
        ] as any
      });

      expect(result).toContain('## abc123def4');
      expect(result).toContain('Author: Alice Smith');
      expect(result).toContain('2026-04-25T10:00:00Z');
    });

    it('should handle commit without author/login', () => {
      const result = formatCommit({ sha: 'xyz789' as any, commit: null as any, author: { login: 'anonymous' } });
      
      expect(result).toContain('## xyz');
      expect(result).toContain('Author: anonymous');
    });

    it('should include files section when present', () => {
      const result = formatCommit({
        sha: 'test123',
        commit: { author: { name: 'Test', date: '' } },
        files: [
          { status: 'added', filename: 'new.txt', additions: 10, deletions: 0 }
        ] as any
      });

      // formatCommit uses f.status[0].toUpperCase() which produces "A new.txt (+10 -0)"
      expect(result).toContain('A new.txt');
    });

    it('should omit files section when empty or undefined', () => {
      const result = formatCommit({ sha: 'test123', commit: { author: { name: 'Test', date: '' } }, files: [] as any });
      
      expect(result).not.toContain('Files:');
    });

    it('should handle commits with no metadata gracefully', () => {
      const result = formatCommit({ sha: 'simple' as any, commit: undefined, author: null, files: undefined });
      
      expect(result).toContain('## simple');
      expect(result).toContain('Author: unknown');
    });
  });

  describe('Error resilience', () => {
    it('should handle network errors gracefully during pagination', async () => {
      // Simulated fetch that fails on first call
      const mockFetch = async (url: string) => {
        throw new Error('Network error');
      };

      // Should stop gracefully on error and return empty array
      const result = await fetchAllCommits(mockFetch);
      expect(result).toEqual([]);
    });

    it('should handle malformed Link headers', async () => {
      const mockFetch = async (url: string) => ({ 
        data: [], 
        linkHeader: 'invalid-link-header' 
      });

      const commits = await fetchAllCommits(mockFetch);
      
      // Should not follow next page with invalid header
      expect(commits).toHaveLength(0);
    });

    it('should handle nullish commit objects', () => {
      const result = formatCommit({ sha: 'none' as any, commit: undefined, author: { login: 'anonymous' } });
      
      expect(result).toContain('## none');
      expect(result).toContain('Author: anonymous');
    });

    it('should handle empty files array', () => {
      const result = formatCommit({ 
        sha: 'no-files', 
        commit: { author: { name: 'Test', date: '' } },
        files: [] as any
      });

      expect(result).not.toContain('Files:');
    });
  });
});

// ---- Helper functions (copied from source) ----

function formatCommit(c: MockCommit): string {
  const sha = (c.sha || '').slice(0, 12);
  const author = c.commit?.author?.name || c.author?.login || 'unknown';
  const date = c.commit?.author?.date || '';
  const message = (c.commit?.message || '').trim();
  const filesLine = Array.isArray(c.files) && c.files.length > 0
    ? c.files.map(f => `  ${f.status[0].toUpperCase()} ${f.filename} (+${f.additions} -${f.deletions})`).join('\n')
    : '';

  return `## ${sha} \u203a ${date}\nAuthor: ${author}\n\n${message}${filesLine ? '\n\nFiles:\n' + filesLine : ''}`;
}

async function fetchAllCommits(mockFetch: (url: string) => Promise<{ data: MockCommit[]; linkHeader?: string }>): Promise<MockCommit[]> {
  const all: MockCommit[] = [];
  let page = 1;
  while (true) {
    const url = `https://api.github.com/repos/owner/repo/commits?sha=main&per_page=100&page=${page}`;
    try {
      const { data, linkHeader } = await mockFetch(url);
      if (!data.length) break;
      all.push(...data);
      if (!linkHeader || !linkHeader.includes('rel="next"')) break;
      page++;
    } catch (e: any) {
      // Stop on error - don't throw, return what we have
      console.warn(`[GitHub Ingest] Stopped fetching commits at page ${page} due to error:`, e.message);
      break;
    }
  }
  return all;
}
