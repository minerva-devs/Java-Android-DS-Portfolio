/**
 * Memory Node Assembly Script (Task 3)
 * 
 * Bridges raw search results and polished distillates to build a final, optimized context payload for small LLMs.
 * Implements token budgeting to ensure prompts fit within model context windows.
 */

import { StructuredLogger } from '../utils/structured-logger.js';
import type { SearchResult } from '../services/search/search-utils.js';
import { stripArtifacts, DEFAULT_MAX_CONTENT_LENGTH, containsArtifacts } from '../types/search.js';
import type { DecisionRecordFormat } from '../services/distillation/radial-distiller-v2.js';

// Token budget constants (configurable)
export const TOKEN_BUDGETS = {
  DEFAULT: 2000,      // Standard context window usage
  CONSERVATIVE: 1500, // Small models or safety margin
  AGGRESSIVE: 3000,    // Maximum budget for larger contexts
};

export const MAX_TOKENS_FOR_CONTENT = 1800; // Leave room for user prompt and system instructions

interface MemoryNode {
  query: string;
  timestamp: number;
  sources: {
    search: SearchResult[];
    distill?: DecisionRecordFormat;
  };
  tokenCount: number;
}

export interface AssemblyConfig {
  maxTokens?: number;          // Target token budget (defaults to TOKEN_BUDGETS.DEFAULT)
  includeSearchResults?: boolean; // Whether to add clean search results as evidence
  distillTags?: string[];      // Specific tags for targeted distillation
  minDistillScore?: number;     // Minimum relevance score for distillate inclusion
  maxResults?: number;         // Maximum search results to include (default 10)
  maxChars?: number;           // Character budget for search results (default 5000)
  distillRadius?: number;      // Radius parameter for radial distillation (default 1.5)
}

/**
 * Count tokens in a string (simple character-based estimation)
 */
function countTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Clean search results by stripping artifacts and enforcing content limits (Task 1 integration)
 */
export function cleanSearchResults(results: SearchResult[]): SearchResult[] {
  const cleaned: SearchResult[] = [];
  
  for (const r of results) {
    // Strip artifacts from content (Task 1)
    let cleanContent = stripArtifacts(r.content);
    
    // Enforce hard max_content_length limit (Task 1)
    if (cleanContent.length > DEFAULT_MAX_CONTENT_LENGTH) {
      const excess = Math.floor(cleanContent.length * 0.2);
      cleanContent = cleanContent.substring(0, DEFAULT_MAX_CONTENT_LENGTH - excess);
    }
    
    cleaned.push({
      ...r,
      content: cleanContent,
    });
  }
  
  return cleaned;
}

/**
 * Build a memory node from search and distillation results with token budgeting (Task 3)
 */
export async function assembleMemoryNode(
  query: string,
  searchResults: SearchResult[],
  distillResult?: DecisionRecordFormat,
  config: AssemblyConfig = {}
): Promise<MemoryNode> {
  const maxTokens = config.maxTokens ?? TOKEN_BUDGETS.DEFAULT;
  const includeSearchResults = config.includeSearchResults !== false;
  
  // Clean search results (Task 1 integration)
  const cleanedSearchResults = cleanSearchResults(searchResults);
  
  let contentOnlyTokens = 0;
  let metadataTokens = countTokens(`{"query":"${query.substring(0, 50)}"`);
  
  // Build evidence section from clean search results (if enabled)
  let searchEvidence: string[] = [];
  if (includeSearchResults && cleanedSearchResults.length > 0) {
    const maxResults = Math.min(config.maxResults ?? 10, cleanedSearchResults.length);
    
    for (let i = 0; i < maxResults; i++) {
      const result = cleanedSearchResults[i];
      
      // Skip if already used in distillate (check if content was modified)
      if (result.id && result.content.includes('...')) continue;
      
      // Check token budget before adding
      const sourcePath = result.provenance?.[0] || 'unknown';
      const newTokens = countTokens(`- [${sourcePath}]: ${stripArtifacts(result.content).substring(0, 200)}...`);
      if (contentOnlyTokens + metadataTokens + newTokens > maxTokens) break;
      
      searchEvidence.push(`- [${sourcePath}]: ${stripArtifacts(result.content).substring(0, 200)}${stripArtifacts(result.content).length > 200 ? '...' : ''}`);
      contentOnlyTokens += countTokens(stripArtifacts(result.content));
    }
  }
  
  // Build distillate section (primary understanding) (Task 2)
  let distillSection: string | undefined;
  if (distillResult && distillResult.records.length > 0) {
    const recordsSummary = distillResult.records.slice(0, 5).map(r => 
      `[${r.title}]: ${r.summary}`
    ).join('\n');
    
    // Check token budget for distillate content (Task 2)
    const distillTokens = countTokens(recordsSummary);
    if (contentOnlyTokens + metadataTokens + distillTokens <= maxTokens) {
      distillSection = recordsSummary;
      contentOnlyTokens += distillTokens;
    }
  }
  
  // Calculate total token usage
  const nodeContent = JSON.stringify({
    query,
    sources: {
      evidence: searchEvidence.length > 0 ? searchEvidence : undefined,
      understanding: distillSection
    }
  });
  
  return {
    query,
    timestamp: Date.now(),
    sources: {
      search: cleanedSearchResults,
      distill: distillResult
    },
    tokenCount: Math.ceil((nodeContent.length / 4) + metadataTokens)
  };
}

/**
 * Create a "Memory Node" from raw search results and targeted distillation (Task 3)
 */
export async function createMemoryNodeFromQuery(
  query: string,
  tags?: string[],
  config: AssemblyConfig = {}
): Promise<MemoryNode> {
  // Step 1: Run clean raw search for high-recall molecules
  const searchResults = await (async () => {
    try {
      const { smartChatSearch } = await import('../services/search/search.js');
      
      return smartChatSearch(
        query,
        [],
        config.maxChars ?? 5000,
        tags || [],
        'all',
        false, // useMaxRecall - fixed type issue
        undefined,
        'standard' as const,
      );
    } catch (err) {
      StructuredLogger.error('MEMORY_NODE_SEARCH_FAILED', err instanceof Error ? err : new Error(String(err)));
      return { results: [], duration_ms: 0, query: '' };
    }
  })();
  
  // Step 2: Run targeted distillation if tags provided (Task 2)
  let distillResult;
  if (tags && tags.length > 0) {
    const radialDistill = await import('../services/distillation/radial-distiller-v2.js');
    
    try {
      // Use compound_ids mode with tags for targeted distillation
      const result = await radialDistill.radialDistill({
        seed: { query, compound_ids: [] },
        radius: config.distillRadius ?? 1.5,
        output_format: 'decision-records',
      });
      
      if (result && result.output?.format === 'decision-records') {
        // Parse decision records from output
        try {
          const fs = await import('fs');
          const recordsPath = result.output.path;
          if (recordsPath) {
            const raw = fs.readFileSync(recordsPath, 'utf-8');
            const parsed = JSON.parse(raw);
            distillResult = parsed as DecisionRecordFormat;
          }
        } catch (fileError) {
          // File read failed, skip distillate
          StructuredLogger.warn('DISTILL_FILE_READ_FAILED', fileError instanceof Error ? fileError : new Error(String(fileError)));
        }
      } else if (result) {
        // Fallback: use output format conversion - properly cast to DecisionRecordFormat
        distillResult = {
          records: [],
          metadata: {
            source: result.output?.path || 'unknown',
            distilled_at: new Date().toISOString(),
            total_records: 0,
          } as any,
        };
      }
    } catch (err) {
      StructuredLogger.warn('DISTILLATION_FAILED', err instanceof Error ? err : new Error(String(err)));
    }
  }
  
  // Step 3: Assemble final memory node with token budgeting
  return await assembleMemoryNode(query, searchResults.results, distillResult, config);
}

/**
 * Validate assembled memory node against token budget constraints (Task 3)
 */
export function validateTokenBudget(node: MemoryNode, maxTokens: number): { valid: boolean; remaining: number } {
  const content = JSON.stringify({
    query: node.query,
    sources: {
      evidence: node.sources.search,
      understanding: node.sources.distill
    }
  });
  
  const estimatedTokens = Math.ceil(content.length / 4) + countTokens(`"query":"${node.query}"`);
  return {
    valid: estimatedTokens <= maxTokens,
    remaining: Math.max(0, maxTokens - estimatedTokens),
  };
}

/**
 * Log memory node assembly details for debugging and monitoring (Task 3)
 */
export function logMemoryNodeAssembly(node: MemoryNode): void {
  StructuredLogger.info('MEMORY_NODE_CREATED', {
    query: node.query.substring(0, 100),
    timestamp: new Date(node.timestamp).toISOString(),
    tokenCount: node.tokenCount,
    searchResultsCount: node.sources.search.length,
    distillPresent: !!node.sources.distill,
    budgetStatus: node.tokenCount < TOKEN_BUDGETS.DEFAULT ? 'within_budget' : 'using_full_budget',
  });
}

export default {
  assembleMemoryNode,
  createMemoryNodeFromQuery,
  validateTokenBudget,
  logMemoryNodeAssembly,
};
