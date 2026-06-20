#!/usr/bin/env node
/**
 * Test Metadata Logger
 * 
 * Provides utilities for logging search and distillation metadata
 * during tests. This allows full control over what data is captured
 * and ensures proper formatting is being utilized.
 * 
 * Usage in tests:
 *   import { logSearchEvent, logDistillationEvent } from '../tests/test-metadata.js';
 *   
 *   // Log a search
 *   const searchResult = await engine.search(query);
 *   logSearchEvent({
 *     query,
 *     results: searchResult,
 *     duration: searchDuration,
 *     strategy: 'standard',
 *   });
 *   
 *   // Log distillation
 *   const distillationResult = await engine.distill();
 *   logDistillationEvent({
 *     type: 'radial',
 *     results: distillationResult,
 *     duration: distillationDuration,
 *   });
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LOGS_DIR = path.join(__dirname, '..', 'logs', 'tests');

// Ensure logs directory exists
if (!fs.existsSync(LOGS_DIR)) {
  fs.mkdirSync(LOGS_DIR, { recursive: true });
}

/**
 * Log a search event with full metadata
 */
export function logSearchEvent(metadata) {
  const logEntry = {
    type: 'SEARCH_EVENT',
    timestamp: metadata.timestamp || new Date().toISOString(),
    ...metadata,
    formattedResults: formatValue(metadata.results),
  };

  writeMetadataLog('search', logEntry);
}

/**
 * Log a distillation event with full metadata
 */
export function logDistillationEvent(metadata) {
  const logEntry = {
    type: 'DISTILLATION_EVENT',
    timestamp: metadata.timestamp || new Date().toISOString(),
    ...metadata,
    formattedResults: formatValue(metadata.results),
  };

  writeMetadataLog('distillation', logEntry);
}

/**
 * Log any custom metadata
 */
export function logCustomEvent(type, data) {
  const logEntry = {
    type,
    timestamp: new Date().toISOString(),
    data: formatValue(data),
  };

  writeMetadataLog('custom', logEntry);
}

/**
 * Write metadata to a consolidated log file
 */
function writeMetadataLog(category, entry) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  const hash = createHash('md5').update(JSON.stringify(entry)).digest('hex').slice(0, 8);
  const logFile = path.join(LOGS_DIR, `${category}-metadata-${timestamp}-${hash}.log`);

  // Append to log file
  fs.appendFileSync(logFile, JSON.stringify(entry, null, 2) + '\n', 'utf-8');
}

/**
 * Get all search events from logs
 */
export function getSearchEvents() {
  const events = [];
  
  try {
    const files = fs.readdirSync(LOGS_DIR);
    
    for (const file of files) {
      if (!file.startsWith('search-metadata-')) continue;
      
      const filePath = path.join(LOGS_DIR, file);
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n').filter(line => line.trim());
      
      for (const line of lines) {
        try {
          const entry = JSON.parse(line);
          if (entry.type === 'SEARCH_EVENT') {
            events.push(entry);
          }
        } catch {
          // Skip invalid JSON lines
        }
      }
    }
  } catch (e) {
    console.error('Failed to read search events:', e);
  }
  
  return events;
}

/**
 * Get all distillation events from logs
 */
export function getDistillationEvents() {
  const events = [];
  
  try {
    const files = fs.readdirSync(LOGS_DIR);
    
    for (const file of files) {
      if (!file.startsWith('distillation-metadata-')) continue;
      
      const filePath = path.join(LOGS_DIR, file);
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n').filter(line => line.trim());
      
      for (const line of lines) {
        try {
          const entry = JSON.parse(line);
          if (entry.type === 'DISTILLATION_EVENT') {
            events.push(entry);
          }
        } catch {
          // Skip invalid JSON lines
        }
      }
    }
  } catch (e) {
    console.error('Failed to read distillation events:', e);
  }
  
  return events;
}

/**
 * Format a value for safe logging
 */
function formatValue(value, maxDepth = 3) {
  if (typeof value === 'string') {
    // Truncate long strings
    return value.length > 1000 ? value.substring(0, 1000) + '...' : value;
  }
  
  if (value instanceof Error) {
    return { message: value.message, stack: value.stack };
  }
  
  if (typeof value === 'object' && value !== null) {
    if (maxDepth <= 0) return '[Object]';
    
    // Handle arrays
    if (Array.isArray(value)) {
      return value.slice(0, 100).map(item => formatValue(item, maxDepth - 1));
    }
    
    // Handle objects
    const result = {};
    for (const [key, val] of Object.entries(value)) {
      if (key === 'stack' || key === '__v') continue; // Skip Vue/dev tools
      result[key] = formatValue(val, maxDepth - 1);
    }
    return result;
  }
  
  return value;
}

/**
 * Export for use in test files
 */
export default {
  logSearchEvent,
  logDistillationEvent,
  logCustomEvent,
  getSearchEvents,
  getDistillationEvents,
};
