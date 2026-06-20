/**
 * Write Content to Mirror Helper
 * 
 * Wraps writeMirroredFile with provenance detection from source path.
 * Called after successful compound storage in ingestion route.
 */

import { writeMirroredFile } from './mirror.js';

/**
 * Write ingested file content to the mirror directory.
 * Automatically determines provenance (internal/external/quarantine) from source path.
 * 
 * @param originalFilePath - The original file path as stored in database (e.g., "inbox/my-notes.md")
 * @param rawContent - The raw file content to write
 * @returns Promise that resolves when content is written to mirror
 */
export async function writeContentToMirror(
    originalFilePath: string,
    rawContent: string,
): Promise<void> {
    // Determine provenance from source path
    const provenance = determineProvenance(originalFilePath);

    // Only log minimal info - never log the actual content
    console.log(`[writeContentToMirror] Writing to mirror:`);
    console.log(`  - Source path: ${originalFilePath}`);
    console.log(`  - Provenance: ${provenance}`);
    console.log(`  - Content length: ${rawContent.length} chars`);

    // Call the underlying writeMirroredFile with provenance detection
    await writeMirroredFile(originalFilePath, rawContent, provenance);
}

/**
 * Determine provenance type from source file path.
 * 
 * @param filePath - Source file path (e.g., "inbox/my-notes.md", "external-inbox/web-page.html")
 * @returns Provenance type: 'internal', 'external', or 'quarantine'
 */
function determineProvenance(filePath: string): 'internal' | 'external' | 'quarantine' {
    if (filePath.includes('quarantine')) {
        return 'quarantine';
    }
    if (filePath.includes('external-inbox') || filePath.includes('external_inbox')) {
        return 'external';
    }
    // Default to internal for inbox and other standard locations
    return 'internal';
}
