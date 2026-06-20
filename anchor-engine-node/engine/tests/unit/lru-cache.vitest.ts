/**
 * LRU Cache Tests
 *
 * Comprehensive tests for the LRU cache implementation with memory-pressure eviction
 * Tests cover: basic operations, TTL, LRU eviction, memory pressure, and statistics
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { LRUCache, createLRUCache } from '../../src/utils/lru-cache.js';
import * as v8 from 'v8';

describe('LRUCache', () => {
  describe('Basic Operations', () => {
    let cache: LRUCache<string, number>;

    beforeEach(() => {
      cache = createLRUCache({
        maxEntries: 5,
        ttlMs: 0, // No TTL for basic tests
        enableMemoryPressureEviction: false,
      });
    });

    afterEach(() => {
      cache.stop();
    });

    it('should set and get values', () => {
      cache.set('key1', 100);
      expect(cache.get('key1')).toBe(100);
    });

    it('should return undefined for missing keys', () => {
      expect(cache.get('nonexistent')).toBeUndefined();
    });

    it('should update existing keys', () => {
      cache.set('key1', 100);
      cache.set('key1', 200);
      expect(cache.get('key1')).toBe(200);
    });

    it('should check existence with has()', () => {
      cache.set('key1', 100);
      expect(cache.has('key1')).toBe(true);
      expect(cache.has('key2')).toBe(false);
    });

    it('should delete keys', () => {
      cache.set('key1', 100);
      expect(cache.delete('key1')).toBe(true);
      expect(cache.has('key1')).toBe(false);
      expect(cache.delete('key1')).toBe(false);
    });

    it('should clear all entries', () => {
      cache.set('key1', 100);
      cache.set('key2', 200);
      cache.clear();
      expect(cache.getStats().size).toBe(0);
    });
  });

  describe('LRU Eviction', () => {
    let cache: LRUCache<string, number>;

    beforeEach(() => {
      cache = createLRUCache({
        maxEntries: 3,
        ttlMs: 0,
        enableMemoryPressureEviction: false,
      });
    });

    afterEach(() => {
      cache.stop();
    });

    it('should evict least recently used entry when full', () => {
      cache.set('key1', 1);
      cache.set('key2', 2);
      cache.set('key3', 3);
      
      // Access key1 to make it recently used
      cache.get('key1');
      
      // Add new entry, should evict key2 (least recently used)
      cache.set('key4', 4);
      
      expect(cache.get('key1')).toBe(1); // Still exists
      expect(cache.get('key2')).toBeUndefined(); // Evicted
      expect(cache.get('key3')).toBe(3); // Still exists
      expect(cache.get('key4')).toBe(4); // New entry
    });

    it('should maintain LRU order on updates', () => {
      cache.set('key1', 1);
      cache.set('key2', 2);
      cache.set('key3', 3);
      
      // Update key1
      cache.set('key1', 100);
      
      // Add new entry, should evict key2
      cache.set('key4', 4);
      
      expect(cache.get('key1')).toBe(100);
      expect(cache.get('key2')).toBeUndefined();
      expect(cache.get('key3')).toBe(3);
      expect(cache.get('key4')).toBe(4);
    });

    it('should track eviction statistics', () => {
      cache.set('key1', 1);
      cache.set('key2', 2);
      cache.set('key3', 3);
      cache.set('key4', 4); // Should evict key1
      
      const stats = cache.getStats();
      expect(stats.evictions).toBe(1);
    });
  });

  describe('TTL (Time-To-Live)', () => {
    let cache: LRUCache<string, number>;

    beforeEach(() => {
      vi.useFakeTimers();
      cache = createLRUCache({
        maxEntries: 5,
        ttlMs: 1000, // 1 second TTL
        enableMemoryPressureEviction: false,
      });
    });

    afterEach(() => {
      vi.useRealTimers();
      cache.stop();
    });

    it('should expire entries after TTL', () => {
      cache.set('key1', 100);
      expect(cache.get('key1')).toBe(100);
      
      // Advance time past TTL
      vi.advanceTimersByTime(1100);
      
      expect(cache.get('key1')).toBeUndefined();
    });

    it('should not expire entries before TTL', () => {
      cache.set('key1', 100);
      
      // Advance time to just before TTL
      vi.advanceTimersByTime(900);
      
      expect(cache.get('key1')).toBe(100);
    });

    it('should reset TTL on update', () => {
      cache.set('key1', 100);
      
      // Advance time
      vi.advanceTimersByTime(800);
      
      // Update the key
      cache.set('key1', 200);
      
      // Advance time past original TTL
      vi.advanceTimersByTime(500);
      
      // Should still exist because TTL was reset
      expect(cache.get('key1')).toBe(200);
      
      // Advance past new TTL
      vi.advanceTimersByTime(600);
      
      expect(cache.get('key1')).toBeUndefined();
    });

    it('should track expiration statistics', () => {
      cache.set('key1', 100);
      vi.advanceTimersByTime(1100);
      cache.get('key1'); // Trigger expiration check
      
      const stats = cache.getStats();
      expect(stats.expirations).toBe(1);
    });

    it('should remove expired entries in batch', () => {
      cache.set('key1', 100);
      cache.set('key2', 200);
      cache.set('key3', 300);
      
      vi.advanceTimersByTime(1100);
      
      const removed = cache.removeExpired();
      expect(removed).toBe(3);
      expect(cache.getStats().size).toBe(0);
    });
  });

  describe('Cache Statistics', () => {
    let cache: LRUCache<string, number>;

    beforeEach(() => {
      cache = createLRUCache({
        maxEntries: 5,
        ttlMs: 0,
        enableMemoryPressureEviction: false,
      });
    });

    afterEach(() => {
      cache.stop();
    });

    it('should track hits and misses', () => {
      cache.set('key1', 100);
      
      cache.get('key1'); // Hit
      cache.get('key1'); // Hit
      cache.get('key2'); // Miss
      cache.get('key3'); // Miss
      
      const stats = cache.getStats();
      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(2);
      expect(stats.hitRate).toBe(0.5);
    });

    it('should report correct size', () => {
      expect(cache.getStats().size).toBe(0);
      
      cache.set('key1', 100);
      cache.set('key2', 200);
      
      expect(cache.getStats().size).toBe(2);
    });

    it('should include memory usage in stats', () => {
      const stats = cache.getStats();
      expect(stats.memoryUsage.heapUsed).toBeGreaterThan(0);
      expect(stats.memoryUsage.heapTotal).toBeGreaterThan(0);
      expect(stats.memoryUsage.percentageUsed).toBeGreaterThan(0);
    });
  });

  describe('Memory Pressure Eviction', () => {
    let cache: LRUCache<string, number>;

    beforeEach(() => {
      cache = createLRUCache({
        maxEntries: 10,
        ttlMs: 0,
        enableMemoryPressureEviction: true,
        memoryPressureThreshold: 70,
        criticalMemoryThreshold: 85,
      });
    });

    afterEach(() => {
      cache.stop();
    });

    it('should monitor memory usage', () => {
      const stats = cache.getStats();
      expect(stats.memoryUsage.percentageUsed).toBeGreaterThan(0);
      expect(stats.memoryUsage.percentageUsed).toBeLessThan(100);
    });

    it('should resize cache under memory pressure', () => {
      // Fill the cache
      for (let i = 0; i < 10; i++) {
        cache.set(`key${i}`, i);
      }
      
      expect(cache.getStats().size).toBe(10);
      
      // Manually trigger resize (simulating memory pressure)
      cache.resize(5);
      
      expect(cache.getStats().size).toBeLessThanOrEqual(5);
      expect(cache.getStats().maxEntries).toBe(5);
    });

    it('should evict entries when resized', () => {
      for (let i = 0; i < 10; i++) {
        cache.set(`key${i}`, i);
      }
      
      const initialEvictions = cache.getStats().evictions;
      
      cache.resize(3);
      
      const finalEvictions = cache.getStats().evictions;
      expect(finalEvictions).toBeGreaterThan(initialEvictions);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty cache operations', () => {
      const cache = createLRUCache({
        maxEntries: 5,
        ttlMs: 0,
        enableMemoryPressureEviction: false,
      });
      
      expect(cache.get('nonexistent')).toBeUndefined();
      expect(cache.delete('nonexistent')).toBe(false);
      expect(cache.has('nonexistent')).toBe(false);
      
      cache.stop();
    });

    it('should handle maxEntries of 1', () => {
      const cache = createLRUCache({
        maxEntries: 1,
        ttlMs: 0,
        enableMemoryPressureEviction: false,
      });
      
      cache.set('key1', 100);
      cache.set('key2', 200);
      
      expect(cache.get('key1')).toBeUndefined();
      expect(cache.get('key2')).toBe(200);
      
      cache.stop();
    });

    it('should handle large values', () => {
      const cache = createLRUCache({
        maxEntries: 5,
        ttlMs: 0,
        enableMemoryPressureEviction: false,
      });
      
      const largeValue = { data: new Array(1000).fill('x').join('') };
      cache.set('large', largeValue as any, 10000);
      
      expect(cache.get('large')).toEqual(largeValue);
      
      cache.stop();
    });

    it('should handle special characters in keys', () => {
      const cache = createLRUCache({
        maxEntries: 5,
        ttlMs: 0,
        enableMemoryPressureEviction: false,
      });
      
      const specialKeys = ['key with spaces', 'key\nwith\nnewlines', 'key\twith\ttabs', 'key:with:colons'];
      
      specialKeys.forEach((key, i) => {
        cache.set(key, i);
        expect(cache.get(key)).toBe(i);
      });
      
      cache.stop();
    });
  });

  describe('Cache Iteration', () => {
    let cache: LRUCache<string, number>;

    beforeEach(() => {
      cache = createLRUCache({
        maxEntries: 5,
        ttlMs: 0,
        enableMemoryPressureEviction: false,
      });
    });

    afterEach(() => {
      cache.stop();
    });

    it('should return all keys', () => {
      cache.set('key1', 1);
      cache.set('key2', 2);
      cache.set('key3', 3);
      
      const keys = cache.keys();
      expect(keys).toHaveLength(3);
      expect(keys).toContain('key1');
      expect(keys).toContain('key2');
      expect(keys).toContain('key3');
    });

    it('should return all values', () => {
      cache.set('key1', 1);
      cache.set('key2', 2);
      cache.set('key3', 3);
      
      const values = cache.values();
      expect(values).toHaveLength(3);
      expect(values).toContain(1);
      expect(values).toContain(2);
      expect(values).toContain(3);
    });

    it('should return all entries', () => {
      cache.set('key1', 1);
      cache.set('key2', 2);
      
      const entries = cache.entries();
      expect(entries).toHaveLength(2);
      
      const entryMap = new Map(entries);
      expect(entryMap.get('key1')).toBe(1);
      expect(entryMap.get('key2')).toBe(2);
    });
  });

  describe('Pre-configured Caches', () => {
    it('should export searchResultCache', async () => {
      const { searchResultCache } = await import('../../src/utils/lru-cache.js');
      expect(searchResultCache).toBeDefined();
      expect(searchResultCache.getStats().maxEntries).toBeGreaterThan(0);
    });

    it('should export queryParseCache', async () => {
      const { queryParseCache } = await import('../../src/utils/lru-cache.js');
      expect(queryParseCache).toBeDefined();
      expect(queryParseCache.getStats().maxEntries).toBe(500);
    });

    it('should export semanticExpansionCache', async () => {
      const { semanticExpansionCache } = await import('../../src/utils/lru-cache.js');
      expect(semanticExpansionCache).toBeDefined();
      expect(semanticExpansionCache.getStats().maxEntries).toBe(1000);
    });

    it('should export engramCache', async () => {
      const { engramCache } = await import('../../src/utils/lru-cache.js');
      expect(engramCache).toBeDefined();
      expect(engramCache.getStats().maxEntries).toBe(200);
    });
  });
});
