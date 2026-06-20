/**
 * Unit Tests for PhysicsTagWalker Service
 *
 * Tests the physics-based tag walker including:
 * - Radial inflation with SQL matrix operations
 * - Unified Field Equation weighting
 * - Tag-based traversal
 * - Hop distance tracking
 * - Temporal decay calculations
 * - Simhash distance weighting
 * - Budget-aware auto-tuning
 *
 * Coverage Goal: >80% for physics-tag-walker.ts (729 lines)
 */

import { describe, it, expect, beforeEach } from 'vitest';

// Mock dependencies (must be before any imports that use them)
import { vi } from 'vitest';
vi.mock('../../src/core/db.js', () => ({
  db: {
    run: vi.fn(),
  },
}));

import { db } from '../../src/core/db.js';
import { PhysicsTagWalker } from '../../src/services/search/physics-tag-walker.js';
import type { SearchResult } from '../../src/services/search/search.js';

describe('PhysicsTagWalker', () => {
  let walker: PhysicsTagWalker;

  beforeEach(() => {
    vi.clearAllMocks();
    walker = new PhysicsTagWalker();
  });

  describe('Constructor', () => {
    it('creates instance with default configuration', () => {
      expect(walker).toBeDefined();
      expect(typeof walker).toBe('object');
    });

    it('uses default hyperparameters', () => {
      const defaultWalker = new PhysicsTagWalker();
      expect(defaultWalker).toBeDefined();
    });

    it('accepts custom configuration', () => {
      const customWalker = new PhysicsTagWalker({
        damping: 0.9,
        temporalDecay: 0.00002,
        maxPerHop: 100,
        walkRadius: 2,
        gravityThreshold: 0.05,
        temperature: 0.3,
      });
      expect(customWalker).toBeDefined();
    });

    it('handles partial configuration', () => {
      const partialWalker = new PhysicsTagWalker({
        damping: 0.95,
        maxPerHop: 75,
      });
      expect(partialWalker).toBeDefined();
    });
  });

  describe('safeParseHex()', () => {
    it('parses valid hex string without 0x prefix', () => {
      const result = (walker as any).safeParseHex('abc123');
      expect(result).toBe(BigInt('0xabc123'));
    });

    it('parses valid hex string with 0x prefix', () => {
      const result = (walker as any).safeParseHex('0xabc123');
      expect(result).toBe(BigInt('0xabc123'));
    });

    it('returns 0n for null input', () => {
      const result = (walker as any).safeParseHex(null);
      expect(result).toBe(0n);
    });

    it('returns 0n for undefined input', () => {
      const result = (walker as any).safeParseHex(undefined);
      expect(result).toBe(0n);
    });

    it('returns 0n for empty string', () => {
      const result = (walker as any).safeParseHex('');
      expect(result).toBe(0n);
    });

    it('returns 0n for invalid hex string', () => {
      const result = (walker as any).safeParseHex('invalid');
      expect(result).toBe(0n);
    });

    it('returns 0n for "0" string', () => {
      const result = (walker as any).safeParseHex('0');
      expect(result).toBe(0n);
    });
  });

  describe('performRadialInflation()', () => {
    it('returns empty array for empty anchor IDs', async () => {
      const results = await walker.performRadialInflation([]);
      expect(results).toEqual([]);
    });

    it('caps anchor IDs to MAX_ANCHOR_IDS', async () => {
      const manyAnchors = Array.from({ length: 50 }, (_, i) => `anchor-${i}`);
      
      (db.run as vi.Mock).mockResolvedValue({
        rows: [],
      });

      const results = await walker.performRadialInflation(manyAnchors);
      expect(results).toEqual([]);
      
      // Verify query was called with capped anchors
      expect(db.run).toHaveBeenCalled();
    });

    it('returns connected nodes with physics metadata', async () => {
      const mockRows = [
        {
          atom_id: 'node-1',
          shared_tags: 3,
          timestamp: Date.now().toString(),
          simhash: 'abc123',
          content: 'test content',
          source_path: 'test.ts',
          tags: ['#test'],
          provenance: 'internal',
          type: 'thought',
          compound_id: 'compound-1',
          start_byte: 0,
          end_byte: 100,
          gravity_score: 0.85,
          best_anchor_id: 'anchor-1',
          hop_distance: 1,
        },
      ];

      (db.run as vi.Mock).mockResolvedValue({ rows: mockRows });

      const results = await walker.performRadialInflation(['anchor-1']);

      expect(results).toHaveLength(1);
      expect(results[0].result.id).toBe('node-1');
      expect(results[0].physics.gravity_score).toBe(0.85);
      expect(results[0].physics.hop_distance).toBe(1);
      expect(results[0].physics.connection_type).toBe('tag_walk_neighbor');
    });

    it('handles multiple connected nodes', async () => {
      const mockRows = [
        {
          atom_id: 'node-1',
          shared_tags: 3,
          timestamp: Date.now().toString(),
          simhash: 'abc123',
          content: 'content 1',
          source_path: 'test1.ts',
          tags: ['#test'],
          provenance: 'internal',
          type: 'thought',
          compound_id: 'compound-1',
          start_byte: 0,
          end_byte: 100,
          gravity_score: 0.9,
          best_anchor_id: 'anchor-1',
          hop_distance: 1,
        },
        {
          atom_id: 'node-2',
          shared_tags: 2,
          timestamp: Date.now().toString(),
          simhash: 'def456',
          content: 'content 2',
          source_path: 'test2.ts',
          tags: ['#test'],
          provenance: 'internal',
          type: 'thought',
          compound_id: 'compound-2',
          start_byte: 0,
          end_byte: 100,
          gravity_score: 0.7,
          best_anchor_id: 'anchor-1',
          hop_distance: 1,
        },
      ];

      (db.run as vi.Mock).mockResolvedValue({ rows: mockRows });

      const results = await walker.performRadialInflation(['anchor-1']);

      expect(results).toHaveLength(2);
      // Should be sorted by gravity score
      expect(results[0].physics.gravity_score).toBeGreaterThanOrEqual(
        results[1].physics.gravity_score
      );
    });

    it('respects maxPerHop limit', async () => {
      const mockRows = Array.from({ length: 100 }, (_, i) => ({
        atom_id: `node-${i}`,
        shared_tags: 1,
        timestamp: Date.now().toString(),
        simhash: 'abc123',
        content: `content ${i}`,
        source_path: `test${i}.ts`,
        tags: ['#test'],
        provenance: 'internal',
        type: 'thought',
        compound_id: `compound-${i}`,
        start_byte: 0,
        end_byte: 100,
        gravity_score: 0.9 - (i * 0.01),
        best_anchor_id: 'anchor-1',
        hop_distance: 1,
      }));

      (db.run as vi.Mock).mockResolvedValue({ rows: mockRows });

      const results = await walker.performRadialInflation(['anchor-1'], 1, 10);

      expect(results.length).toBeLessThanOrEqual(10);
    });

    it('prevents revisiting anchor nodes', async () => {
      const mockRows = [
        {
          atom_id: 'anchor-1', // Same as anchor
          shared_tags: 3,
          timestamp: Date.now().toString(),
          simhash: 'abc123',
          content: 'anchor content',
          source_path: 'test.ts',
          tags: ['#test'],
          provenance: 'internal',
          type: 'thought',
          compound_id: 'compound-1',
          start_byte: 0,
          end_byte: 100,
          gravity_score: 0.9,
          best_anchor_id: 'anchor-1',
          hop_distance: 0,
        },
      ];

      (db.run as vi.Mock).mockResolvedValue({ rows: mockRows });

      const results = await walker.performRadialInflation(['anchor-1']);

      // Should filter out the anchor itself
      expect(results).toHaveLength(0);
    });

    it('handles database errors gracefully', async () => {
      (db.run as vi.Mock).mockRejectedValue(new Error('DB error'));

      const results = await walker.performRadialInflation(['anchor-1']);
      expect(results).toEqual([]);
    });

    it('handles SQL timeout', async () => {
      (db.run as vi.Mock).mockImplementation(
        () =>
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Query timeout')), 3000)
          )
      );

      const results = await walker.performRadialInflation(['anchor-1']);
      expect(results).toEqual([]);
    });

    it('uses custom parameters when provided', async () => {
      const mockRows = [
        {
          atom_id: 'node-1',
          shared_tags: 3,
          timestamp: Date.now().toString(),
          simhash: 'abc123',
          content: 'test',
          source_path: 'test.ts',
          tags: ['#test'],
          provenance: 'internal',
          type: 'thought',
          compound_id: 'compound-1',
          start_byte: 0,
          end_byte: 100,
          gravity_score: 0.8,
          best_anchor_id: 'anchor-1',
          hop_distance: 1,
        },
      ];

      (db.run as vi.Mock).mockResolvedValue({ rows: mockRows });

      const results = await walker.performRadialInflation(
        ['anchor-1'],
        2, // radius
        25, // maxPerHop
        0.3, // temperature
        0.05 // gravityThreshold
      );

      expect(results).toHaveLength(1);
    });

    it('sets connection type based on gravity and shared tags', async () => {
      const mockRows = [
        {
          atom_id: 'node-1',
          shared_tags: 5,
          timestamp: Date.now().toString(),
          simhash: 'abc123',
          content: 'test',
          source_path: 'test.ts',
          tags: ['#test'],
          provenance: 'internal',
          type: 'thought',
          compound_id: 'compound-1',
          start_byte: 0,
          end_byte: 100,
          gravity_score: 0.9,
          best_anchor_id: 'anchor-1',
          hop_distance: 1,
        },
      ];

      (db.run as vi.Mock).mockResolvedValue({ rows: mockRows });

      const results = await walker.performRadialInflation(['anchor-1']);

      expect(results[0].physics.connection_type).toBe('tag_walk_neighbor');
      expect(results[0].physics.link_reason).toContain('strong bond');
    });

    it('marks recurring nodes correctly', async () => {
      const mockRows = [
        {
          atom_id: 'node-1',
          shared_tags: 4,
          timestamp: Date.now().toString(),
          simhash: 'abc123',
          content: 'test',
          source_path: 'test.ts',
          tags: ['#test'],
          provenance: 'internal',
          type: 'thought',
          compound_id: 'compound-1',
          start_byte: 0,
          end_byte: 100,
          gravity_score: 0.8,
          best_anchor_id: 'anchor-1',
          hop_distance: 1,
        },
      ];

      (db.run as vi.Mock).mockResolvedValue({ rows: mockRows });

      const results = await walker.performRadialInflation(['anchor-1']);

      // sharedTags >= 3 should mark as recurring
      expect(results[0].physics.is_recurring).toBe(true);
    });
  });

  describe('getConnectedNodesWeighted()', () => {
    it('returns empty array for empty anchor IDs', async () => {
      const nodes = await (walker as any).getConnectedNodesWeighted([], 50, 0.1);
      expect(nodes).toEqual([]);
    });

    it('caps limit to safe maximum', async () => {
      const mockRows = [
        {
          atom_id: 'node-1',
          shared_tags: 3,
          timestamp: Date.now().toString(),
          simhash: 'abc123',
          content: 'test',
          source_path: 'test.ts',
          tags: ['#test'],
          provenance: 'internal',
          type: 'thought',
          compound_id: 'compound-1',
          start_byte: 0,
          end_byte: 100,
          gravity_score: 0.8,
          best_anchor_id: 'anchor-1',
          hop_distance: 1,
        },
      ];

      (db.run as vi.Mock).mockResolvedValue({ rows: mockRows });

      const nodes = await (walker as any).getConnectedNodesWeighted(
        ['anchor-1'],
        500, // Should be capped to 300
        0.1
      );

      expect(nodes).toHaveLength(1);
    });

    it('caps anchor IDs to MAX_ANCHOR_IDS', async () => {
      const manyAnchors = Array.from({ length: 50 }, (_, i) => `anchor-${i}`);
      
      (db.run as vi.Mock).mockResolvedValue({ rows: [] });

      const nodes = await (walker as any).getConnectedNodesWeighted(
        manyAnchors,
        50,
        0.1
      );

      expect(nodes).toEqual([]);
    });

    it('uses SQL with timeout protection', async () => {
      (db.run as vi.Mock).mockResolvedValue({ rows: [] });

      await (walker as any).getConnectedNodesWeighted(['anchor-1'], 50, 0.1);

      expect(db.run).toHaveBeenCalledWith(
        expect.stringContaining('WITH RECURSIVE'),
        expect.any(Array)
      );
    });

    it('handles database errors gracefully', async () => {
      (db.run as vi.Mock).mockRejectedValue(new Error('DB error'));

      const nodes = await (walker as any).getConnectedNodesWeighted(
        ['anchor-1'],
        50,
        0.1
      );

      expect(nodes).toEqual([]);
    });

    it('logs debug information for large queries', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation();
      
      (db.run as vi.Mock).mockResolvedValue({ rows: [] });

      const manyAnchors = Array.from({ length: 15 }, (_, i) => `anchor-${i}`);
      await (walker as any).getConnectedNodesWeighted(manyAnchors, 150, 0.1);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('SQL params')
      );

      consoleSpy.mockRestore();
    });

    it('warns when query takes too long', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation();
      
      (db.run as vi.Mock).mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
        return { rows: [] };
      });

      await (walker as any).getConnectedNodesWeighted(['anchor-1'], 50, 0.1);

      warnSpy.mockRestore();
    });

    it('warns when zero results returned', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation();
      
      (db.run as vi.Mock).mockResolvedValue({ rows: [] });

      await (walker as any).getConnectedNodesWeighted(['anchor-1'], 50, 0.1);

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Zero results')
      );

      warnSpy.mockRestore();
    });
  });

  describe('applyPhysicsWeighting()', () => {
    it('returns empty array for empty anchor results', async () => {
      const results = await walker.applyPhysicsWeighting([]);
      expect(results).toEqual([]);
    });

    it('applies physics weighting to search results', async () => {
      const anchorResults: SearchResult[] = [
        {
          id: 'anchor-1',
          content: 'anchor content',
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
            atom_id: 'node-1',
            shared_tags: 3,
            timestamp: Date.now().toString(),
            simhash: 'abc123',
            content: 'connected content',
            source_path: 'test.ts',
            tags: ['#test'],
            provenance: 'internal',
            type: 'thought',
            compound_id: 'compound-1',
            start_byte: 0,
            end_byte: 100,
            gravity_score: 0.8,
            best_anchor_id: 'anchor-1',
            hop_distance: 1,
          },
        ],
      });

      const results = await walker.applyPhysicsWeighting(anchorResults);

      expect(results).toHaveLength(1);
      expect(results[0].physics.gravity_score).toBe(0.8);
    });

    it('auto-tunes parameters for high-budget queries', async () => {
      const anchorResults: SearchResult[] = [
        {
          id: 'anchor-1',
          content: 'anchor content',
          source: 'test.ts',
          timestamp: Date.now(),
          buckets: ['inbox'],
          tags: ['#test'],
          epochs: '',
          provenance: 'internal',
          score: 100,
        },
      ];

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation();
      
      (db.run as vi.Mock).mockResolvedValue({ rows: [] });

      await walker.applyPhysicsWeighting(anchorResults, 0.1, {}, 100000);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('High-budget mode')
      );

      consoleSpy.mockRestore();
    });

    it('uses default threshold when not provided', async () => {
      const anchorResults: SearchResult[] = [
        {
          id: 'anchor-1',
          content: 'anchor content',
          source: 'test.ts',
          timestamp: Date.now(),
          buckets: ['inbox'],
          tags: ['#test'],
          epochs: '',
          provenance: 'internal',
          score: 100,
        },
      ];

      (db.run as vi.Mock).mockResolvedValue({ rows: [] });

      const results = await walker.applyPhysicsWeighting(anchorResults);

      expect(results).toEqual([]);
    });

    it('passes config to performRadialInflation', async () => {
      const anchorResults: SearchResult[] = [
        {
          id: 'anchor-1',
          content: 'anchor content',
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
            atom_id: 'node-1',
            shared_tags: 3,
            timestamp: Date.now().toString(),
            simhash: 'abc123',
            content: 'test',
            source_path: 'test.ts',
            tags: ['#test'],
            provenance: 'internal',
            type: 'thought',
            compound_id: 'compound-1',
            start_byte: 0,
            end_byte: 100,
            gravity_score: 0.8,
            best_anchor_id: 'anchor-1',
            hop_distance: 1,
          },
        ],
      });

      const results = await walker.applyPhysicsWeighting(
        anchorResults,
        0.1,
        {
          max_per_hop: 100,
          walk_radius: 2,
          temperature: 0.3,
        }
      );

      expect(results).toHaveLength(1);
    });
  });

  describe('applyPhysicsWeightingFromTags()', () => {
    it('returns empty array for results without tags', async () => {
      const anchorResults: SearchResult[] = [
        {
          id: 'anchor-1',
          content: 'anchor content',
          source: 'test.ts',
          timestamp: Date.now(),
          buckets: ['inbox'],
          tags: [],
          epochs: '',
          provenance: 'internal',
          score: 100,
        },
      ];

      const results = await walker.applyPhysicsWeightingFromTags(anchorResults);
      expect(results).toEqual([]);
    });

    it('extracts tags and applies physics weighting', async () => {
      const anchorResults: SearchResult[] = [
        {
          id: 'anchor-1',
          content: 'anchor content',
          source: 'test.ts',
          timestamp: Date.now(),
          buckets: ['inbox'],
          tags: ['#test', '#physics'],
          epochs: '',
          provenance: 'internal',
          score: 100,
        },
      ];

      (db.run as vi.Mock).mockResolvedValue({
        rows: [
          {
            atom_id: 'node-1',
            shared_tag_count: 2,
            timestamp: Date.now().toString(),
            simhash: 'abc123',
            content: 'connected content',
            source_path: 'test.ts',
            tags: ['#test'],
            provenance: 'internal',
            type: 'thought',
            compound_id: 'compound-1',
            start_byte: 0,
            end_byte: 100,
          },
        ],
      });

      const results = await walker.applyPhysicsWeightingFromTags(anchorResults);

      expect(results).toHaveLength(1);
      expect(results[0].physics.gravity_score).toBeGreaterThan(0);
      expect(results[0].physics.connection_type).toBe('tag_walk_neighbor');
    });

    it('handles multiple tags from multiple anchors', async () => {
      const anchorResults: SearchResult[] = [
        {
          id: 'anchor-1',
          content: 'content 1',
          source: 'test1.ts',
          timestamp: Date.now(),
          buckets: ['inbox'],
          tags: ['#test', '#tag1'],
          epochs: '',
          provenance: 'internal',
          score: 100,
        },
        {
          id: 'anchor-2',
          content: 'content 2',
          source: 'test2.ts',
          timestamp: Date.now(),
          buckets: ['inbox'],
          tags: ['#test', '#tag2'],
          epochs: '',
          provenance: 'internal',
          score: 90,
        },
      ];

      (db.run as vi.Mock).mockResolvedValue({
        rows: [
          {
            atom_id: 'node-1',
            shared_tag_count: 3,
            timestamp: Date.now().toString(),
            simhash: 'abc123',
            content: 'test',
            source_path: 'test.ts',
            tags: ['#test'],
            provenance: 'internal',
            type: 'thought',
            compound_id: 'compound-1',
            start_byte: 0,
            end_byte: 100,
          },
        ],
      });

      const results = await walker.applyPhysicsWeightingFromTags(anchorResults);

      expect(results).toHaveLength(1);
    });

    it('respects maxPerHop from config', async () => {
      const anchorResults: SearchResult[] = [
        {
          id: 'anchor-1',
          content: 'anchor content',
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
        rows: Array.from({ length: 100 }, (_, i) => ({
          atom_id: `node-${i}`,
          shared_tag_count: 1,
          timestamp: Date.now().toString(),
          simhash: 'abc123',
          content: `content ${i}`,
          source_path: `test${i}.ts`,
          tags: ['#test'],
          provenance: 'internal',
          type: 'thought',
          compound_id: `compound-${i}`,
          start_byte: 0,
          end_byte: 100,
        })),
      });

      const results = await walker.applyPhysicsWeightingFromTags(
        anchorResults,
        0.1,
        { max_per_hop: 10 }
      );

      expect(results.length).toBeLessThanOrEqual(10);
    });

    it('sorts results by gravity score', async () => {
      const anchorResults: SearchResult[] = [
        {
          id: 'anchor-1',
          content: 'anchor content',
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
            atom_id: 'node-1',
            shared_tag_count: 2,
            timestamp: Date.now().toString(),
            simhash: 'abc123',
            content: 'test 1',
            source_path: 'test1.ts',
            tags: ['#test'],
            provenance: 'internal',
            type: 'thought',
            compound_id: 'compound-1',
            start_byte: 0,
            end_byte: 100,
          },
          {
            atom_id: 'node-2',
            shared_tag_count: 5,
            timestamp: Date.now().toString(),
            simhash: 'def456',
            content: 'test 2',
            source_path: 'test2.ts',
            tags: ['#test'],
            provenance: 'internal',
            type: 'thought',
            compound_id: 'compound-2',
            start_byte: 0,
            end_byte: 100,
          },
        ],
      });

      const results = await walker.applyPhysicsWeightingFromTags(anchorResults);

      expect(results[0].physics.gravity_score).toBeGreaterThanOrEqual(
        results[1].physics.gravity_score
      );
    });
  });

  describe('getConnectedNodesFromTags()', () => {
    it('returns empty array for empty tag list', async () => {
      const nodes = await (walker as any).getConnectedNodesFromTags([], 50);
      expect(nodes).toEqual([]);
    });

    it('fetches nodes connected by tags', async () => {
      const mockRows = [
        {
          atom_id: 'node-1',
          shared_tag_count: 3,
          timestamp: Date.now().toString(),
          simhash: 'abc123',
          content: 'test content',
          source_path: 'test.ts',
          tags: ['#test'],
          provenance: 'internal',
          type: 'thought',
          compound_id: 'compound-1',
          start_byte: 0,
          end_byte: 100,
        },
      ];

      (db.run as vi.Mock).mockResolvedValue({ rows: mockRows });

      const nodes = await (walker as any).getConnectedNodesFromTags(
        ['#test'],
        50
      );

      expect(nodes).toHaveLength(1);
      expect(nodes[0].atomId).toBe('node-1');
      expect(nodes[0].sharedTags).toBe(3);
    });

    it('handles database errors gracefully', async () => {
      (db.run as vi.Mock).mockRejectedValue(new Error('DB error'));

      const nodes = await (walker as any).getConnectedNodesFromTags(
        ['#test'],
        50
      );

      expect(nodes).toEqual([]);
    });

    it('respects limit parameter', async () => {
      const mockRows = Array.from({ length: 100 }, (_, i) => ({
        atom_id: `node-${i}`,
        shared_tag_count: 1,
        timestamp: Date.now().toString(),
        simhash: 'abc123',
        content: `content ${i}`,
        source_path: `test${i}.ts`,
        tags: ['#test'],
        provenance: 'internal',
        type: 'thought',
        compound_id: `compound-${i}`,
        start_byte: 0,
        end_byte: 100,
      }));

      (db.run as vi.Mock).mockResolvedValue({ rows: mockRows });

      const nodes = await (walker as any).getConnectedNodesFromTags(
        ['#test'],
        10
      );

      expect(nodes.length).toBeLessThanOrEqual(10);
    });
  });

  describe('applyPhysicsWeightingLegacy()', () => {
    it('wraps applyPhysicsWeighting for backward compatibility', async () => {
      const anchorResults: SearchResult[] = [
        {
          id: 'anchor-1',
          content: 'anchor content',
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
            atom_id: 'node-1',
            shared_tags: 3,
            timestamp: Date.now().toString(),
            simhash: 'abc123',
            content: 'test',
            source_path: 'test.ts',
            tags: ['#test'],
            provenance: 'internal',
            type: 'thought',
            compound_id: 'compound-1',
            start_byte: 0,
            end_byte: 100,
            gravity_score: 0.8,
            best_anchor_id: 'anchor-1',
            hop_distance: 1,
          },
        ],
      });

      const results = await walker.applyPhysicsWeightingLegacy(anchorResults);

      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('node-1');
    });

    it('returns empty array for empty input', async () => {
      const results = await walker.applyPhysicsWeightingLegacy([]);
      expect(results).toEqual([]);
    });
  });

  describe('formatTimeDrift()', () => {
    it('formats minutes ago', () => {
      const minutes = 30 * 60 * 1000; // 30 minutes
      const result = (walker as any).formatTimeDrift(minutes);
      expect(result).toContain('minutes ago');
    });

    it('formats hours ago', () => {
      const hours = 5 * 60 * 60 * 1000; // 5 hours
      const result = (walker as any).formatTimeDrift(hours);
      expect(result).toContain('hours ago');
    });

    it('formats days ago', () => {
      const days = 10 * 24 * 60 * 60 * 1000; // 10 days
      const result = (walker as any).formatTimeDrift(days);
      expect(result).toContain('days ago');
    });
  });

  describe('Edge Cases', () => {
    it('handles null content in results', async () => {
      const anchorResults: SearchResult[] = [
        {
          id: 'anchor-1',
          content: 'anchor content',
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
            atom_id: 'node-1',
            shared_tags: 3,
            timestamp: Date.now().toString(),
            simhash: 'abc123',
            content: null,
            source_path: null,
            tags: null,
            provenance: null,
            type: null,
            compound_id: null,
            start_byte: null,
            end_byte: null,
            gravity_score: 0.8,
            best_anchor_id: 'anchor-1',
            hop_distance: 1,
          },
        ],
      });

      const results = await walker.performRadialInflation(['anchor-1']);

      expect(results).toHaveLength(1);
      expect(results[0].result.content).toBe('');
      expect(results[0].result.source).toBe('');
    });

    it('handles missing hop distance', async () => {
      const mockRows = [
        {
          atom_id: 'node-1',
          shared_tags: 3,
          timestamp: Date.now().toString(),
          simhash: 'abc123',
          content: 'test',
          source_path: 'test.ts',
          tags: ['#test'],
          provenance: 'internal',
          type: 'thought',
          compound_id: 'compound-1',
          start_byte: 0,
          end_byte: 100,
          gravity_score: 0.8,
          best_anchor_id: 'anchor-1',
          hop_distance: null,
        },
      ];

      (db.run as vi.Mock).mockResolvedValue({ rows: mockRows });

      const results = await walker.performRadialInflation(['anchor-1']);

      expect(results[0].physics.hop_distance).toBeUndefined();
    });
  });

  describe('Integration Scenarios', () => {
    it('handles realistic search workflow', async () => {
      // Setup anchor results
      const anchorResults: SearchResult[] = [
        {
          id: 'anchor-1',
          content: 'TypeScript interface definition',
          source: 'src/types.ts',
          timestamp: Date.now() - 1000000,
          buckets: ['inbox'],
          tags: ['#typescript', '#interface', '#types'],
          epochs: '',
          provenance: 'internal',
          score: 100,
        },
      ];

      // Mock connected nodes
      (db.run as vi.Mock).mockResolvedValue({
        rows: [
          {
            atom_id: 'related-1',
            shared_tags: 2,
            timestamp: (Date.now() - 2000000).toString(),
            simhash: 'abc123',
            content: 'Related type definition',
            source_path: 'src/types2.ts',
            tags: ['#typescript', '#types'],
            provenance: 'internal',
            type: 'thought',
            compound_id: 'compound-1',
            start_byte: 0,
            end_byte: 500,
            gravity_score: 0.75,
            best_anchor_id: 'anchor-1',
            hop_distance: 1,
          },
          {
            atom_id: 'related-2',
            shared_tags: 1,
            timestamp: (Date.now() - 500000).toString(),
            simhash: 'def456',
            content: 'Implementation code',
            source_path: 'src/impl.ts',
            tags: ['#typescript'],
            provenance: 'internal',
            type: 'code',
            compound_id: 'compound-2',
            start_byte: 100,
            end_byte: 600,
            gravity_score: 0.60,
            best_anchor_id: 'anchor-1',
            hop_distance: 1,
          },
        ],
      });

      const results = await walker.applyPhysicsWeighting(anchorResults, 0.1, {}, 8000);

      expect(results).toHaveLength(2);
      expect(results[0].physics.gravity_score).toBeGreaterThan(
        results[1].physics.gravity_score
      );
      expect(results[0].physics.hop_distance).toBe(1);
      expect(results[0].physics.source_anchor_id).toBe('anchor-1');
    });
  });
});
