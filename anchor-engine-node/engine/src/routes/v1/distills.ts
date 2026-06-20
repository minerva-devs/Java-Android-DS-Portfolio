/**
 * Distill Routes - Version Control for Distills (Standard 016)
 *
 * API endpoints for managing and querying distill checkpoints.
 * Uses pointer-based file reading (start_byte, end_byte) for efficient streaming.
 */

import type { Application, Request, Response } from 'express';
import { StructuredLogger } from '../../utils/structured-logger.js';
import { getAllDistills, getDistill, getDistillsBySession, deleteDistill, recordDistill } from '../../services/distillation/distill-manager.js';
import { radialDistill } from '../../services/distillation/radial-distiller-v2.js';
import type { RadialDistillRequest } from '../../services/distillation/radial-distiller-v2.js';
import fs from 'fs';

export function setupDistillRoutes(app: Application) {
  // POST /v1/distills - Trigger a new distillation (delegates to radial distiller)
  app.post('/v1/distills', async (req: Request, res: Response) => {
    const startTime = Date.now();
    try {
      const body = req.body as RadialDistillRequest;

      // When no seed query: distill across the entire corpus rather than
      // rejecting. The dedup pipeline produces ~3x compression (per benchmarks:
      // 222K molecules → 34.5K unique lines at 3.78:1 ratio). Full-corpus
      // distillation takes ~200s for a ~300K-molecule corpus — the timeout
      // reflects this. Callers can pass max_molecules to limit scope.
      const isSeedless = !body.seed?.query || !body.seed.query.trim();

      const bodyWithDefaults = { ...body, auto_save: true };
      // Full-corpus (seedless) distillation can legitimately take minutes.
      // Benchmarks: 222K molecules distilled in 197s (docs/benchmarks.md).
      // Use the caller's timeout if provided, otherwise 300s for full corpus.
      const defaultTimeout = isSeedless ? 300 : 120;
      const timeoutMs = Math.min((body.timeout_seconds || defaultTimeout) * 1000, 600000);

      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error(`Distillation timed out after ${timeoutMs}ms`)), timeoutMs);
      });

      const result: any = await Promise.race([
        radialDistill(bodyWithDefaults),
        timeoutPromise,
      ]);

      // Record to DB and cache
      const distillRecord = {
        id: `distill-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
        timestamp: new Date().toISOString(),
        filename: result.output?.path?.split('/').pop() || `distill-${Date.now()}.md`,
        file_path: result.output?.path || '',
        line_count: result.stats?.lines_total || 0,
        lines_unique: result.stats?.lines_unique || 0,
        compression_ratio: result.stats?.compression_ratio || '0',
        source_sessions: result.provenance?.source_compounds || [],
        source_files: result.provenance?.source_compounds || [],
        parameters: bodyWithDefaults,
        status: 'complete',
        progress: 100,
        start_byte: 0,
        end_byte: result.output?.size_bytes || 0,
        file_size: result.output?.size_bytes || 0,
      };
      await recordDistill(distillRecord);

      const duration = Date.now() - startTime;
      StructuredLogger.info('DISTILL_POST_COMPLETE', { id: distillRecord.id, duration_ms: duration });

      res.json({ ...result, distill_id: distillRecord.id, duration_ms: duration });
    } catch (err: any) {
      const msg = err instanceof Error ? err.message : String(err);
      StructuredLogger.error('DISTILL_POST_ERROR', err instanceof Error ? err : new Error(msg));
      res.status(500).json({ error: msg });
    }
  });

  // GET /v1/distills/list - List all distills (newest first)
  app.get('/v1/distills/list', async (req: Request, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const distills = await getAllDistills(limit);

      StructuredLogger.info('DISTILLS_LIST', { count: distills.length });

      res.json({
        status: 'success',
        distills,
        count: distills.length,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      StructuredLogger.error('DISTILLS_LIST_ERROR', error);
      res.status(500).json({ error: error.message });
    }
  });

  // GET /v1/distills/:id - Get a specific distill by ID
  app.get('/v1/distills/:id', async (req: Request, res: Response) => {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    try {
      const distill = await getDistill(id);

      if (!distill) {
        res.status(404).json({ error: 'Distill not found' });
        return;
      }

      StructuredLogger.info('DISTILL_GET', { id: id });

      res.json({
        status: 'success',
        distill,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      StructuredLogger.error('DISTILL_GET_ERROR', error, { id: id });
      res.status(500).json({ error: error.message });
    }
  });

  // GET /v1/distills/:id/stream - Stream distill file content using pointer-based byte offsets (Standard: Pointer-Based File Reading for Distills v5.3.0)
  app.get('/v1/distills/:id/stream', async (req: Request, res: Response) => {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    try {
      const distill = await getDistill(id);

      if (!distill) {
        res.status(404).json({ error: 'Distill not found' });
        return;
      }

      StructuredLogger.info('DISTILL_STREAM_INIT', { 
        id: id, 
        filename: distill.filename,
        start_byte: distill.start_byte,
        end_byte: distill.end_byte,
        file_size: distill.file_size
      });

      // Validate file exists
      if (!fs.existsSync(distill.file_path)) {
        StructuredLogger.error('DISTILL_FILE_NOT_FOUND', 'Distill file not found', { id, path: distill.file_path });
        res.status(404).json({ error: 'Distill file not found' });
        return;
      }

      // Use fs.createReadStream with byte offset parameters for pointer-based reading
      const stream = fs.createReadStream(distill.file_path, {
        start: distill.start_byte,
        end: distill.end_byte !== 0 ? distill.end_byte - 1 : undefined, // -1 for inclusive end
        autoClose: true,
      });

      // Set appropriate headers for streaming
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      if (distill.file_size > 0) {
        res.setHeader('Content-Length', distill.file_size);
      }
      res.setHeader('Cache-Control', 'private, max-age=60'); // Short cache for distills

      // Stream content directly to response
      stream.pipe(res);

      stream.on('error', (error: Error) => {
        StructuredLogger.error('DISTILL_STREAM_ERROR', error, { id, stack: error.stack });
        res.status(500).json({ error: 'Failed to stream distill file content' });
      });

    } catch (error: any) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      const errObj = error instanceof Error ? error : new Error(msg);
      StructuredLogger.error('DISTILL_STREAM_FAILED', msg, { id, stack: errObj.stack });
      res.status(500).json({ error: msg });
    }
  });

  // GET /v1/distills/session/:sessionId - Get distills for a session
  app.get('/v1/distills/session/:sessionId', async (req: Request, res: Response) => {
    const sessionId = Array.isArray(req.params.sessionId) ? req.params.sessionId[0] : req.params.sessionId;
    try {
      const distills = await getDistillsBySession(sessionId);

      StructuredLogger.info('DISTILLS_BY_SESSION', {
        sessionId: sessionId,
        count: distills.length,
      });

      res.json({
        status: 'success',
        sessionId: sessionId,
        distills,
        count: distills.length,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      StructuredLogger.error('DISTILLS_BY_SESSION_ERROR', error, { sessionId: sessionId });
      res.status(500).json({ error: error.message });
    }
  });

  // DELETE /v1/distills/:id - Delete a distill (file must be deleted separately)
  app.delete('/v1/distills/:id', async (req: Request, res: Response) => {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    try {
      const deleted = await deleteDistill(id);

      if (!deleted) {
        res.status(404).json({ error: 'Distill not found' });
        return;
      }

      StructuredLogger.info('DISTILL_DELETED', { id: id });

      res.json({
        status: 'success',
        message: 'Distill deleted from database',
        id: id,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      StructuredLogger.error('DISTILL_DELETE_ERROR', error, { id: id });
      res.status(500).json({ error: error.message });
    }
  });
}
