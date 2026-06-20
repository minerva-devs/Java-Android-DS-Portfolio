/**
 * Memory routes — explore / illuminate / distill endpoints
 *
 * POST /v1/memory/explore
 *   BFS graph traversal from seed concepts.
 *   Returns the connected subgraph as structural corpus compression.
 *
 * POST /v1/memory/distill
 *   Standard 133: Radial Distillation
 *   Line-level deduplication with radial inflation (4.8.2 implementation).
 *   Supports streaming mode via ?stream=true query param.
 */

import type { Application, Request, Response } from 'express';
import { StructuredLogger } from '../../utils/structured-logger.js';
import type { ExploreRequest } from '../../services/search/explore.js';
import { exploreMemory } from '../../services/search/explore.js';
import type { RadialDistillRequest } from '../../services/distillation/radial-distiller-v2.js';
import { radialDistill } from '../../services/distillation/radial-distiller-v2.js';
import { executeStreamingDistill, formatDistillSSE } from '../../services/distillation/streaming-distiller.js';
import { validate, schemas } from '../../middleware/validate.js';
import { db } from '../../core/db.js';

export function setupMemoryRoutes(app: Application) {
  // Note: memoryExplore schema validates basic structure; complex seed validation remains inline
  app.post('/v1/memory/explore', async (req: Request, res: Response) => {
    const startTime = Date.now();
    StructuredLogger.info('EXPLORE_REQUEST', { endpoint: '/v1/memory/explore' });

    try {
      const body = req.body as ExploreRequest;

      if (!body?.seed || (!body.seed.global && !body.seed.query && !body.seed.atom_ids?.length)) {
        res.status(400).json({ error: 'seed.query, seed.atom_ids, or seed.global:true is required' });
        return;
      }

      const result = await exploreMemory(body);
      const duration = Date.now() - startTime;

      StructuredLogger.info('EXPLORE_COMPLETE', {
        nodes: result.stats.nodes_count,
        strategy: result.stats.strategy,
        duration_ms: duration,
      });

      // Normalise to a consistent shape regardless of flat/graph format
      if (result.nodes !== undefined && !('results' in result)) {
        // graph or flat — return as-is but also expose `results` alias for MCP compatibility
        res.json({
          ...result,
          results: result.nodes.map(n => ({
            id: n.id,
            content: n.content,
            source: n.source,
            tags: n.tags,
            score: 1,
          })),
          duration_ms: duration,
        });
      } else {
        res.json({ ...result, duration_ms: duration });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      StructuredLogger.error('EXPLORE_ERROR', err instanceof Error ? err : new Error(msg), { error: msg });
      res.status(500).json({ error: msg });
    }
  });

  app.post('/v1/memory/distill', async (req: Request, res: Response) => {
    const startTime = Date.now();

    // DEBUG: Log incoming data to file — MUST be in .anchor/logs/ per doc_policy.md Section 5
    const fs = await import('fs');
    const os = await import('os');
    const homeDir = os.homedir();
    const logPath = `${homeDir}/.anchor/logs/distill-debug.log`;

    // DEBUG: Log incoming data
    const debugLog = [
      '=== DISTILL REQUEST ===',
      `req.headers: ${JSON.stringify(req.headers)}`,
      `req.body type: ${typeof req.body}`,
      `req.body: ${JSON.stringify(req.body)}`,
      `req.body.seed: ${JSON.stringify(req.body?.seed)}`,
      `req.body seed is undefined: ${req.body?.seed === undefined}`,
    ].join('\n');

    // Synchronously write to file BEFORE any async operations
    try {
      fs.writeFileSync(logPath, debugLog + '\n\n', { flag: 'a' });
      console.log('[DEBUG distill] ✓ Debug log written to', logPath);
    } catch (writeErr) {
      console.error('[DEBUG distill] ✗ Failed to write debug log:', String(writeErr));
    }

    StructuredLogger.info('DISTILL_REQUEST', {
      endpoint: '/v1/memory/distill',
      mode: 'radial',
      hasBody: !!req.body,
      bodyKeys: req.body ? Object.keys(req.body) : [],
    });

    try {
      // Check for streaming mode (default: false for backward compatibility)
      const streamMode = req.query.stream === 'true';
      const body = req.body as RadialDistillRequest;

      if (streamMode) {
        // Streaming mode: Server-Sent Events
        StructuredLogger.info('DISTILL_STREAMING_START', {
          radius: body.radius,
          output_format: body.output_format,
        });

        // Streaming distiller only supports json/yaml/compound — strip decision-records
        const streamOpts: any = { ...body, batchSize: 100 };
        if (streamOpts.output_format === 'decision-records') {
          streamOpts.output_format = 'json';
        }

        // Respect include_code and timeout for streaming mode too
        const maxMolecules = body.max_molecules || body.radius || 5;
        const distillTimeoutMs = body.timeout_seconds ? body.timeout_seconds * 1000 : 60000;

        const stream = executeStreamingDistill({ ...streamOpts, max_molecules: maxMolecules });

        // Set up SSE headers
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no');

        // Stream events to client
        for await (const event of stream) {
          res.write(formatDistillSSE(event));
        }

        res.end();

        StructuredLogger.info('DISTILL_STREAMING_COMPLETE', {
          duration_ms: Date.now() - startTime,
        });
        return;
      }

      // Standard mode: Single JSON response (v2 with tag-based + decision records support)
      console.log('[DEBUG distill] === BEFORE radialDistill ===');
      console.log('[DEBUG distill] body:', JSON.stringify(body));
      console.log('[DEBUG distill] body.seed:', body?.seed);
      console.log('[DEBUG distill] body.seed is undefined:', body?.seed === undefined);

      // Enable auto-save and pass all parameters (including max_molecules, include_code, timeout_seconds)
      const bodyWithDefaults = { ...body, auto_save: true };

      // DEBUG: Log what's being passed to radialDistill
      console.log('[DEBUG distill] bodyWithDefaults:', JSON.stringify(bodyWithDefaults));
      console.log('[DEBUG distill] bodyWithDefaults.seed:', bodyWithDefaults?.seed);

      // Add timeout guard to prevent indefinite hangs from PGlite async DB operations
      // Use user-provided timeout_seconds or default to 30s for API requests (prevent 60s timeouts)
      const userTimeoutMs = body.timeout_seconds ? body.timeout_seconds * 1000 : 30000;
      const distillTimeoutMs = Math.min(userTimeoutMs, 120000); // Cap at 2 minutes max

      console.log(`[DEBUG distill] Using timeout: ${distillTimeoutMs}ms (max_molecules: ${bodyWithDefaults.max_molecules})`);

      // Create timeout-aware promise with proper error handling
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error(`Distillation timed out after ${userTimeoutMs}ms as requested`)), distillTimeoutMs);
      });

      const result: any = await Promise.race([
        radialDistill(bodyWithDefaults),
        timeoutPromise,
      ]);

      // Send success acknowledgment immediately to prevent axios timeout
      if (!res.headersSent && res.writableEnded) {
        return; // Client already closed connection
      }

      const duration = Date.now() - startTime;

      StructuredLogger.info('RADIAL_DISTILL_COMPLETE', {
        compounds_processed: result.stats.compounds_processed,
        blocks_total: result.stats.blocks_total,
        blocks_unique: result.stats.blocks_unique,
        decision_records: result.stats.decision_records,
        compression_ratio: result.stats.compression_ratio,
        duration_ms: duration,
      });

      res.json({
        ...result,
        duration_ms: duration,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      StructuredLogger.error('DISTILL_ERROR', err instanceof Error ? err : new Error(msg), { error: msg });
      
      if (!res.headersSent) {
        res.status(500).json({ error: msg });
      } else {
        // For streaming mode, send error as SSE event
        res.write(formatDistillSSE({
          type: 'error',
          message: msg,
          details: err instanceof Error ? err.stack : undefined,
        }));
        res.end();
      }
    }
  });
}
