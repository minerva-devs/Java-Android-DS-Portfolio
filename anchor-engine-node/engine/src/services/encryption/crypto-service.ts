/**
 * Crypto Service for Block-Level Encryption
 * 
 * Provides AES-256-GCM encryption/decryption with PBKDF2 key derivation.
 * All sensitive content is encrypted with authenticated encryption to detect tampering.
 * 
 * @module services/encryption/crypto-service
 */

import { createCipheriv, createDecipheriv, randomBytes, scryptSync, pbkdf2Sync } from 'crypto';

// Cryptographic constants
const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32; // 256 bits
const SALT_LENGTH = 16; // 128 bits
const IV_LENGTH = 12; // 96 bits (recommended for GCM)
const AUTH_TAG_LENGTH = 16; // 128 bits
const PBKDF2_ITERATIONS = 100000; // OWASP recommendation for 2023

/**
 * Encrypted block structure
 */
export interface EncryptedBlock {
  ciphertext: string; // Base64 encoded encrypted content
  iv: string; // Base64 encoded initialization vector
  salt: string; // Base64 encoded salt
  authTag: string; // Base64 encoded authentication tag
}

/**
 * Decrypted block result
 */
export interface DecryptedBlock {
  plaintext: string;
  type: string;
  hash: string;
}

/**
 * Crypto Service for AES-256-GCM encryption
 */
export class CryptoService {
  private cachedKey: Buffer | null = null;
  private cachedPassword: string | null = null;

  /**
   * Derive encryption key from master password using PBKDF2
   * 
   * @param password - Master password
   * @param salt - Salt for key derivation (will be generated if not provided)
   * @returns Derived key and salt
   */
  deriveKey(password: string, salt?: Buffer): { key: Buffer; salt: Buffer } {
    const saltToUse = salt || randomBytes(SALT_LENGTH);
    
    // Use PBKDF2 with SHA-256 for key derivation
    const key = pbkdf2Sync(
      password,
      saltToUse,
      PBKDF2_ITERATIONS,
      KEY_LENGTH,
      'sha256'
    );

    return { key, salt: saltToUse };
  }

  /**
   * Get or cache encryption key from password
   * Caches key to avoid repeated PBKDF2 computations
   * 
   * @param password - Master password
   * @returns Encryption key
   */
  getKey(password: string): Buffer {
    // Return cached key if password matches
    if (this.cachedKey && this.cachedPassword === password) {
      return this.cachedKey;
    }

    // Derive new key
    const { key } = this.deriveKey(password);
    
    // Cache key and password
    this.cachedKey = key;
    this.cachedPassword = password;

    return key;
  }

  /**
   * Clear cached encryption key from memory
   * Should be called after encryption operations complete
   */
  clearKey(): void {
    if (this.cachedKey) {
      // Overwrite key buffer with zeros before clearing
      this.cachedKey.fill(0);
      this.cachedKey = null;
    }
    if (this.cachedPassword) {
      this.cachedPassword = null;
    }
  }

  /**
   * Encrypt sensitive content using AES-256-GCM
   * 
   * @param plaintext - Content to encrypt
   * @param key - Encryption key (from deriveKey or getKey)
   * @returns Encrypted block with IV, salt, and auth tag
   */
  encrypt(plaintext: string, key: Buffer): EncryptedBlock {
    // Generate random IV and salt
    const iv = randomBytes(IV_LENGTH);
    const salt = randomBytes(SALT_LENGTH);

    // Create cipher
    const cipher = createCipheriv(ALGORITHM, key, iv, {
      authTagLength: AUTH_TAG_LENGTH
    });

    // Encrypt content
    let encrypted = cipher.update(plaintext, 'utf8', 'base64');
    encrypted += cipher.final('base64');

    // Get authentication tag
    const authTag = cipher.getAuthTag();

    return {
      ciphertext: encrypted,
      iv: iv.toString('base64'),
      salt: salt.toString('base64'),
      authTag: authTag.toString('base64')
    };
  }

  /**
   * Decrypt encrypted content using AES-256-GCM
   * 
   * @param encryptedBlock - Encrypted block with ciphertext, IV, salt, and auth tag
   * @param key - Decryption key
   * @returns Decrypted plaintext
   */
  decrypt(encryptedBlock: EncryptedBlock, key: Buffer): string {
    const { ciphertext, iv, authTag } = encryptedBlock;

    // Create decipher
    const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(iv, 'base64'), {
      authTagLength: AUTH_TAG_LENGTH
    });

    // Set authentication tag
    decipher.setAuthTag(Buffer.from(authTag, 'base64'));

    // Decrypt content
    let decrypted = decipher.update(ciphertext, 'base64', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  /**
   * Encrypt content with password (convenience method)
   * Automatically derives key and manages caching
   * 
   * @param plaintext - Content to encrypt
   * @param password - Master password
   * @returns Encrypted block
   */
  encryptWithPassword(plaintext: string, password: string): EncryptedBlock {
    try {
      const key = this.getKey(password);
      return this.encrypt(plaintext, key);
    } finally {
      // Clear key after use for security
      this.clearKey();
    }
  }

  /**
   * Decrypt content with password (convenience method)
   * Automatically derives key and manages caching
   * 
   * @param encryptedBlock - Encrypted block
   * @param password - Master password
   * @returns Decrypted plaintext
   */
  decryptWithPassword(encryptedBlock: EncryptedBlock, password: string): string {
    try {
      const key = this.getKey(password);
      return this.decrypt(encryptedBlock, key);
    } finally {
      // Clear key after use for security
      this.clearKey();
    }
  }

  /**
   * Generate SHA-256 hash of content for deduplication
   * 
   * @param content - Content to hash
   * @returns Hex-encoded hash
   */
  hash(content: string): string {
    const { createHash } = require('crypto');
    return createHash('sha256').update(content, 'utf8').digest('hex').substring(0, 16);
  }

  /**
   * Validate encrypted block format
   * 
   * @param block - Encrypted block to validate
   * @returns True if valid
   */
  isValidBlock(block: Partial<EncryptedBlock>): boolean {
    return !!(
      block.ciphertext &&
      block.iv &&
      block.salt &&
      block.authTag &&
      typeof block.ciphertext === 'string' &&
      typeof block.iv === 'string' &&
      typeof block.salt === 'string' &&
      typeof block.authTag === 'string'
    );
  }
}

// Export singleton instance
export const cryptoService = new CryptoService();
