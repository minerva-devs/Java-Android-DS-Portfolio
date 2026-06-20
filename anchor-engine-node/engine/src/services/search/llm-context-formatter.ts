/**
 * LLM-Optimized Context Formatter
 * 
 * Transforms search results from chronological dump to LLM-first structured format.
 * 
 * Design Principles:
 * 1. Structured over narrative - LLMs parse structured data better
 * 2. Explicit relationships - Don't make the LLM infer connections
 * 3. Relevance-ranked - Order by importance, not chronology
 * 4. Token-efficient - Remove noise, keep signal
 * 5. Entity-rich - Pre-extract people, systems, concepts
 */

import type { SearchResult } from './search-utils.js';
import { KNOWN_PEOPLE } from '../../config/known-entities.js';

// ============ Type Definitions ============

export interface Entity {
  name: string;
  type: 'person' | 'system' | 'concept' | 'organization' | 'technology';
  role: string;
  mentions: number;
  related_topics: string[];
  atom_ids: string[];
}

export interface Theme {
  name: string;
  confidence: number;
  atom_ids: string[];
  summary: string;
  keywords: string[];
}

export interface RankedAtom {
  id: string;
  relevance_score: number;
  theme: string;
  entities: string[];
  timestamp: string;
  content: string;
  source: string;
  tags: string[];
  relationships: {
    responds_to?: string[];
    referenced_by?: string[];
    related_to?: string[];
  };
}

export interface Gap {
  topic: string;
  confidence: number;
  suggestion: string;
}

export interface Timeline {
  earliest: string;
  latest: string;
  span_days: number;
  key_moments: Array<{
    timestamp: string;
    event: string;
    atom_id: string;
  }>;
}

export interface LLMContext {
  query: string;
  context: {
    summary: string;
    entities: Entity[];
    themes: Theme[];
    timeline: Timeline;
  };
  atoms: RankedAtom[];
  gaps: Gap[];
  metadata: {
    total_atoms_searched: number;
    atoms_returned: number;
    search_latency_ms: number;
    dedup_removed: number;
    backend: string;
    format_version: string;
  };
}

// ============ Entity Extraction Helpers ============

interface ExtractedEntityData {
  name: string;
  type: string;
  mentions: number;
}

/**
 * Extract entities from text using KNOWN_PEOPLE registry and common technology patterns.
 * Replaces the EntityExtractorService dependency with inline extraction.
 */
function extractEntities(text: string): ExtractedEntityData[] {
  if (!text || text.length === 0) return [];
  const results: ExtractedEntityData[] = [];
  const lower = text.toLowerCase();

  for (const person of KNOWN_PEOPLE) {
    const escaped = person.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\b${escaped}\\b`, 'gi');
    const matches = lower.match(regex);
    if (matches && matches.length > 0) {
      results.push({ name: person, type: 'person', mentions: matches.length });
    }
  }

  const techPatterns = [
    { name: 'Anchor Engine', type: 'technology' as const },
    { name: 'PGlite', type: 'technology' as const },
    { name: 'STAR', type: 'technology' as const },
    { name: 'WASM', type: 'technology' as const },
    { name: 'TagWalker', type: 'technology' as const },
  ];

  for (const { name, type } of techPatterns) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\b${escaped}\\b`, 'gi');
    const matches = lower.match(regex);
    if (matches && matches.length > 0) {
      results.push({ name, type, mentions: matches.length });
    }
  }

  return results;
}

// ============ Main Formatter Class ============

export class LLMContextFormatter {
  private readonly FORMAT_VERSION = '1.0.0';
  
  /**
   * Format atoms into LLM-optimized context
   */
  format(atoms: SearchResult[], query: string, metadata?: Partial<LLMContext['metadata']>): LLMContext {
    const entities = this.extractEntities(atoms);
    const themes = this.clusterThemes(atoms);
    const rankedAtoms = this.rankAndFormatAtoms(atoms, themes);
    const timeline = this.buildTimeline(atoms);
    const gaps = this.identifyGaps(atoms, query, entities);
    
    return {
      query,
      context: {
        summary: this.generateThemeSummary(atoms, query, entities),
        entities,
        themes,
        timeline,
      },
      atoms: rankedAtoms,
      gaps,
      metadata: {
        total_atoms_searched: atoms.length,
        atoms_returned: rankedAtoms.length,
        search_latency_ms: 0, // Will be set by caller
        dedup_removed: 0, // Will be set by caller
        backend: 'pglite', // Will be set by caller
        format_version: this.FORMAT_VERSION,
        ...metadata,
      },
    };
  }
  
  /**
   * Extract entities from atoms using the centralized EntityExtractorService
   */
  private extractEntities(atoms: SearchResult[]): Entity[] {
    const entityMap = new Map<string, Entity>();
    
    for (const atom of atoms) {
      const text = `${atom.content} ${atom.tags?.join(' ') || ''}`;
      
      // Use the centralized service to extract all entities at once
      const extractionResult = extractEntities(text);
      
      // Process extracted entities and add to map
      for (const entity of extractionResult) {
        let entityType: Entity['type'];
        switch (entity.type) {
          case 'person': entityType = 'person'; break;
          case 'system': entityType = 'technology'; break;
          case 'place': entityType = 'concept'; break;
          default: entityType = 'concept';
        }
        
        if (!entityMap.has(entity.name)) {
          entityMap.set(entity.name, {
            name: entity.name,
            type: entityType,
            role: this.inferRoleFromContext(entity.type, entity.mentions),
            mentions: 0,
            related_topics: [],
            atom_ids: [],
          });
        }
        
        const existing = entityMap.get(entity.name)!;
        if (existing.mentions < entity.mentions) {
          existing.mentions = entity.mentions;
        }
        if (!existing.atom_ids.includes(atom.id)) {
          existing.atom_ids.push(atom.id);
        }
      }
    }

    // Sort by mentions and return top entities
    return Array.from(entityMap.values())
      .sort((a, b) => b.mentions - a.mentions)
      .slice(0, 20); // Top 20 entities
  }
  
  /**
   * Cluster atoms by theme using tag co-occurrence
   */
  private clusterThemes(atoms: SearchResult[]): Theme[] {
    const tagCooccurrence = new Map<string, Map<string, number>>();
    
    // Build tag co-occurrence matrix
    for (const atom of atoms) {
      const tags = atom.tags || [];
      for (let i = 0; i < tags.length; i++) {
        for (let j = i + 1; j < tags.length; j++) {
          const tag1 = tags[i].toLowerCase();
          const tag2 = tags[j].toLowerCase();
          
          if (!tagCooccurrence.has(tag1)) {
            tagCooccurrence.set(tag1, new Map());
          }
          if (!tagCooccurrence.has(tag2)) {
            tagCooccurrence.set(tag2, new Map());
          }
          
          const map1 = tagCooccurrence.get(tag1)!;
          const map2 = tagCooccurrence.get(tag2)!;
          
          map1.set(tag2, (map1.get(tag2) || 0) + 1);
          map2.set(tag1, (map2.get(tag1) || 0) + 1);
        }
      }
    }
    
    // Find theme clusters
    const themes: Theme[] = [];
    const usedTags = new Set<string>();
    
    // Start with most frequent tags
    const tagFrequency = new Map<string, number>();
    for (const atom of atoms) {
      for (const tag of atom.tags || []) {
        tagFrequency.set(tag.toLowerCase(), (tagFrequency.get(tag.toLowerCase()) || 0) + 1);
      }
    }
    
    const sortedTags = Array.from(tagFrequency.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([tag]) => tag);
    
    // Create theme clusters
    for (const seedTag of sortedTags) {
      if (usedTags.has(seedTag)) continue;
      
      const cluster = this.buildThemeCluster(seedTag, tagCooccurrence, atoms);
      if (cluster.atom_ids.length >= 2) { // Only themes with 2+ atoms
        themes.push(cluster);
        cluster.keywords.forEach(tag => usedTags.add(tag));
      }
    }
    
    return themes.slice(0, 10); // Top 10 themes
  }
  
  /**
   * Build a theme cluster from a seed tag
   */
  private buildThemeCluster(
    seedTag: string,
    cooccurrence: Map<string, Map<string, number>>,
    atoms: SearchResult[],
  ): Theme {
    const relatedTags = new Set<string>([seedTag]);
    const atomIds = new Set<string>();
    
    // Find related tags (co-occur >= 2 times)
    const seedMap = cooccurrence.get(seedTag);
    if (seedMap) {
      for (const [tag, count] of seedMap.entries()) {
        if (count >= 2) {
          relatedTags.add(tag);
        }
      }
    }
    
    // Find atoms with these tags
    for (const atom of atoms) {
      const atomTags = atom.tags?.map(t => t.toLowerCase()) || [];
      if (atomTags.some(tag => relatedTags.has(tag))) {
        atomIds.add(atom.id);
      }
    }
    
    // Generate theme name from tags
    const themeName = this.generateThemeName(Array.from(relatedTags));
    
    return {
      name: themeName,
      confidence: Math.min(1.0, atomIds.size / atoms.length),
      atom_ids: Array.from(atomIds),
      summary: `Theme: ${themeName} (${atomIds.size} atoms)`,
      keywords: Array.from(relatedTags).slice(0, 5),
    };
  }
  
  /**
   * Rank atoms by relevance and format for LLM
   */
  private rankAndFormatAtoms(atoms: SearchResult[], themes: Theme[]): RankedAtom[] {
    return atoms
      .map(atom => ({
        id: atom.id,
        relevance_score: this.calculateRelevance(atom),
        theme: this.findBestTheme(atom, themes),
        entities: this.extractAtomEntities(atom),
        timestamp: String(atom.timestamp || new Date().toISOString()),
        content: atom.content,
        source: atom.source || 'unknown',
        tags: (atom.tags || []).slice(0, 10), // Limit to top 10 most relevant tags per molecule
        relationships: {
          responds_to: (atom.epochs as any)?.responds_to || [],
          referenced_by: (atom.epochs as any)?.referenced_by || [],
          related_to: this.findRelatedAtoms(atom, atoms),
        },
      }))
      .sort((a, b) => b.relevance_score - a.relevance_score);
  }
  
  /**
   * Calculate relevance score for an atom (0-1)
   */
  private calculateRelevance(atom: SearchResult): number {
    let score = 0.5; // Base score
    
    // Boost for tags
    if (atom.tags && atom.tags.length > 0) {
      score += Math.min(0.2, atom.tags.length * 0.02);
    }
    
    // Boost for content length (substantive atoms)
    const contentLength = atom.content?.length || 0;
    if (contentLength > 100) score += 0.1;
    if (contentLength > 500) score += 0.1;
    
    // Boost for recent timestamps
    if (atom.timestamp) {
      const age = Date.now() - new Date(atom.timestamp).getTime();
      const daysOld = age / (1000 * 60 * 60 * 24);
      if (daysOld < 30) score += 0.1;
      else if (daysOld < 90) score += 0.05;
    }
    
    return Math.min(1.0, score);
  }
  
  /**
   * Build timeline from atoms
   */
  private buildTimeline(atoms: SearchResult[]): Timeline {
    const timestamps = atoms
      .filter(a => a.timestamp)
      .map(a => new Date(a.timestamp).getTime())
      .sort((a, b) => a - b);
    
    if (timestamps.length === 0) {
      return {
        earliest: new Date().toISOString(),
        latest: new Date().toISOString(),
        span_days: 0,
        key_moments: [],
      };
    }
    
    const earliest = new Date(timestamps[0]);
    const latest = new Date(timestamps[timestamps.length - 1]);
    const spanDays = Math.ceil((latest.getTime() - earliest.getTime()) / (1000 * 60 * 60 * 24));
    
    // Find key moments (high-relevance atoms)
    const keyMoments = atoms
      .filter(a => a.timestamp && this.calculateRelevance(a) > 0.7)
      .slice(0, 5)
      .map(atom => ({
        timestamp: atom.timestamp,
        event: atom.content.substring(0, 100) + '...',
        atom_id: atom.id,
      }));
    
    return {
      earliest: earliest.toISOString(),
      latest: latest.toISOString(),
      span_days: spanDays,
      key_moments: keyMoments.map(km => ({
        timestamp: String(km.timestamp),
        event: km.event,
        atom_id: km.atom_id,
      })),
    };
  }
  
  /**
   * Identify information gaps
   */
  private identifyGaps(atoms: SearchResult[], query: string, entities: Entity[]): Gap[] {
    const gaps: Gap[] = [];
    
    // Check if query mentions entities that aren't well-represented
    const queryLower = query.toLowerCase();
    for (const entity of entities) {
      if (queryLower.includes(entity.name.toLowerCase()) && entity.mentions < 3) {
        gaps.push({
          topic: `${entity.name}'s perspective`,
          confidence: 0.6,
          suggestion: `Limited information about ${entity.name} in the results`,
        });
      }
    }
    
    // Check for missing time periods
    if (atoms.length > 0) {
      const timestamps = atoms.filter(a => a.timestamp).map(a => new Date(a.timestamp).getFullYear());
      const yearRange = new Set(timestamps);
      const currentYear = new Date().getFullYear();
      
      for (let year = currentYear - 2; year <= currentYear; year++) {
        if (!yearRange.has(year)) {
          gaps.push({
            topic: `Information from ${year}`,
            confidence: 0.4,
            suggestion: `No atoms found from ${year}`,
          });
        }
      }
    }
    
    return gaps;
  }
  
  // ============ Helper Methods ============
  
  private capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
  
  private inferPersonRole(name: string, atoms: SearchResult[]): string {
    const nameLower = name.toLowerCase();
    for (const atom of atoms) {
      const content = atom.content.toLowerCase();
      if (content.includes(nameLower)) {
        if (content.includes('partner') || content.includes('relationship')) return 'partner';
        if (content.includes('collaborator') || content.includes('work')) return 'collaborator';
        if (content.includes('friend')) return 'friend';
      }
    }
    return 'person';
  }
  
  private classifySystem(name: string): Entity['type'] {
    const lower = name.toLowerCase();
    if (lower.includes('engine') || lower.includes('system')) return 'system';
    if (lower.includes('language') || lower.includes('framework')) return 'technology';
    if (lower.includes('protocol') || lower.includes('algorithm')) return 'concept';
    return 'technology';
  }
  
  private extractTopics(atom: SearchResult): string[] {
    return atom.tags?.slice(0, 5) || [];
  }
  
  private generateThemeName(tags: string[]): string {
    // Capitalize and join tags
    return tags
      .slice(0, 3)
      .map(tag => tag.split('_').map(this.capitalize).join(' '))
      .join(' & ');
  }
  
  private generateThemeSummary(atoms: SearchResult[], query: string, entities: Entity[]): string {
    const sampleContent = atoms.slice(0, 2).map(a => a.content.substring(0, 50)).join('... ');
    const entityNames = entities.slice(0, 3).map(e => e.name).join(', ');
    return `Context about ${entityNames || 'the query'}: ${sampleContent}...`;
  }
  
  private findBestTheme(atom: SearchResult, themes: Theme[]): string {
    for (const theme of themes) {
      if (theme.atom_ids.includes(atom.id)) {
        return theme.name;
      }
    }
    return 'General';
  }
  
  private extractAtomEntities(atom: SearchResult): string[] {
    const entities: string[] = [];
    const text = `${atom.content} ${atom.tags?.join(' ') || ''}`;
    
    // Use dynamic pattern generation from centralized KNOWN_PEOPLE array
    if (KNOWN_PEOPLE.length > 0) {
      const regexPattern = new RegExp(`\\b(${KNOWN_PEOPLE.join('|')})\\b`, 'gi');
      const personMatches = text.match(regexPattern);
      if (personMatches) {
        entities.push(...personMatches.map(p => this.capitalize(p)));
      }
    }
    
    return [...new Set(entities)];
  }
  
  private findRelatedAtoms(atom: SearchResult, allAtoms: SearchResult[]): string[] {
    // Find atoms with shared tags
    const atomTags = new Set(atom.tags || []);
    const related = allAtoms
      .filter(a => a.id !== atom.id)
      .filter(a => {
        const otherTags = new Set(a.tags || []);
        return [...atomTags].some(tag => otherTags.has(tag));
      })
      .slice(0, 3)
      .map(a => a.id);
    
    return related;
  }
  
  /**
   * Infer entity role from context (based on mentions and type)
   */
  private inferRoleFromContext(type: string, mentions: number): string {
    if (type === 'person') {
      return mentions > 5 ? 'primary' : mentions > 1 ? 'secondary' : 'mentioned';
    }
    if (type === 'system' || type === 'technology') {
      return mentions > 3 ? 'core' : 'supporting';
    }
    return 'context';
  }
}
