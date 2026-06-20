/**
 * Encryption Services Module
 * 
 * Provides block-level encryption for sensitive content in Anchor Engine.
 * 
 * Features:
 * - AES-256-GCM authenticated encryption
 * - Pattern-based sensitive content detection
 * - Secure master password management
 * - On-the-fly decryption for search/compaction
 * 
 * @module services/encryption
 */

// Crypto service
export {
  CryptoService,
  cryptoService,
  type EncryptedBlock,
  type DecryptedBlock,
} from './crypto-service.js';

// Pattern detector
export {
  PatternDetector,
  patternDetector,
  type SensitiveBlock,
  type SensitiveType,
  detectSensitiveBlocks,
  getSensitiveStats,
  calculateEntropy,
  generateHash,
} from './pattern-detector.js';

// Key manager
export {
  KeyManager,
  keyManager,
  type KeyManagerConfig,
  type KeyStorageBackend,
} from './key-manager.js';

// Encryption pipeline
export {
  EncryptionPipeline,
  encryptionPipeline,
  type EncryptionConfig,
  type EncryptionResult,
  type DecryptionResult,
  type EncryptedBlockFormat,
  encryptFileContent,
  decryptFileContent,
} from './encryption-pipeline.js';
