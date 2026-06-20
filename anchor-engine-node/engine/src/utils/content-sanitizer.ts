/**
 * Content Sanitizer Utility
 * 
 * Provides functions for sanitizing search results in "clean" mode,
 * including artifact stripping, content truncation, and path normalization.
 */

// Default artifact patterns to filter out (for clean mode)
export const DEFAULT_ARTIFACT_PATTERNS: RegExp[] = [
  /```[a-zA-Z]*\s*[\s\S]*?```/g,           // Code blocks with backticks
  /\/\/.*$/gm,                              // Single-line code comments
  /\{[^{}]*"original"[^}]*\}/g,            // JSON-like artifacts (non-greedy)
  /^\s*d:\s*/gm,                           // Debug log timestamps (React style)
  /^\s*\[.*?\]/g,                          // Array logging like `[LRUCache]`
  /token_count\s*[:=]\s*\d+/g,             // Token count debug strings
];

export const DEFAULT_MAX_CONTENT_LENGTH = 500; // characters for clean mode

// Utility to check if content contains artifacts
export function containsArtifacts(content: string, patterns?: RegExp[]): boolean {
  if (!patterns) patterns = DEFAULT_ARTIFACT_PATTERNS;
  return patterns.some(pattern => pattern.test(content));
}

/**
 * Strip debug artifacts from content
 */
export function stripArtifacts(content: string, patterns?: RegExp[]): string {
  if (!patterns) patterns = DEFAULT_ARTIFACT_PATTERNS;
  let result = content;
  for (const pattern of patterns) {
    result = result.replace(pattern, '');
  }
  return result.trim();
}

/**
 * Truncate content to maxLength characters with ellipsis if truncated
 */
export function truncateContent(content: string, maxLength: number): string {
  if (content.length <= maxLength) return content;
  return content.substring(0, maxLength) + '...';
}

/**
 * Convert absolute file path to relative from project root
 */
export function makeRelativePath(absPath: string, projectRoot?: string): string {
  // Simple implementation - in production this would use path.posix.relative or path.win32.relative
  if (!absPath) return absPath;
  
  // If it's already a relative path, return as-is
  if (!absPath.includes('\\') && !absPath.startsWith('/')) {
    return absPath;
  }
  
  // Try to extract just the filename for very long paths
  const parts = absPath.split(/[/\\]/);
  if (parts.length > 1) {
    return parts[parts.length - 1];
  }
  
  return absPath;
}

/**
 * Sanitize content for clean mode: strip artifacts, truncate, and make paths relative
 */
export function sanitizeContentForCleanMode(
  content: string, 
  maxLength: number = DEFAULT_MAX_CONTENT_LENGTH
): string {
  // Strip artifacts first
  let sanitized = stripArtifacts(content);
  
  // Truncate to max length
  sanitized = truncateContent(sanitized, maxLength);
  
  return sanitized;
}

/**
 * Validate that content is clean (no artifacts) and within length limits
 */
export function validateCleanContent(
  content: string, 
  minLength: number = 10,
  maxLength: number = DEFAULT_MAX_CONTENT_LENGTH
): boolean {
  // Check for artifacts
  if (containsArtifacts(content)) {
    return false;
  }
  
  // Check length constraints
  const cleanContent = stripArtifacts(content);
  return cleanContent.length >= minLength && cleanContent.length <= maxLength;
}

/**
 * Pre-process a search result for clean mode output
 */
export function preprocessCleanResult(result: any): any {
  if (!result || !result.content) {
    return result;
  }
  
  // Sanitize content
  const sanitized = sanitizeContentForCleanMode(result.content);
  
  // Make source path relative if available
  let sourcePath = result.source_path || result.provenance?.[0] || '';
  if (sourcePath) {
    sourcePath = makeRelativePath(sourcePath);
  }
  
  return {
    ...result,
    content: sanitized,
    source_path: sourcePath,
  };
}
