/**
 * Pattern Detector for Sensitive Content
 * 
 * Detects sensitive patterns in text content including:
 * - Credentials (passwords, API keys, tokens)
 * - Personal Information (emails, phones, addresses)
 * - Financial data (credit cards, bank accounts)
 * - Identifiers (SSN, ID numbers)
 * 
 * Uses regex patterns with entropy analysis for improved accuracy.
 * 
 * @module services/encryption/pattern-detector
 */

import { createHash } from 'crypto';

/**
 * Types of sensitive blocks that can be detected
 */
export type SensitiveType =
  | 'EMAIL'
  | 'PHONE'
  | 'CREDIT_CARD'
  | 'API_KEY'
  | 'PASSWORD'
  | 'AWS_KEY'
  | 'GITHUB_TOKEN'
  | 'SSN'
  | 'IP_ADDRESS'
  | 'PRIVATE_KEY'
  | 'BEARER_TOKEN'
  | 'GENERIC_SECRET';

/**
 * Represents a detected sensitive block in content
 */
export interface SensitiveBlock {
  /** Type of sensitive content */
  type: SensitiveType;
  /** SHA-256 hash of original text (for deduplication) */
  hash: string;
  /** Start position in content */
  start: number;
  /** End position in content */
  end: number;
  /** Original sensitive text (to be encrypted) */
  text: string;
  /** Confidence score (0-1) */
  confidence: number;
}

/**
 * Pattern configuration for sensitive type detection
 */
interface PatternConfig {
  type: SensitiveType;
  regex: RegExp;
  minEntropy?: number; // Minimum entropy for random string detection
  group?: number; // Which regex group to extract (default: 0)
}

/**
 * Sensitive pattern configurations
 */
const PATTERNS: PatternConfig[] = [
  // Email addresses
  {
    type: 'EMAIL',
    regex: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    minEntropy: 2.5,
  },
  
  // Phone numbers (international format)
  {
    type: 'PHONE',
    regex: /(?:\+?1?[-.\s]?)?\(?(?:[0-9]{3})\)?[-.\s]?(?:[0-9]{3})[-.\s]?(?:[0-9]{4})/g,
  },
  
  // Credit card numbers (major card types)
  {
    type: 'CREDIT_CARD',
    regex: /\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|6(?:011|5[0-9]{2})[0-9]{12})\b/g,
  },
  
  // API keys (generic patterns)
  {
    type: 'API_KEY',
    regex: /(?:api[_-]?key|apikey|api_secret|secret[_-]?key)[\s:=]+['"]?([a-zA-Z0-9_\-]{20,})['"]?/gi,
    group: 1,
    minEntropy: 3.5,
  },
  
  // Passwords in common formats
  {
    type: 'PASSWORD',
    regex: /(?:password|passwd|pwd|pass)[\s:=]+['"]?([^\s'"]{8,})['"]?/gi,
    group: 1,
    minEntropy: 3.0,
  },
  
  // AWS Access Key IDs
  {
    type: 'AWS_KEY',
    regex: /\b(AKIA[0-9A-Z]{16})\b/g,
  },
  
  // GitHub Personal Access Tokens
  {
    type: 'GITHUB_TOKEN',
    regex: /\b(gh[pousr]_[A-Za-z0-9_]{36,})\b/g,
  },
  
  // Social Security Numbers (US)
  {
    type: 'SSN',
    regex: /\b[0-9]{3}-[0-9]{2}-[0-9]{4}\b/g,
  },
  
  // IP addresses (IPv4)
  {
    type: 'IP_ADDRESS',
    regex: /\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b/g,
  },
  
  // Private keys (PEM format)
  {
    type: 'PRIVATE_KEY',
    regex: /-----BEGIN (?:RSA |EC |DSA )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |DSA )?PRIVATE KEY-----/g,
  },
  
  // Bearer tokens
  {
    type: 'BEARER_TOKEN',
    regex: /bearer\s+[a-zA-Z0-9\-_\.]+/gi,
  },
  
  // Generic secrets (high entropy strings with secret-like labels)
  {
    type: 'GENERIC_SECRET',
    regex: /(?:secret|token|auth|credential)[_-]?(?:key|value)?[\s:=]+['"]?([a-zA-Z0-9\-_]{16,})['"]?/gi,
    group: 1,
    minEntropy: 4.0,
  },
];

/**
 * Calculate Shannon entropy of a string
 * Higher entropy indicates more randomness (likely a secret/key)
 * 
 * @param text - Input text
 * @returns Entropy value (bits per character)
 */
export function calculateEntropy(text: string): number {
  if (!text) return 0;
  
  const freq: Map<string, number> = new Map();
  
  // Count character frequencies
  for (const char of text) {
    freq.set(char, (freq.get(char) || 0) + 1);
  }
  
  // Calculate entropy
  let entropy = 0;
  const len = text.length;
  
  for (const count of freq.values()) {
    const p = count / len;
    entropy -= p * Math.log2(p);
  }
  
  return entropy;
}

/**
 * Generate SHA-256 hash of content (truncated to 16 chars)
 * 
 * @param content - Content to hash
 * @returns Hex-encoded hash
 */
export function generateHash(content: string): string {
  return createHash('sha256').update(content, 'utf8').digest('hex').substring(0, 16);
}

/**
 * Detect sensitive blocks in content
 * 
 * @param content - Text content to scan
 * @param options - Detection options
 * @returns Array of detected sensitive blocks
 */
export function detectSensitiveBlocks(
  content: string,
  options: {
    minConfidence?: number;
    types?: SensitiveType[];
    includeLowEntropy?: boolean;
  } = {}
): SensitiveBlock[] {
  const {
    minConfidence = 0.7,
    types,
    includeLowEntropy = false,
  } = options;
  
  const blocks: SensitiveBlock[] = [];
  const usedRanges: Array<{ start: number; end: number }> = [];
  
  // Filter patterns by type if specified
  const patternsToUse = types
    ? PATTERNS.filter(p => types.includes(p.type))
    : PATTERNS;
  
  // Scan content with each pattern
  for (const pattern of patternsToUse) {
    // Reset regex lastIndex
    pattern.regex.lastIndex = 0;
    
    let match;
    while ((match = pattern.regex.exec(content)) !== null) {
      // Extract matched text (use group if specified)
      const matchedText = match[pattern.group || 0];
      
      if (!matchedText) continue;
      
      // Calculate entropy if required
      const entropy = calculateEntropy(matchedText);
      if (pattern.minEntropy && entropy < pattern.minEntropy && !includeLowEntropy) {
        continue;
      }
      
      // Calculate confidence score
      let confidence = 1.0;
      
      // Reduce confidence for low entropy matches
      if (pattern.minEntropy && entropy < pattern.minEntropy) {
        confidence *= 0.5;
      }
      
      // Boost confidence for exact pattern matches
      if (pattern.type === 'EMAIL' || pattern.type === 'SSN') {
        confidence = Math.min(1.0, confidence + 0.2);
      }
      
      // Skip if below confidence threshold
      if (confidence < minConfidence) {
        continue;
      }
      
      // Check for overlapping ranges
      const start = match.index;
      const end = start + matchedText.length;
      
      const overlaps = usedRanges.some(
        range => !(end <= range.start || start >= range.end)
      );
      
      if (overlaps) {
        continue; // Skip overlapping matches
      }
      
      // Add to results
      blocks.push({
        type: pattern.type,
        hash: generateHash(matchedText),
        start,
        end,
        text: matchedText,
        confidence,
      });
      
      usedRanges.push({ start, end });
    }
  }
  
  // Sort by position
  return blocks.sort((a, b) => a.start - b.start);
}

/**
 * Get statistics about detected sensitive content
 * 
 * @param content - Text content to analyze
 * @returns Statistics about sensitive content
 */
export function getSensitiveStats(content: string): {
  totalBlocks: number;
  byType: Record<string, number>;
  totalChars: number;
  percentage: number;
} {
  const blocks = detectSensitiveBlocks(content);
  
  const byType: Record<string, number> = {};
  let totalChars = 0;
  
  for (const block of blocks) {
    byType[block.type] = (byType[block.type] || 0) + 1;
    totalChars += block.text.length;
  }
  
  return {
    totalBlocks: blocks.length,
    byType,
    totalChars,
    percentage: (totalChars / content.length) * 100,
  };
}

/**
 * Pattern detector class for stateful detection
 */
export class PatternDetector {
  private customPatterns: PatternConfig[] = [];
  
  /**
   * Add custom detection pattern
   * 
   * @param type - Sensitive type
   * @param regex - Pattern regex
   * @param minEntropy - Minimum entropy threshold
   */
  addPattern(
    type: SensitiveType,
    regex: RegExp,
    minEntropy?: number
  ): void {
    this.customPatterns.push({
      type,
      regex,
      minEntropy,
    });
  }
  
  /**
   * Detect sensitive blocks with custom patterns included
   * 
   * @param content - Content to scan
   * @param options - Detection options
   * @returns Detected sensitive blocks
   */
  detect(
    content: string,
    options: Parameters<typeof detectSensitiveBlocks>[1] = {}
  ): SensitiveBlock[] {
    // Combine built-in and custom patterns
    const allPatterns = [...PATTERNS, ...this.customPatterns];
    
    const blocks: SensitiveBlock[] = [];
    const usedRanges: Array<{ start: number; end: number }> = [];
    
    const { minConfidence = 0.7, types, includeLowEntropy = false } = options;
    
    // Filter patterns by type if specified
    const patternsToUse = types
      ? allPatterns.filter(p => types.includes(p.type))
      : allPatterns;
    
    // Scan with each pattern
    for (const pattern of patternsToUse) {
      pattern.regex.lastIndex = 0;
      
      let match;
      while ((match = pattern.regex.exec(content)) !== null) {
        const matchedText = match[pattern.group || 0];
        if (!matchedText) continue;
        
        const entropy = calculateEntropy(matchedText);
        if (pattern.minEntropy && entropy < pattern.minEntropy && !includeLowEntropy) {
          continue;
        }
        
        let confidence = 1.0;
        if (pattern.minEntropy && entropy < pattern.minEntropy) {
          confidence *= 0.5;
        }
        
        if (confidence < minConfidence) continue;
        
        const start = match.index;
        const end = start + matchedText.length;
        
        const overlaps = usedRanges.some(
          range => !(end <= range.start || start >= range.end)
        );
        
        if (overlaps) continue;
        
        blocks.push({
          type: pattern.type,
          hash: generateHash(matchedText),
          start,
          end,
          text: matchedText,
          confidence,
        });
        
        usedRanges.push({ start, end });
      }
    }
    
    return blocks.sort((a, b) => a.start - b.start);
  }
}

// Export singleton instance
export const patternDetector = new PatternDetector();
