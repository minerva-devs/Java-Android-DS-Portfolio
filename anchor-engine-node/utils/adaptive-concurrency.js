/**
 * Adaptive Concurrency Utility
 *
 * Automatically switches between sequential and parallel processing
 * based on available system memory. Optimized for:
 * - Low-memory environments (Termux/Android): Sequential processing
 * - High-memory systems (64GB laptops): Parallel processing
 *
 * Standards: 132 - Adaptive Concurrency Control
 */
import os from 'os';
import * as fs from 'fs';
import { PATHS } from '../config/paths.js';
const USER_SETTINGS_PATH = PATHS.USER_SETTINGS;
// In-memory cache for settings
let cachedSettings = null;
let settingsLastRead = 0;
const SETTINGS_CACHE_MS = 5000; // Cache for 5 seconds
/**
 * Load adaptive concurrency settings from user_settings.json
 * Falls back to environment variables, then defaults
 */
function loadUserSettings() {
    const now = Date.now();
    // Return cached settings if still valid
    if (cachedSettings && (now - settingsLastRead) < SETTINGS_CACHE_MS) {
        return cachedSettings;
    }
    try {
        if (fs.existsSync(USER_SETTINGS_PATH)) {
            const content = fs.readFileSync(USER_SETTINGS_PATH, 'utf-8');
            const settings = JSON.parse(content);
            cachedSettings = settings.adaptive_concurrency || {};
            settingsLastRead = now;
            return cachedSettings;
        }
    }
    catch (error) {
        console.warn('[AdaptiveConcurrency] Failed to load user_settings.json:', error);
    }
    return {};
}
/**
 * Get environment setting from user_settings.json
 * 'auto' | 'low_memory' | 'high_memory'
 */
function getEnvironmentMode() {
    const settings = loadUserSettings();
    const mode = settings.environment || process.env.ANCHOR_CONCURRENCY_ENV;
    if (mode === 'low_memory' || mode === 'high_memory' || mode === 'auto') {
        return mode;
    }
    return 'auto';
}
/**
 * Get current system memory information
 */
export function getSystemMemoryInfo(config) {
    const totalBytes = os.totalmem();
    const freeBytes = os.freemem();
    const usedBytes = totalBytes - freeBytes;
    const totalMB = Math.floor(totalBytes / 1024 / 1024);
    const freeMB = Math.floor(freeBytes / 1024 / 1024);
    const usedMB = Math.floor(usedBytes / 1024 / 1024);
    const usagePercent = Math.round((usedBytes / totalBytes) * 100);
    const thresholds = getThresholds(config);
    return {
        totalMB,
        freeMB,
        usedMB,
        usagePercent,
        isLowMemory: freeMB < thresholds.sequentialThresholdMB,
        isHighMemory: freeMB > thresholds.parallelThresholdMB,
    };
}
/**
 * Get configured thresholds with user_settings.json and environment overrides
 * Priority: config param > user_settings.json > environment variables > defaults
 */
function getThresholds(config) {
    const userSettings = loadUserSettings();
    const environmentMode = getEnvironmentMode();
    // Environment variable overrides (highest priority after config param)
    const envSequential = process.env.ANCHOR_SEQUENTIAL_THRESHOLD_MB;
    const envParallel = process.env.ANCHOR_PARALLEL_THRESHOLD_MB;
    const envMaxConcurrency = process.env.ANCHOR_MAX_CONCURRENCY;
    const envForceSequential = process.env.ANCHOR_FORCE_SEQUENTIAL;
    const envForceParallel = process.env.ANCHOR_FORCE_PARALLEL;
    // Determine force flags based on environment mode from user_settings.json
    let forceSequential = config?.forceSequential ?? false;
    let forceParallel = config?.forceParallel ?? false;
    if (environmentMode === 'low_memory') {
        forceSequential = true;
        forceParallel = false;
    }
    else if (environmentMode === 'high_memory') {
        forceSequential = false;
        forceParallel = true;
    }
    // Environment variables can override user_settings.json
    if (envForceSequential === 'true')
        forceSequential = true;
    if (envForceParallel === 'true')
        forceParallel = true;
    return {
        sequentialThresholdMB: config?.sequentialThresholdMB ??
            (envSequential ? parseInt(envSequential, 10) :
                (userSettings.sequential_threshold_mb ?? 2048)),
        parallelThresholdMB: config?.parallelThresholdMB ??
            (envParallel ? parseInt(envParallel, 10) :
                (userSettings.parallel_threshold_mb ?? 8192)),
        maxConcurrency: config?.maxConcurrency ??
            (envMaxConcurrency ? parseInt(envMaxConcurrency, 10) :
                (userSettings.max_concurrency ?? 5)),
        lowMemoryBatchSize: config?.lowMemoryBatchSize ??
            (userSettings.low_memory_batch_size ?? 1),
        highMemoryBatchSize: config?.highMemoryBatchSize ??
            (userSettings.high_memory_batch_size ?? 20),
        forceSequential,
        forceParallel,
        environmentMode,
    };
}
/**
 * Determine if we should use sequential processing
 */
export function shouldUseSequential(config) {
    const thresholds = getThresholds(config);
    // Force flags take precedence
    if (thresholds.forceSequential)
        return true;
    if (thresholds.forceParallel)
        return false;
    // Auto-detect based on memory
    const memory = getSystemMemoryInfo(config);
    return memory.isLowMemory;
}
/**
 * Get the optimal batch size for current memory conditions
 */
export function getOptimalBatchSize(config) {
    const thresholds = getThresholds(config);
    const memory = getSystemMemoryInfo(config);
    if (thresholds.forceSequential || memory.isLowMemory) {
        return config?.lowMemoryBatchSize ?? thresholds.lowMemoryBatchSize ?? 1;
    }
    if (memory.isHighMemory) {
        return config?.highMemoryBatchSize ?? thresholds.highMemoryBatchSize ?? 20;
    }
    // Adaptive: scale between low and high based on available memory
    const ratio = (memory.freeMB - thresholds.sequentialThresholdMB) /
        (thresholds.parallelThresholdMB - thresholds.sequentialThresholdMB);
    const lowSize = config?.lowMemoryBatchSize ?? thresholds.lowMemoryBatchSize ?? 1;
    const highSize = config?.highMemoryBatchSize ?? thresholds.highMemoryBatchSize ?? 20;
    return Math.floor(lowSize + (highSize - lowSize) * Math.min(ratio, 1));
}
/**
 * Get the optimal concurrency level for current memory conditions
 */
export function getOptimalConcurrency(config) {
    const thresholds = getThresholds(config);
    const memory = getSystemMemoryInfo(config);
    if (thresholds.forceSequential || memory.isLowMemory) {
        return 1; // Sequential
    }
    if (memory.isHighMemory) {
        // Use CPU count for high-memory systems, but cap at 16
        return Math.min(os.cpus().length, 16);
    }
    // Adaptive: use configured max concurrency for mid-range systems
    return thresholds.maxConcurrency;
}
/**
 * Process an array of items with adaptive concurrency
 * Automatically switches between sequential and parallel based on memory
 */
export async function processWithAdaptiveConcurrency(items, processor, config) {
    const results = [];
    const concurrency = getOptimalConcurrency(config);
    const batchSize = getOptimalBatchSize(config);
    // Log mode for debugging
    const memory = getSystemMemoryInfo(config);
    console.log(`[AdaptiveConcurrency] Mode: ${concurrency === 1 ? 'SEQUENTIAL' : `PARALLEL(${concurrency})`}, ` +
        `Batch: ${batchSize}, FreeMem: ${memory.freeMB}MB`);
    if (concurrency === 1) {
        // Sequential processing - memory safe
        for (let i = 0; i < items.length; i++) {
            const result = await processor(items[i], i);
            results.push(result);
            // Periodic GC hint for low-memory environments
            if ((i + 1) % batchSize === 0 && global.gc) {
                global.gc();
            }
        }
    }
    else {
        // Parallel processing with controlled concurrency
        for (let i = 0; i < items.length; i += batchSize) {
            const batch = items.slice(i, i + batchSize);
            const batchPromises = batch.map((item, batchIndex) => processor(item, i + batchIndex));
            const batchResults = await Promise.all(batchPromises);
            results.push(...batchResults);
            // Optional GC between batches on mid-range systems
            if (global.gc && !memory.isHighMemory) {
                global.gc();
            }
        }
    }
    return results;
}
/**
 * Process items in batches with automatic memory management
 * Always uses sequential processing within batches for memory safety
 */
export async function processInBatches(items, processor, batchSize = getOptimalBatchSize()) {
    const results = [];
    for (let i = 0; i < items.length; i += batchSize) {
        const batch = items.slice(i, i + batchSize);
        // Process batch sequentially for memory safety
        for (let j = 0; j < batch.length; j++) {
            const result = await processor(batch[j], i + j);
            results.push(result);
        }
        // GC hint after each batch
        if (global.gc) {
            global.gc();
        }
    }
    return results;
}
/**
 * Get a summary of current concurrency settings for logging
 */
export function getConcurrencySummary(config) {
    const memory = getSystemMemoryInfo(config);
    const concurrency = getOptimalConcurrency(config);
    const batchSize = getOptimalBatchSize(config);
    const thresholds = getThresholds(config);
    const mode = concurrency === 1 ? 'SEQUENTIAL' : 'PARALLEL';
    const envMode = thresholds.environmentMode;
    return `[AdaptiveConcurrency] ${mode} mode (env=${envMode}): concurrency=${concurrency}, batch=${batchSize}, ` +
        `freeMem=${memory.freeMB}MB/${memory.totalMB}MB (${memory.usagePercent}% used)`;
}
/**
 * Get current environment mode setting
 * Useful for UI display
 */
export function getCurrentEnvironmentMode() {
    return getEnvironmentMode();
}
// Export default configuration for easy importing
export const AdaptiveConcurrency = {
    getSystemMemoryInfo,
    shouldUseSequential,
    getOptimalBatchSize,
    getOptimalConcurrency,
    processWithAdaptiveConcurrency,
    processInBatches,
    getConcurrencySummary,
    getCurrentEnvironmentMode,
};
export default AdaptiveConcurrency;
