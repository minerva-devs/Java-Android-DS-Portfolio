/**
 * Key Manager for Master Password Handling
 * 
 * Manages master password storage and retrieval securely.
 * Supports multiple storage backends:
 * - Environment variables
 * - Encrypted local file
 * - System keychain (future)
 * 
 * @module services/encryption/key-manager
 */

import * as fs from 'fs';
import * as path from 'path';
import { randomBytes } from 'crypto';

/**
 * Key storage backend types
 */
export type KeyStorageBackend = 'env' | 'file' | 'prompt';

/**
 * Key manager configuration
 */
export interface KeyManagerConfig {
  /** Storage backend to use */
  backend: KeyStorageBackend;
  /** Environment variable name (for 'env' backend) */
  envVarName: string;
  /** Path to encrypted key file (for 'file' backend) */
  keyFilePath: string;
  /** Whether to prompt for password if not found */
  promptOnMissing: boolean;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: KeyManagerConfig = {
  backend: 'env',
  envVarName: 'ANCHOR_MASTER_PASSWORD',
  keyFilePath: path.join(process.env.HOME || '.', '.anchor', 'encrypted_key'),
  promptOnMissing: true,
};

/**
 * Key Manager for secure master password handling
 */
export class KeyManager {
  private config: KeyManagerConfig;
  private cachedPassword: string | null = null;
  private passwordExpiry: number = 0;
  private readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

  constructor(config: Partial<KeyManagerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Get master password from configured backend
   * 
   * @returns Master password or null if not available
   */
  getPassword(): string | null {
    // Check cache first (with TTL)
    if (
      this.cachedPassword &&
      Date.now() < this.passwordExpiry
    ) {
      return this.cachedPassword;
    }

    let password: string | null = null;

    // Get password from configured backend
    switch (this.config.backend) {
      case 'env':
        password = process.env[this.config.envVarName] || null;
        break;

      case 'file':
        password = this.readFromFile();
        break;

      case 'prompt':
        password = this.promptForPassword();
        break;
    }

    // Cache password if found
    if (password) {
      this.cachedPassword = password;
      this.passwordExpiry = Date.now() + this.CACHE_TTL_MS;
    }

    return password;
  }

  /**
   * Set master password (temporarily cached)
   * 
   * @param password - Master password
   */
  setPassword(password: string): void {
    this.cachedPassword = password;
    this.passwordExpiry = Date.now() + this.CACHE_TTL_MS;
  }

  /**
   * Clear cached password from memory
   */
  clearPassword(): void {
    if (this.cachedPassword) {
      // Overwrite with random data before clearing
      const randomData = randomBytes(this.cachedPassword.length);
      this.cachedPassword = randomData.toString('utf8');
      this.cachedPassword = null;
    }
    this.passwordExpiry = 0;
  }

  /**
   * Check if master password is available
   * 
   * @returns True if password is available
   */
  hasPassword(): boolean {
    return this.getPassword() !== null;
  }

  /**
   * Read password from encrypted file
   * 
   * @returns Password or null
   */
  private readFromFile(): string | null {
    try {
      if (!fs.existsSync(this.config.keyFilePath)) {
        return null;
      }

      const encryptedData = fs.readFileSync(this.config.keyFilePath, 'utf8');
      
      // For now, file contains base64-encoded password
      // TODO: Implement proper file encryption with system keychain
      return Buffer.from(encryptedData, 'base64').toString('utf8');
    } catch (error) {
      console.error('[KeyManager] Failed to read from file:', error);
      return null;
    }
  }

  /**
   * Save password to encrypted file
   * 
   * @param password - Master password
   * @returns True if saved successfully
   */
  saveToFile(password: string): boolean {
    try {
      const dir = path.dirname(this.config.keyFilePath);
      
      // Create directory if it doesn't exist
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
      }

      // Encrypt password (simple base64 for now)
      // TODO: Use proper encryption with system keychain
      const encryptedData = Buffer.from(password, 'utf8').toString('base64');

      // Write with restricted permissions (owner read/write only)
      fs.writeFileSync(this.config.keyFilePath, encryptedData, {
        mode: 0o600,
        encoding: 'utf8',
      });

      return true;
    } catch (error) {
      console.error('[KeyManager] Failed to save to file:', error);
      return false;
    }
  }

  /**
   * Prompt user for password (synchronous)
   * 
   * @returns Password or null
   */
  private promptForPassword(): string | null {
    // Note: This is a placeholder - proper implementation would use
    // a secure prompt library like 'prompts' or 'read'
    console.warn('[KeyManager] Interactive prompt not implemented in non-interactive environment');
    console.warn('[KeyManager] Set ANCHOR_MASTER_PASSWORD environment variable instead');
    return null;
  }

  /**
   * Validate password strength
   * 
   * @param password - Password to validate
   * @returns Validation result
   */
  validatePassword(password: string): {
    valid: boolean;
    errors: string[];
    strength: 'weak' | 'medium' | 'strong';
  } {
    const errors: string[] = [];
    
    // Minimum length
    if (password.length < 12) {
      errors.push('Password must be at least 12 characters long');
    }

    // Check for character variety
    const hasUpper = /[A-Z]/.test(password);
    const hasLower = /[a-z]/.test(password);
    const hasDigit = /[0-9]/.test(password);
    const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);

    const varietyCount = [hasUpper, hasLower, hasDigit, hasSpecial].filter(Boolean).length;

    if (varietyCount < 3) {
      errors.push('Password should contain at least 3 of: uppercase, lowercase, digits, special characters');
    }

    // Determine strength
    let strength: 'weak' | 'medium' | 'strong' = 'weak';
    
    if (password.length >= 16 && varietyCount >= 4) {
      strength = 'strong';
    } else if (password.length >= 12 && varietyCount >= 3) {
      strength = 'medium';
    }

    return {
      valid: errors.length === 0,
      errors,
      strength,
    };
  }

  /**
   * Get password status information
   * 
   * @returns Password status
   */
  getStatus(): {
    hasPassword: boolean;
    backend: KeyStorageBackend;
    cached: boolean;
    cacheExpiresIn: number;
  } {
    const hasCached = this.cachedPassword !== null && Date.now() < this.passwordExpiry;
    
    return {
      hasPassword: this.hasPassword(),
      backend: this.config.backend,
      cached: hasCached,
      cacheExpiresIn: hasCached ? Math.max(0, this.passwordExpiry - Date.now()) : 0,
    };
  }

  /**
   * Update configuration
   * 
   * @param config - New configuration
   */
  configure(config: Partial<KeyManagerConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

// Export singleton instance with default config
export const keyManager = new KeyManager();
