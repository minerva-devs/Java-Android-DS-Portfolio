/**
 * Graph-Context Protocol (GCP) — Type Definitions
 *
 * The Neuro-Symbolic Bridge between the Physics Engine (PGlite/SQL)
 * and the Local LLM (Creative Reasoning).
 *
 * Design Principles:
 * - High Signal-to-Token Ratio: Every byte fed to the LLM must carry meaning.
 * - Deterministic Provenance: The LLM can trace WHY a memory was surfaced.
 * - Federated Sovereignty: User context adapts the graph without changing code.
 *
 * Mathematical Foundations (Unified Field Equation):
 *   Weight = BaseCo-occurrence × TemporalDecay × SimhashGravity × Damping
 *   Where:
 *     TemporalDecay = e^(-λΔt)
 *     SimhashGravity = 1 - (HammingDistance / 64)
 *     Damping = α (default 0.85)
 */
/** Sensible defaults — these match the existing hyperparameters */
export const DEFAULT_SEARCH_CONFIG = {
    direct_limit: 5,
    walker_limit: 10,
    temperature: 0.2,
    gravity_threshold: 0.01,
    walk_radius: 1,
    max_per_hop: 50,
};
