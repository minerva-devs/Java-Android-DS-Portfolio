/**
 * Encryption Configuration Schema
 * 
 * Defines configuration options for block-level encryption.
 */

import { z } from 'zod';

/**
 * Encryption settings schema
 */
export const EncryptionSettingsSchema = z.object({
  /** Enable/disable encryption */
  enabled: z.boolean().optional().default(true),
  
  /** Master password storage method */
  password_storage: z.enum(['env', 'file', 'prompt']).optional().default('env'),
  
  /** Environment variable name for master password */
  password_env_var: z.string().optional().default('ANCHOR_MASTER_PASSWORD'),
  
  /** Minimum confidence for pattern detection (0-1) */
  min_confidence: z.number().min(0).max(1).optional().default(0.7),
  
  /** Types of sensitive content to encrypt */
  sensitive_types: z.array(z.string()).optional(),
  
  /** Enable NSFW detection (requires model download) */
  detect_nsfw: z.boolean().optional().default(false),
  
  /** Auto-encrypt on ingestion */
  auto_encrypt_on_ingest: z.boolean().optional().default(true),
  
  /** Auto-decrypt on search */
  auto_decrypt_on_search: z.boolean().optional().default(true),
  
  /** Dry run mode (detect only, don't encrypt) */
  dry_run: z.boolean().optional().default(false),
  
  /** Custom regex patterns for detection */
  custom_patterns: z.array(
    z.object({
      type: z.string(),
      regex: z.string(),
      min_entropy: z.number().optional(),
    })
  ).optional(),
});

export type EncryptionSettings = z.infer<typeof EncryptionSettingsSchema>;

/**
 * Default encryption settings
 */
export const DEFAULT_ENCRYPTION_SETTINGS: EncryptionSettings = {
  enabled: true,
  password_storage: 'env',
  password_env_var: 'ANCHOR_MASTER_PASSWORD',
  min_confidence: 0.7,
  detect_nsfw: false,
  auto_encrypt_on_ingest: true,
  auto_decrypt_on_search: true,
  dry_run: false,
};
