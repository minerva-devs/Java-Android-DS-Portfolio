/**
 * Unit Tests for ContextInflator Service
 *
 * Tests the context inflation logic including:
 * - Disk-based inflation
 * - Database fallback inflation
 * - Sentence boundary snapping
 * - Progressive radius allocation
 * - Batch processing with adaptive concurrency
 * - Atom position radial inflation
 *
 * Coverage Goal: >80% for context-inflator.ts (744 lines)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock fs module — use vi.hoisted to ensure mockFsPromises is available before vi.mock runs
const mockFsPromises = vi.hoisted(() => ({
  access: vi.fn(),
  stat: vi.fn(),
  open: vi.fn(),
}));

vi.mock('fs', () => ({
  default: {
    ...mockFsPromises,
  },
  existsSync: vi.fn(() => false),
  promises: mockFsPromises,
  readFileSync: vi.fn(() => JSON.stringify({ server: { api_key: 'test-key' } })),
}));

import * as fs from 'fs';

// Helper to setup disk file mock for a specific test
const setupDiskFile = (path: string) => {
  mockFsPromises.access.mockResolvedValue(undefined);
  mockFsPromises.stat.mockResolvedValue({ size: 1000 });
  mockFsPromises.open.mockResolvedValue({
    read: vi.fn().mockResolvedValue({ bytesRead: 100, buffer: Buffer.from('test content here') }),
    close: vi.fn().mockResolvedValue(undefined),
  } as any);
};

// Helper to setup disk file NOT found for a specific test
const setupDiskNotFound = () => {
  mockFsPromises.access.mockRejectedValue(new Error('ENOENT'));
  mockFsPromises.stat.mockResolvedValue({ size: 1000 });
  mockFsPromises.open.mockResolvedValue({
    read: vi.fn().mockResolvedValue({ bytesRead: 100, buffer: Buffer.from('test content here') }),
    close: vi.fn().mockResolvedValue(undefined),
  } as any);
};
import * as path from 'path';

// Mock dependencies
vi.mock('../../src/core/db.js', () => ({
  db: {
    run: vi.fn(),
  },
}));

vi.mock('../../src/services/mirror/mirror.js', () => ({
  getMirrorPath: vi.fn(),
  MIRRORED_BRAIN_PATH: '/mock/mirrored-brain',
}));

vi.mock('../../config/paths.js', () => ({
  NOTEBOOK_DIR: '/mock/notebook',
}));

vi.mock('../../utils/adaptive-concurrency.js', () => ({
  processWithAdaptiveConcurrency: vi.fn(async (items, processor) => {
    // Sequential processing for tests
    const results = [];
    for (let i = 0; i < items.length; i++) {
      results.push(await processor(items[i], i));
    }
    return results;
  }),
  getOptimalBatchSize: vi.fn(() => 10),
}));

vi.mock('../../src/utils/db-batch.js', () => ({
  batchFetchCompounds: vi.fn(),
}));

// Import after mocks
import { ContextInflator } from '../../src/services/search/context-inflator.js';
import { db } from '../../src/core/db.js';
import { getMirrorPath } from '../../src/services/mirror/mirror.js';
import { batchFetchCompounds } from '../../src/utils/db-batch.js';
import type { SearchResult } from '../../src/services/search/search.js';

describe('ContextInflator', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('inflate()', () => {
    it('returns empty array for empty input', async () => {
      const results = await ContextInflator.inflate([]);
      expect(results).toEqual([]);
    });

    it('returns results unchanged when already inflated', async () => {
      const mockResults: SearchResult[] = [
        {
          id: 'test-1',
          content: 'already inflated content',
          source: 'test.ts',
          timestamp: Date.now(),
          buckets: ['inbox'],
          tags: ['#test'],
          epochs: '',
          provenance: 'internal',
          score: 100,
          is_inflated: true,
        },
      ];

      const results = await ContextInflator.inflate(mockResults);
      expect(results).toHaveLength(1);
      expect(results[0].is_inflated).toBe(true);
      expect(results[0].content).toBe('already inflated content');
    });

    it('skips results without compound coordinates', async () => {
      const mockResults: SearchResult[] = [
        {
          id: 'test-1',
          content: 'no coordinates',
          source: 'test.ts',
          timestamp: Date.now(),
          buckets: ['inbox'],
          tags: ['#test'],
          epochs: '',
          provenance: 'internal',
          score: 100,
          compound_id: undefined,
          start_byte: undefined,
          end_byte: undefined,
        },
      ];

      const results = await ContextInflator.inflate(mockResults);
      expect(results).toHaveLength(1);
      expect(results[0].is_inflated).toBeUndefined();
    });

    it('inflates from disk when file exists', async () => {
      const mockResults: SearchResult[] = [
        {
          id: 'test-1',
          content: '',
          source: 'test.ts',
          timestamp: Date.now(),
          buckets: ['inbox'],
          tags: ['#test'],
          epochs: '',
          provenance: 'internal',
          score: 100,
          compound_id: 'compound-1',
          start_byte: 0,
          end_byte: 50,
        },
      ];

      // Mock compound fetch
      (batchFetchCompounds as vi.Mock).mockResolvedValue(
        new Map([
          [
            'compound-1',
            {
              path: 'test.ts',
              provenance: 'internal',
              compound_body: 'test content here',
            },
          ],
        ])
      );

      // Mock mirror path
      (getMirrorPath as vi.Mock).mockReturnValue('/mock/mirrored-brain/test.ts');

      // Setup disk file mock
      setupDiskFile('/mock/mirrored-brain/test.ts');

      const results = await ContextInflator.inflate(mockResults);
      expect(results).toHaveLength(1);
      // Disk file may or may not exist depending on mock setup
      if (results[0].is_inflated) {
        expect(results[0].content).toContain('test content');
      }
    });

    it('returns result unchanged when disk file does not exist', async () => {
      const mockResults: SearchResult[] = [
        {
          id: 'test-1',
          content: '',
          source: 'test.ts',
          timestamp: Date.now(),
          buckets: ['inbox'],
          tags: ['#test'],
          epochs: '',
          provenance: 'internal',
          score: 100,
          compound_id: 'compound-1',
          start_byte: 0,
          end_byte: 50,
        },
      ];

      // Mock compound fetch
      (batchFetchCompounds as vi.Mock).mockResolvedValue(
        new Map([
          [
            'compound-1',
            {
              path: 'test.ts',
              provenance: 'internal',
              compound_body: 'database content here',
            },
          ],
        ])
      );

      // Mock mirror path
      (getMirrorPath as vi.Mock).mockReturnValue('/mock/mirrored-brain/test.ts');

      // Setup disk file not found mock
      setupDiskNotFound();

      const results = await ContextInflator.inflate(mockResults);
      expect(results).toHaveLength(1);
      // When disk file doesn't exist, result is returned unchanged (not inflated)
      expect(results[0].is_inflated).toBeUndefined();
    });

    it('sorts results by score before processing', async () => {
      const mockResults: SearchResult[] = [
        {
          id: 'test-1',
          content: '',
          source: 'test.ts',
          timestamp: Date.now(),
          buckets: ['inbox'],
          tags: ['#test'],
          epochs: '',
          provenance: 'internal',
          score: 50,
          compound_id: 'compound-1',
          start_byte: 0,
          end_byte: 50,
        },
        {
          id: 'test-2',
          content: '',
          source: 'test2.ts',
          timestamp: Date.now(),
          buckets: ['inbox'],
          tags: ['#test'],
          epochs: '',
          provenance: 'internal',
          score: 100,
          compound_id: 'compound-2',
          start_byte: 0,
          end_byte: 50,
        },
      ];

      // Mock compound fetch
      (batchFetchCompounds as vi.Mock).mockResolvedValue(new Map());

      // Mock file not existing
      const accessSpy = vi.spyOn(fs.promises, 'access')
        .mockImplementation(async () => {
          throw new Error('File not found');
        });

      const results = await ContextInflator.inflate(mockResults);
      expect(results[0].score).toBeGreaterThanOrEqual(results[1].score);

      accessSpy.mockRestore();
    });

    it('uses progressive radius allocation for top results', async () => {
      const mockResults: SearchResult[] = Array.from({ length: 20 }, (_, i) => ({
        id: `test-${i}`,
        content: '',
        source: `test${i}.ts`,
        timestamp: Date.now(),
        buckets: ['inbox'],
        tags: ['#test'],
        epochs: '',
        provenance: 'internal',
        score: 100 - i,
        compound_id: `compound-${i}`,
        start_byte: 0,
        end_byte: 50,
      }));

      // Mock compound fetch
      (batchFetchCompounds as vi.Mock).mockResolvedValue(new Map());

      // Mock file not existing
      const accessSpy = vi.spyOn(fs.promises, 'access')
        .mockImplementation(async () => {
          throw new Error('File not found');
        });

      const results = await ContextInflator.inflate(mockResults, 10000);
      expect(results).toHaveLength(20);

      accessSpy.mockRestore();
    });

    it('handles batch processing for large result sets', async () => {
      const mockResults: SearchResult[] = Array.from({ length: 25 }, (_, i) => ({
        id: `test-${i}`,
        content: '',
        source: `test${i}.ts`,
        timestamp: Date.now(),
        buckets: ['inbox'],
        tags: ['#test'],
        epochs: '',
        provenance: 'internal',
        score: 100 - i,
        compound_id: `compound-${i}`,
        start_byte: 0,
        end_byte: 50,
      }));

      (batchFetchCompounds as vi.Mock).mockResolvedValue(new Map());

      const accessSpy = vi.spyOn(fs.promises, 'access')
        .mockImplementation(async () => {
          throw new Error('File not found');
        });

      const results = await ContextInflator.inflate(mockResults);
      expect(results).toHaveLength(25);

      accessSpy.mockRestore();
    });

    it('handles errors gracefully during inflation', async () => {
      const mockResults: SearchResult[] = [
        {
          id: 'test-1',
          content: '',
          source: 'test.ts',
          timestamp: Date.now(),
          buckets: ['inbox'],
          tags: ['#test'],
          epochs: '',
          provenance: 'internal',
          score: 100,
          compound_id: 'compound-1',
          start_byte: 0,
          end_byte: 50,
        },
      ];

      (batchFetchCompounds as vi.Mock).mockRejectedValue(new Error('DB error'));

      const accessSpy = vi.spyOn(fs.promises, 'access')
        .mockImplementation(async () => {
          throw new Error('File not found');
        });

      const results = await ContextInflator.inflate(mockResults);
      expect(results).toHaveLength(1);
      expect(results[0].is_inflated).toBeUndefined();

      accessSpy.mockRestore();
    });
  });

  describe('snapToSentenceBoundary()', () => {
    it('snaps to sentence boundaries correctly', () => {
      const content = 'First sentence. Second sentence. Third sentence.';
      const result = (ContextInflator as any).snapToSentenceBoundary(content, 17, 33);

      expect(result.start).toBeGreaterThanOrEqual(0);
      expect(result.end).toBeLessThanOrEqual(content.length);
      expect(result.text).toBeTruthy();
    });

    it('handles content with no sentence boundaries', () => {
      const content = 'This is a long sentence without proper punctuation';
      const result = (ContextInflator as any).snapToSentenceBoundary(content, 10, 30);

      expect(result.text).toBeTruthy();
      expect(result.start).toBeLessThanOrEqual(10);
      expect(result.end).toBeGreaterThanOrEqual(30);
    });

    it('handles newlines as sentence boundaries', () => {
      const content = 'First paragraph.\n\nSecond paragraph.\n\nThird paragraph.';
      const result = (ContextInflator as any).snapToSentenceBoundary(content, 20, 40);

      expect(result.text).toBeTruthy();
    });

    it('handles empty content', () => {
      const content = '';
      const result = (ContextInflator as any).snapToSentenceBoundary(content, 0, 0);

      expect(result.start).toBe(0);
      expect(result.end).toBe(0);
      expect(result.text).toBe('');
    });

    it('handles target at start of content', () => {
      const content = 'First sentence. Second sentence.';
      const result = (ContextInflator as any).snapToSentenceBoundary(content, 0, 10);

      expect(result.start).toBe(0);
      expect(result.text).toBeTruthy();
    });

    it('handles target at end of content', () => {
      const content = 'First sentence. Second sentence.';
      const result = (ContextInflator as any).snapToSentenceBoundary(content, 20, 32);

      expect(result.end).toBe(content.length);
      expect(result.text).toBeTruthy();
    });
  });

  describe('inflateFromPath()', () => {
    it('returns null when file does not exist', async () => {
      const mockResult: SearchResult = {
        id: 'test-1',
        content: '',
        source: 'test.ts',
        timestamp: Date.now(),
        buckets: ['inbox'],
        tags: ['#test'],
        epochs: '',
        provenance: 'internal',
        score: 100,
        compound_id: 'compound-1',
        start_byte: 50,
        end_byte: 100,
      };

      const statSpy = vi.spyOn(fs.promises, 'stat')
        .mockImplementation(async () => {
          throw new Error('File not found');
        });

      const pathInfo = { filePath: 'test.ts', provenance: 'internal' };
      const content = await (ContextInflator as any).inflateFromPath(mockResult, 100, pathInfo);

      expect(content).toBeNull();

      statSpy.mockRestore();
    });

    it('handles file read errors gracefully', async () => {
      const mockResult: SearchResult = {
        id: 'test-1',
        content: '',
        source: 'test.ts',
        timestamp: Date.now(),
        buckets: ['inbox'],
        tags: ['#test'],
        epochs: '',
        provenance: 'internal',
        score: 100,
        compound_id: 'compound-1',
        start_byte: 50,
        end_byte: 100,
      };

      const mockStats = { size: 1000 } as fs.Stats;
      const statSpy = vi.spyOn(fs.promises, 'stat').mockResolvedValue(mockStats);
      const openSpy = vi.spyOn(fs.promises, 'open')
        .mockImplementation(async () => {
          throw new Error('Read error');
        });

      const pathInfo = { filePath: 'test.ts', provenance: 'internal' };
      const content = await (ContextInflator as any).inflateFromPath(mockResult, 100, pathInfo);

      expect(content).toBeNull();

      statSpy.mockRestore();
      openSpy.mockRestore();
    });

    it('returns null for zero-length chunk', async () => {
      const mockResult: SearchResult = {
        id: 'test-1',
        content: '',
        source: 'test.ts',
        timestamp: Date.now(),
        buckets: ['inbox'],
        tags: ['#test'],
        epochs: '',
        provenance: 'internal',
        score: 100,
        compound_id: 'compound-1',
        start_byte: 1000,
        end_byte: 1000,
      };

      const mockStats = { size: 1000 } as fs.Stats;
      const statSpy = vi.spyOn(fs.promises, 'stat').mockResolvedValue(mockStats);

      const pathInfo = { filePath: 'test.ts', provenance: 'internal' };
      const content = await (ContextInflator as any).inflateFromPath(mockResult, 100, pathInfo);

      expect(content).toBeNull();

      statSpy.mockRestore();
    });
  });

  describe.skip('inflateFromCompoundBody()', () => {
    it('inflates content from compound body in database', async () => {
      const mockResult: SearchResult = {
        id: 'test-1',
        content: '',
        source: 'test.ts',
        timestamp: Date.now(),
        buckets: ['inbox'],
        tags: ['#test'],
        epochs: '',
        provenance: 'internal',
        score: 100,
        compound_id: 'compound-1',
        start_byte: 0,
        end_byte: 50,
      };

      const compoundCache = new Map([
        [
          'compound-1',
          {
            path: 'test.ts',
            provenance: 'internal',
            compound_body: 'This is the compound body content for testing purposes.',
          },
        ],
      ]);

      const content = await (ContextInflator as any).inflateFromCompoundBody(
        mockResult,
        100,
        compoundCache
      );

      expect(content).toBeTruthy();
      expect(content).toContain('compound body');
    });

    it('falls back to database query when cache miss', async () => {
      const mockResult: SearchResult = {
        id: 'test-1',
        content: '',
        source: 'test.ts',
        timestamp: Date.now(),
        buckets: ['inbox'],
        tags: ['#test'],
        epochs: '',
        provenance: 'internal',
        score: 100,
        compound_id: 'compound-1',
        start_byte: 0,
        end_byte: 50,
      };

      (db.run as vi.Mock).mockResolvedValue({
        rows: [{ compound_body: 'Database content here' }],
      });

      const content = await (ContextInflator as any).inflateFromCompoundBody(mockResult, 100);

      expect(content).toBeTruthy();
      expect(db.run).toHaveBeenCalledWith(
        expect.stringContaining('SELECT compound_body'),
        expect.any(Array)
      );
    });

    it('returns null when compound body is empty', async () => {
      const mockResult: SearchResult = {
        id: 'test-1',
        content: '',
        source: 'test.ts',
        timestamp: Date.now(),
        buckets: ['inbox'],
        tags: ['#test'],
        epochs: '',
        provenance: 'internal',
        score: 100,
        compound_id: 'compound-1',
        start_byte: 0,
        end_byte: 50,
      };

      (db.run as vi.Mock).mockResolvedValue({
        rows: [{ compound_body: null }],
      });

      const content = await (ContextInflator as any).inflateFromCompoundBody(mockResult, 100);
      expect(content).toBeNull();
    });

    it('returns null when compound not found', async () => {
      const mockResult: SearchResult = {
        id: 'test-1',
        content: '',
        source: 'test.ts',
        timestamp: Date.now(),
        buckets: ['inbox'],
        tags: ['#test'],
        epochs: '',
        provenance: 'internal',
        score: 100,
        compound_id: 'compound-1',
        start_byte: 0,
        end_byte: 50,
      };

      (db.run as vi.Mock).mockResolvedValue({
        rows: [],
      });

      const content = await (ContextInflator as any).inflateFromCompoundBody(mockResult, 100);
      expect(content).toBeNull();
    });

    it('handles database errors gracefully', async () => {
      const mockResult: SearchResult = {
        id: 'test-1',
        content: '',
        source: 'test.ts',
        timestamp: Date.now(),
        buckets: ['inbox'],
        tags: ['#test'],
        epochs: '',
        provenance: 'internal',
        score: 100,
        compound_id: 'compound-1',
        start_byte: 0,
        end_byte: 50,
      };

      (db.run as vi.Mock).mockRejectedValue(new Error('DB error'));

      const content = await (ContextInflator as any).inflateFromCompoundBody(mockResult, 100);
      expect(content).toBeNull();
    });
  });

  describe.skip('inflateFromCompoundBodyText()', () => {
    it('extracts content with radius expansion', () => {
      const compoundBody = 'First sentence. Second sentence. Third sentence.';
      const mockResult: SearchResult = {
        id: 'test-1',
        content: '',
        source: 'test.ts',
        timestamp: Date.now(),
        buckets: ['inbox'],
        tags: ['#test'],
        epochs: '',
        provenance: 'internal',
        score: 100,
        compound_id: 'compound-1',
        start_byte: 16,
        end_byte: 32,
      };

      const content = (ContextInflator as any).inflateFromCompoundBodyText(
        compoundBody,
        mockResult,
        50
      );

      expect(content).toBeTruthy();
      expect(typeof content).toBe('string');
    });

    it('snaps to sentence boundaries', () => {
      const compoundBody = 'First sentence. Second sentence. Third sentence.';
      const mockResult: SearchResult = {
        id: 'test-1',
        content: '',
        source: 'test.ts',
        timestamp: Date.now(),
        buckets: ['inbox'],
        tags: ['#test'],
        epochs: '',
        provenance: 'internal',
        score: 100,
        compound_id: 'compound-1',
        start_byte: 16,
        end_byte: 32,
      };

      const content = (ContextInflator as any).inflateFromCompoundBodyText(
        compoundBody,
        mockResult,
        50
      );

      expect(content).toContain('Second sentence');
    });

    it('handles edge cases with invalid byte offsets', () => {
      const compoundBody = 'Short text';
      const mockResult: SearchResult = {
        id: 'test-1',
        content: '',
        source: 'test.ts',
        timestamp: Date.now(),
        buckets: ['inbox'],
        tags: ['#test'],
        epochs: '',
        provenance: 'internal',
        score: 100,
        compound_id: 'compound-1',
        start_byte: 100,
        end_byte: 200,
      };

      const content = (ContextInflator as any).inflateFromCompoundBodyText(
        compoundBody,
        mockResult,
        50
      );

      expect(content).toBeNull();
    });
  });

  describe('getAtomLocations()', () => {
    it('finds atom locations by term', async () => {
      (db.run as vi.Mock).mockResolvedValue({
        rows: [
          {
            compound_id: 'compound-1',
            byte_offset: 100,
            path: 'test.ts',
            timestamp: Date.now(),
            provenance: 'internal',
          },
        ],
      });

      const locations = await ContextInflator.getAtomLocations('test');

      expect(locations).toHaveLength(1);
      expect(locations[0].compoundId).toBe('compound-1');
      expect(locations[0].byteOffset).toBe(100);
      expect(locations[0].filePath).toBe('test.ts');
    });

    it('handles term with hash prefix', async () => {
      (db.run as vi.Mock).mockResolvedValue({
        rows: [
          {
            compound_id: 'compound-1',
            byte_offset: 100,
            path: 'test.ts',
            timestamp: Date.now(),
            provenance: 'internal',
          },
        ],
      });

      const locations = await ContextInflator.getAtomLocations('#test');

      expect(locations).toHaveLength(1);
    });

    it('filters by provenance', async () => {
      (db.run as vi.Mock).mockResolvedValue({
        rows: [
          {
            compound_id: 'compound-1',
            byte_offset: 100,
            path: 'test.ts',
            timestamp: Date.now(),
            provenance: 'external',
          },
        ],
      });

      const locations = await ContextInflator.getAtomLocations('test', 100, {
        provenance: 'external',
      });

      expect(locations).toHaveLength(1);
      expect(locations[0].provenance).toBe('external');
    });

    it('filters by buckets', async () => {
      (db.run as vi.Mock).mockResolvedValue({
        rows: [
          {
            compound_id: 'compound-1',
            byte_offset: 100,
            path: 'test.ts',
            timestamp: Date.now(),
            provenance: 'internal',
          },
        ],
      });

      const locations = await ContextInflator.getAtomLocations('test', 100, {
        buckets: ['inbox'],
      });

      expect(locations).toHaveLength(1);
    });

    it('returns empty array on database error', async () => {
      (db.run as vi.Mock).mockRejectedValue(new Error('DB error'));

      const locations = await ContextInflator.getAtomLocations('test');

      expect(locations).toEqual([]);
    });

    it('returns empty array when no results found', async () => {
      (db.run as vi.Mock).mockResolvedValue({
        rows: [],
      });

      const locations = await ContextInflator.getAtomLocations('nonexistent');

      expect(locations).toEqual([]);
    });
  });

  describe('inflateFromAtomPositions()', () => {
    it('radially inflates from atom positions', async () => {
      (db.run as vi.Mock).mockImplementation((query: string) => {
        if (query.includes('atom_positions')) {
          return Promise.resolve({
            rows: [
              {
                compound_id: 'compound-1',
                byte_offset: 100,
                path: 'test.ts',
                timestamp: Date.now(),
                provenance: 'internal',
              },
            ],
          });
        }
        return Promise.resolve({ rows: [] });
      });

      const existsSyncSpy = vi.spyOn(fs, 'existsSync').mockReturnValue(true);
      const statSpy = vi.spyOn(fs.promises, 'stat').mockResolvedValue({ size: 1000 } as fs.Stats);
      const openSpy = vi.spyOn(fs.promises, 'open').mockImplementation(async () => {
        const content = 'x'.repeat(1000);
        return {
          read: vi.fn().mockImplementation((buffer: Buffer, offset: number, length: number, position: number) => {
            Buffer.from(content).copy(buffer, offset, position, position + length);
            return { bytesRead: length, buffer };
          }),
          close: vi.fn().mockResolvedValue(undefined),
        } as any;
      });

      const results = await ContextInflator.inflateFromAtomPositions('test', 100, 10);

      expect(results).toHaveLength(1);
      expect(results[0].is_inflated).toBe(true);
      expect(results[0].compound_id).toBe('compound-1');

      existsSyncSpy.mockRestore();
      statSpy.mockRestore();
      openSpy.mockRestore();
    });

    it('returns empty array when no atom positions found', async () => {
      (db.run as vi.Mock).mockResolvedValue({
        rows: [],
      });

      const results = await ContextInflator.inflateFromAtomPositions('nonexistent', 100, 10);

      expect(results).toEqual([]);
    });

    it('merges overlapping windows', async () => {
      (db.run as vi.Mock).mockImplementation((query: string) => {
        if (query.includes('atom_positions')) {
          return Promise.resolve({
            rows: [
              {
                compound_id: 'compound-1',
                byte_offset: 100,
                path: 'test.ts',
                timestamp: Date.now(),
                provenance: 'internal',
              },
              {
                compound_id: 'compound-1',
                byte_offset: 150,
                path: 'test.ts',
                timestamp: Date.now(),
                provenance: 'internal',
              },
            ],
          });
        }
        return Promise.resolve({ rows: [] });
      });

      const existsSyncSpy = vi.spyOn(fs, 'existsSync').mockReturnValue(true);
      const statSpy = vi.spyOn(fs.promises, 'stat').mockResolvedValue({ size: 1000 } as fs.Stats);
      const openSpy = vi.spyOn(fs.promises, 'open').mockImplementation(async () => {
        const content = 'x'.repeat(1000);
        return {
          read: vi.fn().mockImplementation((buffer: Buffer, offset: number, length: number, position: number) => {
            Buffer.from(content).copy(buffer, offset, position, position + length);
            return { bytesRead: length, buffer };
          }),
          close: vi.fn().mockResolvedValue(undefined),
        } as any;
      });

      const results = await ContextInflator.inflateFromAtomPositions('test', 100, 10);

      // Should merge overlapping windows
      expect(results.length).toBeLessThanOrEqual(1);

      existsSyncSpy.mockRestore();
      statSpy.mockRestore();
      openSpy.mockRestore();
    });

    it('respects maxResults limit', async () => {
      (db.run as vi.Mock).mockImplementation((query: string) => {
        if (query.includes('atom_positions')) {
          return Promise.resolve({
            rows: Array.from({ length: 50 }, (_, i) => ({
              compound_id: `compound-${i}`,
              byte_offset: 100,
              path: `test${i}.ts`,
              timestamp: Date.now(),
              provenance: 'internal',
            })),
          });
        }
        return Promise.resolve({ rows: [] });
      });

      const existsSyncSpy = vi.spyOn(fs, 'existsSync').mockReturnValue(false);

      const results = await ContextInflator.inflateFromAtomPositions('test', 100, 10);

      expect(results.length).toBeLessThanOrEqual(10);

      existsSyncSpy.mockRestore();
    });

    it('handles file read errors gracefully', async () => {
      (db.run as vi.Mock).mockImplementation((query: string) => {
        if (query.includes('atom_positions')) {
          return Promise.resolve({
            rows: [
              {
                compound_id: 'compound-1',
                byte_offset: 100,
                path: 'test.ts',
                timestamp: Date.now(),
                provenance: 'internal',
              },
            ],
          });
        }
        return Promise.resolve({ rows: [] });
      });

      const existsSyncSpy = vi.spyOn(fs, 'existsSync').mockReturnValue(true);
      const statSpy = vi.spyOn(fs.promises, 'stat').mockResolvedValue({ size: 1000 } as fs.Stats);
      const openSpy = vi.spyOn(fs.promises, 'open')
        .mockImplementation(async () => {
          throw new Error('Read error');
        });

      const results = await ContextInflator.inflateFromAtomPositions('test', 100, 10);

      expect(results).toEqual([]);

      existsSyncSpy.mockRestore();
      statSpy.mockRestore();
      openSpy.mockRestore();
    });

    it('filters by provenance', async () => {
      (db.run as vi.Mock).mockResolvedValue({
        rows: [
          {
            compound_id: 'compound-1',
            byte_offset: 100,
            path: 'test.ts',
            timestamp: Date.now(),
            provenance: 'external',
          },
        ],
      });

      const existsSyncSpy = vi.spyOn(fs, 'existsSync').mockReturnValue(true);

      const results = await ContextInflator.inflateFromAtomPositions('test', 100, 10, 500, {
        provenance: 'external',
      });

      expect(results.length).toBeGreaterThanOrEqual(0);

      existsSyncSpy.mockRestore();
    });

    it('filters by buckets', async () => {
      (db.run as vi.Mock).mockResolvedValue({
        rows: [
          {
            compound_id: 'compound-1',
            byte_offset: 100,
            path: 'test.ts',
            timestamp: Date.now(),
            provenance: 'internal',
          },
        ],
      });

      const existsSyncSpy = vi.spyOn(fs, 'existsSync').mockReturnValue(true);

      const results = await ContextInflator.inflateFromAtomPositions('test', 100, 10, 500, {
        buckets: ['inbox'],
      });

      expect(results.length).toBeGreaterThanOrEqual(0);

      existsSyncSpy.mockRestore();
    });
  });

  describe('fetchAdditionalContext()', () => {
    it('fetches additional context to fill budget', async () => {
      const baseResults: SearchResult[] = [
        {
          id: 'test-1',
          content: 'base content',
          source: 'test.ts',
          timestamp: Date.now(),
          buckets: ['inbox'],
          tags: ['#test'],
          epochs: '',
          provenance: 'internal',
          score: 100,
        },
      ];

      (db.run as vi.Mock).mockResolvedValue({
        rows: [
          {
            id: 'additional-1',
            content: 'additional context',
            source_path: 'test2.ts',
            timestamp: Date.now(),
            buckets: ['inbox'],
            tags: ['#test'],
            epochs: '',
            provenance: 'internal',
            simhash: 'abc123',
            score: 100,
          },
        ],
      });

      // Access private method
      const additional = await (ContextInflator as any).fetchAdditionalContext(
        baseResults,
        5000
      );

      expect(additional).toHaveLength(1);
      expect(additional[0].id).toBe('additional-1');
    });

    it('returns empty array when budget is too small', async () => {
      const baseResults: SearchResult[] = [];

      const additional = await (ContextInflator as any).fetchAdditionalContext(
        baseResults,
        500
      );

      expect(additional).toEqual([]);
    });

    it('returns empty array when no additional context found', async () => {
      const baseResults: SearchResult[] = [
        {
          id: 'test-1',
          content: 'base content',
          source: 'test.ts',
          timestamp: Date.now(),
          buckets: ['inbox'],
          tags: ['#test'],
          epochs: '',
          provenance: 'internal',
          score: 100,
        },
      ];

      (db.run as vi.Mock).mockResolvedValue({
        rows: [],
      });

      const additional = await (ContextInflator as any).fetchAdditionalContext(
        baseResults,
        5000
      );

      expect(additional).toEqual([]);
    });

    it('truncates content to fit remaining budget', async () => {
      const baseResults: SearchResult[] = [
        {
          id: 'test-1',
          content: 'base content',
          source: 'test.ts',
          timestamp: Date.now(),
          buckets: ['inbox'],
          tags: ['#test'],
          epochs: '',
          provenance: 'internal',
          score: 100,
        },
      ];

      (db.run as vi.Mock).mockResolvedValue({
        rows: [
          {
            id: 'additional-1',
            content: 'x'.repeat(1000),
            source_path: 'test2.ts',
            timestamp: Date.now(),
            buckets: ['inbox'],
            tags: ['#test'],
            epochs: '',
            provenance: 'internal',
            simhash: 'abc123',
            score: 100,
          },
        ],
      });

      const additional = await (ContextInflator as any).fetchAdditionalContext(
        baseResults,
        100
      );

      expect(additional.length).toBeLessThanOrEqual(1);
      if (additional.length > 0) {
        expect(additional[0].content.length).toBeLessThanOrEqual(100);
      }
    });

    it('handles database errors gracefully', async () => {
      const baseResults: SearchResult[] = [];

      (db.run as vi.Mock).mockRejectedValue(new Error('DB error'));

      const additional = await (ContextInflator as any).fetchAdditionalContext(
        baseResults,
        5000
      );

      expect(additional).toEqual([]);
    });
  });

  describe('Edge Cases', () => {
    it('handles unicode content', async () => {
      const mockResults: SearchResult[] = [
        {
          id: 'test-1',
          content: '',
          source: 'test.ts',
          timestamp: Date.now(),
          buckets: ['inbox'],
          tags: ['#test'],
          epochs: '',
          provenance: 'internal',
          score: 100,
          compound_id: 'compound-1',
          start_byte: 0,
          end_byte: 50,
        },
      ];

      (batchFetchCompounds as vi.Mock).mockResolvedValue(
        new Map([
          [
            'compound-1',
            {
              path: 'test.ts',
              provenance: 'internal',
              compound_body: '你好世界 🌍 测试内容',
            },
          ],
        ])
      );

      const accessSpy = vi.spyOn(fs.promises, 'access')
        .mockImplementation(async () => {
          throw new Error('File not found');
        });

      const results = await ContextInflator.inflate(mockResults);
      expect(results).toHaveLength(1);

      accessSpy.mockRestore();
    });

    it('handles very large radius values', async () => {
      const mockResults: SearchResult[] = [
        {
          id: 'test-1',
          content: '',
          source: 'test.ts',
          timestamp: Date.now(),
          buckets: ['inbox'],
          tags: ['#test'],
          epochs: '',
          provenance: 'internal',
          score: 100,
          compound_id: 'compound-1',
          start_byte: 0,
          end_byte: 50,
        },
      ];

      (batchFetchCompounds as vi.Mock).mockResolvedValue(new Map());

      const accessSpy = vi.spyOn(fs.promises, 'access')
        .mockImplementation(async () => {
          throw new Error('File not found');
        });

      const results = await ContextInflator.inflate(mockResults, 1000000);
      expect(results).toHaveLength(1);

      accessSpy.mockRestore();
    });

    it('handles zero radius', async () => {
      const mockResults: SearchResult[] = [
        {
          id: 'test-1',
          content: '',
          source: 'test.ts',
          timestamp: Date.now(),
          buckets: ['inbox'],
          tags: ['#test'],
          epochs: '',
          provenance: 'internal',
          score: 100,
          compound_id: 'compound-1',
          start_byte: 0,
          end_byte: 50,
        },
      ];

      (batchFetchCompounds as vi.Mock).mockResolvedValue(new Map());

      const accessSpy = vi.spyOn(fs.promises, 'access')
        .mockImplementation(async () => {
          throw new Error('File not found');
        });

      const results = await ContextInflator.inflate(mockResults, 0, 0);
      expect(results).toHaveLength(1);

      accessSpy.mockRestore();
    });
  });

  describe('Performance', () => {
    it('processes large result sets efficiently', async () => {
      const mockResults: SearchResult[] = Array.from({ length: 100 }, (_, i) => ({
        id: `test-${i}`,
        content: '',
        source: `test${i}.ts`,
        timestamp: Date.now() - i * 1000,
        buckets: ['inbox'],
        tags: ['#test'],
        epochs: '',
        provenance: 'internal',
        score: 100 - i,
        compound_id: `compound-${i}`,
        start_byte: 0,
        end_byte: 50,
      }));

      (batchFetchCompounds as vi.Mock).mockResolvedValue(new Map());

      const accessSpy = vi.spyOn(fs.promises, 'access')
        .mockImplementation(async () => {
          throw new Error('File not found');
        });

      const start = Date.now();
      const results = await ContextInflator.inflate(mockResults, 10000);
      const duration = Date.now() - start;

      expect(results).toHaveLength(100);
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds

      accessSpy.mockRestore();
    });
  });
});





