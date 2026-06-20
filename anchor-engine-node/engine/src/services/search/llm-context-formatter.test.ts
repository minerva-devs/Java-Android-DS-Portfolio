/**
 * LLM Context Formatter Tests
 */

import { LLMContextFormatter } from './llm-context-formatter.js';

describe('LLMContextFormatter', () => {
  const mockAtoms = [
    {
      id: 'atom_1',
      content: 'Rob discussed career changes with Coda over coffee',
      timestamp: new Date('2025-06-15T14:30:00Z').getTime(),
      source: 'chat_2025-06-15',
      tags: ['career', 'friendship', 'advice'],
      buckets: [],
      epochs: '' as any,
      provenance: 'internal' as const,
      score: 0.9
    },
    {
      id: 'atom_2',
      content: 'Dory supported Rob through imposter syndrome during job search',
      timestamp: new Date('2025-08-20T09:15:00Z').getTime(),
      source: 'chat_2025-08-20',
      tags: ['relationship', 'support', 'career'],
      buckets: [],
      epochs: '' as any,
      provenance: 'internal' as const,
      score: 0.85
    },
    {
      id: 'atom_3',
      content: 'External Context Engine architecture discussion with POML protocol design',
      timestamp: new Date('2025-10-05T16:45:00Z').getTime(),
      source: 'dev_notes',
      tags: ['architecture', 'POML', 'ECE'],
      buckets: [],
      epochs: '' as any,
      provenance: 'internal' as const,
      score: 0.8
    }
  ];

  let formatter: LLMContextFormatter;

  beforeEach(() => {
    formatter = new LLMContextFormatter();
  });

  describe('format', () => {
    it('should format context with entities, themes, and atoms', () => {
      const result = formatter.format(mockAtoms, 'Rob career Dory ECE');

      expect(result).toBeDefined();
      expect(result.query).toBe('Rob career Dory ECE');
      expect(result.context).toBeDefined();
      expect(result.context.entities).toBeDefined();
      expect(result.context.themes).toBeDefined();
      expect(result.atoms).toBeDefined();
      expect(result.gaps).toBeDefined();
    });

    it('should extract entities from atoms', () => {
      const result = formatter.format(mockAtoms, 'Rob career Dory ECE');
      const entities = result.context.entities;

      expect(entities.length).toBeGreaterThan(0);
      expect(entities[0]).toHaveProperty('name');
      expect(entities[0]).toHaveProperty('mentions');
    });

    it('should cluster themes from atoms', () => {
      const result = formatter.format(mockAtoms, 'Rob career Dory ECE');
      const themes = result.context.themes;

      expect(themes.length).toBeGreaterThan(0);
      themes.forEach(theme => {
        expect(theme).toHaveProperty('name');
        expect(theme).toHaveProperty('atom_ids');
        expect(theme).toHaveProperty('confidence');
      });
    });

    it('should rank atoms by relevance', () => {
      const result = formatter.format(mockAtoms, 'Rob career Dory ECE');
      const atoms = result.atoms;

      expect(atoms.length).toBeGreaterThan(0);
      atoms.forEach(atom => {
        expect(atom).toHaveProperty('relevance_score');
        expect(atom.relevance_score).toBeGreaterThanOrEqual(0);
        expect(atom.relevance_score).toBeLessThanOrEqual(1);
      });
    });

    it('should perform gap analysis', () => {
      const result = formatter.format(mockAtoms, 'Rob career Dory ECE');

      expect(result.gaps).toBeDefined();
      expect(Array.isArray(result.gaps)).toBe(true);
    });
  });

  describe('JSON output', () => {
    it('should produce valid JSON output', () => {
      const result = formatter.format(mockAtoms, 'Rob career Dory ECE');
      const jsonStr = JSON.stringify(result);

      expect(() => JSON.parse(jsonStr)).not.toThrow();
    });

    it('should estimate token count reasonably', () => {
      const result = formatter.format(mockAtoms, 'Rob career Dory ECE');
      const jsonStr = JSON.stringify(result, null, 2);
      const tokenEstimate = jsonStr.length / 4;

      expect(tokenEstimate).toBeGreaterThan(0);
      expect(tokenEstimate).toBeLessThan(10000); // Reasonable upper bound
    });
  });
});
