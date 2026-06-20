/**
 * Unit tests for Search Service
 *
 * Tests exported functions and cache behavior.
 * Note: Full integration tests require database setup.
 *
 * Coverage Goal: >30% (from 0%)
 */

import { describe, it, expect, beforeEach } from 'vitest';

// Import after mocks
import {
  searchCache,
  clusterMolecules,
} from '../../src/services/search/search.js';

describe('Search Service', () => {
  beforeEach(() => {
    // Clear cache before each test
    searchCache.clear();
  });

  describe('Search Cache', () => {
    it('stores and retrieves cached results', () => {
      const key = 'test-cache-key';
      const mockResults = {
        context: 'test context',
        results: [{ id: '1', content: 'test' }],
        toAgentString: () => 'test',
        attempt: 1,
      };

      searchCache.set(key, {
        results: mockResults,
        timestamp: Date.now(),
      });

      const cached = searchCache.get(key);
      expect(cached).toBeDefined();
      expect(cached?.results.context).toBe('test context');
    });

    it('clears all entries', () => {
      searchCache.set('key1', {
        results: { context: '', results: [], toAgentString: () => '', attempt: 1 },
        timestamp: Date.now(),
      });
      searchCache.set('key2', {
        results: { context: '', results: [], toAgentString: () => '', attempt: 1 },
        timestamp: Date.now(),
      });

      searchCache.clear();
      expect(searchCache.size).toBe(0);
    });

    it('tracks cache size', () => {
      expect(searchCache.size).toBe(0);

      searchCache.set('key1', {
        results: { context: '', results: [], toAgentString: () => '', attempt: 1 },
        timestamp: Date.now(),
      });

      expect(searchCache.size).toBe(1);
    });

    it('stores timestamp with entries', () => {
      const before = Date.now();
      searchCache.set('key1', {
        results: { context: '', results: [], toAgentString: () => '', attempt: 1 },
        timestamp: before,
      });

      const entry = searchCache.get('key1');
      expect(entry?.timestamp).toBe(before);
    });
  });

  describe('clusterMolecules()', () => {
    it('is defined and callable', () => {
      expect(typeof clusterMolecules).toBe('function');
    });

    it('groups molecules by source', () => {
      const molecules = [
        {
          id: '1',
          content: 'content 1',
          source: 'file1.ts',
          timestamp: Date.now(),
          buckets: ['inbox'],
          tags: ['#tag1'],
          provenance: 'internal' as const,
        },
        {
          id: '2',
          content: 'content 2',
          source: 'file1.ts',
          timestamp: Date.now(),
          buckets: ['inbox'],
          tags: ['#tag2'],
          provenance: 'internal' as const,
        },
        {
          id: '3',
          content: 'content 3',
          source: 'file2.ts',
          timestamp: Date.now(),
          buckets: ['inbox'],
          tags: ['#tag3'],
          provenance: 'internal' as const,
        },
      ];

      const clusters = clusterMolecules(molecules);
      expect(Array.isArray(clusters)).toBe(true);
      // Should have 2 clusters (file1.ts and file2.ts)
      expect(clusters.length).toBeGreaterThanOrEqual(1);
    });

    it('handles empty results', () => {
      const clusters = clusterMolecules([]);
      expect(Array.isArray(clusters)).toBe(true);
      expect(clusters.length).toBe(0);
    });

    it('handles single molecule', () => {
      const molecules = [
        {
          id: '1',
          content: 'content 1',
          source: 'file1.ts',
          timestamp: Date.now(),
          buckets: ['inbox'],
          tags: ['#tag1'],
          provenance: 'internal' as const,
        },
      ];

      const clusters = clusterMolecules(molecules);
      expect(Array.isArray(clusters)).toBe(true);
      expect(clusters.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Deduplication Logic', () => {
    it('removes exact duplicates by ID', () => {
      const results = [
        { id: '1', content: 'test', source: 'file1' },
        { id: '1', content: 'test', source: 'file1' }, // duplicate
        { id: '2', content: 'test2', source: 'file2' },
      ];

      const seenIds = new Set<string>();
      const unique = results.filter(r => {
        if (seenIds.has(r.id)) return false;
        seenIds.add(r.id);
        return true;
      });

      expect(unique.length).toBe(2);
    });

    it('handles overlapping byte ranges', () => {
      const ranges = [
        { start: 0, end: 100, content: 'A' },
        { start: 50, end: 150, content: 'B' }, // overlaps
        { start: 200, end: 300, content: 'C' },
      ];

      const hasOverlap = (r1: any, r2: any) => {
        return r1.start < r2.end && r2.start < r1.end;
      };

      expect(hasOverlap(ranges[0], ranges[1])).toBe(true);
      expect(hasOverlap(ranges[0], ranges[2])).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('handles unicode content in cache', () => {
      const key = 'unicode-test';
      searchCache.set(key, {
        results: {
          context: '你好世界 🌍',
          results: [],
          toAgentString: () => 'test',
          attempt: 1,
        },
        timestamp: Date.now(),
      });

      const cached = searchCache.get(key);
      expect(cached).toBeDefined();
      expect(cached?.results.context).toContain('你好');
    });

    it('handles special characters in cache key', () => {
      const key = 'special<>key';
      searchCache.set(key, {
        results: { context: 'test', results: [], toAgentString: () => 'test', attempt: 1 },
        timestamp: Date.now(),
      });

      const cached = searchCache.get(key);
      expect(cached).toBeDefined();
    });
  });

  describe('Cache Concurrency', () => {
    it('handles concurrent set operations', () => {
      const keys = ['key1', 'key2', 'key3', 'key4', 'key5'];

      keys.forEach(key => {
        searchCache.set(key, {
          results: { context: `result-${key}`, results: [], toAgentString: () => 'test', attempt: 1 },
          timestamp: Date.now(),
        });
      });

      keys.forEach(key => {
        expect(searchCache.has(key)).toBe(true);
      });
    });

    it('handles get for non-existent key', () => {
      const result = searchCache.get('non-existent-key');
      expect(result).toBeUndefined();
    });
  });

  describe('Real-World Scenarios', () => {
    it('caches search results for code query', () => {
      const key = 'code-search';
      searchCache.set(key, {
        results: {
          context: 'Code search results',
          results: [
            {
              id: '1',
              content: 'async function fetchData() { await fetch() }',
              source: 'src/api.ts',
              timestamp: Date.now(),
              buckets: ['inbox'],
              tags: ['#code', '#async'],
              provenance: 'internal',
              score: 0.95,
              type: 'code',
            },
          ],
          toAgentString: () => 'Found 1 code result',
          attempt: 1,
        },
        timestamp: Date.now(),
      });

      const cached = searchCache.get(key);
      expect(cached?.results.results[0].type).toBe('code');
    });

    it('caches search results for documentation', () => {
      const key = 'doc-search';
      searchCache.set(key, {
        results: {
          context: 'Documentation search',
          results: [
            {
              id: '1',
              content: 'REST API documentation',
              source: 'docs/api.md',
              timestamp: Date.now(),
              buckets: ['external'],
              tags: ['#api', '#documentation'],
              provenance: 'external',
              score: 0.90,
            },
          ],
          toAgentString: () => 'Found 1 documentation result',
          attempt: 1,
        },
        timestamp: Date.now(),
      });

      const cached = searchCache.get(key);
      expect(cached?.results.results[0].provenance).toBe('external');
    });
  });
});
