/**
 * Configuration Module for Anchor Engine
 *
 * All configuration is abstracted to ~/.anchor/user_settings.json.
 * No config files live in the project root.
 */

import * as fs from 'fs';
import * as path from 'path';
import { homedir } from 'os';
import { fileURLToPath } from 'url';
import yaml from 'js-yaml';
import { z } from 'zod';
import { PATHS } from './paths.js';

// For __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Add distill_idle_minutes to Config schema
// Note: The full ConfigSchema is defined elsewhere; we simply add the missing field.

// === Configuration Schema with Zod Validation ===

// Add distill_idle_minutes to Config schema
const ConfigSchema = z.object({
  // existing fields would be added here
  distill_idle_minutes: z.number().optional(),
});

// Server Settings Schema
const ServerSettingsSchema = z.object({
  host: z.string().optional(),
  port: z.number().int().min(1).max(65535).optional(),
  // SECURITY FIX (Standard 132): API key must be at least 32 chars with mixed character types
  // Prevents weak keys like "aaaaaaaaaaaaaaaa" or "1234567890123456"
  // Accepts: mixed case+digit OR 64+ char hex key (from crypto.randomBytes)
  api_key: z.string()
    .min(32, 'API key must be at least 32 characters')
    .max(128, 'API key must not exceed 128 characters')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z0-9]{32,128}$|^[a-f0-9]{64,}$/i,
      'API key must be 32-128 alphanumeric chars with mixed case+digit - OR 64+ char hex')
    .optional(),
});

// Resource Management Schema
const ResourceManagementSchema = z.object({
  gc_cooldown_ms: z.number().int().positive().optional(),
  max_atoms_in_memory: z.number().int().positive().optional(),
  monitoring_interval_ms: z.number().int().positive().optional(),
  cache_ttl_ms: z.number().int().positive().optional(),
  max_cache_size: z.number().int().positive().optional(),
});

// Watcher Settings Schema
const WatcherSettingsSchema = z.object({
  debounce_ms: z.number().int().positive().optional(),
  stability_threshold_ms: z.number().int().positive().optional(),
  extra_paths: z.array(z.string()).optional(),
  auto_start: z.boolean().optional(),
  wipe_mirrored_brain_on_shutdown: z.boolean().optional(),
});

// Search Settings Schema
const SearchSettingsSchema = z.object({
  strategy: z.string().optional(),
  hide_years_in_tags: z.boolean().optional(),
  whitelist: z.array(z.string()).optional(),
  max_chars_default: z.number().int().positive().optional(),
  max_chars_limit: z.number().int().positive().optional(),
  fts_window_size: z.number().int().positive().optional(),
  fts_padding: z.number().int().positive().optional(),
  max_results_default: z.number().int().positive().default(100).optional(),
});

// Database Settings Schema
const DatabaseSettingsSchema = z.object({
  wipe_on_startup: z.boolean().optional(),
  wipe_on_shutdown: z.boolean().optional(),
  shared_buffers_mb: z.number().int().positive().optional(),
  effective_cache_size_mb: z.number().int().positive().optional(),
  work_mem_mb: z.number().int().positive().optional(),
  maintenance_work_mem_mb: z.number().int().positive().optional(),
});

// Memory Settings Schema
const MemorySettingsSchema = z.object({
  heap_pressure_mb: z.number().int().positive().optional(),
  throttle_start_mb: z.number().int().positive().optional(),
  throttle_max_mb: z.number().int().positive().optional(),
  emergency_stop_mb: z.number().int().positive().optional(),
  search_results_batch_size: z.number().int().positive().optional(),
  enable_streaming_results: z.boolean().optional(),
});

// Low Resource Mode Schema (Standard 136)
const LowResourceSchema = z.object({
  enabled: z.boolean().optional(),
  max_recall_low: z.number().int().min(1).optional(),
  max_recall_high: z.number().int().min(1).optional(),
  max_concurrency: z.number().int().min(1).optional(),
  search_batch_size: z.number().int().min(1).optional(),
  ingest_batch_size: z.number().int().min(1).optional(),
  vector_ingest_batch: z.number().int().min(1).optional(),
});

// Limits Schema
const LimitsSchema = z.object({
  max_file_size_bytes: z.number().int().positive().optional(),
  max_content_length_chars: z.number().int().positive().optional(),
  max_chunk_size_chars: z.number().int().positive().optional(),
  max_summary_length_chars: z.number().int().positive().optional(),
  date_extractor_scan_limit: z.number().int().positive().optional(),
});

// Streaming Ingestion Schema
const StreamingSchema = z.object({
  enabled: z.boolean().optional(),
  stream_threshold_bytes: z.number().int().positive().optional(),
  window_bytes: z.number().int().positive().optional(),
  lookahead_bytes: z.number().int().positive().optional(),
  yield_interval_ms: z.number().int().min(0).optional(),
});

// Worker Threads Schema (experimental)
const WorkerThreadsSchema = z.object({
  enabled: z.boolean().optional(),
  max_workers: z.number().int().min(1).max(16).optional(),
  ingest_queue_max: z.number().int().min(1).optional(),
});

// Cron Scheduler Schema
const CronSchema = z.object({
  enabled: z.boolean().optional(),
  daily_scrape_hour: z.number().int().min(0).max(23).optional(),
  synonym_regeneration_hour: z.number().int().min(0).max(23).optional(),
  db_vacuum_hour: z.number().int().min(0).max(23).optional(),
  cache_prune_interval_minutes: z.number().int().min(1).optional(),
});

// User Settings Schema (all optional, with defaults applied)
const _UserSettingsSchema = z.object({
  server: ServerSettingsSchema.optional(),
  resource_management: ResourceManagementSchema.optional(),
  watcher: WatcherSettingsSchema.optional(),
  search: SearchSettingsSchema.optional(),
  database: DatabaseSettingsSchema.optional(),
  memory: MemorySettingsSchema.optional(),
  low_resource: LowResourceSchema.optional(),
  limits: LimitsSchema.optional(),

  // Cache Settings Schema (LRU Cache Configuration)
  cache: z.object({
    max_entries_search_result: z.number().int().positive().optional(),
    max_entries_query_parse: z.number().int().positive().optional(),
    max_entries_semantic_expansion: z.number().int().positive().optional(),
    max_entries_engram: z.number().int().positive().optional(),
    memory_pressure_threshold: z.number().int().min(1).max(100).optional(),
    critical_memory_threshold: z.number().int().min(1).max(100).optional(),
    enable_memory_pressure_eviction: z.boolean().optional(),
    search_result_ttl_ms: z.number().int().positive().optional(),
    query_parse_ttl_ms: z.number().int().positive().optional(),
    semantic_expansion_ttl_ms: z.number().int().positive().optional(),
    engram_ttl_ms: z.number().int().positive().optional(),
  }).optional(),

  // Allow additional properties for backward compatibility
  streaming: StreamingSchema.optional(),
  worker_threads: WorkerThreadsSchema.optional(),
  cron: CronSchema.optional(),
}).passthrough();

// Type inference from schema (used for type checking in loadConfig)
type _UserSettings = z.infer<typeof _UserSettingsSchema>;

// Define configuration interface
interface Config {
  // Core
  PORT: number;
  HOST: string;
  API_KEY: string;
  VERSION: string;
  GITHUB_TOKEN: string;
  LOG_LEVEL: string;
  OVERLAY_PORT: number;

  // LLM Provider
  LLM_PROVIDER: 'local' | 'remote';
  REMOTE_LLM_URL: string;
  REMOTE_MODEL_NAME: string;
  LLM_MODEL_DIR: string;

  // Tuning
  DEFAULT_SEARCH_CHAR_LIMIT: number;
  SIMILARITY_THRESHOLD: number;
  TOKEN_LIMIT: number;

  VECTOR_INGEST_BATCH: number;

  // Resource Management
  GC_COOLDOWN_MS: number;
  MAX_ATOMS_IN_MEMORY: number;
  MONITORING_INTERVAL_MS: number;
  CACHE_TTL_MS: number;
  MAX_CACHE_SIZE: number;

  // Low-Resource Mode (Standard 136)
  LOW_RESOURCE: {
    ENABLED: boolean;
    MAX_RECALL_LOW: number;
    MAX_RECALL_HIGH: number;
    MAX_CONCURRENCY: number;
    SEARCH_BATCH_SIZE: number;
    INGEST_BATCH_SIZE: number;
    VECTOR_INGEST_BATCH: number;
  };

  // Distiller Configuration (v2.1)
  DISTILLER: {
    SIMILARITY_THRESHOLD: number;
    OUTPUT_FORMAT: string;
  };

  // Distillation batch processing (v5.3.0)
  DISTILLATION: {
    BATCH_SIZE: number;
    BATCH_CEILING: number;
    HEAP_FRACTION: number;
    BYTES_PER_MOLECULE: number;
    BATCH_FLOOR: number;
  };

  // Watcher Settings
  WATCHER_DEBOUNCE_MS: number;
  WATCHER_STABILITY_THRESHOLD_MS: number;
  WATCHER_EXTRA_PATHS: string[];
  WATCHER_AUTO_START: boolean;
  WATCHER_WIPE_MIRRORED_BRAIN_ON_SHUTDOWN: boolean;

  // Context Relevance
  CONTEXT_RELEVANCE_WEIGHT: number;
  CONTEXT_RECENCY_WEIGHT: number;

  // Infrastructure
  distill_idle_minutes: 5,

  REDIS: {
    ENABLED: boolean;
    URL: string;
    TTL: number;
  };
  NEO4J: {
    ENABLED: boolean;
    URI: string;
    USER: string;
    PASS: string;
  };

  // Features
  FEATURES: {
    CONTEXT_STORAGE: boolean;
    MEMORY_RECALL: boolean;
    CODA: boolean;
    ARCHIVIST: boolean;
    WEAVER: boolean;
    MARKOVIAN: boolean;
  };

  // Search Settings
  SEARCH: {
    strategy: string;
    hide_years_in_tags: boolean;
    whitelist: string[];
    max_chars_default: number;
    max_chars_limit: number;
    fts_window_size: number;
    fts_padding: number;
    max_results_default: number;
  };

  // Cache Settings (LRU Cache Configuration)
  CACHE: {
    MAX_ENTRIES_SEARCH_RESULT: 200,      // Reduced from 500 (5% of ~4000 entry budget)
    MAX_ENTRIES_QUERY_PARSE: 200,        // Reduced from 500 (5% of ~4000 entry budget)
    MAX_ENTRIES_SEMANTIC_EXPANSION: 400, // Reduced from 1000 (5% of ~8000 entry budget)
    MAX_ENTRIES_ENGRAM: 100,             // Reduced from 200 (5% of ~2000 entry budget)
    MEMORY_PRESSURE_THRESHOLD: 80, // Middle ground: evict at 80% to prevent thrashing
    CRITICAL_MEMORY_THRESHOLD: 92, // Critical only at 92% (was 95%)
    ENABLE_MEMORY_PRESSURE_EVICTION: true,
    SEARCH_RESULT_TTL_MS: 60000,
    QUERY_PARSE_TTL_MS: 300000,
    SEMANTIC_EXPANSION_TTL_MS: 600000,
    ENGRAM_TTL_MS: 120000,
  },

  // Models
  MODELS: {
    EMBEDDING_DIM: number;
    MAIN: {
      PATH: string;
      CTX_SIZE: number;
      GPU_LAYERS: number;
      MAX_TOKENS: number;
    };
    ORCHESTRATOR: {
      PATH: string;
      CTX_SIZE: number;
      GPU_LAYERS: number;
      MAX_TOKENS: number;
    };
    VISION: {
      PATH: string;
      PROJECTOR: string;
      CTX_SIZE: number;
      GPU_LAYERS: number;
      MAX_TOKENS: number;
    };
  };

  // Services
  SERVICES: {
    VISION_SERVER_PORT: number;
    CHAT_SERVER_PORT: number;
    TAG_INFECTOR_UNLOAD_TIMEOUT: number;
    TAG_GLINER_CHECK_INTERVAL: number;
  };

  // Limits and Thresholds
  LIMITS: {
    MAX_FILE_SIZE_BYTES: number;
    MAX_CONTENT_LENGTH_CHARS: number;
    MAX_CHUNK_SIZE_CHARS: number;
    MAX_SUMMARY_LENGTH_CHARS: number;
    DATE_EXTRACTOR_SCAN_LIMIT: number;
  };

  // Watcher Settings
  WATCHER: {
    AUTO_START: boolean;
    WIPE_MIRRORED_BRAIN_ON_SHUTDOWN: boolean;
  };

  // Path Definitions (all relative to anchor root or system directories)
  PATHS: {
    PROJECT_ROOT: string;
    ANCHOR_ROOT: string;
    LOCAL_DATA_DIR: string;
    INBOX_DIR: string;
    EXTERNAL_INBOX_DIR: string;
    MIRRORED_BRAIN_DIR: string;
    BACKUPS_DIR: string;
    LOGS_DIR: string;
    CONTEXT_DATA_DIR: string;
    TEST_DBS_DIR: string;
    NOTEBOOK_DIR: string;
    CONTEXT_DIR: string;
    MODELS_DIR: string;
    DIST_DIR: string;
    DISTILLS_DIR: string;
    SESSIONS_DIR: string;
    CONFIG_FILE: string;
    USER_SETTINGS: string;
    DATABASE_FILE: string;
    LIBRARIES_DIR: string;
    MIRRORS_DIR: string;
    ENGINE_BIN: string;
    ENGINE_SRC: string;
    ENGINE_DIST: string;
    ENGINE_CONTEXT: string;
    ENGINE_PLUGINS: string;
    DESKTOP_OVERLAY_SRC: string;
    DESKTOP_OVERLAY_DIST: string;
  };

  // Database Settings
  DATABASE: {
    WIPE_ON_STARTUP: boolean; // Standard 051: Ephemeral Index (true = wipe & rebuild on each start)
    WIPE_ON_SHUTDOWN: boolean;
    SHARED_BUFFERS_MB: number;
    EFFECTIVE_CACHE_SIZE_MB: number;
    WORK_MEM_MB: number;
    MAINTENANCE_WORK_MEM_MB: number;
    START_TIME: number; // Server start time for uptime calculation
  };

  // Adaptive Concurrency (Standard 132)
  ADAPTIVE_CONCURRENCY: {
    SEQUENTIAL_THRESHOLD_MB: number;
    PARALLEL_THRESHOLD_MB: number;
    MAX_CONCURRENCY: number;
    LOW_MEMORY_BATCH_SIZE: number;
    HIGH_MEMORY_BATCH_SIZE: number;
    FORCE_SEQUENTIAL: boolean;
    FORCE_PARALLEL: boolean;
  };

  // Memory Management (Standard 127/134/135)
  MEMORY: {
    HEAP_PRESSURE_MB: number;
    THROTTLE_START_MB: number;
    THROTTLE_MAX_MB: number;
    EMERGENCY_STOP_MB: number;
    SEARCH_RESULTS_BATCH_SIZE: number;
    ENABLE_STREAMING_RESULTS: boolean;
  };

  // Ingestion Configuration (Agent-Controlled)
  INGESTION: {
    CONCEPT_DENSITY: 'low' | 'medium' | 'high';
    TAG_THRESHOLD: number;
    DEDUP_STRENGTH: 'light' | 'medium' | 'aggressive';
    TOKEN_BUDGET_DEFAULT: number;
    INGESTION_PROFILE: 'code' | 'notes' | 'chat' | 'default';
  };

  // Density Prefix — tier thresholds for external RAG pipeline dispatch
  DENSITY: {
    LIGHT_DOC_THRESHOLD: number;   // mol_count >= this → light tier (well-known concept)
    MEDIUM_DOC_THRESHOLD: number;  // mol_count >= this → medium tier
    LIGHT_RAG_LIMIT: number;       // doc limit to pass to external RAG for light tier
    MEDIUM_RAG_LIMIT: number;      // doc limit for medium tier
    HEAVY_RAG_LIMIT: number;       // doc limit for heavy tier (0 = all available)
  };

  // Streaming Ingestion (Standard 024)
  STREAMING: {
    ENABLED: boolean;
    STREAM_THRESHOLD_BYTES: number;
    WINDOW_BYTES: number;
    LOOKAHEAD_BYTES: number;
    YIELD_INTERVAL_MS: number;
  };

  // Worker Threads (experimental)
  WORKER_THREADS: {
    ENABLED: boolean;
    MAX_WORKERS: number;
    INGEST_QUEUE_MAX: number;
  };

  // Cron Scheduler
  CRON: {
    ENABLED: boolean;
    DAILY_SCRAPE_HOUR: number;
    SYNONYM_REGENERATION_HOUR: number;
    DB_VACUUM_HOUR: number;
    CACHE_PRUNE_INTERVAL_MINUTES: number;
  };
}

// Default configuration
const DEFAULT_CONFIG: Config = {
  // Core
  PORT: 3160,
  HOST: '0.0.0.0',
  API_KEY: '', // REQUIRED
  VERSION: '5.3.0', // Engine version - can be overridden in user_settings.json
  GITHUB_TOKEN: '', // Optional: GitHub PAT for repo ingestion: Must be set in user_settings.json -> server.api_key
  LOG_LEVEL: 'INFO',
  OVERLAY_PORT: 3002,

  // LLM Provider
  LLM_PROVIDER: 'local',
  REMOTE_LLM_URL: 'http://localhost:8000/v1',
  REMOTE_MODEL_NAME: 'default',
  LLM_MODEL_DIR: 'models',

  // Tuning
  DEFAULT_SEARCH_CHAR_LIMIT: 524288,
  SIMILARITY_THRESHOLD: 0.8,
  TOKEN_LIMIT: 1000000,

  VECTOR_INGEST_BATCH: 50,

  // Resource Management
  GC_COOLDOWN_MS: 15000, // 15 seconds (reduced for faster cleanup)
  MAX_ATOMS_IN_MEMORY: 2500, // Increased from 2000
  MONITORING_INTERVAL_MS: 20000, // 20 seconds
  CACHE_TTL_MS: 120000, // 2 minutes (increased)
  MAX_CACHE_SIZE: 800, // Increased from 500

  // Distiller Configuration (v2.1)
  DISTILLER: {
    SIMILARITY_THRESHOLD: 0.85,
    OUTPUT_FORMAT: 'decision-records',
  },

  // Distillation batch processing
  DISTILLATION: {
    BATCH_SIZE: parseInt(process.env['ANCHOR_DISTILL_BATCH_SIZE'] || '5000', 10),
    BATCH_CEILING: parseInt(process.env['ANCHOR_DISTILL_CEILING'] || '20000', 10),
    HEAP_FRACTION: parseFloat(process.env['ANCHOR_DISTILL_HEAP_FRAC'] || '0.25'),
    BYTES_PER_MOLECULE: parseInt(process.env['ANCHOR_DISTILL_BYTES_PER_MOL'] || '2048', 10),
    BATCH_FLOOR: parseInt(process.env['ANCHOR_DISTILL_FLOOR'] || '1000', 10),
  },

  // Watcher Settings
  WATCHER_DEBOUNCE_MS: 2000,
  WATCHER_STABILITY_THRESHOLD_MS: 2000,
  WATCHER_EXTRA_PATHS: [],
  WATCHER_AUTO_START: false,
  WATCHER_WIPE_MIRRORED_BRAIN_ON_SHUTDOWN: true,

  // Watcher Settings (nested object for index.ts access)
  WATCHER: {
    AUTO_START: false,
    WIPE_MIRRORED_BRAIN_ON_SHUTDOWN: true,
  },

  // Context Relevance
  CONTEXT_RELEVANCE_WEIGHT: 0.7,
  CONTEXT_RECENCY_WEIGHT: 0.3,

  // Infrastructure
  distill_idle_minutes: 5,

  REDIS: {
    ENABLED: false,
    URL: 'redis://localhost:6379',
    TTL: 3600,
  },
  NEO4J: {
    ENABLED: false,
    URI: 'bolt://localhost:7687',
    USER: 'neo4j',
    PASS: 'password',
  },

  // Features
  FEATURES: {
    CONTEXT_STORAGE: true,
    MEMORY_RECALL: true,
    CODA: true,
    ARCHIVIST: true,
    WEAVER: true,
    MARKOVIAN: true,
  },

  // Search
  SEARCH: {
    strategy: 'hybrid',
    hide_years_in_tags: true,
    whitelist: [],
    max_chars_default: 5000,   // 5k chars = ~1.25k tokens (mobile-friendly)
    max_chars_limit: 20000,    // 20k chars max limit
    fts_window_size: 1500,
    fts_padding: 750,
    max_results_default: 100,
  },

  // Cache Settings (LRU Cache Configuration)
  CACHE: {
    MAX_ENTRIES_SEARCH_RESULT: 200,      // Reduced from 500 (5% of ~4000 entry budget)
    MAX_ENTRIES_QUERY_PARSE: 200,        // Reduced from 500 (5% of ~4000 entry budget)
    MAX_ENTRIES_SEMANTIC_EXPANSION: 400, // Reduced from 1000 (5% of ~8000 entry budget)
    MAX_ENTRIES_ENGRAM: 100,             // Reduced from 200 (5% of ~2000 entry budget)
    MEMORY_PRESSURE_THRESHOLD: 80, // Middle ground: evict at 80% to prevent thrashing
    CRITICAL_MEMORY_THRESHOLD: 92, // Critical only at 92% (was 95%)
    ENABLE_MEMORY_PRESSURE_EVICTION: true,
    SEARCH_RESULT_TTL_MS: 60000,
    QUERY_PARSE_TTL_MS: 300000,
    SEMANTIC_EXPANSION_TTL_MS: 600000,
    ENGRAM_TTL_MS: 120000,
  },

  // Models
  MODELS: {
    EMBEDDING_DIM: 768,
    MAIN: {
      PATH: 'glm-edge-1.5b-chat.Q5_K_M.gguf', // Default from user_settings.json
      CTX_SIZE: 8192, // Default from user_settings.json
      GPU_LAYERS: 11, // Default from user_settings.json
      MAX_TOKENS: 1024,
    },
    ORCHESTRATOR: {
      PATH: 'Qwen3-4B-Function-Calling-Pro.gguf', // Default from user_settings.json
      CTX_SIZE: 8192,
      GPU_LAYERS: 0,
      MAX_TOKENS: 2048,
    },
    VISION: {
      PATH: '',  // MUST BE SET IN user_settings.json
      PROJECTOR: '', // MUST BE SET IN user_settings.json
      CTX_SIZE: 2048,
      GPU_LAYERS: 11, // Default from user_settings.json
      MAX_TOKENS: 1024,
    },
  },

  // Services
  SERVICES: {
    VISION_SERVER_PORT: 8081,
    CHAT_SERVER_PORT: 8080,
    TAG_INFECTOR_UNLOAD_TIMEOUT: 300000, // 5 minutes
    TAG_GLINER_CHECK_INTERVAL: 60000, // 1 minute
  },

  // Limits and Thresholds
  LIMITS: {
    MAX_FILE_SIZE_BYTES: 10485760, // 10MB
    MAX_CONTENT_LENGTH_CHARS: 5000,
    MAX_CHUNK_SIZE_CHARS: 3000,
    MAX_SUMMARY_LENGTH_CHARS: 2000,
    DATE_EXTRACTOR_SCAN_LIMIT: 2000,
  },

  // Paths (will be loaded from paths.ts at runtime)
  PATHS: {} as typeof import('./paths.js').PATHS,

  // Database Settings
  // Standard 127: PGlite Memory Optimization - tuned for ARM64 Windows with limited RAM
  // Reduced from 256/512/32 to prevent WASM memory access out of bounds errors
  DATABASE: {
    WIPE_ON_STARTUP: true,
    WIPE_ON_SHUTDOWN: true,
    SHARED_BUFFERS_MB: 64,   // SQLite shared buffer cache for index pages (reduced from 128)
    EFFECTIVE_CACHE_SIZE_MB: 100, // OS cache size hint for query planner (reduced from 200)
    WORK_MEM_MB: 8,          // In-memory sort buffer (larger = faster complex queries, reduced from 16)
    MAINTENANCE_WORK_MEM_MB: 8,
    START_TIME: Date.now(),
  },

  // Adaptive Concurrency (Standard 132)
  // Automatically adjusts parallel processing based on available memory
  ADAPTIVE_CONCURRENCY: {
    // Memory threshold in MB below which to use sequential processing (default: 2048)
    SEQUENTIAL_THRESHOLD_MB: parseInt(process.env['ANCHOR_SEQUENTIAL_THRESHOLD_MB'] || '2048', 10),
    // Memory threshold in MB above which to use full parallel processing (default: 8192)
    PARALLEL_THRESHOLD_MB: parseInt(process.env['ANCHOR_PARALLEL_THRESHOLD_MB'] || '8192', 10),
    // Maximum concurrent operations in adaptive mode (default: 5)
    MAX_CONCURRENCY: parseInt(process.env['ANCHOR_MAX_CONCURRENCY'] || '5', 10),
    // Batch size for low-memory mode (default: 1)
    LOW_MEMORY_BATCH_SIZE: parseInt(process.env['ANCHOR_LOW_MEMORY_BATCH_SIZE'] || '1', 10),
    // Batch size for high-memory mode (default: 20)
    HIGH_MEMORY_BATCH_SIZE: parseInt(process.env['ANCHOR_HIGH_MEMORY_BATCH_SIZE'] || '20', 10),
    // Force sequential mode regardless of memory (default: false)
    FORCE_SEQUENTIAL: process.env['ANCHOR_FORCE_SEQUENTIAL'] === 'true',
    // Force parallel mode regardless of memory (default: false)
    FORCE_PARALLEL: process.env['ANCHOR_FORCE_PARALLEL'] === 'true',
  },

  // Memory Management (Standard 127/134/135)
  // Configurable memory thresholds for search throttling and streaming
  MEMORY: {
    // Heap pressure threshold for downgrading max-recall to standard (default: 500MB)
    HEAP_PRESSURE_MB: parseInt(process.env['ANCHOR_HEAP_PRESSURE_MB'] || '500', 10),
    // Start throttling searches at this heap size (default: 800MB)
    THROTTLE_START_MB: parseInt(process.env['ANCHOR_THROTTLE_START_MB'] || '800', 10),
    // Reject searches above this heap size (default: 1200MB)
    THROTTLE_MAX_MB: parseInt(process.env['ANCHOR_THROTTLE_MAX_MB'] || '1200', 10),
    // Emergency stop searches at this heap size (default: 1500MB)
    EMERGENCY_STOP_MB: parseInt(process.env['ANCHOR_EMERGENCY_STOP_MB'] || '1500', 10),
    // Batch size for streaming search results (default: 20)
    SEARCH_RESULTS_BATCH_SIZE: parseInt(process.env['ANCHOR_SEARCH_RESULTS_BATCH_SIZE'] || '20', 10),
    // Enable streaming results for memory efficiency (default: false)
    ENABLE_STREAMING_RESULTS: process.env['ANCHOR_ENABLE_STREAMING_RESULTS'] === 'true',
  },

  // Low-Resource Mode (Standard 136)
  // Optimizations for devices with limited memory/CPU
  LOW_RESOURCE: {
    // Enable low-resource mode (default: false)
    ENABLED: process.env['ANCHOR_LOW_RESOURCE_MODE'] === 'true',
    // Reduce max recall at low memory (default: 5)
    MAX_RECALL_LOW: parseInt(process.env['ANCHOR_MAX_RECALL_LOW'] || '5', 10),
    // Reduce max recall at high memory (default: 20)
    MAX_RECALL_HIGH: parseInt(process.env['ANCHOR_MAX_RECALL_HIGH'] || '20', 10),
    // Reduce concurrent operations (default: 1)
    MAX_CONCURRENCY: parseInt(process.env['ANCHOR_MAX_CONCURRENCY'] || '1', 10),
    // Reduce search result batch size (default: 10)
    SEARCH_BATCH_SIZE: parseInt(process.env['ANCHOR_SEARCH_BATCH_SIZE'] || '10', 10),
    // Reduce ingestion batch size (default: 5)
    INGEST_BATCH_SIZE: parseInt(process.env['ANCHOR_INGEST_BATCH_SIZE'] || '5', 10),
    // Reduce vector ingest batch (default: 10)
    VECTOR_INGEST_BATCH: parseInt(process.env['ANCHOR_VECTOR_INGEST_BATCH'] || '10', 10),
  },

  // Ingestion Configuration (Agent-Controlled)
  // Configurable ingestion behavior for different content types
  INGESTION: {
    CONCEPT_DENSITY: (process.env['ANCHOR_CONCEPT_DENSITY'] as 'low' | 'medium' | 'high') || 'medium',
    TAG_THRESHOLD: parseFloat(process.env['ANCHOR_TAG_THRESHOLD'] || '0.7'),
    DEDUP_STRENGTH: (process.env['ANCHOR_DEDUP_STRENGTH'] as 'light' | 'medium' | 'aggressive') || 'medium',
    TOKEN_BUDGET_DEFAULT: parseInt(process.env['ANCHOR_TOKEN_BUDGET_DEFAULT'] || '2000', 10),
    INGESTION_PROFILE: (process.env['ANCHOR_INGESTION_PROFILE'] as 'code' | 'notes' | 'chat' | 'default') || 'default',
  },

  // Density Prefix — tier thresholds for external RAG pipeline dispatch
  DENSITY: {
    // mol_count >= LIGHT_DOC_THRESHOLD → concept is well-known, external RAG can use light retrieval
    LIGHT_DOC_THRESHOLD: parseInt(process.env['ANCHOR_DENSITY_LIGHT_THRESHOLD'] || '50', 10),
    // mol_count >= MEDIUM_DOC_THRESHOLD → moderate, balanced retrieval
    MEDIUM_DOC_THRESHOLD: parseInt(process.env['ANCHOR_DENSITY_MEDIUM_THRESHOLD'] || '5', 10),
    // Document limits to pass to external RAG pipeline per tier
    LIGHT_RAG_LIMIT: parseInt(process.env['ANCHOR_DENSITY_LIGHT_RAG_LIMIT'] || '10', 10),
    MEDIUM_RAG_LIMIT: parseInt(process.env['ANCHOR_DENSITY_MEDIUM_RAG_LIMIT'] || '25', 10),
    HEAVY_RAG_LIMIT: parseInt(process.env['ANCHOR_DENSITY_HEAVY_RAG_LIMIT'] || '0', 10), // 0 = all available
  },

  // Streaming Ingestion (Standard 024) — window-based file reading for >10 MB files
  STREAMING: {
    ENABLED: process.env['ANCHOR_STREAMING_ENABLED'] !== 'false',
    STREAM_THRESHOLD_BYTES: parseInt(process.env['ANCHOR_STREAM_THRESHOLD_BYTES'] || String(10 * 1024 * 1024), 10),
    WINDOW_BYTES: parseInt(process.env['ANCHOR_STREAM_WINDOW_BYTES'] || String(1 * 1024 * 1024), 10),
    LOOKAHEAD_BYTES: parseInt(process.env['ANCHOR_STREAM_LOOKAHEAD_BYTES'] || String(64 * 1024), 10),
    YIELD_INTERVAL_MS: parseInt(process.env['ANCHOR_STREAM_YIELD_MS'] || '0', 10),
  },

  // Worker Threads — experimental off-main-thread ingestion
  WORKER_THREADS: {
    ENABLED: process.env['ANCHOR_WORKER_ENABLED'] === 'true',
    MAX_WORKERS: parseInt(process.env['ANCHOR_WORKER_MAX'] || '1', 10),
    INGEST_QUEUE_MAX: parseInt(process.env['ANCHOR_WORKER_QUEUE'] || '100', 10),
  },

  // Cron Scheduler — periodic maintenance tasks
  CRON: {
    ENABLED: process.env['ANCHOR_CRON_ENABLED'] === 'true',
    DAILY_SCRAPE_HOUR: parseInt(process.env['ANCHOR_CRON_SCRAPE_HOUR'] || '3', 10),
    SYNONYM_REGENERATION_HOUR: parseInt(process.env['ANCHOR_CRON_SYNONYM_HOUR'] || '4', 10),
    DB_VACUUM_HOUR: parseInt(process.env['ANCHOR_CRON_VACUUM_HOUR'] || '5', 10),
    CACHE_PRUNE_INTERVAL_MINUTES: parseInt(process.env['ANCHOR_CRON_CACHE_PRUNE_MIN'] || '60', 10),
  },
};

// Configuration loader
/**
 * Priority: ~/.anchor/user_settings.json > ~/.anchor/sovereign.yaml > Defaults
 * All paths are defined in user_settings.json.template (single source of truth) and loaded into ~/.anchor/user_settings.json at runtime.
 */
function loadConfig(): Config {
  // Determine config file path
  // Priority: ~/.anchor/user_settings.json > ~/.anchor/sovereign.yaml > Defaults
  let loadedConfig = { ...DEFAULT_CONFIG };

  // 1. Try Loading sovereign.yaml (Legacy/System Config)
  const configPath = process.env.SOVEREIGN_CONFIG_PATH || PATHS.CONFIG_FILE;

  if (fs.existsSync(configPath)) {
    try {
      const configFile = fs.readFileSync(configPath, 'utf8');
      const parsedConfig = yaml.load(configFile) as Partial<Config>;
      loadedConfig = { ...loadedConfig, ...parsedConfig };
    } catch (error) {
      console.warn(`Failed to load config from ${configPath}:`, error);
    }
  }

  // 2. Try Loading user_settings.json (Highest Priority for User Overrides)
  // Primary: ~/.anchor/user_settings.json (user's home directory)
  const anchorSettingsPath = PATHS.USER_SETTINGS;

  if (fs.existsSync(anchorSettingsPath) && fs.statSync(anchorSettingsPath).isFile()) {
    try {
      const rawConfig = JSON.parse(fs.readFileSync(anchorSettingsPath, 'utf8'));
      // Validate against schema — throws ZodError on type mismatches (wrong port type, etc.)
      const parsed = _UserSettingsSchema.parse(rawConfig);
      console.log(`[Config] Loaded and validated settings from ${anchorSettingsPath}`);

      // Load LLM Settings (Provider + Model paths — single consolidated block)
      if (parsed.llm) {
        // Provider settings
        const llm = parsed.llm as any;
        if (llm.provider) loadedConfig.LLM_PROVIDER = llm.provider;
        if (llm.remote_url) loadedConfig.REMOTE_LLM_URL = llm.remote_url;
        if (llm.remote_model) loadedConfig.REMOTE_MODEL_NAME = llm.remote_model;
        if (llm.model_dir) loadedConfig.LLM_MODEL_DIR = llm.model_dir;

        // Main model
        if (llm.chat_model) loadedConfig.MODELS.MAIN.PATH = llm.chat_model;
        if (llm.gpu_layers !== undefined) loadedConfig.MODELS.MAIN.GPU_LAYERS = llm.gpu_layers;
        if (llm.ctx_size !== undefined) loadedConfig.MODELS.MAIN.CTX_SIZE = llm.ctx_size;
        if (llm.max_tokens !== undefined) loadedConfig.MODELS.MAIN.MAX_TOKENS = llm.max_tokens;

        // Orchestrator model
        if (llm.task_model) loadedConfig.MODELS.ORCHESTRATOR.PATH = llm.task_model;
        if (llm.orchestrator_ctx_size !== undefined) loadedConfig.MODELS.ORCHESTRATOR.CTX_SIZE = llm.orchestrator_ctx_size;
        if (llm.orchestrator_gpu_layers !== undefined) loadedConfig.MODELS.ORCHESTRATOR.GPU_LAYERS = llm.orchestrator_gpu_layers;
        if (llm.orchestrator_max_tokens !== undefined) loadedConfig.MODELS.ORCHESTRATOR.MAX_TOKENS = llm.orchestrator_max_tokens;

        // Vision model
        if (llm.vision_model) loadedConfig.MODELS.VISION.PATH = llm.vision_model;
        if (llm.vision_projector) loadedConfig.MODELS.VISION.PROJECTOR = llm.vision_projector;
        if (llm.vision_ctx_size !== undefined) loadedConfig.MODELS.VISION.CTX_SIZE = llm.vision_ctx_size;
        if (llm.vision_gpu_layers !== undefined) loadedConfig.MODELS.VISION.GPU_LAYERS = llm.vision_gpu_layers;
        if (llm.vision_max_tokens !== undefined) loadedConfig.MODELS.VISION.MAX_TOKENS = llm.vision_max_tokens;
      }

      // Load Search Settings (single consolidated block)
      if (parsed.search) {
        if (parsed.search.strategy) loadedConfig.SEARCH.strategy = parsed.search.strategy;
        if (parsed.search.hide_years_in_tags !== undefined) loadedConfig.SEARCH.hide_years_in_tags = parsed.search.hide_years_in_tags;
        if (parsed.search.whitelist) loadedConfig.SEARCH.whitelist = parsed.search.whitelist;
        if (parsed.search.max_chars_default !== undefined) loadedConfig.SEARCH.max_chars_default = parsed.search.max_chars_default;
        if (parsed.search.max_chars_limit !== undefined) loadedConfig.SEARCH.max_chars_limit = parsed.search.max_chars_limit;
        if (parsed.search.fts_window_size !== undefined) loadedConfig.SEARCH.fts_window_size = parsed.search.fts_window_size;
        if (parsed.search.fts_padding !== undefined) loadedConfig.SEARCH.fts_padding = parsed.search.fts_padding;
      }

      // Load Server Settings
      if (parsed.server) {
        const srv = parsed.server as any;
        if (srv.host) loadedConfig.HOST = srv.host;
        if (srv.port) loadedConfig.PORT = srv.port;
        if (srv.api_key !== undefined) loadedConfig.API_KEY = srv.api_key;
        if (srv.version !== undefined) loadedConfig.VERSION = srv.version;
      }

      // Load GitHub Settings
      if (parsed.github) {
        const gh = parsed.github as any;
        if (gh.token !== undefined) loadedConfig.GITHUB_TOKEN = gh.token;
      }

      // Load Resource Management Settings
      if (parsed.resource_management) {
        if (parsed.resource_management.gc_cooldown_ms !== undefined) loadedConfig.GC_COOLDOWN_MS = parsed.resource_management.gc_cooldown_ms;
        if (parsed.resource_management.max_atoms_in_memory !== undefined) loadedConfig.MAX_ATOMS_IN_MEMORY = parsed.resource_management.max_atoms_in_memory;
        if (parsed.resource_management.monitoring_interval_ms !== undefined) loadedConfig.MONITORING_INTERVAL_MS = parsed.resource_management.monitoring_interval_ms;
        if (parsed.resource_management.cache_ttl_ms !== undefined) loadedConfig.CACHE_TTL_MS = parsed.resource_management.cache_ttl_ms;
        if (parsed.resource_management.max_cache_size !== undefined) loadedConfig.MAX_CACHE_SIZE = parsed.resource_management.max_cache_size;
      }

      // Load Watcher Settings
      if (parsed.watcher) {
        if (parsed.watcher.debounce_ms !== undefined) loadedConfig.WATCHER_DEBOUNCE_MS = parsed.watcher.debounce_ms;
        if (parsed.watcher.stability_threshold_ms !== undefined) loadedConfig.WATCHER_STABILITY_THRESHOLD_MS = parsed.watcher.stability_threshold_ms;
        if (parsed.watcher.extra_paths) loadedConfig.WATCHER_EXTRA_PATHS = parsed.watcher.extra_paths;
        if (parsed.watcher.auto_start !== undefined) loadedConfig.WATCHER_AUTO_START = parsed.watcher.auto_start;
        if (parsed.watcher.wipe_mirrored_brain_on_shutdown !== undefined) loadedConfig.WATCHER_WIPE_MIRRORED_BRAIN_ON_SHUTDOWN = parsed.watcher.wipe_mirrored_brain_on_shutdown;
      }

      // Load Context Relevance Settings
      if (parsed.context) {
        const ctx = parsed.context as any;
        if (ctx.relevance_weight !== undefined) loadedConfig.CONTEXT_RELEVANCE_WEIGHT = ctx.relevance_weight;
        if (ctx.recency_weight !== undefined) loadedConfig.CONTEXT_RECENCY_WEIGHT = ctx.recency_weight;
      }

      // Load Service Settings
      if (parsed.services) {
        const svc = parsed.services as any;
        if (svc.vision_server_port !== undefined) loadedConfig.SERVICES.VISION_SERVER_PORT = svc.vision_server_port;
        if (svc.chat_server_port !== undefined) loadedConfig.SERVICES.CHAT_SERVER_PORT = svc.chat_server_port;
        if (svc.tag_infector_unload_timeout !== undefined) loadedConfig.SERVICES.TAG_INFECTOR_UNLOAD_TIMEOUT = svc.tag_infector_unload_timeout;
        if (svc.tag_gliner_check_interval !== undefined) loadedConfig.SERVICES.TAG_GLINER_CHECK_INTERVAL = svc.tag_gliner_check_interval;
      }

      // Load Database Settings
      if (parsed.database) {
        if (parsed.database.wipe_on_startup !== undefined) loadedConfig.DATABASE.WIPE_ON_STARTUP = parsed.database.wipe_on_startup;
        if (parsed.database.wipe_on_shutdown !== undefined) loadedConfig.DATABASE.WIPE_ON_SHUTDOWN = parsed.database.wipe_on_shutdown;
        if (parsed.database.shared_buffers_mb !== undefined) loadedConfig.DATABASE.SHARED_BUFFERS_MB = parsed.database.shared_buffers_mb;
        if (parsed.database.effective_cache_size_mb !== undefined) loadedConfig.DATABASE.EFFECTIVE_CACHE_SIZE_MB = parsed.database.effective_cache_size_mb;
        if (parsed.database.work_mem_mb !== undefined) loadedConfig.DATABASE.WORK_MEM_MB = parsed.database.work_mem_mb;
        if (parsed.database.maintenance_work_mem_mb !== undefined) loadedConfig.DATABASE.MAINTENANCE_WORK_MEM_MB = parsed.database.maintenance_work_mem_mb;
      }

      // Load Limits and Thresholds
      if (parsed.limits) {
        if (parsed.limits.max_file_size_bytes !== undefined) loadedConfig.LIMITS.MAX_FILE_SIZE_BYTES = parsed.limits.max_file_size_bytes;
        if (parsed.limits.max_content_length_chars !== undefined) loadedConfig.LIMITS.MAX_CONTENT_LENGTH_CHARS = parsed.limits.max_content_length_chars;
        if (parsed.limits.max_chunk_size_chars !== undefined) loadedConfig.LIMITS.MAX_CHUNK_SIZE_CHARS = parsed.limits.max_chunk_size_chars;
        if (parsed.limits.max_summary_length_chars !== undefined) loadedConfig.LIMITS.MAX_SUMMARY_LENGTH_CHARS = parsed.limits.max_summary_length_chars;
        if (parsed.limits.date_extractor_scan_limit !== undefined) loadedConfig.LIMITS.DATE_EXTRACTOR_SCAN_LIMIT = parsed.limits.date_extractor_scan_limit;
      }

      // Load Memory Management Settings (Standard 127/134/135)
      if (parsed.memory) {
        if (parsed.memory.heap_pressure_mb !== undefined) loadedConfig.MEMORY.HEAP_PRESSURE_MB = parsed.memory.heap_pressure_mb;
        if (parsed.memory.throttle_start_mb !== undefined) loadedConfig.MEMORY.THROTTLE_START_MB = parsed.memory.throttle_start_mb;
        if (parsed.memory.throttle_max_mb !== undefined) loadedConfig.MEMORY.THROTTLE_MAX_MB = parsed.memory.throttle_max_mb;
        if (parsed.memory.emergency_stop_mb !== undefined) loadedConfig.MEMORY.EMERGENCY_STOP_MB = parsed.memory.emergency_stop_mb;
        if (parsed.memory.search_results_batch_size !== undefined) loadedConfig.MEMORY.SEARCH_RESULTS_BATCH_SIZE = parsed.memory.search_results_batch_size;
        if (parsed.memory.enable_streaming_results !== undefined) loadedConfig.MEMORY.ENABLE_STREAMING_RESULTS = parsed.memory.enable_streaming_results;
      }

      // Load Low-Resource Mode Settings (Standard 136)
      if (parsed.low_resource) {
        if (parsed.low_resource.enabled !== undefined) loadedConfig.LOW_RESOURCE.ENABLED = parsed.low_resource.enabled;
        if (parsed.low_resource.max_recall_low !== undefined) loadedConfig.LOW_RESOURCE.MAX_RECALL_LOW = parsed.low_resource.max_recall_low;
        if (parsed.low_resource.max_recall_high !== undefined) loadedConfig.LOW_RESOURCE.MAX_RECALL_HIGH = parsed.low_resource.max_recall_high;
        if (parsed.low_resource.max_concurrency !== undefined) loadedConfig.LOW_RESOURCE.MAX_CONCURRENCY = parsed.low_resource.max_concurrency;
        if (parsed.low_resource.search_batch_size !== undefined) loadedConfig.LOW_RESOURCE.SEARCH_BATCH_SIZE = parsed.low_resource.search_batch_size;
        if (parsed.low_resource.ingest_batch_size !== undefined) loadedConfig.LOW_RESOURCE.INGEST_BATCH_SIZE = parsed.low_resource.ingest_batch_size;
        if (parsed.low_resource.vector_ingest_batch !== undefined) loadedConfig.LOW_RESOURCE.VECTOR_INGEST_BATCH = parsed.low_resource.vector_ingest_batch;
      }

      // Load Ingestion Configuration (Agent-Controlled)
      if (parsed.ingestion) {
        const igs = parsed.ingestion as any;
        if (igs.concept_density) loadedConfig.INGESTION.CONCEPT_DENSITY = igs.concept_density;
        if (igs.tag_threshold !== undefined) loadedConfig.INGESTION.TAG_THRESHOLD = igs.tag_threshold;
        if (igs.dedup_strength) loadedConfig.INGESTION.DEDUP_STRENGTH = igs.dedup_strength;
        if (igs.token_budget_default !== undefined) loadedConfig.INGESTION.TOKEN_BUDGET_DEFAULT = igs.token_budget_default;
        if (igs.ingestion_profile) loadedConfig.INGESTION.INGESTION_PROFILE = igs.ingestion_profile;
      }

      // Load Density Configuration — tier thresholds for external RAG pipeline dispatch
      if (parsed.density) {
        const dy = parsed.density as any;
        if (dy.light_doc_threshold !== undefined) loadedConfig.DENSITY.LIGHT_DOC_THRESHOLD = dy.light_doc_threshold;
        if (dy.medium_doc_threshold !== undefined) loadedConfig.DENSITY.MEDIUM_DOC_THRESHOLD = dy.medium_doc_threshold;
        if (dy.light_rag_limit !== undefined) loadedConfig.DENSITY.LIGHT_RAG_LIMIT = dy.light_rag_limit;
        if (dy.medium_rag_limit !== undefined) loadedConfig.DENSITY.MEDIUM_RAG_LIMIT = dy.medium_rag_limit;
        if (dy.heavy_rag_limit !== undefined) loadedConfig.DENSITY.HEAVY_RAG_LIMIT = dy.heavy_rag_limit;
      }

      // Load Cache Settings (LRU Cache Configuration)
      if (parsed.cache) {
        const c = parsed.cache as any;
        if (c.max_entries_search_result !== undefined) loadedConfig.CACHE.MAX_ENTRIES_SEARCH_RESULT = c.max_entries_search_result;
        if (c.max_entries_query_parse !== undefined) loadedConfig.CACHE.MAX_ENTRIES_QUERY_PARSE = c.max_entries_query_parse;
        if (c.max_entries_semantic_expansion !== undefined) loadedConfig.CACHE.MAX_ENTRIES_SEMANTIC_EXPANSION = c.max_entries_semantic_expansion;
        if (c.max_entries_engram !== undefined) loadedConfig.CACHE.MAX_ENTRIES_ENGRAM = c.max_entries_engram;
        if (c.memory_pressure_threshold !== undefined) loadedConfig.CACHE.MEMORY_PRESSURE_THRESHOLD = c.memory_pressure_threshold;
        if (c.critical_memory_threshold !== undefined) loadedConfig.CACHE.CRITICAL_MEMORY_THRESHOLD = c.critical_memory_threshold;
        if (c.enable_memory_pressure_eviction !== undefined) loadedConfig.CACHE.ENABLE_MEMORY_PRESSURE_EVICTION = c.enable_memory_pressure_eviction;
        if (c.search_result_ttl_ms !== undefined) loadedConfig.CACHE.SEARCH_RESULT_TTL_MS = c.search_result_ttl_ms;
        if (c.query_parse_ttl_ms !== undefined) loadedConfig.CACHE.QUERY_PARSE_TTL_MS = c.query_parse_ttl_ms;
        if (c.semantic_expansion_ttl_ms !== undefined) loadedConfig.CACHE.SEMANTIC_EXPANSION_TTL_MS = c.semantic_expansion_ttl_ms;
        if (c.engram_ttl_ms !== undefined) loadedConfig.CACHE.ENGRAM_TTL_MS = c.engram_ttl_ms;
      }

      // Load Streaming Configuration
      if (parsed.streaming) {
        const s = parsed.streaming as any;
        if (s.enabled !== undefined) loadedConfig.STREAMING.ENABLED = s.enabled;
        if (s.stream_threshold_bytes !== undefined) loadedConfig.STREAMING.STREAM_THRESHOLD_BYTES = s.stream_threshold_bytes;
        if (s.window_bytes !== undefined) loadedConfig.STREAMING.WINDOW_BYTES = s.window_bytes;
        if (s.lookahead_bytes !== undefined) loadedConfig.STREAMING.LOOKAHEAD_BYTES = s.lookahead_bytes;
        if (s.yield_interval_ms !== undefined) loadedConfig.STREAMING.YIELD_INTERVAL_MS = s.yield_interval_ms;
      }

      // Load Worker Threads Configuration
      if (parsed.worker_threads) {
        const w = parsed.worker_threads as any;
        if (w.enabled !== undefined) loadedConfig.WORKER_THREADS.ENABLED = w.enabled;
        if (w.max_workers !== undefined) loadedConfig.WORKER_THREADS.MAX_WORKERS = w.max_workers;
        if (w.ingest_queue_max !== undefined) loadedConfig.WORKER_THREADS.INGEST_QUEUE_MAX = w.ingest_queue_max;
      }

      // Load Cron Configuration
      if (parsed.cron) {
        const cr = parsed.cron as any;
        if (cr.enabled !== undefined) loadedConfig.CRON.ENABLED = cr.enabled;
        if (cr.daily_scrape_hour !== undefined) loadedConfig.CRON.DAILY_SCRAPE_HOUR = cr.daily_scrape_hour;
        if (cr.synonym_regeneration_hour !== undefined) loadedConfig.CRON.SYNONYM_REGENERATION_HOUR = cr.synonym_regeneration_hour;
        if (cr.db_vacuum_hour !== undefined) loadedConfig.CRON.DB_VACUUM_HOUR = cr.db_vacuum_hour;
        if (cr.cache_prune_interval_minutes !== undefined) loadedConfig.CRON.CACHE_PRUNE_INTERVAL_MINUTES = cr.cache_prune_interval_minutes;
      }

      // Load Distiller Configuration (v2.1)
      if (parsed.distiller) {
        const d = parsed.distiller as any;
        if (d.similarity_threshold !== undefined) loadedConfig.DISTILLER.SIMILARITY_THRESHOLD = d.similarity_threshold;
        if (d.output_format) loadedConfig.DISTILLER.OUTPUT_FORMAT = d.output_format;
      }

      // Load Distillation batch processing config
      if (parsed.distillation) {
        const ds = parsed.distillation as any;
        if (ds.batch_size !== undefined) loadedConfig.DISTILLATION.BATCH_SIZE = ds.batch_size;
        if (ds.batch_ceiling !== undefined) loadedConfig.DISTILLATION.BATCH_CEILING = ds.batch_ceiling;
        if (ds.heap_fraction !== undefined) loadedConfig.DISTILLATION.HEAP_FRACTION = ds.heap_fraction;
        if (ds.bytes_per_molecule !== undefined) loadedConfig.DISTILLATION.BYTES_PER_MOLECULE = ds.bytes_per_molecule;
        if (ds.batch_floor !== undefined) loadedConfig.DISTILLATION.BATCH_FLOOR = ds.batch_floor;
      }

    } catch (e: any) {
      // Check if this is a Zod validation error
      if (e instanceof z.ZodError) {
        console.error('[Config] Invalid configuration in user_settings.json:');
        // ZodError.errors is available in Zod 3.x but not in 4.x
        // In Zod 4.x, use e.flatten() or iterate over issues
        const issues = (e as any).issues || (e as any).flatten?.().errors || [];
        if (issues.length > 0) {
          issues.forEach((err: any) => {
            console.error(`  - ${err.path?.join('.') || 'unknown'}: ${err.message}`);
          });
        }
        console.error('[Config] Please fix the configuration file and restart.');
      } else {
        console.error('[Config] Failed to parse user_settings.json:', e);
      }
    }
  }

  return loadedConfig;
}

// Export configuration
export const config = loadConfig();

export default config;

// Export PATHS for modules that need it
export { PATHS } from './paths.js';