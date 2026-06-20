/**
 * Tag Modulation System
 * 
 * Controls tag generation strictness and filtering based on user settings.
 * Modulation levels:
 *   0%   = Only strict entities (PERSON, ORG, PRODUCT, etc.)
 *   50%  = Entities + meaningful common words
 *   100% = All tags (no filtering)
 * 
 * Settings controlled via user_settings.json:
 *   - tagging.modulation_level: 0-100
 *   - tagging.blacklist_strictness: 0-100
 *   - tagging.atom_as_tag: whether atoms become tags
 *   - tagging.strict_atom_selection: tighter atom extraction
 *   - tagging.min_tag_length: minimum character length
 *   - tagging.max_tags_per_molecule: cap on tags per molecule
 */

import { config } from '../config/index.js';

// Common words that should be filtered at lower modulation levels
const COMMON_WORDS = new Set([
  // Basic verbs
  'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did',
  // Articles and determiners
  'the', 'a', 'an', 'this', 'that', 'these', 'those', 'some', 'any', 'all', 'most', 'other',
  // Prepositions
  'in', 'on', 'at', 'to', 'for', 'with', 'by', 'from', 'up', 'about', 'into', 'over', 'after',
  // Conjunctions
  'and', 'but', 'or', 'nor', 'so', 'yet', 'both', 'either', 'neither', 'not', 'only', 'own', 'same',
  // Pronouns
  'i', 'you', 'he', 'she', 'it', 'we', 'they', 'what', 'which', 'who', 'whom', 'whose',
  // Generic nouns
  'thing', 'things', 'way', 'ways', 'day', 'days', 'time', 'times', 'year', 'years', 'people',
  // Generic adjectives
  'good', 'bad', 'new', 'old', 'first', 'last', 'long', 'great', 'little', 'own', 'other',
  // Tech generic terms
  'code', 'file', 'files', 'data', 'info', 'info', 'system', 'systems', 'user', 'users',
  // Conversation fillers
  'okay', 'ok', 'yeah', 'yes', 'no', 'maybe', 'well', 'so', 'like', 'just', 'really',
  // Time references (too generic)
  'today', 'tomorrow', 'yesterday', 'now', 'then', 'soon', 'later',
  // Misc generic
  'get', 'got', 'make', 'made', 'can', 'will', 'would', 'could', 'should', 'may', 'might', 'must',
]);

// Entity-type patterns (high-value tags always kept)
const ENTITY_PATTERNS = [
  /^#[A-Z][a-z]+[A-Z]/,  // CamelCase (ProjectName, PersonName)
  /^#[A-Z]{2,}/,  // Acronyms (AI, API, RAG, FTS)
  /^#@[a-zA-Z0-9_]+/,  // @mentions
  /^#\d{4}/,  // Years (specific temporal context)
];

// Strict blacklist (always filtered regardless of modulation)
const STRICT_BLACKLIST = [
  /^#[0-9a-fA-F]{3,8}$/,  // Color codes
  /^#_\w*$/, /^#__[\w\d_]+$/,  // Internal artifacts
  /^#btn\b/, /^#class\b/, /^#div\b/, /^#id\b/, /^#span\b/,  // HTML
  /^#fn\b/, /^#elif\b/, /^#else\b/, /^#endif\b/,  // Code
  /^#cite_note/, /^#cite_ref/,  // Scraping artifacts
  /^#incorrect_/, /^#error_/,  // Errors
  /^#null\b/, /^#undefined\b/, /^#nan\b/,  // Null values
  /^#untagged$/, /^#manual\b/, /^#manually_/,  // System tags

  // System-generated tags (prevent self-contamination from Anchor output)
  /^#virtual_/,           // Virtual molecule markers
  /^#mem_[a-f0-9_]+/,    // System memory IDs
  /^#score_/,            // Score-based tags
  /^#local_data_inbox_/, /^#inbox_/,            // Source path tags
  /^#provenance_/,       // Provenance tags
  /^#bucket_/,           // Bucket tags
  /^#epoch_/,            // Epoch tags
  /^#compound_/,         // Compound ID tags
  /^#molecule_/,         // Molecule ID tags
  /^#atom_/,             // Atom ID tags
  /^#simhash_/,          // Simhash tags
  /^#ts_rank/,           // Search ranking tags
  /^#fts_/,              // Full-text search tags
  /^#anchor_/,           // Anchor system tags
  /^#mcp_/,              // MCP protocol tags
];

// Medium blacklist (filtered at low modulation)
const MEDIUM_BLACKLIST = [
  /^#monday\b/, /^#tuesday\b/, /^#wednesday\b/,  // Days
  /^#january\b/, /^#february\b/,  // Months
  /^#slow_pickup$/, /^#late_night$/,  // Too generic
  /^#test_/, /^#tmp\b/, /^#temp\b/,  // Temporary
  /^#agentgpt$/, /^#babyagi$/, /^#autogen$/,  // Deprecated
];

// Light blacklist (only filtered at very low modulation)
const LIGHT_BLACKLIST = [
  /^#code\b/, /^#data\b/, /^#file\b/, /^#files\b/,  // Generic tech
  /^#info\b/, /^#system\b/, /^#user\b/,  // Generic
  /^#good\b/, /^#bad\b/, /^#new\b/, /^#old\b/,  // Generic adjectives
];

export interface TagModulationSettings {
  modulation_level: number;
  blacklist_strictness: number;
  atom_as_tag: boolean;
  strict_atom_selection: boolean;
  min_tag_length: number;
  max_tags_per_molecule: number;
  common_words_filter: boolean;
  entity_extraction: {
    enabled: boolean;
    min_confidence: number;
    categories: string[];
  };
}

/**
 * Get current tag modulation settings from config
 */
export function getTagModulationSettings(): TagModulationSettings {
  const tagging = (config as any).tagging || {};
  
  return {
    modulation_level: Math.max(0, Math.min(100, tagging.modulation_level ?? 50)),
    blacklist_strictness: Math.max(0, Math.min(100, tagging.blacklist_strictness ?? 75)),
    atom_as_tag: tagging.atom_as_tag ?? false,
    strict_atom_selection: tagging.strict_atom_selection ?? true,
    min_tag_length: tagging.min_tag_length ?? 3,
    max_tags_per_molecule: tagging.max_tags_per_molecule ?? 20,
    common_words_filter: tagging.common_words_filter ?? true,
    entity_extraction: {
      enabled: tagging.entity_extraction?.enabled ?? true,
      min_confidence: tagging.entity_extraction?.min_confidence ?? 0.6,
      categories: tagging.entity_extraction?.categories ?? ['PERSON', 'ORG', 'PRODUCT', 'EVENT', 'LOCATION'],
    },
  };
}

/**
 * Check if a tag passes the blacklist filter based on strictness level
 */
export function passesBlacklist(tag: string, strictness: number = 75): boolean {
  const normalizedTag = tag.replace(/^#/, '').trim().toLowerCase();
  
  // Always check strict blacklist
  for (const pattern of STRICT_BLACKLIST) {
    if (pattern.test(tag)) {
      return false;
    }
  }
  
  // Check if it's an entity pattern (always keep)
  for (const pattern of ENTITY_PATTERNS) {
    if (pattern.test(tag)) {
      return true;
    }
  }
  
  // Apply medium blacklist based on strictness
  if (strictness >= 50) {
    for (const pattern of MEDIUM_BLACKLIST) {
      if (pattern.test(tag)) {
        return false;
      }
    }
  }
  
  // Apply light blacklist only at high strictness
  if (strictness >= 75) {
    for (const pattern of LIGHT_BLACKLIST) {
      if (pattern.test(tag)) {
        return false;
      }
    }
  }
  
  return true;
}

/**
 * Check if a word is a common word that should be filtered
 */
export function isCommonWord(word: string): boolean {
  return COMMON_WORDS.has(word.toLowerCase());
}

/**
 * Check if a tag looks like an entity (high-value tag)
 */
export function isEntityTag(tag: string): boolean {
  const cleanTag = tag.replace(/^#/, '');
  
  // Check entity patterns
  for (const pattern of ENTITY_PATTERNS) {
    if (pattern.test(tag)) {
      return true;
    }
  }
  
  // Check if it's a proper noun (capitalized, not all caps)
  if (/^[A-Z][a-z]+[A-Z]/.test(cleanTag) || /^[A-Z][a-z]+$/.test(cleanTag)) {
    return true;
  }
  
  return false;
}

/**
 * Filter tags based on modulation level
 * 
 * @param tags - Array of tags to filter
 * @param modulationLevel - 0-100 (0=strict, 100=lenient)
 * @param strictness - 0-100 blacklist strictness
 */
export function modulateTags(
  tags: string[], 
  modulationLevel: number = 50,
  strictness: number = 75,
): string[] {
  if (!tags || !Array.isArray(tags)) return [];
  
  const settings = getTagModulationSettings();
  const level = modulationLevel ?? settings.modulation_level;
  const strict = strictness ?? settings.blacklist_strictness;
  
  return tags
    .filter(tag => {
      if (!tag || typeof tag !== 'string') return false;
      
      const cleanTag = tag.replace(/^#/, '').trim();
      
      // Minimum length check
      if (cleanTag.length < (settings.min_tag_length || 3)) {
        return false;
      }
      
      // Blacklist check
      if (!passesBlacklist(tag, strict)) {
        return false;
      }
      
      // Common words filter (based on modulation level)
      if (settings.common_words_filter && level < 100) {
        if (isCommonWord(cleanTag) && !isEntityTag(tag)) {
          // At 50% modulation, allow 50% of common words through
          const threshold = level / 100;
          if (Math.random() > threshold) {
            return false;
          }
        }
      }
      
      return true;
    })
    .map(tag => tag.trim())
    .slice(0, settings.max_tags_per_molecule);
}

/**
 * Filter atom labels to become tags (if enabled)
 */
export function filterAtomLabelsAsTags(labels: string[]): string[] {
  const settings = getTagModulationSettings();
  
  if (!settings.atom_as_tag) {
    return [];
  }
  
  return modulateTags(
    labels.map(label => label.startsWith('#') ? label : `#${label}`),
    settings.modulation_level,
    settings.blacklist_strictness,
  );
}

/**
 * Check if atom selection should be strict
 */
export function shouldUseStrictAtomSelection(): boolean {
  const settings = getTagModulationSettings();
  return settings.strict_atom_selection;
}

/**
 * Get minimum confidence for entity extraction
 */
export function getEntityMinConfidence(): number {
  const settings = getTagModulationSettings();
  return settings.entity_extraction.min_confidence;
}

/**
 * Check if entity extraction is enabled for a category
 */
export function isEntityCategoryEnabled(category: string): boolean {
  const settings = getTagModulationSettings();
  return settings.entity_extraction.enabled && 
         settings.entity_extraction.categories.includes(category.toUpperCase());
}

/**
 * Validate and normalize a tag
 */
export function normalizeTag(tag: string): string | null {
  if (!tag || typeof tag !== 'string') return null;
  
  let normalized = tag.trim();
  
  // Ensure starts with #
  if (!normalized.startsWith('#')) {
    normalized = `#${normalized}`;
  }
  
  // Convert to proper case (first letter uppercase for single words)
  const cleanPart = normalized.slice(1);
  if (cleanPart.length <= 20 && /^[a-z]+$/.test(cleanPart)) {
    normalized = `#${cleanPart.charAt(0).toUpperCase() + cleanPart.slice(1)}`;
  }
  
  // Validate
  if (normalized.length < 2 || normalized.length > 50) {
    return null;
  }
  
  return normalized;
}

/**
 * Batch process and modulate tags for a molecule
 */
export function processMoleculeTags(
  rawTags: string[],
  atomLabels?: string[],
): string[] {
  const settings = getTagModulationSettings();
  
  // Start with raw tags
  let processedTags = [...rawTags];
  
  // Add atom labels as tags if enabled
  if (atomLabels && settings.atom_as_tag) {
    processedTags = [
      ...processedTags,
      ...atomLabels.map(label => label.startsWith('#') ? label : `#${label}`),
    ];
  }
  
  // Deduplicate
  processedTags = Array.from(new Set(processedTags));
  
  // Apply modulation
  return modulateTags(processedTags);
}
