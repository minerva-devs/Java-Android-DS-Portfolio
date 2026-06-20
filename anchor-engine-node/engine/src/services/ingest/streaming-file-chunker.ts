/**
 * Streaming File Chunker — GB-scale ingestion without blocking the event loop.
 *
 * Instead of loading entire files into memory, this module reads files in
 * configurable windows (~1–5 MB), splits each window on clean sentence
 * boundaries, and yields individual chunks via an async generator. Between
 * each window the event loop is yielded so API requests stay responsive.
 *
 * Architecture:
 *   createReadStream → buffer window → find last sentence break →
 *   emit chunk → yield event loop → repeat
 *
 * For structured formats (JSON, YAML) we delegate to the existing
 * file-chunker.ts which loads the full file — these formats are typically
 * much smaller than unstructured text corpora.
 */

import * as fs from 'fs';
import * as path from 'path';
import { config } from '../../config/index.js';

// ─── Configuration (overridable via user_settings.json → streaming section) ────

/** Files larger than this use the streaming path. */
export const STREAM_THRESHOLD_BYTES = config.STREAMING?.STREAM_THRESHOLD_BYTES ?? 10 * 1024 * 1024;

/** How many bytes to read per window from the file. */
const WINDOW_BYTES = config.STREAMING?.WINDOW_BYTES ?? 1 * 1024 * 1024;

/** Extra bytes to read past the window to find a clean sentence boundary. */
const LOOKAHEAD_BYTES = config.STREAMING?.LOOKAHEAD_BYTES ?? 64 * 1024;

/** Milliseconds to yield the event loop between windows (0 = setImmediate). */
const YIELD_INTERVAL_MS = config.STREAMING?.YIELD_INTERVAL_MS ?? 0;

/** Yield the event loop — setImmediate for minimal delay, setTimeout for configurable pause. */
const yieldEventLoop = (): Promise<void> =>
  YIELD_INTERVAL_MS > 0
    ? new Promise(resolve => setTimeout(resolve, YIELD_INTERVAL_MS))
    : new Promise(resolve => setImmediate(resolve));

// ─── Types ───────────────────────────────────────────────────────────────────

export interface FileChunk {
  virtualPath: string;
  content: string;
  index: number;
  total: number; // estimated total; updated as streaming progresses
}

export interface StreamProgress {
  bytesRead: number;
  totalBytes: number;
  chunksEmitted: number;
  percentComplete: number;
}

// ─── Sentence-boundary regex ────────────────────────────────────────────────
// Matches a period/exclamation/question mark followed by whitespace and a
// capital letter or digit — a reliable heuristic for sentence boundaries
// across English prose and academic text.
const SENTENCE_BOUNDARY = /[.!?]\s+(?=[A-Z0-9])/g;

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Stream a file into chunks, yielding each chunk as it becomes available.
 * Between each window read, the event loop is yielded so the server stays
 * responsive.
 *
 * @param filePath  Absolute path to the file to stream.
 * @param onProgress Optional callback receiving progress updates.
 */
export async function* streamFileIntoChunks(
  filePath: string,
  onProgress?: (progress: StreamProgress) => void,
): AsyncGenerator<FileChunk, void, undefined> {
  const basename = path.basename(filePath);
  const stat = fs.statSync(filePath);
  const totalBytes = stat.size;

  if (totalBytes === 0) return;

  // Use window-based streaming for large files; small files read at once.
  if (totalBytes > STREAM_THRESHOLD_BYTES) {
    yield* streamLargeFile(filePath, basename, totalBytes, onProgress);
  } else {
    // Small file: read whole, chunk via existing logic, emit all at once.
    const { chunkFile } = await import('./file-chunker.js');
    const content = fs.readFileSync(filePath, 'utf-8');
    const chunks = chunkFile(content, filePath);
    if (chunks.length === 0) {
      // Single chunk (no splitting needed)
      yield {
        virtualPath: filePath,
        content,
        index: 1,
        total: 1,
      };
    } else {
      for (const chunk of chunks) {
        yield chunk;
      }
    }
  }
}

// ─── Streaming engine ────────────────────────────────────────────────────────

async function* streamLargeFile(
  filePath: string,
  basename: string,
  totalBytes: number,
  onProgress?: (p: StreamProgress) => void,
): AsyncGenerator<FileChunk, void, undefined> {
  const fd = fs.openSync(filePath, 'r');
  let bytesRead = 0;
  let chunkIndex = 0;
  let carryover = ''; // partial sentence from previous window

  try {
    while (bytesRead < totalBytes) {
      const windowSize = Math.min(WINDOW_BYTES, totalBytes - bytesRead);
      const lookaheadSize = Math.min(LOOKAHEAD_BYTES, totalBytes - bytesRead - windowSize);

      // Read window + lookahead
      const buf = Buffer.alloc(windowSize + lookaheadSize);
      const read = fs.readSync(fd, buf, 0, buf.length, bytesRead);
      if (read === 0) break;

      let text = buf.toString('utf-8', 0, read);

      // Prepend carryover from previous window
      if (carryover) {
        text = carryover + text;
        carryover = '';
      }

      // Only apply sentence-boundary splitting for prose-heavy content.
      // For code, JSON, YAML we'd use different strategies — for now the
      // file-chunker handles those separately for small files.
      const ext = path.extname(basename).toLowerCase();
      const isStructured = ['.json', '.yaml', '.yml', '.jsonl'].includes(ext);

      if (isStructured) {
        // Structured files: emit the window as-is and let the downstream
        // chunker handle splitting. Not ideal for GB-scale JSON arrays, but
        // those are rare in practice.
        bytesRead += windowSize;
        chunkIndex++;
        const progress = emitProgress(bytesRead, totalBytes, chunkIndex, onProgress);
        yield {
          virtualPath: `${filePath}#chunk-${String(chunkIndex).padStart(4, '0')}`,
          content: text.slice(0, windowSize),
          index: chunkIndex,
          total: Math.ceil(totalBytes / WINDOW_BYTES),
        };
        // Yield event loop
        await yieldEventLoop();
        continue;
      }

      // ── Prose: split on sentence boundaries ──────────────────────────
      // Find the LAST sentence boundary in this window so we don't split
      // mid-sentence.
      const windowText = text.slice(0, windowSize);
      const matches = [...windowText.matchAll(SENTENCE_BOUNDARY)];
      let splitPos: number;

      if (matches.length > 0) {
        const lastMatch = matches[matches.length - 1];
        splitPos = (lastMatch.index ?? 0) + lastMatch[0].length;
      } else {
        // No sentence boundary found — fall back to the full window size.
        // This handles code blocks, lists, and unstructured content.
        splitPos = windowSize;
      }

      // Ensure we make forward progress even on boundary-free content.
      if (splitPos === 0) splitPos = Math.min(windowSize, text.length);

      const chunk = text.slice(0, splitPos);
      carryover = text.slice(splitPos);

      // Only advance bytesRead by the actual bytes consumed from the file
      // (not counting carryover which came from the previous window).
      const consumedFromFile = Math.max(0, splitPos - (carryover ? 0 : 0));
      // Actually, carryover was prepended so we need to subtract it.
      // carryover length at this point is from the previous iteration's remainder.
      // We track this by advancing bytesRead by windowSize (the bytes we read from disk)
      // minus the new carryover that will go into the next window.
      bytesRead += windowSize;

      // Don't carry over more than a reasonable amount
      if (carryover.length > WINDOW_BYTES) {
        // Extremely long sentence — emit it as its own chunk
        chunkIndex++;
        yield {
          virtualPath: `${filePath}#chunk-${String(chunkIndex).padStart(4, '0')}`,
          content: carryover.slice(0, WINDOW_BYTES),
          index: chunkIndex,
          total: Math.ceil(totalBytes / WINDOW_BYTES),
        };
        carryover = carryover.slice(WINDOW_BYTES);
        bytesRead += WINDOW_BYTES;
        await yieldEventLoop();
        continue;
      }

      if (chunk.trim().length > 0) {
        chunkIndex++;
        const progress = emitProgress(bytesRead, totalBytes, chunkIndex, onProgress);
        yield {
          virtualPath: `${filePath}#chunk-${String(chunkIndex).padStart(4, '0')}`,
          content: chunk,
          index: chunkIndex,
          total: Math.ceil(totalBytes / WINDOW_BYTES),
        };
      }

      // Yield the event loop so the server can handle requests.
      await yieldEventLoop();
    }

    // Emit any remaining carryover
    if (carryover.trim().length > 0) {
      chunkIndex++;
      yield {
        virtualPath: `${filePath}#chunk-${String(chunkIndex).padStart(4, '0')}`,
        content: carryover,
        index: chunkIndex,
        total: chunkIndex,
      };
    }
  } finally {
    fs.closeSync(fd);
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function emitProgress(
  bytesRead: number,
  totalBytes: number,
  chunksEmitted: number,
  onProgress?: (p: StreamProgress) => void,
): StreamProgress {
  const progress: StreamProgress = {
    bytesRead,
    totalBytes,
    chunksEmitted,
    percentComplete: totalBytes > 0 ? Math.round((bytesRead / totalBytes) * 100) : 100,
  };
  onProgress?.(progress);
  return progress;
}
