/**
 * Provenance Utilities for Sovereign Context Engine
 *
 * This module provides utilities for extracting and managing provenance metadata
 * from file paths, replacing the compounds table's provenance field.
 */

import * as path from 'path';
import { pathManager } from '../utils/path-manager.js';
import crypto from 'crypto';

export interface ProvenanceData {
  /** Unique identifier for this provenance record */
  id: string;
  /** File path (normalized) */
  source_path: string;
  /** Original file path as provided */
  original_path?: string;
  /** Byte offset start (if applicable) */
  byte_offset_start?: number;
  /** Byte offset end (if applicable) */
  byte_offset_end?: number;
  /** Additional metadata from file content or external sources */
  extra_metadata?: Record<string, unknown>;
  /** Timestamp when provenance was created */
  timestamp: number;
}

/**
 * Extract provenance data from a file path.
 * 
 * This function extracts meaningful metadata from file paths to create
 * a provenance record that can be stored in the molecules/atoms tables.
 * 
 * @param filePath - The file path to extract provenance from
 * @returns ProvenanceData object with extracted information
 */
export function extractProvenance(filePath: string): ProvenanceData {
  const normalizedPath = pathManager.normalizePath(filePath);
  
  // Extract components from path
  const parts = normalizedPath.split(path.sep).filter(p => p.length > 0);
  const fileName = parts.pop() || '';
  const directory = parts.join(path.sep) || '';
  
  // Generate unique ID based on path (or use provided ID)
  const id = filePath.replace(/[^a-zA-Z0-9]/g, '_');
  
  return {
    id,
    source_path: normalizedPath,
    original_path: filePath,
    timestamp: Date.now(),
    // byte_offset_start and byte_offset_end would be set during molecule parsing
  };
}

/**
 * Create provenance record for a molecular chunk.
 * 
 * @param filePath - Path to the source file
 * @param content - Content of this molecular chunk
 * @param startByte - Start byte offset in the file
 * @param endByte - End byte offset in the file
 * @returns ProvenanceData object ready for storage
 */
export function createMoleculeProvenance(
  filePath: string,
  content: string,
  startByte: number,
  endByte: number
): ProvenanceData {
  const normalizedPath = pathManager.normalizePath(filePath);
  
  // Extract provenance from file path
  const parts = normalizedPath.split(path.sep).filter(p => p.length > 0);
  const fileName = parts.pop() || '';
  const directory = parts.join(path.sep) || '';
  
  return {
    id: `${fileName}_${startByte}_${endByte}`,
    source_path: normalizedPath,
    original_path: filePath,
    byte_offset_start: startByte,
    byte_offset_end: endByte,
    extra_metadata: {
      directory,
      filename: fileName,
      content_length: content.length,
      // Could add more extraction here (e.g., from file extension)
    },
    timestamp: Date.now(),
  };
}

/**
 * Create provenance record for an atom.
 * 
 * @param filePath - Path to the source file
 * @param content - Content of this atomic chunk
 * @returns ProvenanceData object ready for storage
 */
export function createAtomProvenance(
  filePath: string,
  content: string
): ProvenanceData {
  const normalizedPath = pathManager.normalizePath(filePath);
  
  // Extract provenance from file path
  const parts = normalizedPath.split(path.sep).filter(p => p.length > 0);
  const fileName = parts.pop() || '';
  const directory = parts.join(path.sep) || '';
  
  return {
    id: `${fileName}_atom`,
    source_path: normalizedPath,
    original_path: filePath,
    extra_metadata: {
      directory,
      filename: fileName,
      content_length: content.length,
    },
    timestamp: Date.now(),
  };
}

/**
 * Validate provenance data before insertion.
 * 
 * @param provenance - ProvenanceData object to validate
 * @throws Error if validation fails
 */
export function validateProvenance(provenance: ProvenanceData): void {
  if (!provenance.id) {
    throw new Error('Provenance must have an id');
  }
  
  if (!provenance.source_path) {
    throw new Error('Provenance must have a source_path');
  }
  
  // Validate byte offsets are consistent
  if (provenance.byte_offset_start !== undefined && 
      provenance.byte_offset_end !== undefined) {
    if (provenance.byte_offset_end < provenance.byte_offset_start) {
      throw new Error('byte_offset_end must be >= byte_offset_start');
    }
  }
}

/**
 * Extract provenance from a compound record (for migration).
 * 
 * This is used during the compounds table removal to extract
 * provenance data that needs to be migrated.
 * 
 * @param compound - Compound record from database
 * @returns ProvenanceData object with compound's provenance
 */
export function extractCompoundProvenance(compound: {
  id: string;
  path: string;
  provenance?: string;
  molecular_signature?: string;
}): ProvenanceData {
  return {
    id: compound.id,
    source_path: compound.path || '',
    original_path: compound.path,
    extra_metadata: {
      provenance: compound.provenance,
      molecular_signature: compound.molecular_signature,
    },
    timestamp: Date.now(),
  };
}

/**
 * Parse file path to extract directory and filename components.
 * 
 * @param filePath - File path to parse
 * @returns Object with directory, filename, and extension
 */
export function parseFilePath(filePath: string): {
  directory: string;
  filename: string;
  extension?: string;
} {
  const normalizedPath = pathManager.normalizePath(filePath);
  const parts = normalizedPath.split(path.sep).filter(p => p.length > 0);
  
  let filename = '';
  let extension = undefined;
  
  if (parts.length > 0) {
    filename = parts.pop() || '';
    const dotIndex = filename.lastIndexOf('.');
    if (dotIndex > 0) {
      extension = filename.substring(dotIndex + 1);
      filename = filename.substring(0, dotIndex);
    }
  }
  
  const directory = parts.join(path.sep) || '';
  
  return { directory, filename, extension };
}

/**
 * Generate a consistent ID from path and content.
 * 
 * @param filePath - File path
 * @param contentHash - Hash of content (for deduplication)
 * @returns Consistent identifier
 */
export function generateConsistentId(
  filePath: string,
  contentHash: string
): string {
  const normalizedPath = pathManager.normalizePath(filePath);
  const hash = crypto.createHash('sha256')
    .update(normalizedPath + contentHash)
    .digest('hex');
  
  // Use first 16 chars for ID (sufficient for uniqueness in our use case)
  return hash.substring(0, 16);
}

// Export pathManager for testing if needed
export { pathManager } from '../utils/path-manager.js';