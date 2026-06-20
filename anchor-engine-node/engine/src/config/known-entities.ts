/**
 * Known Entities Configuration
 * 
 * Centralized list of recognized entity names to avoid hardcoded strings across services.
 * This allows easy updates when new people, places, or systems are added to the corpus.
 */

// ============ Person Names ============
// Add new person names here as they appear in the corpus
export const KNOWN_PEOPLE = [
  'rob', 'robert',
  'jade', 
  'dory',
  'coda',
  'alex',
] as const;

/** Type-safe access to known people names */
export type KnownPerson = (typeof KNOWN_PEOPLE)[number];

// ============ Place Names ============
export const KNOWN_PLACES = [
  'albuquerque',
  'bernalillo',
  'sandia',
  'los alamos',
  'texas',
] as const;

/** Type-safe access to known places */
export type KnownPlace = (typeof KNOWN_PLACES)[number];

// ============ System/Technology Names ============
export const KNOWN_SYSTEMS = [
  // Platforms/Frameworks
  'node.js', 'typescript', 'react', 'vue', 'svelte',
  'express', 'fastify', 'hapi',
  'python', 'pytorch', 'tensorflow', 'keras',
  'rust', 'go', 'java', 'csharp', 'c++',
  
  // Databases
  'cozodb', 'postgres', 'postgresql', 'sqlite', 'pglite',
  'redis', 'mongodb', 'prisma', 'typeorm',
  
  // Search/Vector
  'star', 'pinecone', 'weaviate', 'qdrant', 'milvus',
  'chroma', 'faiss', 'hnsw',
  
  // AI/ML Concepts
  'rag', 'llm', 'embedding', 'vector', 'attention',
  'transformer', 'bert', 'llama', 'mistral', 'qwen',
  
  // Architecture Patterns
  'context engine', 'ece', 'anchor', 'semantic memory',
  'radial distillation', 'sovereign memory',
] as const;

/** Type-safe access to known systems */
export type KnownSystem = (typeof KNOWN_SYSTEMS)[number];

// ============ Helper Functions ============

/**
 * Check if a word matches any known entity in the given category
 */
export function isKnownEntity(word: string, category: 'people' | 'places' | 'systems'): boolean {
  const list = category === 'people' 
    ? KNOWN_PEOPLE 
    : category === 'places' 
      ? KNOWN_PLACES 
      : KNOWN_SYSTEMS;
  
  return list.some(name => word.toLowerCase().includes(name.toLowerCase()));
}

/**
 * Get the matching known entity name (or undefined if no match)
 */
export function getMatchingEntity(word: string, category: 'people' | 'places' | 'systems'): string | undefined {
  const list = category === 'people' 
    ? KNOWN_PEOPLE 
    : category === 'places' 
      ? KNOWN_PLACES 
      : KNOWN_SYSTEMS;
  
  const lowerWord = word.toLowerCase();
  for (const name of list) {
    if (lowerWord.includes(name.toLowerCase())) {
      return name;
    }
  }
  return undefined;
}

/**
 * Categorize an entity based on its characteristics
 */
export function categorizeEntity(word: string): 'person' | 'place' | 'system' | 'unknown' {
  if (isKnownEntity(word, 'people')) return 'person';
  if (isKnownEntity(word, 'places')) return 'place';
  if (isKnownEntity(word, 'systems')) return 'system';
  return 'unknown';
}