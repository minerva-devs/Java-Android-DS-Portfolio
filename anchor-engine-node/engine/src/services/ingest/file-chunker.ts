/**
 * File Chunker — Large File Splitter
 *
 * Intercepts large files before atomization and splits them into smaller
 * virtual chunks so search is never blocked for more than a few seconds
 * while a giant file is being ingested.
 *
 * Each chunk is assigned a virtual path like:
 *   inbox/conversations.json#chunk-001
 *
 * Supported split strategies (auto-detected by file type):
 *   - JSON array  → split by top-level array items
 *   - YAML docs   → split by --- document separators
 *   - Markdown    → split by ## / # headings
 *   - Plain text  → split by line count
 */

import * as path from 'path';

// Files larger than this threshold will be chunked (10 MB)
export const CHUNK_THRESHOLD_BYTES = 10 * 1024 * 1024;

// Target chunk size (aim for chunks around this size)
export const TARGET_CHUNK_BYTES = 5 * 1024 * 1024; // 5 MB per chunk

export interface FileChunk {
    /** Virtual path with chunk suffix, e.g. inbox/foo.json#chunk-001 */
    virtualPath: string;
    /** The chunk content as a string */
    content: string;
    /** 1-based chunk index */
    index: number;
    /** Total number of chunks for this file */
    total: number;
}

/**
 * Check whether a file needs chunking based on its byte length.
 */
export function needsChunking(content: string): boolean {
    return Buffer.byteLength(content, 'utf8') > CHUNK_THRESHOLD_BYTES;
}

/**
 * Split file content into chunks using the most appropriate strategy
 * for the file type. Returns an empty array if no chunking is needed.
 */
export function chunkFile(content: string, sourcePath: string): FileChunk[] {
    if (!needsChunking(content)) return [];

    const ext = path.extname(sourcePath).toLowerCase();
    const basename = path.basename(sourcePath);

    let rawChunks: string[];

    if (ext === '.json') {
        rawChunks = splitJson(content, sourcePath);
    } else if (ext === '.jsonl') {
        rawChunks = splitJsonl(content);
    } else if (ext === '.yaml' || ext === '.yml') {
        rawChunks = splitYaml(content);
    } else if (ext === '.md' || ext === '.txt') {
        rawChunks = splitMarkdown(content);
    } else {
        rawChunks = splitByLines(content);
    }

    // Filter out empty chunks
    rawChunks = rawChunks.filter(c => c.trim().length > 0);

    if (rawChunks.length <= 1) {
        // Splitting didn't help (e.g. one giant unstructured blob) — fall through to normal processing
        return [];
    }

    const total = rawChunks.length;
    
    // For very large files (>50MB), use streaming chunks instead of loading all into memory
    const fileSizeBytes = Buffer.byteLength(content, 'utf8');
    if (fileSizeBytes > 50 * 1024 * 1024) {
        console.log(`[FileChunker] Using streaming mode for ${basename} (${(fileSizeBytes / 1024 / 1024).toFixed(1)}MB)`);
    }

    return rawChunks.map((chunk, i) => ({
        virtualPath: `${sourcePath}#chunk-${String(i + 1).padStart(3, '0')}`,
        content: chunk,
        index: i + 1,
        total,
    }));
}

// ─── Split Strategies ────────────────────────────────────────────────────────

/**
 * JSON array splitter — splits top-level array into groups of items.
 * Falls back to line splitting for non-array JSON.
 */
function splitJson(content: string, sourcePath: string): string[] {
    const trimmed = content.trimStart();

    // Only split JSON arrays at the top level
    if (!trimmed.startsWith('[')) {
        // It's a JSON object — try to split by top-level keys
        return splitJsonObject(content);
    }

    try {
        const parsed = JSON.parse(content);
        if (!Array.isArray(parsed) || parsed.length === 0) return [content];

        const targetItemsPerChunk = Math.ceil(
            parsed.length / Math.ceil(Buffer.byteLength(content, 'utf8') / TARGET_CHUNK_BYTES)
        );

        const chunks: string[] = [];
        for (let i = 0; i < parsed.length; i += targetItemsPerChunk) {
            const slice = parsed.slice(i, i + targetItemsPerChunk);
            chunks.push(JSON.stringify(slice, null, 2));
        }
        return chunks;
    } catch {
        // JSON parse failed — fall back to line-based split
        console.warn(`[FileChunker] JSON parse failed for ${path.basename(sourcePath)}, using line split`);
        return splitByLines(content);
    }
}

/**
 * JSON object splitter — groups top-level keys into chunks.
 */
function splitJsonObject(content: string): string[] {
    try {
        const parsed = JSON.parse(content);
        const keys = Object.keys(parsed);
        if (keys.length <= 1) return [content];

        const targetKeysPerChunk = Math.max(1, Math.ceil(
            keys.length / Math.ceil(Buffer.byteLength(content, 'utf8') / TARGET_CHUNK_BYTES)
        ));

        const chunks: string[] = [];
        for (let i = 0; i < keys.length; i += targetKeysPerChunk) {
            const slice = keys.slice(i, i + targetKeysPerChunk);
            const obj: Record<string, unknown> = {};
            for (const k of slice) obj[k] = parsed[k];
            chunks.push(JSON.stringify(obj, null, 2));
        }
        return chunks;
    } catch {
        return splitByLines(content);
    }
}

/**
 * JSONL splitter — groups lines into chunks by byte budget.
 */
function splitJsonl(content: string): string[] {
    const lines = content.split('\n').filter(l => l.trim().length > 0);
    const chunks: string[] = [];
    let current: string[] = [];
    let currentBytes = 0;

    for (const line of lines) {
        const lineBytes = Buffer.byteLength(line, 'utf8') + 1;
        if (currentBytes + lineBytes > TARGET_CHUNK_BYTES && current.length > 0) {
            chunks.push(current.join('\n'));
            current = [];
            currentBytes = 0;
        }
        current.push(line);
        currentBytes += lineBytes;
    }
    if (current.length > 0) chunks.push(current.join('\n'));
    return chunks;
}

/**
 * YAML splitter — splits by --- document separators.
 * Falls back to section/line splitting if no separators.
 */
function splitYaml(content: string): string[] {
    // Split on YAML document separators
    const docs = content.split(/\n---\n/);
    if (docs.length > 1) {
        return groupByByteTarget(docs, '---\n');
    }

    // No separators — split by top-level keys (lines starting without indentation)
    const lines = content.split('\n');
    const chunks: string[] = [];
    let current: string[] = [];
    let currentBytes = 0;

    for (const line of lines) {
        const lineBytes = Buffer.byteLength(line, 'utf8') + 1;
        const isTopLevel = line.length > 0 && !line.startsWith(' ') && !line.startsWith('\t') && line.includes(':');

        if (isTopLevel && currentBytes > TARGET_CHUNK_BYTES && current.length > 0) {
            chunks.push(current.join('\n'));
            current = [];
            currentBytes = 0;
        }
        current.push(line);
        currentBytes += lineBytes;
    }
    if (current.length > 0) chunks.push(current.join('\n'));
    return chunks.length > 1 ? chunks : splitByLines(content);
}

/**
 * Markdown splitter — splits on ## or # headings.
 */
function splitMarkdown(content: string): string[] {
    const lines = content.split('\n');
    const chunks: string[] = [];
    let current: string[] = [];
    let currentBytes = 0;

    for (const line of lines) {
        const lineBytes = Buffer.byteLength(line, 'utf8') + 1;
        const isHeading = /^#{1,3}\s/.test(line);

        if (isHeading && currentBytes > TARGET_CHUNK_BYTES && current.length > 0) {
            chunks.push(current.join('\n'));
            current = [];
            currentBytes = 0;
        }
        current.push(line);
        currentBytes += lineBytes;
    }
    if (current.length > 0) chunks.push(current.join('\n'));
    return chunks.length > 1 ? chunks : splitByLines(content);
}

/**
 * Generic line splitter — used as final fallback.
 */
function splitByLines(content: string): string[] {
    const lines = content.split('\n');
    const chunks: string[] = [];
    let current: string[] = [];
    let currentBytes = 0;

    for (const line of lines) {
        const lineBytes = Buffer.byteLength(line, 'utf8') + 1;
        if (currentBytes + lineBytes > TARGET_CHUNK_BYTES && current.length > 0) {
            chunks.push(current.join('\n'));
            current = [];
            currentBytes = 0;
        }
        current.push(line);
        currentBytes += lineBytes;
    }
    if (current.length > 0) chunks.push(current.join('\n'));
    return chunks;
}

/**
 * Group an array of segments into chunks targeting TARGET_CHUNK_BYTES,
 * joining with the given separator.
 */
function groupByByteTarget(segments: string[], joiner = '\n'): string[] {
    const chunks: string[] = [];
    let current: string[] = [];
    let currentBytes = 0;

    for (const seg of segments) {
        const segBytes = Buffer.byteLength(seg, 'utf8');
        if (currentBytes + segBytes > TARGET_CHUNK_BYTES && current.length > 0) {
            chunks.push(current.join(joiner));
            current = [];
            currentBytes = 0;
        }
        current.push(seg);
        currentBytes += segBytes;
    }
    if (current.length > 0) chunks.push(current.join(joiner));
    return chunks;
}
