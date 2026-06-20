/**
 * Entity Extractor Service
 *
 * Extracts named entities (people, systems, concepts) from text using pattern matching
 * and the KNOWN_PEOPLE registry. Used by the LLM context formatter to pre-enrich
 * search results with structured entity data.
 */

import { KNOWN_PEOPLE } from '../../config/known-entities.js';

export interface ExtractedEntity {
  name: string;
  type: 'person' | 'system' | 'place' | 'concept' | 'technology' | 'organization';
  mentions: number;
}

export class EntityExtractorService {
  /**
   * Extract entities from text using pattern matching against known registries.
   */
  extract(text: string): ExtractedEntity[] {
    if (!text || text.length === 0) return [];

    const results: ExtractedEntity[] = [];
    const lower = text.toLowerCase();

    // Match known people
    for (const person of KNOWN_PEOPLE) {
      const regex = new RegExp(`\\b${escapeRegex(person)}\\b`, 'gi');
      const matches = lower.match(regex);
      if (matches && matches.length > 0) {
        results.push({
          name: person,
          type: 'person',
          mentions: matches.length,
        });
      }
    }

    // Match known system/technology patterns
    const techPatterns = [
      { name: 'Anchor Engine', type: 'technology' as const },
      { name: 'PGlite', type: 'technology' as const },
      { name: 'STAR', type: 'technology' as const },
      { name: 'WASM', type: 'technology' as const },
      { name: 'TagWalker', type: 'technology' as const },
    ];

    for (const { name, type } of techPatterns) {
      const regex = new RegExp(`\\b${escapeRegex(name)}\\b`, 'gi');
      const matches = lower.match(regex);
      if (matches && matches.length > 0) {
        results.push({ name, type, mentions: matches.length });
      }
    }

    return results;
  }
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
