/**
 * Tag Filter - Blacklist for noise/system tags
 * 
 * Prevents low-value tags from being stored in the database.
 * Applied at ingestion time to keep the tag space clean.
 */

// Blacklist patterns - tags matching these will be rejected
const TAG_BLACKLIST_PATTERNS = [
  // Color codes (hex)
  /^#[0-9a-fA-F]{3,8}$/,
  
  // Pure numbers or too short
  /^#\d{1,3}$/,
  /^#_\w*$/,
  /^#__[\w\d_]+$/,  // __lottie_element_, etc.
  
  // HTML/DOM artifacts
  /^#btn\b/,
  /^#class\b/,
  /^#div\b/,
  /^#id\b/,
  /^#span\b/,
  /^#href\b/,
  /^#src\b/,
  
  // Code artifacts
  /^#fn\b/,
  /^#elif\b/,
  /^#else\b/,
  /^#endif\b/,
  /^#ifdef\b/,
  /^#ifndef\b/,
  /^#include\b/,
  /^#define\b/,
  /^#pragma\b/,
  
  // Scraping artifacts (Wikipedia, etc.)
  /^#cite_note/,
  /^#cite_ref/,
  /^#amp_tf/,
  /^#details_of_atom/,
  /^#entry_lin/,
  /^#entry_links/,
  /^#entry_metadata/,
  /^#feed_metadata/,
  /^#opensearch_extension/,
  /^#extension_elements/,
  /^#simple_examples/,
  /^#query_interface/,
  /^#api_response/,
  /^#response_example/,
  /^#examples?$/,
  /^#overview$/,
  /^#preface$/,
  /^#appendix/,
  /^#appendices$/,
  /^#bib\b/,
  /^#ref\b/,
  /^#fn\b/,
  
  // Error/artifact tags
  /^#incorrect_/,
  /^#error_/,
  /^#null\b/,
  /^#undefined\b/,
  /^#nan\b/,
  
  // Too generic / low signal
  /^#slow_pickup$/,
  /^#late_night$/,
  /^#early_morning$/,
  /^#monday\b/,
  /^#tuesday\b/,
  /^#wednesday\b/,
  /^#thursday\b/,
  /^#friday\b/,
  /^#saturday\b/,
  /^#sunday\b/,
  /^#manual\b/,
  /^#manually_/,
  /^#test_/,
  /^#tmp\b/,
  /^#temp\b/,
  /^#untagged$/,
  
  // Old project names / deprecated
  /^#agentgpt$/,
  /^#babyagi$/,
  /^#autogen$/,
  /^#chimaera$/,
  
  // System tags (not user-meaningful)
  /^#manually_quarantined$/,
  /^#quarantined$/,
  /^#system$/,
  /^#internal$/,
  /^#external$/,
];

// Also maintain a simple blacklist for exact matches
const TAG_BLACKLIST_EXACT = new Set([
  '#_', '#0', '#1', '#2', '#3', '#4', '#5', '#6', '#7', '#8', '#9',
  '#00', '#000', '#0000', '#00000', '#000000',
]);

/**
 * Check if a tag should be filtered out
 */
export function isTagBlacklisted(tag: string): boolean {
  if (!tag || typeof tag !== 'string') return true;
  
  const normalizedTag = tag.trim();
  
  // Check exact blacklist
  if (TAG_BLACKLIST_EXACT.has(normalizedTag)) {
    return true;
  }
  
  // Check pattern blacklist
  for (const pattern of TAG_BLACKLIST_PATTERNS) {
    if (pattern.test(normalizedTag)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Filter an array of tags, removing blacklisted ones
 */
export function filterTags(tags: string[]): string[] {
  if (!tags || !Array.isArray(tags)) return [];
  
  return tags
    .filter(tag => !isTagBlacklisted(tag))
    .map(tag => tag.trim())
    .filter(tag => tag.length > 0);
}

/**
 * Filter tags and log what was removed (for debugging)
 */
export function filterTagsWithLogging(tags: string[], context?: string): string[] {
  if (!tags || !Array.isArray(tags)) return [];
  
  const filtered = tags.filter(tag => {
    if (isTagBlacklisted(tag)) {
      if (context) {
        console.debug(`[TagFilter] ${context}: Filtered out "${tag}"`);
      }
      return false;
    }
    return true;
  });
  
  const removedCount = tags.length - filtered.length;
  if (removedCount > 0 && context) {
    console.debug(`[TagFilter] ${context}: Removed ${removedCount}/${tags.length} blacklisted tags`);
  }
  
  return filtered.map(tag => tag.trim());
}
