/**
 * Watchdog Service
 *
 * Scans the Notebook directory for changes and ingests new content.
 * Uses 'chokidar' for efficient file watching.
 */

import * as chokidar from 'chokidar';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { db } from '../../core/db.js';
import { NOTEBOOK_DIR, PROJECT_ROOT, PATHS } from '../../config/paths.js';
import { ingestAtoms } from './ingest.js';
import { config } from '../../config/index.js';
import { pathManager } from '../../utils/path-manager.js';
import { systemStatus } from '../system-status.js';
import { needsChunking, chunkFile } from './file-chunker.js';
import { streamFileIntoChunks, STREAM_THRESHOLD_BYTES } from './streaming-file-chunker.js';

let watcher: chokidar.FSWatcher | null = null;
const IGNORE_PATTERNS = /(^|[\/\\])\../; // Ignore dotfiles
const IGNORE_PATHS = [
    'distilled',           // Ignore distillation outputs (prevent self-contamination)
    'distills',            // Ignore distills directory
    'synonym-ring',        // Ignore auto-generated synonym files
];

// Post-ingestion synonym generation
let ingestionTimeout: NodeJS.Timeout | null = null;
const INGESTION_DEBOUNCE_MS = 30000; // Wait 30 seconds after last ingestion

// Cumulative ingestion tracking - tracks total time across all ingested files
interface IngestionRecord {
    filePath: string;
    fileSize?: number;
    startTime: number;
    endTime?: number;
}

const ingestionLog: IngestionRecord[] = [];
let totalIngestionTime = 0;
let fileCount = 0;
let streamingFileWasProcessed = false; // prevent post-ingestion synonym generation on large corpora

async function triggerPostIngestionSynonyms() {
    // Skip entirely if a streaming file was processed in this session.
    // The synonym generator scans ALL atoms and blocks the event loop for
    // minutes on 184K+ atom corpora — safe to defer to next restart.
    if (streamingFileWasProcessed) {
        console.log('[Watchdog] Synonym generation skipped (streaming file processed this session)');
        return;
    }
    // Clear any pending timeout
    if (ingestionTimeout) {
        clearTimeout(ingestionTimeout);
    }

    // Set new timeout to generate synonyms after ingestion stops.
    // Wrapped in setImmediate so the current ingestion response can complete
    // before the heavy synonym computation begins, keeping the engine responsive.
    ingestionTimeout = setTimeout(() => {
        setImmediate(async () => {
            console.log('[Watchdog] Post-ingestion synonym generation starting...');
            try {
                const { AutoSynonymGenerator } = await import('../synonyms/auto-synonym-generator.js');
                const generator = new AutoSynonymGenerator();
                const synonyms = await generator.generateSynonymRings();
                const synonymDir = path.join(pathManager.getDatabasePath(), 'synonyms');
                if (!fs.existsSync(synonymDir)) {
                    fs.mkdirSync(synonymDir, { recursive: true });
                }
                const synonymPath = path.join(synonymDir, 'synonym-ring-auto.json');
                await generator.saveSynonymRings(synonyms, synonymPath);
                console.log(`[Watchdog] ✅ Post-ingestion synonym rings saved to ${synonymPath}`);
            } catch (error: any) {
                console.warn('[Watchdog] Post-ingestion synonym generation failed:', error.message);
            }
        });
    }, INGESTION_DEBOUNCE_MS);
}

export async function startWatchdog(customPaths?: string[]): Promise<void> {
    if (watcher) return;

    // If custom paths provided, use them instead of default inbox/external-inbox
    const pathsToUse = customPaths && customPaths.length > 0 ? customPaths : [];

    if (!fs.existsSync(NOTEBOOK_DIR)) {
        console.warn(`[Watchdog] Notebook directory not found: ${NOTEBOOK_DIR}. Skipping watch.`);
        return;
    }

    // If no paths provided, use defaults (inbox and external-inbox)
    if (pathsToUse.length === 0) {
        const inbox = PATHS.INBOX_DIR;
        const externalInbox = PATHS.EXTERNAL_INBOX_DIR;

        // Auto-create inbox directories if missing
        if (!fs.existsSync(inbox)) {
            fs.mkdirSync(inbox, { recursive: true });
            console.log(`[Watchdog] Created inbox directory: ${inbox}`);
        }
        if (!fs.existsSync(externalInbox)) {
            fs.mkdirSync(externalInbox, { recursive: true });
            console.log(`[Watchdog] Created external-inbox directory: ${externalInbox}`);
        }

        watcher = chokidar.watch([inbox, externalInbox], {
            ignored: IGNORE_PATTERNS,
            ignoreInitial: true,
            usePolling: true,
            interval: 1000,
            followSymlinks: false,
        });

        watcher.on('add', (filePath: string) => {
            console.log(`[Watchdog] File added: ${filePath}`);
            processFile(filePath, 'added');
        });

        watcher.on('change', (filePath: string) => {
            console.log(`[Watchdog] File changed: ${filePath}`);
            processFile(filePath, 'changed');
        });

        watcher.on('unlink', async (filePath: string) => {
            console.log(`[Watchdog] File removed: ${filePath}`);
            try {
                const relativePath = path.relative(NOTEBOOK_DIR, filePath);
                await atomicIngest.cleanupSourcePath(relativePath);
                await db.run('DELETE FROM sources WHERE path = $1', [relativePath]);
                console.log(`[Watchdog] ✅ Cleaned up database records for deleted file: ${relativePath}`);
            } catch (error: any) {
                console.error(`[Watchdog] Failed to clean up deleted file ${filePath}:`, error.message);
            }
        });

        watcher.on('error', (error: any) => {
            console.error('[Watchdog] Watch error:', error.message);
        });

        console.log(`[Watchdog] Watching inbox directories: ${inbox}, ${externalInbox}`);
    } else {
        // Use custom paths
        for (const customPath of pathsToUse) {
            if (!fs.existsSync(customPath)) {
                console.warn(`[Watchdog] Custom path does not exist: ${customPath}. Skipping.`);
                continue;
            }

            const watcherInstance = chokidar.watch([customPath], {
                ignored: IGNORE_PATTERNS,
                ignoreInitial: true,
            });

            watcherInstance.on('add', (filePath: string) => {
                console.log(`[Watchdog] File added: ${filePath}`);
                processFile(filePath, 'added');
            });

            watcherInstance.on('change', (filePath: string) => {
                console.log(`[Watchdog] File changed: ${filePath}`);
                processFile(filePath, 'changed');
            });

            watcherInstance.on('unlink', async (filePath: string) => {
                console.log(`[Watchdog] File removed: ${filePath}`);
                try {
                    const relativePath = path.relative(NOTEBOOK_DIR, filePath);
                    await atomicIngest.cleanupSourcePath(relativePath);
                    await db.run('DELETE FROM sources WHERE path = $1', [relativePath]);
                    console.log(`[Watchdog] ✅ Cleaned up database records for deleted file: ${relativePath}`);
                } catch (error: any) {
                    console.error(`[Watchdog] Failed to clean up deleted file ${filePath}:`, error.message);
                }
            });

            if (!watcher) {
                watcher = watcherInstance;
            }
        }

        console.log(`[Watchdog] Watching custom paths: ${pathsToUse.join(', ')}`);
    }

    // Start the manual ingestion scan after setting up watchers
    setTimeout(async () => {
        await scanInbox();
    }, 1000);
}

// ---
// Idle‑timer helper – postpones full‑corpus distillation until the ingestion pipeline is idle for a configurable period
let lastIngest = Date.now();
const idleMs = (config.distill_idle_minutes ?? 5) * 60 * 1000;
let idleTimer: NodeJS.Timeout | null = null;

function scheduleDistill(): void {
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(async () => {
        console.log('[Watchdog] Idle period elapsed – starting full‑corpus distillation');
        const { triggerFullDistillation } = await import('../../services/distillation/distill-manager.js');
        await triggerFullDistillation();
    }, idleMs);
}

function onFileAdded(): void {
    lastIngest = Date.now();
    scheduleDistill();
}
// ---
// ---

export async function addWatchPath(newPath: string): Promise<boolean> {
    if (!fs.existsSync(newPath)) {
        throw new Error(`Path does not exist: ${newPath}`);
    }

    // Add to watcher if it's running
    if (watcher) {
        watcher.add(newPath);
        console.log(`[Watchdog] Added dynamic watch path: ${newPath}`);
    } else {
        console.log(`[Watchdog] Path saved for later (watchdog not running): ${newPath}`);
    }

    // Update Config (In-Memory)
    if (!config.WATCHER_EXTRA_PATHS) config.WATCHER_EXTRA_PATHS = [];
    if (!config.WATCHER_EXTRA_PATHS.includes(newPath)) {
        config.WATCHER_EXTRA_PATHS.push(newPath);

        // Persist to user_settings.json (always do this, even if watchdog isn't running)
        try {
            const settingsPath = PATHS.USER_SETTINGS;
            if (fs.existsSync(settingsPath)) {
                const settingsRequest = await fs.promises.readFile(settingsPath, 'utf8');
                const settings = JSON.parse(settingsRequest);

                if (!settings.watcher) settings.watcher = {};
                if (!settings.watcher.extra_paths) settings.watcher.extra_paths = [];

                if (!settings.watcher.extra_paths.includes(newPath)) {
                    settings.watcher.extra_paths.push(newPath);
                    await fs.promises.writeFile(settingsPath, JSON.stringify(settings, null, 4));
                    console.log('[Watchdog] Persisted path to user_settings.json');
                }
            }
        } catch (e: any) {
            console.error(`[Watchdog] Failed to persist settings: ${e.message}`);
        }
    }

    return true;
}

export async function removeWatchPath(pathToRemove: string): Promise<boolean> {
    // Remove from chokidar watcher if it exists (watchdog is running)
    if (watcher) {
        watcher.unwatch(pathToRemove);
        console.log(`[Watchdog] Removed watch path: ${pathToRemove}`);
    } else {
        console.log(`[Watchdog] Path marked for removal (watchdog not running): ${pathToRemove}`);
    }

    // Update Config (In-Memory)
    if (config.WATCHER_EXTRA_PATHS && config.WATCHER_EXTRA_PATHS.includes(pathToRemove)) {
        config.WATCHER_EXTRA_PATHS = config.WATCHER_EXTRA_PATHS.filter((p: string) => p !== pathToRemove);

        // Persist to user_settings.json
        try {
            const settingsPath = PATHS.USER_SETTINGS;
            if (fs.existsSync(settingsPath)) {
                const settingsRequest = await fs.promises.readFile(settingsPath, 'utf8');
                const settings = JSON.parse(settingsRequest);

                if (settings.watcher && settings.watcher.extra_paths) {
                    settings.watcher.extra_paths = settings.watcher.extra_paths.filter((p: string) => p !== pathToRemove);
                    await fs.promises.writeFile(settingsPath, JSON.stringify(settings, null, 4));
                    console.log('[Watchdog] Persisted path removal to user_settings.json');
                }
            }
        } catch (e: any) {
            console.error(`[Watchdog] Failed to persist settings removal: ${e.message}`);
        }
    }

    // 🔥 HOT SLOTTING: Purge all database records for this path AND filesystem mirror
    try {
        const AtomicIngestService = await import('./ingest-atomic.js');
        const ingestService = new AtomicIngestService.AtomicIngestService();
        const purgeSummary = await ingestService.purgeDirectory(pathToRemove);
        console.log(`[Watchdog] 🧹 Hot-slotting complete: ${purgeSummary.atoms} atoms, ${purgeSummary.molecules} molecules, ${purgeSummary.files_cleaned} mirrored files`);
    } catch (purgeError: any) {
        console.error(`[Watchdog] ⚠️ Database purge failed for path ${pathToRemove}:`, purgeError.message);
        // Don't fail the entire operation — just log and continue
    }

    return true;
}

/**
 * Stop the watchdog service
 */
export async function stopWatchdog(): Promise<void> {
    if (watcher) {
        await watcher.close();
        watcher = null;
        console.log('[Watchdog] Stopped watching files');
    }
}

/**
 * Get watchdog status
 */
export function getWatcherStatus(): { isRunning: boolean; watchedPaths: string[] } {
    return {
        isRunning: watcher !== null,
        watchedPaths: [PATHS.INBOX_DIR, PATHS.EXTERNAL_INBOX_DIR, ...(config.WATCHER_EXTRA_PATHS || [])],
    };
}

/**
 * Trigger manual ingestion scan
 */
export async function triggerManualIngestion(): Promise<void> {
    console.log('[Watchdog] Manual ingestion triggered');
    await scanInbox();
}

async function scanInbox(): Promise<void> {
    const inbox = PATHS.INBOX_DIR;
    const externalInbox = PATHS.EXTERNAL_INBOX_DIR;

    // Scan inbox directory
    if (!fs.existsSync(inbox)) return;

    let filesProcessed = 0;
    let filesIngested = 0;

    const files = fs.readdirSync(inbox, { recursive: true }) as string[];
    console.log(`[ManualIngest] Found ${files.length} items in inbox`);

    for (const file of files) {
        const filePath = path.join(inbox, file);

        // Skip directories and ignored patterns
        if (fs.statSync(filePath).isDirectory()) continue;
        if (IGNORE_PATTERNS.test(file)) continue;

        filesProcessed++;
        console.log(`[ManualIngest] Processing file ${filesProcessed}: ${filePath}`);

        // Trigger actual ingestion by calling processFile
        try {
            const result = await processFile(filePath, 'manual');
            if (result.ingested) {
                filesIngested++;
                console.log(`[ManualIngest] Successfully ingested file ${filesIngested}: ${filePath}`);
            } else {
                console.log(`[ManualIngest] Skipped file ${filePath}: ${result.reason}`);
            }
        } catch (error: any) {
            console.error(`[ManualIngest] Failed to process ${file}:`, error.message);
        }
    }

    // Also scan external-inbox if it exists
    if (fs.existsSync(externalInbox)) {
        const externalFiles = fs.readdirSync(externalInbox, { recursive: true }) as string[];

        for (const file of externalFiles) {
            const filePath = path.join(externalInbox, file);

            if (fs.statSync(filePath).isDirectory()) continue;
            if (IGNORE_PATTERNS.test(file)) continue;

            filesProcessed++;

            try {
                const result = await processFile(filePath, 'manual');
                if (result.ingested) {
                    filesIngested++;
                }
            } catch (error: any) {
                console.error(`[ManualIngest] Failed to process ${file}:`, error.message);
            }
        }
    }

    // Also scan extra watched paths
    const extraPaths = config.WATCHER_EXTRA_PATHS || [];
    for (const extraPath of extraPaths) {
        if (!fs.existsSync(extraPath)) {
            console.log(`[ManualIngest] Extra path does not exist: ${extraPath}`);
            continue;
        }

        console.log(`[ManualIngest] Scanning extra path: ${extraPath}`);
        const extraFiles = fs.readdirSync(extraPath, { recursive: true }) as string[];
        console.log(`[ManualIngest] Found ${extraFiles.length} items in extra path`);

        for (const file of extraFiles) {
            const filePath = path.join(extraPath, file);

            if (fs.statSync(filePath).isDirectory()) continue;
            if (IGNORE_PATTERNS.test(file)) continue;

            filesProcessed++;
            console.log(`[ManualIngest] Processing ${file}`);

            try {
                const result = await processFile(filePath, 'manual');
                if (result.ingested) {
                    filesIngested++;
                }
            } catch (error: any) {
                console.error(`[ManualIngest] Failed to process ${file}:`, error.message);
            }
        }
    }

    // Print final summary
    const avgTime = fileCount > 0 ? (totalIngestionTime / fileCount).toFixed(2) : 'N/A';
    console.log(`[Watchdog] 📊 INGESTION SUMMARY: ${fileCount} files processed, Total time: ${totalIngestionTime.toFixed(2)}s, Avg per file: ${avgTime}s`);

    // Standard 076: Auto-distill disabled — distillation is triggered manually
    // via the UI or API until the distiller is mature enough for automatic runs.
    // Re-enable by uncommenting the block below.
    // if (filesIngested > 0) {
    //     try {
    //         const { radialDistill } = await import('../distillation/radial-distiller-v2.js');
    //         console.log(`[Watchdog] ⏳ Auto-distill starting (${filesIngested} files ingested)...`);
    //         await radialDistill({});
    //         console.log('[Watchdog] ✅ Auto-distill complete');
    //     } catch (error: any) {
    //         console.warn('[Watchdog] ⚠️ Auto-distill failed:', error.message);
    //     }
    // }

    console.log(`[ManualIngest] Processed ${filesProcessed} items, ingested ${filesIngested}`);
}

// Revert to AtomizerService for performance
import { AtomizerService } from './atomizer-service.js';
import { AtomicIngestService } from './ingest-atomic.js';

// Singleton Services
const atomizer = new AtomizerService();
const atomicIngest = new AtomicIngestService();

async function processFile(filePath: string, event: string): Promise<{ ingested: boolean; reason?: string }> {
    const fileStartTime = Date.now();
    console.log(`[Watchdog] Starting processFile: ${filePath}, event: ${event}`);

    // Accept markdown, text, YAML, CSV, JSON, JSONL, and HTML files
    if (!filePath.endsWith('.md') && !filePath.endsWith('.txt') && !filePath.endsWith('.yaml') &&
        !filePath.endsWith('.csv') && !filePath.endsWith('.json') && !filePath.endsWith('.jsonl') &&
        !filePath.endsWith('.html') && !filePath.endsWith('.htm')) {
        console.log(`[Watchdog] Skipping: ${filePath} - unsupported extension`);
        return { ingested: false, reason: 'unsupported_extension' };
    }
    if (filePath.includes('mirrored_brain')) {
        console.log(`[Watchdog] Skipping: ${filePath} - mirrored_brain path`);
        return { ingested: false, reason: 'mirrored_brain' };
    }

    console.log(`[Watchdog] Detected ${event}: ${filePath}`);

    // Set system status to ingesting
    systemStatus.setState('ingesting', `Processing: ${path.basename(filePath)}`);

    try {
        const stat = fs.statSync(filePath);
        if (stat.size === 0) return { ingested: false, reason: 'empty_file' };

        const relativePath = path.relative(NOTEBOOK_DIR, filePath);

        // Lightweight dedup for large streaming files — avoids reading the
        // entire file just for a hash. Uses mtime + size as a fingerprint.
        // Small files still use full SHA-256 hash for precision.
        const USE_STREAMING = stat.size > STREAM_THRESHOLD_BYTES && config.STREAMING?.ENABLED !== false;
        if (USE_STREAMING) streamingFileWasProcessed = true;
        let fileHash: string;

        if (USE_STREAMING) {
            fileHash = `stream:${stat.mtimeMs}:${stat.size}`;
        } else {
            const buffer = await fs.promises.readFile(filePath);
            fileHash = crypto.createHash('sha256').update(buffer).digest('hex');
        }

        // --- Change Detection ---
        const sourceQuery = 'SELECT path, hash FROM sources WHERE path = $1';
        const sourceResult = await db.run(sourceQuery, [relativePath]);

        if (sourceResult?.rows?.length > 0) {
            const row = sourceResult.rows[0];
            const existingHash = Array.isArray(row) ? row[1] : row.hash;
            if (existingHash === fileHash) {
                console.log(`[Watchdog] File unchanged (hash match): ${relativePath}`);
                systemStatus.setState('idle');
                return { ingested: false, reason: 'hash_match' };
            }
        }

        console.log(`[Watchdog] Processing Pipeline: ${relativePath} (${(stat.size / 1024 / 1024).toFixed(1)}MB${USE_STREAMING ? ', streaming' : ''})`);
        systemStatus.setProgress(0, 100, 'Starting ingestion...');

        // 3. DETERMINE METADATA
        // Determine buckets
        const parts = relativePath.split(path.sep);
        let bucket = 'notebook';

        // logic: if inside a root folder (inbox/external-inbox) and has a subfolder, use subfolder as bucket
        // otherwise use the root folder
        if (parts.length >= 2) {
            const root = parts[0];
            if ((root === 'inbox' || root === 'external-inbox') && parts.length > 2) {
                bucket = parts[1];
            } else {
                bucket = root;
            }
        }

        // Determine type (auto-detect HTML for cleaning)
        const ext = path.extname(filePath).replace('.', '');
        let type = ext || 'text';

        // Auto-detect HTML content for cleaning pipeline
        if (ext === 'html' || ext === 'htm') {
            type = 'web_page';  // Triggers full HTML cleaning
        }

        // Determine Provenance
        let provenance: 'internal' | 'external' = 'internal';
        if (relativePath.includes('external-inbox') || relativePath.includes('web_scrape')) {
            provenance = 'external';
        }

        // 3.5 Clean up existing database entries for this file and its chunks to avoid duplicates
        await atomicIngest.cleanupSourcePath(relativePath);

        let finalCompound: any = null;
        let totalAtomsCount = 0;
        const filename = relativePath.split(/[/\\]/).pop() || relativePath;

        // Extract keywords from first chunk(s) of content for tag-based search.
        // For streaming files: sample first 1MB. For non-streaming: use full content.
        if (!USE_STREAMING) {
            const content = fs.readFileSync(filePath, 'utf-8');
            const keywords = atomizer.extractKeywordsFromContent(content);
            if (keywords.length > 0) atomizer.setKeywords(keywords);
        }

        // ─── Streaming path (files > 10 MB) ───────────────────────────
        if (USE_STREAMING) {
            console.log(`[Watchdog] 🌊 Streaming ingestion: ${filename}`);
            const ingestStart = Date.now();
            let keywordsExtracted = false;

            for await (const chunk of streamFileIntoChunks(
                filePath,
                (progress) => {
                    systemStatus.setProgress(
                        progress.bytesRead,
                        progress.totalBytes,
                        `Streaming: ${progress.percentComplete}% (${progress.chunksEmitted} chunks)`,
                    );
                },
            )) {
                // Extract keywords from first chunk only (avoids scanning GBs)
                if (!keywordsExtracted) {
                    const kw = atomizer.extractKeywordsFromContent(chunk.content);
                    if (kw.length > 0) atomizer.setKeywords(kw);
                    keywordsExtracted = true;
                }

                const atomizeResult = await atomizer.atomize(
                    chunk.content,
                    chunk.virtualPath,
                    provenance,
                );

                if (!atomizeResult) {
                    console.log(`[Watchdog] ⚠️ SKIP: ${chunk.virtualPath} - Transient data in chunk, skipping`);
                    continue;
                }

                const { compound, molecules, atoms } = atomizeResult;
                if (!finalCompound) finalCompound = compound;

                totalAtomsCount += atoms.length;

                await atomicIngest.ingestResult(
                    compound,
                    molecules,
                    atoms,
                    [bucket],
                    (step, total, desc) => {
                        systemStatus.setProgress(
                            chunk.index,
                            chunk.total,
                            `Ingesting chunk ${chunk.index}/${chunk.total} (${desc})`,
                        );
                    },
                );

                // Yield to event loop between chunks — keeps API responsive
                await new Promise(resolve => setImmediate(resolve));

                // Force GC + PGlite checkpoint every 10 chunks to prevent WASM heap OOM.
                // Without this, the WASM linear memory fills up after ~70 chunks (~70MB
                // of raw text → hundreds of thousands of persisted rows) and crashes with
                // "memory access out of bounds".
                if (chunk.index % 10 === 0) {
                    try {
                        await db.run('CHECKPOINT');
                        if (typeof (global as any).gc === 'function') (global as any).gc();
                        console.log(`[Watchdog] 🧹 GC + checkpoint after chunk ${chunk.index}`);
                    } catch {}
                }
            }

            const elapsed = ((Date.now() - ingestStart) / 1000).toFixed(1);
            console.log(`[Watchdog] ✅ Streaming complete: ${totalAtomsCount} atoms in ${elapsed}s`);
        } else {
            // ─── Small-file path (≤ 10 MB) — existing behavior ─────────
            const content = fs.readFileSync(filePath, 'utf-8');

            if (needsChunking(content)) {
                const chunks = chunkFile(content, relativePath);
                console.log(`[Watchdog] 🧩 Chunking ${relativePath} into ${chunks.length} chunks`);

                for (let i = 0; i < chunks.length; i++) {
                    const chunk = chunks[i];
                    systemStatus.setProgress(i, chunks.length, `Atomizing chunk ${chunk.index}/${chunk.total}...`);

                    const atomizeResult = await atomizer.atomize(
                        chunk.content,
                        chunk.virtualPath,
                        provenance,
                    );

                    if (!atomizeResult) {
                        console.log(`[Watchdog] ⚠️ SKIP: ${chunk.virtualPath} - Transient data in chunk, skipping`);
                        continue;
                    }

                    const { compound, molecules, atoms } = atomizeResult;
                    if (!finalCompound) finalCompound = compound;

                    totalAtomsCount += atoms.length;

                    await atomicIngest.ingestResult(
                        compound,
                        molecules,
                        atoms,
                        [bucket],
                        (step, total, desc) => {
                            systemStatus.setProgress(
                                i,
                                chunks.length,
                                `Ingesting chunk ${chunk.index}/${chunk.total} (${desc})`,
                            );
                        },
                    );

                    await new Promise(resolve => setTimeout(resolve, 50));
                }
            } else {
                // Single-file atomize (no chunking needed)
                const atomizeResult = await atomizer.atomize(
                    content,
                    relativePath,
                    provenance,
                );

                if (!atomizeResult) {
                    console.log(`[Watchdog] ⚠️ SKIP: ${relativePath} - Transient data, skipping ingestion`);
                    return { ingested: false, reason: 'transient_data' };
                }

                const { compound, molecules, atoms } = atomizeResult;
                finalCompound = compound;
                totalAtomsCount = atoms.length;

                await atomicIngest.ingestResult(
                    compound,
                    molecules,
                    atoms,
                    [bucket],
                    (step, total, desc) => {
                        systemStatus.setProgress(step, total, `${filename}: ${desc}`);
                    },
                );
            }
        }

        // 6. Update Source Table
        await db.run(
            `INSERT INTO sources (path, hash, total_atoms, last_ingest)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (path) DO UPDATE SET
               hash = EXCLUDED.hash,
               total_atoms = EXCLUDED.total_atoms,
               last_ingest = EXCLUDED.last_ingest`,
            [
                relativePath,
                fileHash,
                totalAtomsCount,
                Date.now(),
            ],
        );

        console.log(`[Watchdog] Sync Complete: ${relativePath}`);

        // Standard 016: Invalidate search cache after successful watchdog ingestion
        try {
            const { searchCache } = await import('../search/search.js');
            searchCache.clear();
        } catch (e) {
            console.warn('[Watchdog] Could not invalidate search cache:', e);
        }

        // Mirror write: for streaming files, skip — the content was already processed
        // from the original file chunk-by-chunk. Trying to read the full 237MB file
        // again with readFileSync blocks the event loop after ingestion completes.
        // Small files still get the mirror treatment for sanitized copies.
        try {
            if (!USE_STREAMING) {
                const { writeMirroredFile } = await import('../mirror/mirror.js');
                const content = fs.readFileSync(filePath, 'utf-8');
                if (finalCompound && content) {
                    await writeMirroredFile(relativePath, content, provenance);
                }
            } else {
                console.log(`[Watchdog] Skipping mirror write for streaming file (chunks processed from original)`);
            }
        } catch (e: any) {
            console.warn(`[Watchdog] Mirror write failed for ${relativePath}:`, e.message);
        }

        // Trigger post-ingestion synonym generation (debounced).
        // Skip entirely when streaming was used anywhere in this processFile
        // call — the small inbox files processed after a large streaming file
        // would otherwise trigger synonym generation against the full 184K+
        // atom corpus, blocking the event loop for minutes.
        if (!USE_STREAMING) {
            triggerPostIngestionSynonyms();
        } else {
            console.log(`[Watchdog] Skipping synonym generation (streaming file — deferred to next restart)`);
        }

        // Reset system status to idle after ingestion completes
        if (typeof (global as any).gc === 'function') (global as any).gc();
        systemStatus.setState('idle');
        systemStatus.clearProgress();
        
        // Track successful ingestion for cumulative timing
        const fileDuration = ((Date.now() - fileStartTime) / 1000);
        totalIngestionTime += fileDuration;
        fileCount++;

        return { ingested: true };

    } catch (error: any) {
      // Return user-friendly error message instead of raw error object
      let errorMessage = `Failed to process ${filePath}: ${error.message}`;
      
      // Provide specific guidance for common errors
      if (error.code === 'ENOENT') {
        errorMessage += '. File not found.';
      } else if (error.code === 'EACCES') {
        errorMessage += '. Permission denied. Please check file permissions.';
      } else if (error.message.includes('token')) {
        errorMessage += '. Token limit exceeded - content may be too large for ingestion.';
      }

      // Track failed ingestion for cumulative timing
      const fileDuration = ((Date.now() - fileStartTime) / 1000);
      totalIngestionTime += fileDuration;
      
      console.error(`[Watchdog] ${errorMessage}`);
      systemStatus.setState('idle');
      systemStatus.clearProgress();

      return { ingested: false, reason: 'processing_error' };
    }
  }

// Export cumulative ingestion summary for pnpm start output
export function getIngestionSummary(): string {
  const avgTime = fileCount > 0 ? (totalIngestionTime / fileCount).toFixed(2) : 'N/A';
  return `[Watchdog] 📊 INGESTION SUMMARY: ${fileCount} files processed, Total time: ${totalIngestionTime.toFixed(2)}s, Avg per file: ${avgTime}s`;
}

// Export watched paths for system status reporting
export function getWatchedPaths(): string[] {
  return [PATHS.INBOX_DIR, PATHS.EXTERNAL_INBOX_DIR, ...(config.WATCHER_EXTRA_PATHS || [])];
}

// Alias for backward compatibility
export const triggerManualIngest = triggerManualIngestion;

