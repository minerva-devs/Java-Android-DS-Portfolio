/**
 * Graph-Context Serializer
 * 
 * Transforms the Physics Engine output into a dense, token-efficient format
 * that the Local LLM can read as structured context.
 * 
 * Design Goal: HIGH SIGNAL-TO-TOKEN RATIO.
 * The LLM doesn't need pretty UI — it needs dense, structured signal.
 * Every byte must carry meaning.
 * 
 * Two output modes:
 * 1. serializeForLLM()  — Produces the compact [CONTEXT_GRAPH] text block.
 *                         This is what gets injected into the LLM's prompt.
 * 2. serializeToJSON()  — Produces the full ContextPackage JSON.
 *                         Used for debugging, API responses, and UI rendering.
 */

import type {
  ContextPackage,
  MemoryNode,
  PhysicsMetadata,
  UserContext,
  QueryContext,
  QueryIntent,
  ConnectionType,
  SearchConfig,
  DEFAULT_SEARCH_CONFIG,
} from '../../types/context-protocol.js';

import type { SearchResult } from './search.js';
import type { PhysicsResult } from './physics-tag-walker.js';

// =============================================================================
// INTENT DETECTION — Lightweight, no LLM needed
// =============================================================================

const EMOTIONAL_SIGNALS = ['feel', 'feeling', 'tired', 'frustrated', 'happy', 'sad', 'angry', 'anxious', 'stressed', 'burned', 'burnout', 'overwhelmed', 'excited', 'hopeful', 'lost', 'stuck'];
const TEMPORAL_SIGNALS = ['when', 'recently', 'lately', 'last', 'yesterday', 'today', 'this week', 'this month', 'ago', 'since', 'between', 'before', 'after'];
const RELATIONAL_SIGNALS = ['and', 'with', 'told', 'said', 'met', 'called', 'texted', 'about', 'between'];
const CREATIVE_SIGNALS = ['idea', 'brainstorm', 'imagine', 'what if', 'could we', 'design', 'build', 'create', 'invent', 'explore'];

/**
 * Detect the likely intent of a query without using the LLM.
 */
export function detectIntent(query: string): QueryIntent {
  const q = query.toLowerCase();
  
  const scores: Record<QueryIntent, number> = {
    emotional: 0,
    temporal: 0,
    relational: 0,
    creative: 0,
    factual: 0,
  };

  EMOTIONAL_SIGNALS.forEach(s => { if (q.includes(s)) scores.emotional += 2; });
  TEMPORAL_SIGNALS.forEach(s => { if (q.includes(s)) scores.temporal += 2; });
  RELATIONAL_SIGNALS.forEach(s => { if (q.includes(s)) scores.relational += 1; });
  CREATIVE_SIGNALS.forEach(s => { if (q.includes(s)) scores.creative += 2; });

  // Default to factual
  scores.factual = 1;

  // Return highest scoring intent
  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  return sorted[0][0] as QueryIntent;
}

// =============================================================================
// CONTENT SANITIZATION — Strip inline tags from molecule content
// =============================================================================

/**
 * Remove hashtag tokens from content so they don't pollute LLM context.
 * Tags are stored separately in result.tags and used for graph traversal;
 * they add noise when embedded literally in the text window.
 *
 * Strips:
 *   - Quoted tag lists:  "\"#Tag1\" - \"#Tag2\""  or  '"#Tag1" - "#Tag2"'
 *   - Plain hashtags:    #Tag, ##Tag
 *   - Separator runs left behind: " - " chains at start/end
 */
function stripInlineTags(content: string): string {
  if (!content) return content;
  let s = content.replace(/\\?"#[^"\\]+\\?"/g, '');
  s = s.replace(/##?[A-Za-z0-9_]+/g, '');
  // Only strip " - " list separators (space-hyphen-space), not bare hyphens
  // in kebab-case identifiers like p-6, text-xl, font-bold, etc.
  s = s.replace(/[ \t]+-[ \t]+/g, ' ').trim();
  return s;
}



/**
 * Convert a SearchResult + PhysicsMetadata into a MemoryNode.
 */
function toMemoryNode(result: SearchResult, physics: PhysicsMetadata): MemoryNode {
  return {
    id: result.id,
    content: stripInlineTags(result.content || ''),
    source: result.source || '',
    type: result.type || 'thought',
    tags: result.tags || [],
    provenance: result.provenance || 'internal',
    timestamp: result.timestamp,
    physics,
  };
}

/**
 * Convert direct search results (anchors/planets) into MemoryNodes.
 * These get 'direct_fts' connection type and a normalized gravity score.
 */
function anchorsToMemoryNodes(anchors: SearchResult[]): MemoryNode[] {
  if (anchors.length === 0) return [];

  // Normalize scores relative to the best anchor
  const maxScore = Math.max(...anchors.map(a => a.score || 1));
  const now = Date.now();

  return anchors.map(anchor => {
    const normalizedScore = maxScore > 0 ? (anchor.score || 0) / maxScore : 0;
    const timeDeltaMs = Math.abs(now - anchor.timestamp);
    const frequency = anchor.frequency || 1;

    const physics: PhysicsMetadata = {
      gravity_score: normalizedScore,
      time_drift: formatTimeDrift(timeDeltaMs),
      is_recurring: frequency > 1,
      frequency,
      connection_type: 'direct_fts',
      link_reason: 'direct search match',
    };

    return toMemoryNode(anchor, physics);
  });
}

/**
 * Convert PhysicsResult[] (walker output) into MemoryNodes.
 */
function walkerToMemoryNodes(walkerResults: PhysicsResult[]): MemoryNode[] {
  return walkerResults.map(pr => toMemoryNode(pr.result, pr.physics));
}

// =============================================================================
// TIME FORMATTING
// =============================================================================

function formatTimeDrift(deltaMs: number): string {
  const hours = deltaMs / (1000 * 60 * 60);
  if (hours < 1) return `${Math.round(deltaMs / (1000 * 60))}m ago`;
  if (hours < 24) return `${Math.round(hours)}h ago`;
  const days = hours / 24;
  if (days < 30) return `${Math.round(days)}d ago`;
  const months = days / 30;
  if (months < 12) return `${Math.round(months)}mo ago`;
  return `${(months / 12).toFixed(1)}y ago`;
}

// =============================================================================
// LLM TEXT SERIALIZER — Hierarchical Source-Grouped Format v2
// =============================================================================

const CHARS_PER_TOKEN = 4;

// --- Internal types for hierarchical grouping ---

interface SourceGroup {
  source: string;
  nodes: MemoryNode[];
  maxScore: number;
  /** Tags hoisted from all nodes in this group (appear in >= 50% of members) */
  taxonomy: string[];
}

/**
 * Group nodes by their source file/origin.
 * Returns groups sorted by max gravity score descending.
 */
function groupNodesBySource(nodes: MemoryNode[]): SourceGroup[] {
  const map = new Map<string, MemoryNode[]>();
  for (const node of nodes) {
    const key = node.source || '(unknown)';
    const bucket = map.get(key);
    if (bucket) {
      bucket.push(node);
    } else {
      map.set(key, [node]);
    }
  }

  const groups: SourceGroup[] = [];
  for (const [source, groupNodes] of map) {
    const taxonomy = hoistCommonTags(groupNodes);
    const maxScore = Math.max(...groupNodes.map(n => n.physics.gravity_score));
    groups.push({ source, nodes: groupNodes, maxScore, taxonomy });
  }

  // Best sources first
  groups.sort((a, b) => b.maxScore - a.maxScore);
  return groups;
}

/**
 * Hoist tags that appear in >= 50% of nodes to a shared group taxonomy.
 * Returns tags sorted by frequency descending.
 */
function hoistCommonTags(nodes: MemoryNode[]): string[] {
  if (nodes.length === 0) return [];

  const freq = new Map<string, number>();
  for (const node of nodes) {
    const seen = new Set<string>();
    for (const tag of (node.tags || [])) {
      const normalized = tag.startsWith('#') ? tag : `#${tag}`;
      if (!seen.has(normalized)) {
        seen.add(normalized);
        freq.set(normalized, (freq.get(normalized) ?? 0) + 1);
      }
    }
  }

  const threshold = Math.max(1, nodes.length * 0.5);
  return Array.from(freq.entries())
    .filter(([, count]) => count >= threshold)
    .sort((a, b) => b[1] - a[1])
    .map(([tag]) => tag);
}

/**
 * Return tags on a node that are NOT already in the group taxonomy.
 */
function uniqueNodeTags(node: MemoryNode, taxonomySet: Set<string>): string[] {
  return (node.tags || [])
    .map(t => t.startsWith('#') ? t : `#${t}`)
    .filter(t => !taxonomySet.has(t));
}

/**
 * Infer a short location label for a node (state-anchor marker or timestamp).
 */
function inferNodeLocation(node: MemoryNode): string {
  if (node.id.startsWith('virtual_mem_')) return '[state-anchor]';
  if (node.timestamp && node.timestamp > 1_000_000_000) {
    const d = new Date(node.timestamp < 1e12 ? node.timestamp * 1000 : node.timestamp);
    return `[${d.toISOString().replace('T', ' ').substring(0, 16)}]`;
  }
  return '';
}

/**
 * Serialize a ContextPackage into the compact [CONTEXT_GRAPH] text block.
 *
 * v2 Format — Hierarchical Source Grouping with Taxonomy Hoisting:
 *
 *   [CONTEXT_GRAPH_START]
 *   user: @name | state: current_state | intent: factual | terms: t1, t2
 *
 *   // DIRECT HITS
 *   [SRC: path/to/file.ext | max: 1.00 | N nodes]
 *   taxonomy: #tag1, #tag2, #tag3, ...   ← declared ONCE per source
 *     [N:id] (freq:N) [loc] "content"
 *     [N:id] (freq:N) [loc] "content" | +tags: #unique1
 *
 *   // ASSOCIATED MEMORIES
 *   [SRC: path/to/other.ext | max: 0.82 | N nodes]
 *   taxonomy: #sharedA, #sharedB
 *     [N:id] [W:0.82|WALK] [loc] "content" -> [N:anchor] (reason)
 *
 *   [CONTEXT_GRAPH_END]
 *
 * Token savings: ~600 tokens/node eliminated by hoisting shared tags once per source.
 */
export function serializeForLLM(pkg: ContextPackage, charBudget?: number): string {
  const budget = charBudget || Infinity;
  let output = '';
  let currentChars = 0;

  const add = (s: string) => { output += s; currentChars += s.length; };
  const overBudget = () => currentChars >= budget * 0.95;

  // Single-line dense header
  add(`[CONTEXT_GRAPH_START]\nuser: @${pkg.userContext.name} | state: ${pkg.userContext.current_state}\nintent: ${pkg.query.intent} | terms: ${pkg.query.keyTerms.join(', ')}\n\n`);

  // ── DIRECT HITS (Planets) ────────────────────────────────────────────────
  if (pkg.anchors.length > 0) {
    add('// DIRECT HITS\n');

    const anchorGroups = groupNodesBySource(pkg.anchors);
    const maxAtomChars = budget > 200_000
      ? Math.min(8000, Math.floor(budget * 0.7 / pkg.anchors.length))
      : (budget > 50_000 ? 2500 : 500);

    for (const group of anchorGroups) {
      if (overBudget()) break;

      const taxonomySet = new Set(group.taxonomy);
      const sourceLabel = group.source.length > 60 ? '...' + group.source.slice(-57) : group.source;

      add(`[SRC: ${sourceLabel} | max: ${group.maxScore.toFixed(2)} | ${group.nodes.length} node${group.nodes.length !== 1 ? 's' : ''}]\n`);
      if (group.taxonomy.length > 0) {
        // All hoisted tags on one compact line — no per-node repetition
        add(`taxonomy: ${group.taxonomy.slice(0, 60).join(', ')}\n`);
      }

      for (const node of group.nodes) {
        if (overBudget()) break;
        const loc = inferNodeLocation(node);
        const truncated = truncateContent(node.content, Math.min(maxAtomChars, budget - currentChars - 200));
        const uniq = uniqueNodeTags(node, taxonomySet);
        const uniqStr = uniq.length > 0 ? ` | +tags: ${uniq.slice(0, 10).join(', ')}` : '';
        add(`  [N:${shortId(node.id)}] (freq:${node.physics.frequency})${loc ? ` ${loc}` : ''} "${truncated}"${uniqStr}\n`);
      }

      add('\n');
    }
  }

  // ── ASSOCIATED MEMORIES (Moons) ──────────────────────────────────────────
  if (pkg.associations.length > 0) {
    add('// ASSOCIATED MEMORIES\n');

    const assocGroups = groupNodesBySource(pkg.associations);
    const maxAssocChars = budget > 200_000
      ? Math.min(5000, Math.floor(budget * 0.25 / pkg.associations.length))
      : (budget > 50_000 ? 1500 : 400);

    for (const group of assocGroups) {
      if (overBudget()) break;

      const taxonomySet = new Set(group.taxonomy);
      const sourceLabel = group.source.length > 60 ? '...' + group.source.slice(-57) : group.source;

      add(`[SRC: ${sourceLabel} | max: ${group.maxScore.toFixed(2)} | ${group.nodes.length} node${group.nodes.length !== 1 ? 's' : ''}]\n`);
      if (group.taxonomy.length > 0) {
        add(`taxonomy: ${group.taxonomy.slice(0, 60).join(', ')}\n`);
      }

      for (const node of group.nodes) {
        if (overBudget()) break;
        const loc = inferNodeLocation(node);
        const truncated = truncateContent(node.content, Math.min(maxAssocChars, budget - currentChars - 200));
        const typeLabel = connectionTypeLabel(node.physics.connection_type);
        const anchorRef = node.physics.source_anchor_id ? shortId(node.physics.source_anchor_id) : '?';
        const reason = node.physics.link_reason || node.physics.connection_type;
        const uniq = uniqueNodeTags(node, taxonomySet);
        const uniqStr = uniq.length > 0 ? ` | +tags: ${uniq.slice(0, 5).join(', ')}` : '';
        add(`  [N:${shortId(node.id)}] [W:${node.physics.gravity_score.toFixed(2)}|${typeLabel}]${loc ? ` ${loc}` : ''} "${truncated}" -> [N:${anchorRef}] (${reason})${uniqStr}\n`);
      }

      add('\n');
    }
  }

  add('[CONTEXT_GRAPH_END]\n');
  return output;
}

/**
 * Truncate content to a character limit, cutting at the nearest sentence boundary.
 */
function truncateContent(content: string, maxChars: number): string {
  if (!content) return '';
  if (content.length <= maxChars) return content.replace(/\n/g, ' ').trim();
  
  const truncated = content.substring(0, maxChars);
  // Find last sentence boundary
  const lastDot = truncated.lastIndexOf('.');
  const lastBang = truncated.lastIndexOf('!');
  const lastQ = truncated.lastIndexOf('?');
  const bestCut = Math.max(lastDot, lastBang, lastQ);
  
  if (bestCut > maxChars * 0.5) {
    return truncated.substring(0, bestCut + 1).replace(/\n/g, ' ').trim();
  }
  
  // Try to cut at the last space to avoid cutting mid-word
  const lastSpace = truncated.lastIndexOf(' ');
  const cutIndex = lastSpace > maxChars * 0.5 ? lastSpace : maxChars;
  return truncated.substring(0, cutIndex).replace(/\n/g, ' ').trim() + '...';
}

/**
 * Shorten a UUID to its first 8 chars for token efficiency.
 */
function shortId(id: string): string {
  if (!id) return '?';
  // If it's a UUID, take first 8 chars
  if (id.length > 12) return id.substring(0, 8);
  return id;
}

/**
 * Map ConnectionType to a short label for the serialized format.
 */
function connectionTypeLabel(type: ConnectionType): string {
  switch (type) {
    case 'direct_fts':        return 'FTS';
    case 'direct_simhash':    return 'SIM';
    case 'tag_walk_neighbor':  return 'WALK';
    case 'temporal_neighbor':  return 'TIME';
    case 'serendipity':        return 'LUCK';
    case 'engram_hit':         return 'ENGR';
    case 'walk_fallback':      return 'FALL';
    default:                   return 'UNK';
  }
}

// =============================================================================
// FULL CONTEXT PACKAGE ASSEMBLY
// =============================================================================

export interface AssembleOptions {
  /** User context (who is asking) */
  user: UserContext;
  /** The raw query string */
  query: string;
  /** NLP-extracted key terms */
  keyTerms: string[];
  /** Explicit scope tags */
  scopeTags?: string[];
  /** Direct search results (Planets) */
  anchors: SearchResult[];
  /** Physics walker results (Moons) — optional, may be empty */
  walkerResults?: PhysicsResult[];
  /** Legacy walker results (SearchResult[]) for backward compat */
  legacyWalkerResults?: SearchResult[];
  /** Character budget for the serialized output */
  charBudget?: number;
}

/**
 * Assemble the full ContextPackage from search results.
 * This is the main entry point for the serializer.
 */
export function assembleContextPackage(opts: AssembleOptions): ContextPackage {
  const now = Date.now();
  const intent = detectIntent(opts.query);

  const queryContext: QueryContext = {
    text: opts.query,
    timestamp: now,
    intent,
    keyTerms: opts.keyTerms,
    scopeTags: opts.scopeTags || [],
  };

  // Convert anchors to MemoryNodes
  const anchorNodes = anchorsToMemoryNodes(opts.anchors);

  // Convert walker results to MemoryNodes
  let associationNodes: MemoryNode[];
  if (opts.walkerResults && opts.walkerResults.length > 0) {
    associationNodes = walkerToMemoryNodes(opts.walkerResults);
  } else if (opts.legacyWalkerResults && opts.legacyWalkerResults.length > 0) {
    // Backward compat: convert legacy SearchResult[] to MemoryNodes with inferred physics
    associationNodes = opts.legacyWalkerResults.map(r => {
      const timeDeltaMs = Math.abs(now - r.timestamp);
      const frequency = r.frequency || 1;
      const physics: PhysicsMetadata = {
        gravity_score: r.score || 0,
        time_drift: formatTimeDrift(timeDeltaMs),
        is_recurring: frequency > 1,
        frequency,
        connection_type: 'walk_fallback',
        link_reason: 'traditional walk',
      };
      return toMemoryNode(r, physics);
    });
  } else {
    associationNodes = [];
  }

  // Compute aggregate statistics
  const allNodes = [...anchorNodes, ...associationNodes];
  const totalNodes = allNodes.length;
  const avgGravity = totalNodes > 0
    ? allNodes.reduce((sum, n) => sum + n.physics.gravity_score, 0) / totalNodes
    : 0;
  const recurringThemes = allNodes.filter(n => n.physics.is_recurring).length;
  const totalChars = allNodes.reduce((sum, n) => sum + n.content.length, 0);
  const estimatedTokens = Math.ceil(totalChars / CHARS_PER_TOKEN);
  const budgetUtilization = opts.charBudget 
    ? Math.min(100, (totalChars / opts.charBudget) * 100)
    : 0;

  return {
    userContext: opts.user,
    query: queryContext,
    anchors: anchorNodes,
    associations: associationNodes,
    graphStats: {
      totalNodes,
      budgetUtilization,
      avgGravity,
      recurringThemes,
      estimatedTokens,
    },
  };
}

/**
 * One-shot convenience: assemble + serialize for LLM consumption.
 * Returns the compact text block ready to inject into a prompt.
 */
export function assembleAndSerialize(opts: AssembleOptions): string {
  const pkg = assembleContextPackage(opts);
  
  // Debug logging for large budgets
  if (opts.charBudget && opts.charBudget > 100000) {
    const totalContentChars = pkg.anchors.reduce((sum, n) => sum + n.content.length, 0) + 
                              pkg.associations.reduce((sum, n) => sum + n.content.length, 0);
    console.log(`[Serializer] Budget: ${opts.charBudget}, Anchors: ${pkg.anchors.length}, Associations: ${pkg.associations.length}, Total content: ${totalContentChars} chars`);
    if (pkg.anchors.length > 0) {
      console.log(`[Serializer] Avg anchor content: ${Math.round(totalContentChars / pkg.anchors.length)} chars`);
    }
  }
  
  return serializeForLLM(pkg, opts.charBudget);
}
