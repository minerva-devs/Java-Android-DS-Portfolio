/**
 * WASM Module Loader
 *
 * Loads Rust-compiled WASM modules for cross-platform compatibility.
 * Replaces C++ native modules with zero-compilation WASM alternatives.
 *
 * Uses import.meta.resolve for proper ESM module resolution when
 * installed as an npm package.
 *
 * Standard 074: Native Module Acceleration (WASM Edition)
 *
 * FALLBACK MODE: If WASM modules fail to load, the engine continues
 * with pure JavaScript fallbacks. This ensures the engine remains
 * operational even when WASM is unavailable.
 */
import { createHash } from 'crypto';
// Module storage - initialized dynamically
let fingerprint_fn = null;
let distance_fn = null;
let sanitize_fn = null;
let atomize_fn = null;
let extract_keywords_fn = null;
let search_graph_fn = null;
const moduleStatus = {
    'anchor-fingerprint-wasm': { loaded: false, fallback: false },
    'anchor-atomizer-wasm': { loaded: false, fallback: false },
    'anchor-keyextract-wasm': { loaded: false, fallback: false },
    'anchor-tagwalker-wasm': { loaded: false, fallback: false },
};
// Track initialization state
let initialized = false;
let initPromise = null;
// ============================================
// FALLBACK IMPLEMENTATIONS
// ============================================
/**
 * Fallback fingerprint using Node.js crypto.
 * Produces a deterministic 64-bit hash from text.
 */
function fallbackFingerprint(text) {
    const hash = createHash('sha256').update(text).digest();
    // Take first 8 bytes as bigint
    let result = BigInt(0);
    for (let i = 0; i < 8; i++) {
        result = (result << BigInt(8)) | BigInt(hash[i]);
    }
    return result;
}
/**
 * Fallback Hamming distance for two bigint fingerprints.
 */
function fallbackDistance(a, b) {
    let xor = a ^ b;
    let distance = 0;
    while (xor !== BigInt(0)) {
        distance += Number(xor & BigInt(1));
        xor >>= BigInt(1);
    }
    return distance;
}
/**
 * Fallback text sanitization - removes control characters.
 */
function fallbackSanitize(text) {
    return text
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n');
}
/**
 * Fallback atomization - splits by paragraphs and sentences.
 */
function fallbackAtomize(text, strategy = 'prose') {
    const sanitized = fallbackSanitize(text);
    if (strategy === 'code') {
        // Split by double newlines for code
        return sanitized.split(/\n\n+/).filter(s => s.trim().length > 0);
    }
    // For prose: split by paragraphs, then by sentences if too long
    const paragraphs = sanitized.split(/\n\n+/).filter(s => s.trim().length > 0);
    const chunks = [];
    for (const para of paragraphs) {
        if (para.length <= 500) {
            chunks.push(para);
        }
        else {
            // Split long paragraphs by sentences
            const sentences = para.split(/(?<=[.!?])\s+/);
            let current = '';
            for (const sentence of sentences) {
                if (current.length + sentence.length > 500) {
                    if (current)
                        chunks.push(current);
                    current = sentence;
                }
                else {
                    current += (current ? ' ' : '') + sentence;
                }
            }
            if (current)
                chunks.push(current);
        }
    }
    return chunks.length > 0 ? chunks : [sanitized];
}
/**
 * Fallback keyword extraction using simple heuristics.
 */
function fallbackExtractKeywords(text, max) {
    // Simple keyword extraction: find capitalized words and repeated terms
    const words = text.toLowerCase().match(/\b[a-z]{4,}\b/g) || [];
    const freq = {};
    for (const word of words) {
        freq[word] = (freq[word] || 0) + 1;
    }
    // Sort by frequency and return top keywords
    return Object.entries(freq)
        .sort((a, b) => b[1] - a[1])
        .slice(0, max)
        .map(([word]) => word);
}
/**
 * Fallback graph search - simple text matching.
 */
function fallbackSearchGraph(query, data, _config) {
    // Simple fallback: return matching lines
    const lines = data.split('\n');
    const queryLower = query.toLowerCase();
    const matches = lines.filter(line => line.toLowerCase().includes(queryLower));
    return JSON.stringify({ matches: matches.slice(0, 10), total: matches.length });
}
// ============================================
// WASM MODULE INITIALIZATION
// ============================================
/**
 * Initialize all WASM modules using import.meta.resolve for proper ESM resolution.
 * Falls back to JavaScript implementations if WASM fails.
 */
async function initWasmModules() {
    if (initialized)
        return;
    if (initPromise)
        return initPromise;
    initPromise = (async () => {
        console.log('[WasmModuleLoader] Initializing WASM modules...');
        // Resolve and load fingerprint WASM
        try {
            const fingerprintPath = import.meta.resolve('@rbalchii/anchor-fingerprint-wasm');
            const fingerprintModule = await import(fingerprintPath);
            fingerprint_fn = fingerprintModule.fingerprint;
            distance_fn = fingerprintModule.distance;
            moduleStatus['anchor-fingerprint-wasm'] = { loaded: true, fallback: false };
            console.log('[WasmModuleLoader] ✓ anchor-fingerprint-wasm loaded');
        }
        catch (e) {
            console.warn('[WasmModuleLoader] ⚠ anchor-fingerprint-wasm unavailable, using fallback:', e.message);
            fingerprint_fn = fallbackFingerprint;
            distance_fn = fallbackDistance;
            moduleStatus['anchor-fingerprint-wasm'] = { loaded: true, fallback: true, error: e.message };
        }
        // Resolve and load atomizer WASM
        try {
            const atomizerPath = import.meta.resolve('@rbalchii/anchor-atomizer-wasm');
            const atomizerModule = await import(atomizerPath);
            sanitize_fn = atomizerModule.sanitize;
            atomize_fn = atomizerModule.atomize;
            moduleStatus['anchor-atomizer-wasm'] = { loaded: true, fallback: false };
            console.log('[WasmModuleLoader] ✓ anchor-atomizer-wasm loaded');
        }
        catch (e) {
            console.warn('[WasmModuleLoader] ⚠ anchor-atomizer-wasm unavailable, using fallback:', e.message);
            sanitize_fn = fallbackSanitize;
            atomize_fn = fallbackAtomize;
            moduleStatus['anchor-atomizer-wasm'] = { loaded: true, fallback: true, error: e.message };
        }
        // Resolve and load keyextract WASM
        try {
            const keyextractPath = import.meta.resolve('@rbalchii/anchor-keyextract-wasm');
            const keyextractModule = await import(keyextractPath);
            extract_keywords_fn = keyextractModule.extract_keywords;
            moduleStatus['anchor-keyextract-wasm'] = { loaded: true, fallback: false };
            console.log('[WasmModuleLoader] ✓ anchor-keyextract-wasm loaded');
        }
        catch (e) {
            console.warn('[WasmModuleLoader] ⚠ anchor-keyextract-wasm unavailable, using fallback:', e.message);
            extract_keywords_fn = fallbackExtractKeywords;
            moduleStatus['anchor-keyextract-wasm'] = { loaded: true, fallback: true, error: e.message };
        }
        // Resolve and load tagwalker WASM
        try {
            const tagwalkerPath = import.meta.resolve('@rbalchii/anchor-tagwalker-wasm');
            const tagwalkerModule = await import(tagwalkerPath);
            search_graph_fn = tagwalkerModule.search_graph;
            moduleStatus['anchor-tagwalker-wasm'] = { loaded: true, fallback: false };
            console.log('[WasmModuleLoader] ✓ anchor-tagwalker-wasm loaded');
        }
        catch (e) {
            console.warn('[WasmModuleLoader] ⚠ anchor-tagwalker-wasm unavailable, using fallback:', e.message);
            search_graph_fn = fallbackSearchGraph;
            moduleStatus['anchor-tagwalker-wasm'] = { loaded: true, fallback: true, error: e.message };
        }
        initialized = true;
        // Summary
        const fallbackCount = Object.values(moduleStatus).filter(s => s.fallback).length;
        if (fallbackCount > 0) {
            console.log(`[WasmModuleLoader] Initialized with ${fallbackCount} fallback(s) - engine operational`);
        }
        else {
            console.log('[WasmModuleLoader] All WASM modules loaded successfully');
        }
    })();
    return initPromise;
}
export class WasmModuleLoader {
    static instance;
    constructor() {
        // Initialize modules asynchronously
        initWasmModules().catch(e => {
            console.error('[WasmModuleLoader] Initialization error:', e);
        });
    }
    static getInstance() {
        if (!WasmModuleLoader.instance) {
            WasmModuleLoader.instance = new WasmModuleLoader();
        }
        return WasmModuleLoader.instance;
    }
    /**
     * Wait for all WASM modules to be initialized
     */
    async waitForInit() {
        await initWasmModules();
    }
    /**
     * Get detailed status for a specific module
     */
    getStatus(moduleName) {
        const key = `${moduleName}-wasm`;
        const status = moduleStatus[key];
        if (!status)
            return undefined;
        return {
            loaded: status.loaded,
            fallback: status.fallback,
            moduleName,
            error: status.error,
        };
    }
    /**
     * Get all module statuses
     */
    getAllStatus() {
        return Object.entries(moduleStatus).map(([key, status]) => ({
            loaded: status.loaded,
            fallback: status.fallback,
            moduleName: key.replace('-wasm', ''),
            error: status.error,
        }));
    }
    /**
     * Check if a module is loaded (either WASM or fallback)
     */
    isLoaded(moduleName) {
        const key = `${moduleName}-wasm`;
        return moduleStatus[key]?.loaded ?? false;
    }
    /**
     * Check if a module is using fallback implementation
     */
    isFallback(moduleName) {
        const key = `${moduleName}-wasm`;
        return moduleStatus[key]?.fallback ?? false;
    }
    /**
     * Get summary of module status for health checks
     */
    getSummary() {
        const statuses = Object.values(moduleStatus);
        return {
            total: statuses.length,
            wasm: statuses.filter(s => s.loaded && !s.fallback).length,
            fallback: statuses.filter(s => s.fallback).length,
            errors: statuses.filter(s => s.error).map(s => s.error),
        };
    }
    /**
     * Convenience methods for common operations
     * All methods now use fallbacks if WASM is unavailable
     */
    // Fingerprint operations
    fingerprint(text) {
        // Always available via fallback
        return fingerprint_fn(text);
    }
    distance(a, b) {
        // Always available via fallback
        return distance_fn(a, b);
    }
    // Atomizer operations
    sanitizeText(text) {
        // Always available via fallback
        return sanitize_fn(text);
    }
    atomizeText(text, strategy = 'prose') {
        // Always available via fallback
        return atomize_fn(text, strategy);
    }
    // Keyphrase extraction
    extractKeyphrases(text) {
        // Always available via fallback
        return extract_keywords_fn(text, 10);
    }
    // Graph search
    searchGraph(query, data, config) {
        // Always available via fallback
        return search_graph_fn(query, data, config);
    }
}
// Export singleton instance
export const wasmModuleLoader = WasmModuleLoader.getInstance();
// Export init function for explicit initialization
export { initWasmModules };
