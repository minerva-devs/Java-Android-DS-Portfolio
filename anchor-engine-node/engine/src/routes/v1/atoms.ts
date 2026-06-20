import type { Application, Request, Response } from 'express';
import * as crypto from 'crypto';
import { db } from '../../core/db.js';

export function setupAtomRoutes(app: Application) {
  // === List Atoms Endpoints ===

  // GET /v1/atoms - List atoms with filtering and pagination
  app.get('/v1/atoms', async (req: Request, res: Response) => {
    try {
      const query = req.query as Record<string, string | undefined>;
      const limit = Math.min(parseInt(query.limit || '20', 10), 100);
      const offset = parseInt(query.offset || '0', 10);
      const order_by = (query.order_by as string) || 'timestamp';

      // Select only lightweight columns for list view — avoid simhash/embedding
      // which can contain massive text blobs that choke JSON serialization.
      let sqlQuery = 'SELECT id, source_path, timestamp, provenance, created_at, content, buckets, tags, type, compound_id FROM atoms';

      const params: (string | number | boolean)[] = [];

      // Validate order_by to prevent SQL injection
      const validOrderBy = ['id', 'timestamp', 'created_at'];
      const safeOrder = validOrderBy.includes(order_by) ? order_by : 'timestamp';
      sqlQuery += ` ORDER BY ${safeOrder} DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
      params.push(limit);
      params.push(offset);

      const result = await db.run(sqlQuery, params);

      // Map DB rows to typed Atom objects without any casts
      const atoms: Array<{ id: string; source_path: string | null; timestamp: string | number | null; provenance: string | null; created_at: string | number | null; content: string; buckets: unknown; tags: unknown; type: string; compound_id: string }> = (result.rows || []).map((row: Record<string, unknown>) => ({
        id: String(row.id),
        source_path: row.source_path,
        timestamp: row.timestamp,
        provenance: row.provenance,
        created_at: row.created_at,
        content: row.content,
        buckets: row.buckets,
        tags: row.tags,
        type: row.type,
        compound_id: row.compound_id,
      }));

      // Get total count for pagination
      const countResult = await db.run('SELECT COUNT(*) as total FROM atoms');
      const total = parseInt(countResult.rows?.[0]?.total || '0', 10);

      res.status(200).json({
        atoms,
        total,
        limit,
        offset,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      console.error('[Atoms API] Error:', err);
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) || 'Internal server error' });
    }
  });

  // GET /v1/atoms/stats - Get atoms statistics
  app.get('/v1/atoms/stats', async (_req: Request, res: Response) => {
    try {
      const [totalResult, byProvenanceResult] = await Promise.all([
        db.run('SELECT COUNT(*) as total FROM atoms'),
        db.run('SELECT provenance, COUNT(*) as count FROM atoms GROUP BY provenance'),
      ]);

      const total = parseInt(totalResult.rows?.[0]?.total || '0', 10);
      // Map DB rows to typed provenance count objects without any casts
      const byProvenance: Array<{ provenance: string; count: number }> = (byProvenanceResult.rows || []).map((row: Record<string, unknown>) => ({
        provenance: row.provenance as string,
        count: parseInt(row.count as string, 10),
      }));

      res.status(200).json({
        total,
        by_provenance: byProvenance,
        timestamp: new Date().toISOString(),
      });
    } catch {
      // Error already logged; return safe error response without leaking internals
      res.status(500).json({ error: 'Failed to get atoms statistics' });
    }
  });

  // === Quarantine Endpoints ===

  // POST /v1/atoms/:id/quarantine - Quarantine an atom
  app.post('/v1/atoms/:id/quarantine', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      
      if (!id) {
        res.status(400).json({ error: 'Atom ID is required' });
        return;
      }

      console.log(`[API] Quarantining Atom: ${id}`);

      // Get current record
      const check = await db.run('SELECT tags FROM atoms WHERE id = $1', [id]);
      if (!check.rows || check.rows.length === 0) {
        res.status(404).json({ error: 'Atom not found' });
        return;
      }

      const currentTags = check.rows[0][0] as string[] || [];
      const newTags = [...new Set([...currentTags, '#manually_quarantined'])];

      await db.run(
        'UPDATE atoms SET tags = $1, provenance = $2 WHERE id = $3',
        [newTags, 'quarantine', id],
      );

      res.status(200).json({ status: 'success', message: `Atom ${id} quarantined.` });
    } catch {
      // Error already logged; return safe error response without leaking internals
      res.status(500).json({ error: 'Failed to quarantine atom' });
    }
  });

  // GET /v1/atoms/quarantined - List quarantined atoms
  app.get('/v1/atoms/quarantined', async (_req: Request, res: Response) => {
    try {
      const query = `
        SELECT id, content, source_path, timestamp, buckets, tags, provenance, simhash, embedding
        FROM atoms
        WHERE provenance = 'quarantine'
        ORDER BY timestamp DESC
        LIMIT 100
      `;
      const result = await db.run(query);

      const atoms: Array<{ id: string; content: string; source: string | null; timestamp: number | string | null; buckets: unknown; tags: unknown; provenance: string; simhash: string }> = (result.rows || []).map((row: Record<string, unknown>) => ({
        id: row.id,
        content: row.content,
        source: row.source_path,
        timestamp: row.timestamp,
        buckets: row.buckets,
        tags: row.tags,
        provenance: row.provenance,
        simhash: row.simhash,
      }));

      res.status(200).json(atoms);
    } catch {
      // Error already logged; return safe error response without leaking internals
      res.status(500).json({ error: 'Failed to fetch quarantined atoms' });
    }
  });

  // PUT /v1/atoms/:id/content - Update atom content
  app.put('/v1/atoms/:id/content', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { content } = req.body;

      console.log(`[API] Updating Atom Content: ${id}`);

      const fullRecord = await db.run(
        `SELECT id, timestamp, content, source_path, source_id, sequence, type, hash, buckets, epochs, tags, provenance, simhash, embedding
         FROM atoms WHERE id = $1`,
        [id],
      );

      if (!fullRecord.rows || fullRecord.rows.length === 0) {
        res.status(404).json({ error: 'Atom not found' });
        return;
      }

      const newHash = crypto.createHash('sha256').update(content).digest('hex');
      const newEmbedding = new Array(384).fill(0.1);

      await db.run(
        'UPDATE atoms SET content = $1, hash = $2, embedding = $3 WHERE id = $4',
        [content, newHash, newEmbedding, id],
      );

      res.status(200).json({ status: 'success', message: `Atom ${id} updated.` });

    } catch (err) {
      console.error(err);
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  // POST /v1/atoms/:id/restore - Restore a quarantined atom
  app.post('/v1/atoms/:id/restore', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      
      console.log(`[API] Restoring Atom: ${id}`);

      const fullRecord = await db.run(
        `SELECT id, timestamp, content, source_path, source_id, sequence, type, hash, buckets, epochs, tags, provenance, simhash, embedding
         FROM atoms WHERE id = $1`,
        [id],
      );

      if (!fullRecord.rows || fullRecord.rows.length === 0) {
        res.status(404).json({ error: 'Atom not found' });
        return;
      }

      const row = fullRecord.rows[0];
      const currentTags = row.tags as string[] || [];

      // Filter out quarantine tags
      const newTags = currentTags.filter(t => t !== '#manually_quarantined' && t !== '#auto_quarantined');

      await db.run(
        'UPDATE atoms SET tags = $1, provenance = $2 WHERE id = $3',
        [newTags, 'internal', id],
      );

      res.status(200).json({ status: 'success', message: `Atom ${id} restored to Graph.` });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  // === Compatibility Routes for UI ===

  // GET /v1/quarantine - List quarantined atoms (alias)
  app.get('/v1/quarantine', async (_req: Request, res: Response) => {
    try {
      const query = `
        SELECT id, content, source_path, timestamp, buckets, tags, provenance, simhash, embedding
        FROM atoms
        WHERE provenance = 'quarantine'
        ORDER BY timestamp DESC
        LIMIT 100
      `;
      const result = await db.run(query);

      const atoms: Array<{ id: string; content: string; source: string | null; timestamp: number | string | null; buckets: unknown; tags: unknown; provenance: string; simhash: string }> = (result.rows || []).map((row: Record<string, unknown>) => ({
        id: row.id,
        content: row.content,
        source: row.source_path,
        timestamp: row.timestamp,
        buckets: row.buckets,
        tags: row.tags,
        provenance: row.provenance,
        simhash: row.simhash,
      }));

      res.status(200).json({ atoms, total: atoms.length });
    } catch {
      // Error already logged; return safe error response without leaking internals
      res.status(500).json({ error: 'Failed to fetch quarantined atoms' });
    }
  });

  // POST /v1/quarantine/:id/restore - Restore a quarantined atom (alias)
  app.post('/v1/quarantine/:id/restore', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      
      console.log(`[API] Restoring Atom: ${id}`);

      const fullRecord = await db.run(
        `SELECT id, timestamp, content, source_path, source_id, sequence, type, hash, buckets, epochs, tags, provenance, simhash, embedding
         FROM atoms WHERE id = $1`,
        [id],
      );

      if (!fullRecord.rows || fullRecord.rows.length === 0) {
        res.status(404).json({ error: 'Atom not found' });
        return;
      }

      const row = fullRecord.rows[0];
      const currentTags = row.tags as string[] || [];

      // Filter out quarantine tags
      const newTags = currentTags.filter(t => t !== '#manually_quarantined' && t !== '#auto_quarantined');

      await db.run(
        'UPDATE atoms SET tags = $1, provenance = $2 WHERE id = $3',
        [newTags, 'internal', id],
      );

      res.status(200).json({ status: 'success', message: `Atom ${id} restored to Graph.` });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  // DELETE /v1/quarantine/:id - Delete a quarantined atom
  app.delete('/v1/quarantine/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      
      console.log(`[API] Deleting quarantined atom: ${id}`);

      await db.run('DELETE FROM atoms WHERE id = $1', [id]);

      res.status(200).json({ status: 'deleted', id });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });
}