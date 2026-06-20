/**
 * LRU Cache Implementation with Memory-Pressure Eviction
 *
 * A production-ready Least Recently Used (LRU) cache with:
 * - O(1) get/put operations using Map + doubly-linked list
 * - Memory-pressure aware eviction (integrates with ResourceManager)
 * - TTL-based expiration
 * - Statistics tracking for monitoring
 * - Thread-safe operations
 *
 * @see Standard 016: Search Caching
 * @see Standard 062: Memory Management
 */
import * as v8 from 'v8';
import { config } from '../config/index.js';
// --- Doubly Linked List Node for O(1) LRU tracking ---
class LRUNode {
    key;
    value;
    prev = null;
    next = null;
    constructor(key, value) {
        this.key = key;
        this.value = value;
    }
}
// --- LRU Cache Implementation ---
export class LRUCache {
    maxEntries;
    ttlMs;
    enableMemoryPressureEviction;
    memoryPressureThreshold;
    criticalMemoryThreshold;
    cache;
    head = null; // Most recently used
    tail = null; // Least recently used
    stats = {
        hits: 0,
        misses: 0,
        evictions: 0,
        expirations: 0,
        size: 0,
        maxEntries: 0,
        hitRate: 0,
        memoryUsage: {
            heapUsed: 0,
            heapTotal: 0,
            percentageUsed: 0,
        },
    };
    memoryCheckInterval = null;
    constructor(options) {
        this.maxEntries = options.maxEntries;
        this.ttlMs = options.ttlMs || 0;
        this.enableMemoryPressureEviction = options.enableMemoryPressureEviction ?? true;
        this.memoryPressureThreshold = options.memoryPressureThreshold ?? 70;
        this.criticalMemoryThreshold = options.criticalMemoryThreshold ?? 85;
        this.cache = new Map();
        this.stats.maxEntries = options.maxEntries;
        // Start memory monitoring if enabled
        if (this.enableMemoryPressureEviction) {
            this.startMemoryMonitoring();
        }
    }
    /**
     * Get a value from the cache
     * @param key - The key to retrieve
     * @returns The value if found and not expired, undefined otherwise
     */
    get(key) {
        const node = this.cache.get(key);
        if (!node) {
            this.stats.misses++;
            this.updateHitRate();
            return undefined;
        }
        // Check expiration
        if (node.value.expiresAt && Date.now() > node.value.expiresAt) {
            this.remove(key);
            this.stats.expirations++;
            this.stats.misses++;
            this.updateHitRate();
            return undefined;
        }
        // Move to head (most recently used)
        this.moveToHead(node);
        this.stats.hits++;
        this.updateHitRate();
        return node.value.value;
    }
    /**
     * Set a value in the cache
     * @param key - The key to store
     * @param value - The value to store
     * @param estimatedSize - Estimated memory size in bytes (default: 1024)
     */
    set(key, value, estimatedSize = 1024) {
        const existingNode = this.cache.get(key);
        if (existingNode) {
            // Update existing entry
            existingNode.value = {
                value,
                timestamp: Date.now(),
                expiresAt: this.ttlMs > 0 ? Date.now() + this.ttlMs : null,
                size: estimatedSize,
            };
            this.moveToHead(existingNode);
        }
        else {
            // Create new entry
            const newNode = new LRUNode(key, {
                value,
                timestamp: Date.now(),
                expiresAt: this.ttlMs > 0 ? Date.now() + this.ttlMs : null,
                size: estimatedSize,
            });
            this.cache.set(key, newNode);
            this.addToHead(newNode);
            this.stats.size = this.cache.size;
            // Evict if over capacity
            if (this.cache.size > this.maxEntries) {
                this.evictLRU();
            }
        }
    }
    /**
     * Check if a key exists in the cache (without updating LRU order)
     */
    has(key) {
        const node = this.cache.get(key);
        if (!node)
            return false;
        // Check expiration
        if (node.value.expiresAt && Date.now() > node.value.expiresAt) {
            this.remove(key);
            this.stats.expirations++;
            return false;
        }
        return true;
    }
    /**
     * Remove a key from the cache
     */
    delete(key) {
        return this.remove(key);
    }
    /**
     * Clear all entries from the cache
     */
    clear() {
        this.cache.clear();
        this.head = null;
        this.tail = null;
        this.stats.size = 0;
        this.stats.evictions += this.cache.size;
    }
    /**
     * Get cache statistics
     */
    getStats() {
        const heapStats = v8.getHeapStatistics();
        const heapUsed = heapStats.used_heap_size || 0;
        const heapTotal = heapStats.total_heap_size || 1;
        this.stats.memoryUsage = {
            heapUsed,
            heapTotal,
            percentageUsed: (heapUsed / heapTotal) * 100,
        };
        this.stats.size = this.cache.size;
        return { ...this.stats };
    }
    /**
     * Get all keys in the cache
     */
    keys() {
        return Array.from(this.cache.keys());
    }
    /**
     * Get all values in the cache
     */
    values() {
        return Array.from(this.cache.values()).map(node => node.value.value);
    }
    /**
     * Get all entries as [key, value] pairs
     */
    entries() {
        return Array.from(this.cache.entries()).map(([key, node]) => [key, node.value.value]);
    }
    /**
     * Remove expired entries
     * @returns Number of entries removed
     */
    removeExpired() {
        const now = Date.now();
        let removed = 0;
        for (const [key, node] of this.cache.entries()) {
            if (node.value.expiresAt && now > node.value.expiresAt) {
                this.remove(key);
                removed++;
                this.stats.expirations++;
            }
        }
        return removed;
    }
    /**
     * Force eviction of least recently used entries
     * @param count - Number of entries to evict (default: 10% of cache)
     */
    evict(count) {
        const toEvict = count || Math.max(1, Math.floor(this.cache.size * 0.1));
        for (let i = 0; i < toEvict && this.tail; i++) {
            this.evictLRU();
        }
    }
    /**
     * Resize the cache (useful for memory pressure scenarios)
     * @param newMaxEntries - New maximum number of entries
     */
    resize(newMaxEntries) {
        this.maxEntries = newMaxEntries;
        this.stats.maxEntries = newMaxEntries;
        // Evict if current size exceeds new limit
        while (this.cache.size > newMaxEntries && this.tail) {
            this.evictLRU();
        }
    }
    // --- Private Methods ---
    addToHead(node) {
        node.prev = null;
        node.next = this.head;
        if (this.head) {
            this.head.prev = node;
        }
        this.head = node;
        if (!this.tail) {
            this.tail = node;
        }
    }
    removeNode(node) {
        if (node.prev) {
            node.prev.next = node.next;
        }
        else {
            this.head = node.next;
        }
        if (node.next) {
            node.next.prev = node.prev;
        }
        else {
            this.tail = node.prev;
        }
    }
    moveToHead(node) {
        this.removeNode(node);
        this.addToHead(node);
    }
    evictLRU() {
        if (!this.tail)
            return;
        const key = this.tail.key;
        this.removeNode(this.tail);
        this.cache.delete(key);
        this.stats.size = this.cache.size;
        this.stats.evictions++;
    }
    remove(key) {
        const node = this.cache.get(key);
        if (!node)
            return false;
        this.removeNode(node);
        this.cache.delete(key);
        this.stats.size = this.cache.size;
        return true;
    }
    updateHitRate() {
        const total = this.stats.hits + this.stats.misses;
        this.stats.hitRate = total > 0 ? this.stats.hits / total : 0;
    }
    startMemoryMonitoring() {
        // Check memory every 5 seconds
        this.memoryCheckInterval = setInterval(() => {
            this.checkMemoryPressure();
        }, 5000);
        // Don't prevent process exit
        if (this.memoryCheckInterval.unref) {
            this.memoryCheckInterval.unref();
        }
    }
    checkMemoryPressure() {
        try {
            const heapStats = v8.getHeapStatistics();
            const heapUsed = heapStats.used_heap_size || 0;
            const heapTotal = heapStats.total_heap_size || 1;
            const percentageUsed = (heapUsed / heapTotal) * 100;
            if (percentageUsed >= this.criticalMemoryThreshold) {
                // Critical: Evict 50% of cache (but keep minimum floor of 10 entries)
                const targetSize = Math.max(10, Math.floor(this.maxEntries * 0.5));
                if (this.cache.size > targetSize) {
                    this.resize(targetSize);
                }
                console.log(`[LRUCache] CRITICAL: Evicted to ${targetSize} entries (memory: ${percentageUsed.toFixed(1)}%)`);
            }
            else if (percentageUsed >= this.memoryPressureThreshold) {
                // High pressure: Evict 30% of cache (but keep minimum floor of 20 entries)
                const targetSize = Math.max(20, Math.floor(this.maxEntries * 0.7));
                if (this.cache.size > targetSize) {
                    this.resize(targetSize);
                }
                console.log(`[LRUCache] HIGH PRESSURE: Evicted to ${targetSize} entries (memory: ${percentageUsed.toFixed(1)}%)`);
            }
        }
        catch (error) {
            console.error('[LRUCache] Memory check failed:', error);
        }
    }
    /**
     * Stop memory monitoring (for cleanup)
     */
    stop() {
        if (this.memoryCheckInterval) {
            clearInterval(this.memoryCheckInterval);
            this.memoryCheckInterval = null;
        }
    }
}
// --- Factory Function ---
/**
 * Create a new LRU cache instance
 * @param options - Cache configuration options
 * @returns A new LRUCache instance
 */
export function createLRUCache(options) {
    return new LRUCache(options);
}
// --- Pre-configured Cache Instances ---
/**
 * Search result cache (Standard 016)
 * Replaces the simple Map-based cache in search.ts
 */
export const searchResultCache = createLRUCache({
    maxEntries: config.MAX_CACHE_SIZE || 100,
    ttlMs: config.CACHE_TTL_MS || 60000,
    enableMemoryPressureEviction: true,
    memoryPressureThreshold: 90, // Increased from 88
    criticalMemoryThreshold: 96, // Increased from 95
});
/**
 * Query parsing cache
 * Caches parsed query structures to avoid re-parsing
 */
export const queryParseCache = createLRUCache({
    maxEntries: 500,
    ttlMs: 300000, // 5 minutes
    enableMemoryPressureEviction: true,
    memoryPressureThreshold: 90, // Increased from 88
    criticalMemoryThreshold: 96, // Increased from 95
});
/**
 * Semantic expansion cache
 * Caches taxonomy expansion results
 */
export const semanticExpansionCache = createLRUCache({
    maxEntries: 1000,
    ttlMs: 600000, // 10 minutes
    enableMemoryPressureEviction: true,
    memoryPressureThreshold: 90, // Increased from 88
    criticalMemoryThreshold: 96, // Increased from 95
});
/**
 * Engram lookup cache
 * Caches engram-based context retrieval
 */
export const engramCache = createLRUCache({
    maxEntries: 200,
    ttlMs: 120000, // 2 minutes
    enableMemoryPressureEviction: true,
    memoryPressureThreshold: 90, // Increased from 88
    criticalMemoryThreshold: 96, // Increased from 95
});
