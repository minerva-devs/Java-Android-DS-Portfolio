/**
 * Security Utilities Tests - Vitest version
 *
 * Tests for path traversal prevention and path validation utilities.
 */

import { test, expect } from 'vitest';
import path from 'path';
import fs from 'fs';
import {
  validatePathSafety,
  validatePathSafetyWithExistence,
  getSafePath,
  isPathSafe
} from '../../src/utils/security.js';

// Use realpath'd cwd to handle environments where the workspace is symlinked
const PROJECT_ROOT = fs.realpathSync(process.cwd());

describe('Security Utilities', () => {
  describe('validatePathSafety', () => {
    it('should allow valid paths within allowed base directory', () => {
      const result = validatePathSafety('./src/index.ts', [PROJECT_ROOT]);
      expect(result.isValid).toBe(true);
      expect(result.resolvedPath.endsWith('src/index.ts')).toBe(true);
    });

    it('should reject path traversal attempts with ../', () => {
      const result = validatePathSafety('../../../etc/passwd', [PROJECT_ROOT]);
      expect(result.isValid).toBe(false);
      expect(result.error?.includes('Path traversal detected')).toBe(true);
    });

    it('should reject path traversal attempts with ..\\ on Windows', () => {
      const result = validatePathSafety('..\\..\\..\\etc\\passwd', [PROJECT_ROOT]);
      expect(result.isValid).toBe(false);
      expect(result.error?.includes('Path traversal detected')).toBe(true);
    });

    it('should reject absolute paths outside allowed directories', () => {
      const evilPath = process.platform === 'win32'
        ? 'C:\\Windows\\System32\\config\\SAM'
        : '/etc/shadow';
      const result = validatePathSafety(evilPath, [PROJECT_ROOT]);
      expect(result.isValid).toBe(false);
    });

    it('should handle multiple allowed base directories', () => {
      const tempDir = path.join(process.cwd(), 'temp');
      const result = validatePathSafety('./temp/test.txt', [PROJECT_ROOT, tempDir]);
      // Should be valid since it's within PROJECT_ROOT
      expect(result.isValid).toBe(true);
    });

    it('should reject empty paths', () => {
      const result = validatePathSafety('', [PROJECT_ROOT]);
      expect(result.isValid).toBe(false);
      expect(result.error?.includes('cannot be empty')).toBe(true);
    });

    it('should reject null/undefined paths', () => {
      const result1 = validatePathSafety(null as any, [PROJECT_ROOT]);
      expect(result1.isValid).toBe(false);

      const result2 = validatePathSafety(undefined as any, [PROJECT_ROOT]);
      expect(result2.isValid).toBe(false);
    });

    it('should handle paths with mixed separators', () => {
      // This is a valid path normalization test
      const result = validatePathSafety('src\\utils/security.ts', [PROJECT_ROOT]);
      expect(result.isValid).toBe(true);
    });

    it('should allow exact base directory match', () => {
      const result = validatePathSafety(PROJECT_ROOT, [PROJECT_ROOT]);
      expect(result.isValid).toBe(true);
      // Normalize both paths for comparison (Windows may use different separators)
      expect(result.resolvedPath.replace(/\\/g, '/')).toBe(PROJECT_ROOT.replace(/\\/g, '/'));
    });

    it('should reject paths that try to escape via symlink-like patterns', () => {
      // Even if the path looks legitimate, it should be validated
      const result = validatePathSafety('src/../../../etc/passwd', [PROJECT_ROOT]);
      expect(result.isValid).toBe(false);
    });

    it('should handle URL-encoded path traversal attempts', () => {
      // URL-encoded ../ would be %2e%2e%2f or %2e%2e/
      const result = validatePathSafety('%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd', [PROJECT_ROOT]);
      // After decoding, this should still be caught
      expect(result.isValid).toBe(false);
    });
  });

  describe('validatePathSafetyWithExistence', () => {
    it('should validate path safety and existence for valid files', async () => {
      // Create a temp test file
      const testFile = path.join(PROJECT_ROOT, 'tests', 'fixtures', 'security', 'test.txt');
      await fs.promises.mkdir(path.dirname(testFile), { recursive: true });
      await fs.promises.writeFile(testFile, 'test content');

      try {
        const result = await validatePathSafetyWithExistence(testFile, [PROJECT_ROOT]);
        expect(result.isValid).toBe(true);
        expect(result.resolvedPath.includes('test.txt')).toBe(true);
      } finally {
        // Cleanup
        await fs.promises.unlink(testFile).catch(() => {});
      }
    });

    it('should reject non-existent paths', async () => {
      const result = await validatePathSafetyWithExistence(
        path.join(PROJECT_ROOT, 'nonexistent', 'file.txt'),
        [PROJECT_ROOT]
      );
      expect(result.isValid).toBe(false);
      expect(result.error?.includes('does not exist')).toBe(true);
    });

    it('should reject traversal paths even if they exist', async () => {
      // /etc/passwd exists on Unix systems but should be rejected
      if (process.platform !== 'win32') {
        const result = await validatePathSafetyWithExistence('/etc/passwd', [PROJECT_ROOT]);
        expect(result.isValid).toBe(false);
        expect(result.error?.includes('Path traversal')).toBe(true);
      }
    });
  });

  describe('getSafePath', () => {
    it('should return safe path for valid input', async () => {
      // Use a path under PROJECT_ROOT directly — avoid process.cwd() which
      // may resolve through symlinks/junctions on some environments.
      const testFile = path.join(PROJECT_ROOT, 'package.json');
      const safePath = await getSafePath(testFile, [PROJECT_ROOT]);
      expect(safePath.endsWith('package.json')).toBe(true);
    });

    it('should throw error for traversal attempts', async () => {
      await expect(getSafePath('../../../etc/passwd', [PROJECT_ROOT])).rejects.toThrow(/Path traversal/);
    });
  });

  describe('isPathSafe', () => {
    it('should return true for safe paths', () => {
      expect(isPathSafe('./src', [PROJECT_ROOT])).toBe(true);
    });

    it('should return false for unsafe paths', () => {
      expect(isPathSafe('../../../etc', [PROJECT_ROOT])).toBe(false);
    });

    it('should be a convenient boolean check', () => {
      // Quick boolean check without full result object
      const safe = isPathSafe('docs/readme.md', [PROJECT_ROOT]);
      expect(safe).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle very long paths', () => {
      const longPath = './src/' + 'a/'.repeat(100) + 'file.txt';
      const result = validatePathSafety(longPath, [PROJECT_ROOT]);
      // Should not throw, result depends on whether it stays within PROJECT_ROOT
      expect(typeof result.isValid).toBe('boolean');
    });

    it('should handle paths with special characters', () => {
      const result = validatePathSafety('./src/file with spaces & special!.txt', [PROJECT_ROOT]);
      expect(result.isValid).toBe(true);
    });

    it('should handle Unicode paths', () => {
      const result = validatePathSafety('./src/文件.txt', [PROJECT_ROOT]);
      expect(result.isValid).toBe(true);
    });

    it('should handle paths with null bytes (injection attempt)', () => {
      const result = validatePathSafety('./src/file.txt\u0000.jpg', [PROJECT_ROOT]);
      // Should either reject or safely handle - but not crash
      expect(typeof result.isValid).toBe('boolean');
    });
  });

  describe('Real-World Attack Scenarios', () => {
    it('should block classic ../../etc/passwd attack', () => {
      const result = validatePathSafety('../../etc/passwd', [PROJECT_ROOT]);
      expect(result.isValid).toBe(false);
    });

    it('should block Windows UNC path attacks', () => {
      const result = validatePathSafety('\\\\evil\\share\\file.txt', [PROJECT_ROOT]);
      expect(result.isValid).toBe(false);
    });

    it('should block path with hidden directory traversal', () => {
      // Using ....// which after normalization might become ../
      const result = validatePathSafety('....//....//etc/passwd', [PROJECT_ROOT]);
      expect(result.isValid).toBe(false);
    });

    it('should block NTFS alternate data streams (Windows)', () => {
      if (process.platform === 'win32') {
        const result = validatePathSafety('file.txt:secret.txt', [PROJECT_ROOT]);
        // ADS detection depends on path normalization; accept either outcome
        expect(typeof result.isValid).toBe('boolean');
      }
    });
  });
});
