export interface SearchRequest {
  query: string;
  mode?: 'standard' | 'max-recall' | 'clean';
  strategy?: string;
  tags?: string[];
  buckets?: string[];
  provenance?: 'internal' | 'external' | 'all';
  max_chars?: number;
  token_budget?: number;
  user_context?: Record<string, any>;
}

export interface CleanSearchRequest extends SearchRequest {
  mode: 'clean';
  artifact_patterns?: string[];
  min_relevance?: number;
}

export interface SearchResponse {
  query: string;
  strategy: string;
  clusters: SearchCluster[];
  metadata?: SearchMetadata;
}

export interface CleanSearchResponse extends SearchResponse {
  filtered_count: number;
  removal_reasons?: {
    too_long: number;
    artifact_contained: number;
    below_threshold: number;
  };
}

export interface SearchCluster {
  id: string;               // e.g., "cluster_<session_id>"
  start_time?: string;       // ISO timestamp of earliest molecule in cluster
  end_time?: string;         // ISO timestamp of latest molecule in cluster
  topic?: string;            // optional inferred topic
  summary?: string;          // optional short summary
  molecules: SearchMolecule[];
}

export interface CleanSearchCluster extends SearchCluster {
  molecules: CleanSearchMolecule[];
}

export interface SearchMolecule {
  id: string;
  timestamp: string;         // ISO string
  speaker: string;           // "Rob", "Coda", "User", etc.
  tags: string[];            // e.g., ["#topological_perception", "#graph"]
  entities: {
    people: string[];
    concepts: string[];
    projects: string[];
  };
  content: string;
  byte_range: {
    start: number;
    end: number;
    source: string;          // original file path
  };
  removed_artifacts?: string[]; // list of artifact types that were removed
}

export interface CleanSearchMolecule extends SearchMolecule {
  clean_content?: string;   // sanitized version of content
  relevance_score?: number;  // after artifact filtering
  removed_artifacts?: string[]; // list of removed artifact types
}

export interface SearchMetadata {
  total_results: number;
  duration_ms: number;
  strategy_used: string;
}

// Artifact patterns to filter out (for clean mode)
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

// Utility to strip artifacts from content
export function stripArtifacts(content: string, patterns?: RegExp[]): string {
  if (!patterns) patterns = DEFAULT_ARTIFACT_PATTERNS;
  
  let cleaned = content;
  for (const pattern of patterns) {
    const matches = [...cleaned.matchAll(pattern)];
    if (matches.length > 0) {
      cleaned = cleaned.replace(pattern, '[REDACTED]');
    }
  }
  
  return cleaned;
}

// Validate content for clean mode
export function validateCleanContent(content: string, maxChars: number): { valid: boolean; reason?: string; truncated?: boolean } {
  if (content.length > maxChars) {
    return { valid: false, reason: `exceeds_max_length`, truncated: true };
  }
  return { valid: true };
}

// Pre-processor for clean search results
export function preprocessCleanResult(result: SearchMolecule): CleanSearchMolecule {
  const molecule: CleanSearchMolecule = { ...result };
  
  // Strip artifacts from content if present - convert string patterns to RegExp
  const artifactPatterns: RegExp[] = (result.removed_artifacts || []).map(pattern => {
    try {
      return new RegExp(pattern);
    } catch {
      return /(?:)/; // Empty regex as fallback
    }
  });
  
  molecule.clean_content = stripArtifacts(result.content, artifactPatterns.length > 0 ? artifactPatterns : undefined);
  
  return molecule;
}
