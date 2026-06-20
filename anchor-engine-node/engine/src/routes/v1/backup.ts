import type { Application, Request, Response } from 'express';
import { StructuredLogger } from '../../utils/structured-logger.js';
import { createCorpusBackupYaml, listBackups, restoreBackup as restoreFromDisk, rebuildInboxFromMirror, rebuildFilesystemFromSources } from '../../services/backup/backup.js';
import { config } from '../../config/index.js';

export function setupBackupRoutes(app: Application) {
  // GET /v1/backups/list - List available backups
  app.get('/v1/backups/list', async (req: Request, res: Response) => {
    try {
      const backups = await listBackups();
      
      StructuredLogger.info('BACKUPS_LIST', { count: backups.length });

      res.json({
        status: 'success',
        backups,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      StructuredLogger.error('BACKUPS_LIST_ERROR', error);
      res.status(500).json({ error: error.message });
    }
  });

  // POST /v1/backups/create - Create new corpus backup in YAML format with provenance receipts
  app.post('/v1/backups/create', async (req: Request, res: Response) => {
    try {
      const result = await createCorpusBackupYaml();
      
      StructuredLogger.info('BACKUP_CREATED', { 
        filename: result.filename, 
        stats: result.stats 
      });

      res.json({
        status: 'success',
        message: `Created backup with ${result.stats.records} records and ${result.stats.files} files`,
        filename: result.filename,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      StructuredLogger.error('BACKUP_CREATE_ERROR', error);
      res.status(500).json({ error: error.message });
    }
  });

  // POST /v1/backups/restore - Restore from backup file
  app.post('/v1/backups/restore', async (req: Request, res: Response) => {
    const { filename } = req.body;

    if (!filename) {
      res.status(400).json({ error: 'filename is required' });
      return;
    }

    try {
      const stats = await restoreFromDisk(filename);
      
      StructuredLogger.info('BACKUP_RESTORED', { filename, stats });

      res.json({
        status: 'success',
        message: `Restored ${filename}`,
        restored: stats,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      StructuredLogger.error('BACKUP_RESTORE_ERROR', error);
      res.status(500).json({ error: error.message });
    }
  });

  // POST /v1/inbox/rebuild-mirror - Rebuild inbox from mirrored_brain/ (for backup restore)
  app.post('/v1/inbox/rebuild-mirror', async (req: Request, res: Response) => {
    try {
      await rebuildInboxFromMirror();
      
      StructuredLogger.info('INBOX_REBUILT_FROM_MIRROR');

      res.json({
        status: 'success',
        message: 'Inbox rebuilt from mirrored_brain/',
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      StructuredLogger.error('INBOX_REBUILD_ERROR', error);
      res.status(500).json({ error: error.message });
    }
  });

  // POST /v1/inbox/rebuild-filesystem - Rebuild filesystem from database sources
  app.post('/v1/inbox/rebuild-filesystem', async (req: Request, res: Response) => {
    try {
      await rebuildFilesystemFromSources();
      
      StructuredLogger.info('FILESYSTEM_REBUILT_FROM_SOURCES');

      res.json({
        status: 'success',
        message: 'Inbox rebuilt from database sources',
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      StructuredLogger.error('FILESYSTEM_REBUILD_ERROR', error);
      res.status(500).json({ error: error.message });
    }
  });

  // GET /v1/backup/status - Get backup system status
  app.get('/v1/backup/status', async (req: Request, res: Response) => {
    try {
      const backups = await listBackups();
      
      StructuredLogger.info('BACKUP_STATUS');

      res.json({
        status: 'healthy',
        backup_count: backups.length,
        latest_backup: backups[0] || null,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      StructuredLogger.error('BACKUP_STATUS_ERROR', error);
      res.status(500).json({ error: error.message });
    }
  });
}