/**
 * Encryption API Routes
 * 
 * Provides REST API endpoints for encryption operations:
 * - POST /v1/encryption/encrypt - Encrypt content
 * - POST /v1/encryption/decrypt - Decrypt content
 * - GET /v1/encryption/status - Get encryption status
 * - POST /v1/encryption/set-password - Set master password
 * 
 * @module routes/v1/encryption
 */

import { Application, Request, Response } from 'express';
import {
  EncryptionPipeline,
  encryptFileContent,
  decryptFileContent,
} from '../../services/encryption/encryption-pipeline.js';
import { keyManager } from '../../services/encryption/key-manager.js';
import { patternDetector, getSensitiveStats } from '../../services/encryption/pattern-detector.js';

export function setupEncryptionRoutes(app: Application) {
  /**
   * POST /v1/encryption/encrypt
   * 
   * Encrypt sensitive content in text
   */
  app.post('/v1/encryption/encrypt', async (req: Request, res: Response) => {
    try {
      const { content, file_path, master_password } = req.body;

      if (!content && !file_path) {
        return res.status(400).json({
          error: 'Either "content" or "file_path" is required',
        });
      }

      // Get content to encrypt
      let contentToEncrypt = content;
      if (file_path) {
        const fs = await import('fs');
        if (fs.existsSync(file_path)) {
          contentToEncrypt = fs.readFileSync(file_path, 'utf8');
        } else {
          return res.status(404).json({
            error: `File not found: ${file_path}`,
          });
        }
      }

      // Create pipeline with optional password override
      const pipeline = new EncryptionPipeline({
        masterPassword: master_password,
      });

      // Encrypt content
      const result = await pipeline.encrypt(contentToEncrypt);

      res.json({
        success: true,
        encrypted_content: result.encryptedContent,
        blocks_encrypted: result.blocksEncrypted,
        blocks_by_type: result.blocksByType,
        message: `Encrypted ${result.blocksEncrypted} sensitive blocks`,
      });
    } catch (error: any) {
      console.error('[API] Encryption error:', error);
      res.status(500).json({
        error: error.message || 'Encryption failed',
      });
    }
  });

  /**
   * POST /v1/encryption/decrypt
   * 
   * Decrypt encrypted content (in-memory only)
   */
  app.post('/v1/encryption/decrypt', async (req: Request, res: Response) => {
    try {
      const { encrypted_content, master_password } = req.body;

      if (!encrypted_content) {
        return res.status(400).json({
          error: '"encrypted_content" is required',
        });
      }

      // Create pipeline with optional password override
      const pipeline = new EncryptionPipeline({
        masterPassword: master_password,
      });

      // Decrypt content
      const result = await pipeline.decrypt(encrypted_content, master_password);

      res.json({
        success: true,
        decrypted_content: result.decryptedContent,
        blocks_decrypted: result.blocksDecrypted,
        message: `Decrypted ${result.blocksDecrypted} blocks`,
      });
    } catch (error: any) {
      console.error('[API] Decryption error:', error);
      res.status(500).json({
        error: error.message || 'Decryption failed',
      });
    }
  });

  /**
   * GET /v1/encryption/status
   * 
   * Get encryption configuration and status
   */
  app.get('/v1/encryption/status', async (req: Request, res: Response) => {
    try {
      const keyStatus = keyManager.getStatus();
      const pipeline = new EncryptionPipeline();

      res.json({
        enabled: true,
        has_master_password: keyStatus.hasPassword,
        password_backend: keyStatus.backend,
        password_cached: keyStatus.cached,
        cache_expires_in_ms: keyStatus.cacheExpiresIn,
        config: {
          min_confidence: 0.7,
          detect_nsfw: false,
          auto_encrypt_on_ingest: true,
          auto_decrypt_on_search: true,
        },
      });
    } catch (error: any) {
      console.error('[API] Status error:', error);
      res.status(500).json({
        error: error.message || 'Failed to get status',
      });
    }
  });

  /**
   * POST /v1/encryption/set-password
   * 
   * Set master password temporarily (cached in memory)
   */
  app.post('/v1/encryption/set-password', async (req: Request, res: Response) => {
    try {
      const { password, validate } = req.body;

      if (!password) {
        return res.status(400).json({
          error: '"password" is required',
        });
      }

      // Validate password strength if requested
      if (validate) {
        const validation = keyManager.validatePassword(password);
        if (!validation.valid) {
          return res.status(400).json({
            error: 'Password does not meet requirements',
            validation_errors: validation.errors,
            strength: validation.strength,
          });
        }
      }

      // Set password in key manager
      keyManager.setPassword(password);

      res.json({
        success: true,
        message: 'Master password set (cached in memory)',
        expires_in_ms: 5 * 60 * 1000, // 5 minutes
      });
    } catch (error: any) {
      console.error('[API] Set password error:', error);
      res.status(500).json({
        error: error.message || 'Failed to set password',
      });
    }
  });

  /**
   * POST /v1/encryption/clear-password
   * 
   * Clear cached master password from memory
   */
  app.post('/v1/encryption/clear-password', async (req: Request, res: Response) => {
    try {
      keyManager.clearPassword();

      res.json({
        success: true,
        message: 'Master password cleared from memory',
      });
    } catch (error: any) {
      console.error('[API] Clear password error:', error);
      res.status(500).json({
        error: error.message || 'Failed to clear password',
      });
    }
  });

  /**
   * POST /v1/encryption/scan
   * 
   * Scan content for sensitive patterns (without encrypting)
   */
  app.post('/v1/encryption/scan', async (req: Request, res: Response) => {
    try {
      const { content, file_path } = req.body;

      if (!content && !file_path) {
        return res.status(400).json({
          error: 'Either "content" or "file_path" is required',
        });
      }

      // Get content to scan
      let contentToScan = content;
      if (file_path) {
        const fs = await import('fs');
        if (fs.existsSync(file_path)) {
          contentToScan = fs.readFileSync(file_path, 'utf8');
        } else {
          return res.status(404).json({
            error: `File not found: ${file_path}`,
          });
        }
      }

      // Detect sensitive blocks
      const blocks = patternDetector.detect(contentToScan);

      // Get statistics
      const stats = getSensitiveStats(contentToScan);

      res.json({
        success: true,
        total_blocks: blocks.length,
        by_type: stats.byType,
        total_chars: stats.totalChars,
        percentage: stats.percentage,
        blocks: blocks.map(b => ({
          type: b.type,
          hash: b.hash,
          start: b.start,
          end: b.end,
          length: b.end - b.start,
          confidence: b.confidence,
        })),
      });
    } catch (error: any) {
      console.error('[API] Scan error:', error);
      res.status(500).json({
        error: error.message || 'Scan failed',
      });
    }
  });
}
