/**
 * Memory Management and Resource Optimization for ECE
 *
 * Implements efficient memory usage patterns and resource management
 * following Standard 062: Inference Worker Stability
 */
import * as os from 'os';
import * as v8 from 'v8';
import { config } from '../config/index.js';
/**
 * Default implementation using real system resources
 */
class DefaultSystemResources {
    getTotalMemory() {
        return os.totalmem();
    }
    getMemoryUsage() {
        return process.memoryUsage();
    }
    getHeapStatistics() {
        return v8.getHeapStatistics();
    }
    getHeapSpaceStatistics() {
        return v8.getHeapSpaceStatistics();
    }
    gc() {
        if (global.gc) {
            global.gc();
        }
    }
    hasGc() {
        return !!global.gc;
    }
}
export class ResourceManager {
    static instance;
    limits;
    lastGCTime = 0;
    gcCooldown = config.GC_COOLDOWN_MS; // Configurable cooldown between forced GC
    resources;
    monitoringInterval = null;
    constructor(resources) {
        this.resources = resources || new DefaultSystemResources();
        // Set default resource limits based on system capabilities
        const totalMemory = this.resources.getTotalMemory();
        this.limits = {
            maxHeapSize: totalMemory * 0.6, // Use up to 60% of total memory
            memoryThreshold: 0.7, // Optimize when 70% of heap is used
            maxAtomsInMemory: config.MAX_ATOMS_IN_MEMORY, // Configurable max atoms to keep in memory at once
            gcThreshold: 0.75, // Force GC when 75% of heap is used
        };
    }
    static getInstance() {
        if (!ResourceManager.instance) {
            ResourceManager.instance = new ResourceManager();
        }
        return ResourceManager.instance;
    }
    /**
     * Reset the singleton instance (for testing only)
     */
    static resetInstance() {
        // @ts-expect-error
        ResourceManager.instance = undefined;
    }
    /**
     * Create an instance with specific resources (for testing only)
     */
    static createInstanceForTesting(resources) {
        ResourceManager.instance = new ResourceManager(resources);
        return ResourceManager.instance;
    }
    /**
     * Get current memory statistics
     */
    getMemoryStats() {
        const usage = this.resources.getMemoryUsage();
        const heapStats = this.resources.getHeapStatistics();
        const heapSpaces = this.getHeapSpaceInfo();
        return {
            rss: usage.rss,
            heapTotal: usage.heapTotal,
            heapUsed: usage.heapUsed,
            external: usage.external,
            arrayBuffers: usage.arrayBuffers,
            percentageUsed: (usage.heapUsed / heapStats.heap_size_limit) * 100, // Correct metric relative to V8 limit
            heapSpaces,
        };
    }
    /**
     * Get detailed heap space information
     */
    getHeapSpaceInfo() {
        try {
            const spaces = this.resources.getHeapSpaceStatistics();
            return spaces.map(space => ({
                name: space.space_name,
                size: space.space_size,
                used: space.space_used_size,
                available: space.space_available_size,
                physical: space.physical_space_size,
            }));
        }
        catch (error) {
            // If heap space stats are not available, return empty array
            console.warn('Could not retrieve heap space statistics:', error);
            return [];
        }
    }
    /**
     * Check if memory usage is approaching limits
     */
    isMemoryCritical() {
        const stats = this.getMemoryStats();
        return stats.percentageUsed > this.limits.gcThreshold * 100;
    }
    /**
     * Check if optimization is needed
     */
    needsOptimization() {
        const stats = this.getMemoryStats();
        return stats.percentageUsed > this.limits.memoryThreshold * 100;
    }
    /**
     * Perform garbage collection if needed and allowed
     */
    performGCIfNeeded() {
        if (!this.needsOptimization()) {
            return;
        }
        const now = Date.now();
        if (now - this.lastGCTime < this.gcCooldown) {
            // Still in cooldown period
            return;
        }
        this.performGarbageCollection();
    }
    /**
     * Force garbage collection (requires --expose-gc flag)
     */
    performGarbageCollection() {
        this.lastGCTime = Date.now();
        try {
            if (this.resources.hasGc()) {
                console.log('[ResourceManager] Performing forced garbage collection...');
                this.resources.gc();
                console.log('[ResourceManager] Garbage collection completed.');
            }
            else {
                console.warn('[ResourceManager] Garbage collection not available. Run with --expose-gc flag for manual GC.');
            }
        }
        catch (error) {
            console.error('[ResourceManager] Error during garbage collection:', error);
        }
    }
    /**
     * Optimize memory usage by clearing caches and releasing unused resources
     */
    optimizeMemory() {
        console.log('[ResourceManager] Starting memory optimization...');
        // Clear any internal caches (implement as needed)
        this.clearInternalCaches();
        // Perform GC if needed
        this.performGCIfNeeded();
        // Log memory stats after optimization
        const stats = this.getMemoryStats();
        console.log(`[ResourceManager] Memory optimization completed. Heap usage: ${stats.percentageUsed.toFixed(2)}%`);
    }
    /**
     * Clear internal caches to free up memory
     */
    clearInternalCaches() {
        // This is where you would clear any application-specific caches
        // For example, atom caches, search result caches, etc.
        console.log('[ResourceManager] Clearing internal caches...');
        // Example: Clear any cached search results older than 5 minutes
        // This would be implemented based on your specific caching needs
        // Example: Clear any temporary data structures
        // This would be implemented based on your specific needs
    }
    /**
     * Get resource limits
     */
    getResourceLimits() {
        return { ...this.limits };
    }
    /**
     * Update resource limits
     */
    updateLimits(newLimits) {
        this.limits = { ...this.limits, ...newLimits };
    }
    /**
     * Monitor memory usage and trigger optimizations
     */
    startMonitoring(intervalMs = config.MONITORING_INTERVAL_MS) {
        if (this.monitoringInterval !== null) {
            this.stopMonitoring();
        }
        console.log(`[ResourceManager] Starting memory monitoring (interval: ${intervalMs}ms)`);
        this.monitoringInterval = setInterval(() => {
            const stats = this.getMemoryStats();
            if (stats.percentageUsed > this.limits.gcThreshold * 100) {
                console.log(`[ResourceManager] Memory usage critical: ${stats.percentageUsed.toFixed(2)}%`);
                this.performGCIfNeeded();
            }
            else if (stats.percentageUsed > this.limits.memoryThreshold * 100) {
                console.log(`[ResourceManager] Memory usage high: ${stats.percentageUsed.toFixed(2)}%`);
                this.optimizeMemory();
            }
            // Log memory stats periodically if in debug mode
            if (process.env.NODE_ENV === 'development' || process.env.DEBUG_MEMORY) {
                console.log(`[ResourceManager] RSS: ${(stats.rss / 1024 / 1024).toFixed(2)}MB, Heap: ${stats.percentageUsed.toFixed(2)}%`);
            }
        }, intervalMs);
    }
    /**
     * Stop memory monitoring
     */
    stopMonitoring() {
        if (this.monitoringInterval !== null) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = null;
            console.log('[ResourceManager] Stopped memory monitoring');
        }
    }
}
// Export singleton instance
export const resourceManager = ResourceManager.getInstance();
// Initialize monitoring if enabled
if (process.env.ECE_MEMORY_MONITORING !== 'false') {
    resourceManager.startMonitoring();
}
