/**
 * Encryption Pipeline for Block-Level Content Encryption
 * 
 * Orchestrates the encryption of sensitive content blocks:
 * 1. Detects sensitive patterns in content
 * 2. Encrypts each block with AES-256-GCM
 * 3. Replaces original with encrypted placeholder
 * 4. Supports on-the-fly decryption for search/compaction
 * 
 * @module services/encryption/encryption-pipeline
 */

import { cryptoService } from './crypto-service.js';
import { patternDetector, type SensitiveBlock } from './pattern-detector.js';
import { keyManager } from './key-manager.js';

/**
 * Encrypted block format in content
 */
export interface EncryptedBlockFormat {
  type: string;
  hash: string;
  iv: string;
  salt: string;
  authTag: string;
  ciphertext: string;
}

/**
 * Encryption result
 */
export interface EncryptionResult {
  /** Encrypted content */
  encryptedContent: string;
  /** Number of blocks encrypted */
  blocksEncrypted: number;
  /** Breakdown by type */
  blocksByType: Record<string, number>;
  /** Block hash map for tracking */
  blockMap: Map<string, string>;
}

/**
 * Decryption result
 */
export interface DecryptionResult {
  /** Decrypted content */
  decryptedContent: string;
  /** Number of blocks decrypted */
  blocksDecrypted: number;
}

/**
 * Encryption pipeline configuration
 */
export interface EncryptionConfig {
  /** Enable/disable encryption */
  enabled: boolean;
  /** Master password (optional, can use env var) */
  masterPassword?: string;
  /** Minimum confidence for pattern detection */
  minConfidence: number;
  /** Types of sensitive content to encrypt */
  sensitiveTypes?: string[];
  /** Include NSFW detection */
  detectNSFW: boolean;
  /** Dry run (detect only, don't encrypt) */
  dryRun: boolean;
}

/**
 * Default encryption configuration
 */
const DEFAULT_CONFIG: EncryptionConfig = {
  enabled: true,
  minConfidence: 0.7,
  detectNSFW: false, // Disabled by default (requires model download)
  dryRun: false,
};

/**
 * Block marker format
 */
const BLOCK_FORMAT = {
  start: '[ENCRYPTED_BLOCK_START]',
  end: '[ENCRYPTED_BLOCK_END]',
  type: (type: string) => `[TYPE: ${type}]`,
  hash: (hash: string) => `[HASH: ${hash}]`,
  iv: (iv: string) => `[IV: ${iv}]`,
  salt: (salt: string) => `[SALT: ${salt}]`,
  auth: (auth: string) => `[AUTH: ${auth}]`,
  placeholder: (type: string, hash: string) => `[${type}: ${hash}]`,
};

/**
 * Encryption Pipeline for block-level content encryption
 */
export class EncryptionPipeline {
  private config: EncryptionConfig;

  constructor(config: Partial<EncryptionConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Update pipeline configuration
   */
  configure(config: Partial<EncryptionConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get master password from config or environment
   */
  private getMasterPassword(): string | null {
    return this.config.masterPassword || keyManager.getPassword();
  }

  /**
   * Encrypt sensitive content in text
   * 
   * @param content - Text content to encrypt
   * @param config - Optional config override
   * @returns Encryption result
   */
  async encrypt(
    content: string,
    config?: Partial<EncryptionConfig>
  ): Promise<EncryptionResult> {
    const effectiveConfig = { ...this.config, ...config };

    // Check if encryption is enabled
    if (!effectiveConfig.enabled) {
      return {
        encryptedContent: content,
        blocksEncrypted: 0,
        blocksByType: {},
        blockMap: new Map(),
      };
    }

    // Get master password
    const password = this.getMasterPassword();
    if (!password) {
      console.warn('[EncryptionPipeline] No master password available, skipping encryption');
      return {
        encryptedContent: content,
        blocksEncrypted: 0,
        blocksByType: {},
        blockMap: new Map(),
      };
    }

    try {
      // Detect sensitive blocks
      const blocks = patternDetector.detect(content, {
        minConfidence: effectiveConfig.minConfidence,
        types: effectiveConfig.sensitiveTypes as any,
      });

      if (blocks.length === 0) {
        return {
          encryptedContent: content,
          blocksEncrypted: 0,
          blocksByType: {},
          blockMap: new Map(),
        };
      }

      // Encrypt each block
      const blockMap = new Map<string, string>();
      const blocksByType: Record<string, number> = {};
      let encryptedContent = content;
      let offset = 0;

      for (const block of blocks) {
        // Encrypt block content
        const encrypted = cryptoService.encryptWithPassword(block.text, password);

        // Create encrypted block marker
        const encryptedBlock = this.formatEncryptedBlock(
          block.type,
          block.hash,
          encrypted
        );

        // Replace original with encrypted block
        const start = block.start + offset;
        const end = block.end + offset;

        encryptedContent =
          encryptedContent.substring(0, start) +
          encryptedBlock +
          encryptedContent.substring(end);

        offset += encryptedBlock.length - (block.end - block.start);

        // Track block
        blockMap.set(block.hash, block.type);
        blocksByType[block.type] = (blocksByType[block.type] || 0) + 1;
      }

      return {
        encryptedContent,
        blocksEncrypted: blocks.length,
        blocksByType,
        blockMap,
      };
    } finally {
      // Clear cached password for security
      keyManager.clearPassword();
    }
  }

  /**
   * Decrypt encrypted content
   * 
   * @param encryptedContent - Content with encrypted blocks
   * @param password - Optional master password override
   * @returns Decryption result
   */
  async decrypt(
    encryptedContent: string,
    password?: string
  ): Promise<DecryptionResult> {
    const masterPassword = password || this.getMasterPassword();

    if (!masterPassword) {
      console.warn('[EncryptionPipeline] No master password available for decryption');
      return {
        decryptedContent: encryptedContent,
        blocksDecrypted: 0,
      };
    }

    try {
      // Find all encrypted blocks
      const blockRegex = new RegExp(
        `${BLOCK_FORMAT.start}([\\s\\S]*?)${BLOCK_FORMAT.end}`,
        'g'
      );

      let decryptedContent = encryptedContent;
      let blocksDecrypted = 0;
      let match;

      while ((match = blockRegex.exec(encryptedContent)) !== null) {
        const blockContent = match[1];

        // Parse block metadata
        const typeMatch = blockContent.match(/\[TYPE: (\w+)\]/);
        const hashMatch = blockContent.match(/\[HASH: ([^\]]+)\]/);
        const ivMatch = blockContent.match(/\[IV: ([^\]]+)\]/);
        const saltMatch = blockContent.match(/\[SALT: ([^\]]+)\]/);
        const authMatch = blockContent.match(/\[AUTH: ([^\]]+)\]/);
        const ciphertextMatch = blockContent.match(/\n([A-Za-z0-9+/=]+)\n/);

        if (
          !typeMatch ||
          !ivMatch ||
          !saltMatch ||
          !authMatch ||
          !ciphertextMatch
        ) {
          console.warn('[EncryptionPipeline] Invalid encrypted block format');
          continue;
        }

        try {
          // Decrypt block
          const decrypted = cryptoService.decryptWithPassword(
            {
              ciphertext: ciphertextMatch[1],
              iv: ivMatch[1],
              salt: saltMatch[1],
              authTag: authMatch[1],
            },
            masterPassword
          );

          // Replace encrypted block with original content
          const start = match.index;
          const end = match.index + match[0].length;

          decryptedContent =
            decryptedContent.substring(0, start) +
            decrypted +
            decryptedContent.substring(end);

          blocksDecrypted++;
        } catch (error: any) {
          console.error(
            `[EncryptionPipeline] Failed to decrypt block (${typeMatch[1]}):`,
            error.message
          );
          // Leave encrypted block in place on error
        }
      }

      return {
        decryptedContent,
        blocksDecrypted,
      };
    } finally {
      // Clear cached password for security
      keyManager.clearPassword();
    }
  }

  /**
   * Format encrypted block for insertion
   */
  private formatEncryptedBlock(
    type: string,
    hash: string,
    encrypted: { ciphertext: string; iv: string; salt: string; authTag: string }
  ): string {
    return (
      `${BLOCK_FORMAT.placeholder(type, hash)}\n` +
      `${BLOCK_FORMAT.start}\n` +
      `${BLOCK_FORMAT.type(type)}\n` +
      `${BLOCK_FORMAT.hash(hash)}\n` +
      `${BLOCK_FORMAT.iv(encrypted.iv)}\n` +
      `${BLOCK_FORMAT.salt(encrypted.salt)}\n` +
      `${BLOCK_FORMAT.auth(encrypted.authTag)}\n` +
      `${encrypted.ciphertext}\n` +
      `${BLOCK_FORMAT.end}`
    );
  }

  /**
   * Check if content contains encrypted blocks
   */
  hasEncryptedBlocks(content: string): boolean {
    return content.includes(BLOCK_FORMAT.start);
  }

  /**
   * Count encrypted blocks in content
   */
  countEncryptedBlocks(content: string): number {
    const matches = content.match(
      new RegExp(BLOCK_FORMAT.start, 'g')
    );
    return matches ? matches.length : 0;
  }

  /**
   * Get encryption statistics for content
   */
  getStats(content: string): {
    hasEncryptedBlocks: boolean;
    encryptedBlockCount: number;
    sensitiveBlockCount: number;
    estimatedEncryptedChars: number;
  } {
    const encryptedBlockCount = this.countEncryptedBlocks(content);
    
    // Detect unencrypted sensitive blocks
    const sensitiveBlocks = patternDetector.detect(content, {
      minConfidence: this.config.minConfidence,
    });

    // Estimate encrypted characters
    let estimatedEncryptedChars = 0;
    const blockRegex = new RegExp(
      `${BLOCK_FORMAT.start}([\\s\\S]*?)${BLOCK_FORMAT.end}`,
      'g'
    );
    let match;

    while ((match = blockRegex.exec(content)) !== null) {
      // Approximate original length from encrypted block size
      estimatedEncryptedChars += Math.floor(match[0].length / 2);
    }

    return {
      hasEncryptedBlocks: encryptedBlockCount > 0,
      encryptedBlockCount,
      sensitiveBlockCount: sensitiveBlocks.length,
      estimatedEncryptedChars,
    };
  }
}

/**
 * Encrypt file content before storage
 * 
 * @param content - File content
 * @param filePath - File path (for logging)
 * @param password - Master password
 * @returns Encrypted content
 */
export async function encryptFileContent(
  content: string,
  filePath: string,
  password?: string
): Promise<string> {
  const pipeline = new EncryptionPipeline({
    masterPassword: password,
  });

  const result = await pipeline.encrypt(content);

  if (result.blocksEncrypted > 0) {
    console.log(
      `[Encryption] Encrypted ${result.blocksEncrypted} blocks in ${filePath}`
    );
  }

  return result.encryptedContent;
}

/**
 * Decrypt file content for reading
 * 
 * @param content - Encrypted file content
 * @param filePath - File path (for logging)
 * @param password - Master password
 * @returns Decrypted content
 */
export async function decryptFileContent(
  content: string,
  filePath: string,
  password?: string
): Promise<string> {
  const pipeline = new EncryptionPipeline({
    masterPassword: password,
  });

  if (!pipeline.hasEncryptedBlocks(content)) {
    return content; // No encrypted blocks, return as-is
  }

  const result = await pipeline.decrypt(content, password);

  if (result.blocksDecrypted > 0) {
    console.log(
      `[Encryption] Decrypted ${result.blocksDecrypted} blocks in ${filePath}`
    );
  }

  return result.decryptedContent;
}

// Export singleton instance
export const encryptionPipeline = new EncryptionPipeline();
