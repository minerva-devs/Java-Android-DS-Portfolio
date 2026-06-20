import { describe, it, expect, beforeEach } from 'vitest';
import { logSearchResults, getLatestEntryForHash, clearAllLogsCache, listLogFiles } from '../../src/services/search/search-results-logger';
import fs from 'fs';
import path from 'path';

/** Load JSON content of the newest log file for a given hash. */
function loadNewestLog(hash: string): any {
  const files = listLogFiles();
  // Files are named like 20260518T222633_search.log, need to extract hash from filename
  const candidate = files.find(f => f.includes('_search_'));
  if (!candidate) return null;
  const fullPath = path.join(process.cwd(), '..', '..', '.anchor', 'logs', candidate);
  const content = fs.readFileSync(fullPath, 'utf-8');
  const lines = content.split('\n').filter(l => l.trim());
  for (const line of lines) {
    try {
      const entry = JSON.parse(line);
      if (entry.queryHash === hash) {
        return entry;
      }
    } catch {}
  }
  return null;
}

describe('Engine Version Liking', () => {
  const query = 'anchor engine test';
  beforeEach(() => {
    clearAllLogsCache();
    process.env.ANCHOR_SEARCH_LOG = '1'; // enable logging
  });

  it('should include engineVersion in log metadata', () => {
    const mockResults = [
      { id: 'atom_0', content: 'some content', source_path: '/src/file.ts', timestamp: Date.now(), score: 10, }
    ];
    const metadata = { strategy: 'simple', totalResults: 1 };

    // Set the engine version that the logger will pick up
    process.env.ENGINE_VERSION = '1.2.3';

    logSearchResults(query, mockResults, metadata);

    // Compute the same deterministic hash used by the logger
    const queryHash = (() => {
      const normalized = query.toLowerCase().trim();
      let h = 0;
      for (let i = 0; i < normalized.length; i++) {
        h = ((h << 5) - h + normalized.charCodeAt(i)) | 0;
      }
      return Math.abs(h).toString(16);
    })();

    const latestEntry = getLatestEntryForHash(queryHash);
    expect(latestEntry).not.toBeNull();
    if (latestEntry) {
      expect(latestEntry.metadata.engineVersion).toBe('1.2.3');
    }
  });
});
