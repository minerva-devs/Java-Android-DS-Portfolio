/**
 * Request Validation Middleware
 * 
 * Lightweight JSON schema validation for API endpoints.
 * No external dependencies — uses a simple declarative schema format.
 * 
 * Usage:
 *   import { validate, schemas } from './middleware/validate.js';
 *   app.post('/v1/ingest', validate(schemas.ingest), handler);
 */

import type { Request, Response, NextFunction } from 'express';

interface FieldSchema {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  itemType?: string;
  properties?: Record<string, FieldSchema>;
}

/**
 * Validate a value against a field schema
 */
function validateField(field: string, value: any, schema: FieldSchema): string | null {
  if (value === undefined || value === null) {
    if (schema.required) return `'${field}' is required`;
    return null; // optional and missing — ok
  }

  // Type check
  if (schema.type === 'array') {
    if (!Array.isArray(value)) return `'${field}' must be an array`;
    if (schema.itemType) {
      for (let i = 0; i < value.length; i++) {
        if (typeof value[i] !== schema.itemType) {
          return `'${field}[${i}]' must be of type '${schema.itemType}'`;
        }
      }
    }
  } else if (typeof value !== schema.type) {
    return `'${field}' must be of type '${schema.type}', got '${typeof value}'`;
  }

  // String constraints
  if (schema.type === 'string') {
    if (schema.minLength !== undefined && value.length < schema.minLength) {
      return `'${field}' must be at least ${schema.minLength} characters`;
    }
    if (schema.maxLength !== undefined && value.length > schema.maxLength) {
      return `'${field}' must be at most ${schema.maxLength} characters`;
    }
  }

  // Number constraints
  if (schema.type === 'number') {
    if (schema.min !== undefined && value < schema.min) {
      return `'${field}' must be >= ${schema.min}`;
    }
    if (schema.max !== undefined && value > schema.max) {
      return `'${field}' must be <= ${schema.max}`;
    }
  }

  return null;
}

/**
 * Create validation middleware from a body schema
 */
export function validate(schema: Record<string, FieldSchema>) {
  return (req: Request, res: Response, next: NextFunction) => {
    const errors: string[] = [];

    for (const [field, fieldSchema] of Object.entries(schema)) {
      const error = validateField(field, req.body[field], fieldSchema);
      if (error) errors.push(error);
    }

    if (errors.length > 0) {
      res.status(400).json({
        error: 'Validation failed',
        details: errors,
      });
      return;
    }

    next();
  };
}

/**
 * Pre-defined schemas for common API endpoints
 */
export const schemas: Record<string, Record<string, FieldSchema>> = {
  /** POST /v1/ingest */
  ingest: {
    content: { type: 'string', required: true, minLength: 1 },
    source: { type: 'string', required: false },
    type: { type: 'string', required: false },
    bucket: { type: 'string', required: false },
    buckets: { type: 'array', required: false, itemType: 'string' },
    tags: { type: 'array', required: false, itemType: 'string' },
  },

  /** POST /v1/memory/search */
  memorySearch: {
    query: { type: 'string', required: true, minLength: 1 },
    buckets: { type: 'array', required: false, itemType: 'string' },
    tags: { type: 'array', required: false, itemType: 'string' },
    max_chars: { type: 'number', required: false, min: 1 },
    code_weight: { type: 'number', required: false, min: 0, max: 1 },
  },

  /** POST /v1/memory/distill */
  memoryDistill: {
    seed: { type: 'object', required: false, properties: {
      query: { type: 'string', required: true, minLength: 1 },
      compound_ids: { type: 'array', required: false, itemType: 'string' },
      buckets: { type: 'array', required: false, itemType: 'string' },
      tags: { type: 'array', required: false, itemType: 'string' },
    } },
    radius: { type: 'number', required: false, min: 1, max: 10 },
    max_radius: { type: 'number', required: false, min: 1, max: 20 },
    output_format: { type: 'string', required: false },
    output_path: { type: 'string', required: false },
  },

  /** POST /v1/memory/explore */
  memoryExplore: {
    seed: { type: 'string', required: true, minLength: 1 },
    depth: { type: 'number', required: false, min: 1, max: 10 },
    max_nodes: { type: 'number', required: false, min: 1, max: 1000 },
  },

  /** POST /v1/github/repos */
  githubRepos: {
    url: { type: 'string', required: true, minLength: 1 },
    bucket: { type: 'string', required: false },  // Auto-generated from URL if not provided
    include_history: { type: 'boolean', required: false },
  },

  /** POST /v1/terminal/exec */
  terminalExec: {
    command: { type: 'string', required: true, minLength: 1, maxLength: 1000 },
    cwd: { type: 'string', required: false },
    timeout: { type: 'number', required: false, min: 1000, max: 30000 },
  },

  /** POST /v1/config/ingestion */
  configIngestion: {
    concept_density: { type: 'string', required: false },
    tag_threshold: { type: 'number', required: false, min: 0, max: 1 },
    dedup_strength: { type: 'string', required: false },
    token_budget_default: { type: 'number', required: false, min: 100, max: 10000 },
    ingestion_profile: { type: 'string', required: false },
  },

  /** POST /v1/chat/completions */
  chatCompletions: {
    messages: { type: 'array', required: true },
    model: { type: 'string', required: false },
    temperature: { type: 'number', required: false, min: 0, max: 2 },
    max_tokens: { type: 'number', required: false, min: 1, max: 128000 },
  },

  /** POST /v1/model/load */
  modelLoad: {
    model: { type: 'string', required: true, minLength: 1 },
  },

  /** POST /v1/research/scrape */
  researchScrape: {
    url: { type: 'string', required: true, minLength: 1 },
  },

  /** POST /v1/engine/switch */
  engineSwitch: {
    engine: { type: 'string', required: true, minLength: 1 },
  },
};
