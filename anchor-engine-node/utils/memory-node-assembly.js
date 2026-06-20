/**
 * Memory Node Assembly Script (Task 3)
 *
 * Bridges raw search results and polished distillates to build a final, optimized context payload for small LLMs.
 * Implements token budgeting to ensure prompts fit within model context windows.
 */
import { StructuredLogger } from '../utils/structured-logger.js';
import { stripArtifacts, DEFAULT_MAX_CONTENT_LENGTH } from '../types/search.js';
// Token budget constants (configurable)
export const TOKEN_BUDGETS = {
    DEFAULT: 2000, // Standard context window usage
    CONSERVATIVE: 1500, // Small models or safety margin
    AGGRESSIVE: 3000, // Maximum budget for larger contexts
};
export const MAX_TOKENS_FOR_CONTENT = 1800; // Leave room for user prompt and system instructions
/**
 * Count tokens in a string (simple character-based estimation)
 */
function countTokens(text) {
    // Simple estimation: roughly 1 token per 4 characters for English text
    return Math.ceil(text.length / 4);
}
/**
 * Clean search results by stripping artifacts and enforcing content limits (Task 1 integration)
 */
export function cleanSearchResults(results) {
    const cleaned = [];
    for (const r of results) {
        // Strip artifacts from content (Task 1)
        let cleanContent = stripArtifacts(r.content);
        // Enforce hard max_content_length limit (Task 1)
        if (cleanContent.length > DEFAULT_MAX_CONTENT_LENGTH) {
            const excess = Math.floor(cleanContent.length * 0.2); // Truncate to ~80%
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
 * Build a memory node from search and distillation results with token budgeting
 */
export async function assembleMemoryNode(query, searchResults, distillResult, config = {}) {
    const maxTokens = config.maxTokens ?? TOKEN_BUDGETS.DEFAULT;
    const includeSearchResults = config.includeSearchResults !== false;
    // Clean search results (Task 1 integration)
    const cleanedSearchResults = cleanSearchResults(searchResults);
    let contentOnlyTokens = 0;
    let metadataTokens = countTokens(`{"query":"${query.substring(0, 50)}"}`);
    // Build evidence section from clean search results (if enabled)
    let searchEvidence = [];
    if (includeSearchResults && cleanedSearchResults.length > 0) {
        const maxResults = Math.min(config.maxResults ?? 10, cleanedSearchResults.length);
        for (let i = 0; i < maxResults; i++) {
            const result = cleanedSearchResults[i];
            // Check token budget before adding
            const newTokens = countTokens(`- [${result.source || 'unknown'}]: ${stripArtifacts(result.content).substring(0, 200)}...`);
            if (contentOnlyTokens + metadataTokens + newTokens > maxTokens)
                break;
            searchEvidence.push(`- [${result.source || 'anchor-engine'}]: ${stripArtifacts(result.content).substring(0, 200)}${stripArtifacts(result.content).length > 200 ? '...' : ''}`);
            contentOnlyTokens += countTokens(stripArtifacts(result.content));
        }
    }
    // Build distillate section (primary understanding)
    let distillSection;
    if (distillResult && distillResult.records.length > 0) {
        const recordsSummary = distillResult.records.slice(0, 5).map(r => `[${r.title}]: ${r.summary}`).join('\n');
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
export async function createMemoryNodeFromQuery(query, tags, config = {}) {
    // Step 1: Run clean raw search for high-recall molecules
    const searchResults = await (async () => {
        try {
            // Import here to avoid circular dependency
            const { smartChatSearch } = await import('../services/search/search.js');
            return smartChatSearch(query, [], config.maxChars ?? 5000, tags || [], 'all', false, // useMaxRecall
            undefined, 'standard');
        }
        catch (err) {
            StructuredLogger.error('MEMORY_NODE_SEARCH_FAILED', err instanceof Error ? err : new Error(String(err)));
            return { results: [], duration_ms: 0, query: '' };
        }
    })();
    // Step 2: Run targeted distillation if tags provided (Task 2)
    let distillResult;
    if (tags && tags.length > 0) {
        const { radialDistill } = await import('../services/distillation/radial-distiller-v2.js');
        try {
            const distillRequest = {
                seed: { query, compound_ids: [] },
                radius: config.distillRadius ?? 1.5,
                tags,
                output_format: 'decision-records',
            };
            const result = await radialDistill(distillRequest);
            if (result && result.output?.format === 'decision-records') {
                // Parse decision records from output
                try {
                    const records = JSON.parse(fs.readFileSync(result.output.path || '', 'utf-8'));
                    distillResult = records;
                }
                catch {
                    // File read failed, skip distillate
                }
            }
            else if (result) {
                // Use default format conversion
                distillResult = {
                    records: [],
                    metadata: result.output ? { ...result.output } : {},
                };
            }
        }
        catch (err) {
            StructuredLogger.warn('DISTILLATION_FAILED', err instanceof Error ? err : new Error(String(err)));
        }
    }
    // Step 3: Assemble final memory node with token budgeting
    return await assembleMemoryNode(query, searchResults.results, distillResult, config);
}
// Need to import fs for the above function
import fs from 'fs';
/**
 * Validate assembled memory node against token budget constraints
 */
export function validateTokenBudget(node, maxTokens) {
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
 * Log memory node assembly details for debugging and monitoring
 */
export function logMemoryNodeAssembly(node) {
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
