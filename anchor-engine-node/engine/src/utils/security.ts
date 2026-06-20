/**
 * Security Utilities for Path Validation
 * 
 * Prevents path traversal attacks by validating that resolved paths
 * stay within allowed base directories.
 */

import path from 'path';
import fs from 'fs';

/**
 * Result of path validation
 */
export interface PathValidationResult {
  isValid: boolean;
  resolvedPath: string;
  error?: string;
  allowedBase?: string;
}

/**
 * Validate that a user-supplied path resolves to within one of the allowed base directories.
 *
 * @param userPath - The path provided by the user (can be relative or absolute)
 * @param allowedBases - Array of allowed base directory paths (must be absolute)
 * @returns PathValidationResult with validation status and resolved path
 *
 * @example
 * ```typescript
 * const result = validatePathSafety('../../../etc/passwd', [PROJECT_ROOT]);
 * if (!result.isValid) {
 *   return res.status(403).json({ error: result.error });
 * }
 * // Safe to use result.resolvedPath
 * ```
 */
export function validatePathSafety(
  userPath: string,
  allowedBases: string[]
): PathValidationResult {
  // Reject empty or null paths
  if (!userPath || userPath.trim() === '') {
    return {
      isValid: false,
      resolvedPath: '',
      error: 'Path cannot be empty'
    };
  }

  // SECURITY FIX: Decode URL-encoded characters BEFORE validation
  // This catches attacks like %2e%2e%2f (../) or %00 (null byte)
  let decodedPath = userPath;
  try {
    decodedPath = decodeURIComponent(userPath);
  } catch (e) {
    // If decoding fails, use original path but still validate
    decodedPath = userPath;
  }

  // SECURITY FIX: Reject paths containing null bytes AFTER URL decoding
  // Attackers can use %00 to inject null bytes
  if (decodedPath.includes('\u0000')) {
    return {
      isValid: false,
      resolvedPath: '',
      error: 'Path cannot contain null bytes'
    };
  }

  // Resolve to absolute path using decoded URL string - ensure consistent path format
  const resolvedPath = path.resolve(decodedPath).replace(/\\/g, '/');

  // Check against each allowed base directory
  for (const baseDir of allowedBases) {
    // Ensure base directory exists and is absolute
    if (!path.isAbsolute(baseDir)) {
      console.error(`[Security] Invalid base directory (not absolute): ${baseDir}`);
      continue;
    }

    // SECURITY FIX: Use path.relative() for robust cross-platform path comparison
    // This handles Windows case-insensitivity and path normalization correctly
    const relativePath = path.relative(baseDir, resolvedPath);
    
    // Path is inside baseDir if relative path doesn't start with '..' and is not absolute
    // On Windows, path.relative may return paths with backslashes, so check both formats
    const isOutside = relativePath.startsWith('..') || 
                      path.isAbsolute(relativePath) ||
                      relativePath.startsWith(path.sep);
    
    if (!isOutside || relativePath === '') {
      // Empty relative path means resolvedPath === baseDir (exact match)
      return {
        isValid: true,
        resolvedPath,
        allowedBase: baseDir
      };
    }
  }

  // Path is outside all allowed directories
  // SECURITY FIX: Don't leak resolved path in error message
  return {
    isValid: false,
    resolvedPath,
    error: 'Path traversal detected: path is outside allowed directories',
  };
}

/**
 * Async version that also verifies the path exists on disk and resolves symlinks
 *
 * @param userPath - The path provided by the user
 * @param allowedBases - Array of allowed base directory paths
 * @returns PathValidationResult with validation status
 */
export async function validatePathSafetyWithExistence(
  userPath: string,
  allowedBases: string[]
): Promise<PathValidationResult> {
  // First do basic validation
  const basicResult = validatePathSafety(userPath, allowedBases);

  if (!basicResult.isValid) {
    return basicResult;
  }

  // Then verify the path exists and resolve symlinks
  try {
    // Get real path (resolves symlinks)
    const realPath = await fs.promises.realpath(basicResult.resolvedPath);
    
    // SECURITY FIX: Re-validate after symlink resolution
    // A symlink inside allowed base could point outside
    const normalizedRealPath = realPath.replace(/\\/g, '/');
    
    for (const baseDir of allowedBases) {
      const normalizedBase = baseDir.replace(/\\/g, '/');
      if (normalizedRealPath === normalizedBase ||
          normalizedRealPath.startsWith(normalizedBase + '/')) {
        // Path is still within allowed base after symlink resolution
        return basicResult;
      }
    }
    
    // Symlink points outside allowed directories
    return {
      isValid: false,
      resolvedPath: basicResult.resolvedPath,
      error: 'Symlink resolution: path points outside allowed directories'
    };
  } catch (error: any) {
    return {
      isValid: false,
      resolvedPath: basicResult.resolvedPath,
      error: `Path does not exist or is not readable: ${userPath}`
    };
  }
}

/**
 * Get safe absolute path for file operations
 * Combines validation with existence check in one call
 * 
 * @param userPath - User-supplied path
 * @param allowedBases - Allowed base directories
 * @returns Safe absolute path or throws error
 * @throws Error if path is invalid or doesn't exist
 */
export async function getSafePath(
  userPath: string,
  allowedBases: string[]
): Promise<string> {
  const result = await validatePathSafetyWithExistence(userPath, allowedBases);
  
  if (!result.isValid) {
    throw new Error(result.error || 'Path validation failed');
  }
  
  return result.resolvedPath;
}

/**
 * Check if a path is safe (convenience wrapper)
 * 
 * @param userPath - User-supplied path
 * @param allowedBases - Allowed base directories
 * @returns true if path is safe
 */
export function isPathSafe(userPath: string, allowedBases: string[]): boolean {
  return validatePathSafety(userPath, allowedBases).isValid;
}
