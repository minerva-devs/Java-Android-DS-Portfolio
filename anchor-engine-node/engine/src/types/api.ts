
import type { UserContext } from './context.js';

export interface Menu {
    id: string;
    content: string;
    source: string;
    type: string;
    timestamp: number;
    buckets: string[];
    tags: string;
    epochs: string;
    provenance: string;
    score?: number;
}

export interface SearchRequest {
    query: string;           // The natural language query
    limit?: number;          // Elastic Window (default 20)
    max_chars?: number;      // Character budget
    deep?: boolean;          // If true, trigger 'Epochal' search (Dreamer layers)

    // The "UniversalRAG" Routing Layer
    buckets?: string[];      // e.g., ["@code", "@visual", "@memory"]
    provenance?: 'internal' | 'external' | 'quarantine' | 'all'; // Data Provenance filter

    // Clean mode for token-efficient output (Task 1)
    mode?: 'standard' | 'clean';

    user_context?: UserContext; // Federated Sovereignty (User Context)
}

export interface KnowledgeResponse {
    query: string;
    strategy: string;
    clusters: KnowledgeCluster[];
}

export interface KnowledgeCluster {
    id: string;               // e.g., "cluster_<session_id>"
    start_time?: string;      // ISO timestamp of earliest molecule in cluster
    end_time?: string;        // ISO timestamp of latest molecule
    topic?: string;           // optional inferred topic
    summary?: string;         // optional short summary
    molecules: KnowledgeMolecule[];
}

export interface KnowledgeMolecule {
    id: string;
    timestamp: string;        // ISO string
    speaker: string;          // "Rob", "Coda", "User", etc.
    tags: string[];           // e.g., ["#topological_perception", "#graph"]
    entities: {
        people: string[];
        concepts: string[];
        projects: string[];
    };
    content: string;
    byte_range: {
        start: number;
        end: number;
        source: string;       // original file path
    };
}
