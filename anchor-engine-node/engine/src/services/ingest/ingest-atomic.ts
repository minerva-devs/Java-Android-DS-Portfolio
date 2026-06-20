import { db } from '../../core/db.js';
import { config } from '../../config/index.js';
import type { Atom, Molecule, Compound } from '../../types/atomic.js';
import { filterTags } from '../../utils/tag-filter.js';
import { modulateTags, normalizeTag } from '../../utils/tag-modulation.js';
import { getMirrorPath } from '../mirror/mirror.js';
import * as fs from 'fs';

export class AtomicIngestService {

    async cleanupSourcePath(sourcePath: string) {
        const likePattern = `${sourcePath}#%`;
        console.log(`[AtomicIngest] 🧹 Cleaning up database records for: ${sourcePath}`);
        
        await db.transaction(async () => {
            // Delete tags
            await db.run(
                `DELETE FROM tags WHERE atom_id IN (SELECT id FROM atoms WHERE source_path = $1 OR source_path LIKE $2)`,
                [sourcePath, likePattern]
            );
            
            // Delete edges
            await db.run(
                `DELETE FROM edges WHERE source_id IN (SELECT id FROM atoms WHERE source_path = $1 OR source_path LIKE $2) 
                 OR target_id IN (SELECT id FROM atoms WHERE source_path = $1 OR source_path LIKE $2)`,
                [sourcePath, likePattern]
            );
            
            // Delete atom positions
            await db.run(
                `DELETE FROM atom_positions WHERE compound_id IN (SELECT id FROM atoms WHERE source_path = $1 OR source_path LIKE $2)`,
                [sourcePath, likePattern]
            );
            
            // Delete molecules
            await db.run(
                `DELETE FROM molecules WHERE source_path = $1 OR source_path LIKE $2`,
                [sourcePath, likePattern]
            );
            
            // Delete atoms
            await db.run(
                `DELETE FROM atoms WHERE source_path = $1 OR source_path LIKE $2`,
                [sourcePath, likePattern]
            );
        });
        console.log(`[AtomicIngest] 🧹 Database clean for: ${sourcePath} complete`);
    }

    /**
     * Hot Slotting Purge — Remove ALL database records associated with a directory.
     * This is the "un-ingest" operation for removing watched paths.
     */
    async purgeDirectory(dirPath: string): Promise<{ path: string; atoms: number; molecules: number; edges: number; tags: number; sources: number; files_cleaned: number }> {
        const likePattern = `${dirPath.replace(/\\/g, '/')}/%`;
        const summary = { path: dirPath, atoms: 0, molecules: 0, edges: 0, tags: 0, sources: 0, files_cleaned: 0 };

        await db.transaction(async () => {
            // Step 1: Get all atoms under this directory (needed for edge/position deletion)
            const atoms = await db.run(
                `SELECT id FROM atoms WHERE source_path LIKE $1`,
                [likePattern]
            );
            const atomIds = Array.isArray(atoms?.results) ? atoms.results.map((a: any) => a.id) : [];

            // Step 2: Delete edges referencing those atoms (both directions)
            if (atomIds.length) {
                const placeholders = atomIds.map((_: any, i: number) => `$${i + 1}`).join(',');
                await db.run(`DELETE FROM edges WHERE source_id IN (${placeholders}) OR target_id IN (${placeholders})`, atomIds.concat(atomIds));
                summary.edges = atomIds.length; // rough count based on atoms
            }

            // Step 3: Delete atom_positions (via molecules/compounds)
            if (atomIds.length) {
                const placeholders = atomIds.map((_: any, i: number) => `$${i + 1}`).join(',');
                await db.run(`DELETE FROM atom_positions WHERE compound_id IN (${placeholders})`, atomIds);
            }

            // Step 4: Delete tags (via atoms)
            const tagsResult = await db.run(
                `DELETE FROM tags WHERE atom_id IN (SELECT id FROM atoms WHERE source_path LIKE $1)`,
                [likePattern]
            );
            summary.tags = tagsResult?.changes ?? 0;

            // Step 5: Delete molecules
            const moleculesResult = await db.run(
                `DELETE FROM molecules WHERE source_path LIKE $1`,
                [likePattern]
            );
            summary.molecules = moleculesResult.changes ?? 0;

            // Step 6: Delete atoms
            const atomsResult = await db.run(
                `DELETE FROM atoms WHERE source_path LIKE $1`,
                [likePattern]
            );
            summary.atoms = atomsResult.changes ?? 0;

            // Step 7: Delete source records (path trackers)
            const sourcesResult = await db.run(
                `DELETE FROM sources WHERE path LIKE $1`,
                [likePattern]
            );
            summary.sources = sourcesResult.changes ?? 0;
        });

        // 🔥 FILESYSTEM CLEANUP: Remove mirrored_brain/ files for this path
        summary.files_cleaned = await this.cleanupMirroredFiles(dirPath);

        console.log(`[AtomicIngest] 🧹 Purged directory "${dirPath}": ${summary.atoms} atoms, ${summary.molecules} molecules, ${summary.files_cleaned} mirrored files`);
        return summary;
    }

    /**
     * Filesystem Cleanup — Delete all mirrored_brain/ files associated with a source path.
     * This ensures complete cleanup of the "tangible knowledge graph" alongside database purge.
     */
    private async cleanupMirroredFiles(dirPath: string): Promise<number> {
        const normalized = dirPath.replace(/\\/g, '/');
        const likePattern = `${normalized}/%`;
        
        // Get all distinct source paths from atoms table for this directory
        try {
            const result = await db.run(
                `SELECT DISTINCT source_path FROM atoms WHERE source_path LIKE $1`,
                [likePattern]
            );
            
            let cleaned = 0;
            if (result?.results) {
                for (const row of result.results) {
                    try {
                        const sourcePath = Array.isArray(row) ? row[0] : row.source_path || '';
                        
                        // Determine provenance from path content
                        const provenance = sourcePath.includes('external-inbox') ? 'external' : 
                                          sourcePath.includes('quarantine') ? 'quarantine' : 'internal';
                        
                        // Resolve mirrored file path
                        const mirrorPath = getMirrorPath(sourcePath, provenance);
                        if (fs.existsSync(mirrorPath)) {
                            fs.unlinkSync(mirrorPath);  // Delete mirrored file
                            cleaned++;
                        }
                    } catch (e: any) {
                        console.warn(`[AtomicIngest] Failed to delete mirror for ${dirPath}:`, e.message);
                        // Don't fail entire purge for one missing/wrong file
                    }
                }
            }
            
            return cleaned;
        } catch (dbError: any) {
            console.error(`[AtomicIngest] ⚠️ Failed to query atoms for filesystem cleanup:`, dbError.message);
            return 0;
        }
    }


    async ingestResult(
        compound: Compound,
        molecules: Molecule[],
        atoms: Atom[],
        buckets: string[] = ['core'],
        onProgress?: (step: number, totalSteps: number, description: string) => void,
    ) {
        const startTime = Date.now();
        const filename = compound.path.split(/[/\\]/).pop() || compound.path;

        console.log(`[AtomicIngest] ⏱️ START Persisting: ${filename} (${molecules.length} molecules, ${atoms.length} atoms)`);

        // Wrap entire ingestion in a transaction for atomicity and performance
        await db.transaction(async () => {
            const provenanceType = compound.provenance || 'internal';
            // Ensure provenanceType is only 'internal' or 'external' (not 'quarantine')
            const validProvenanceType = (provenanceType as 'internal' | 'external') || 'internal';
        const signature = compound.molecular_signature || this.generateCompoundSignature(compound.id, compound.path);
        await this._ingestResultInTransaction(
            compound, molecules, atoms, buckets, validProvenanceType, signature, onProgress
        );
        });

        const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);
        console.log(`[AtomicIngest] ✅ COMPLETE: ${filename} in ${totalTime}s`);
    }

    private async _ingestResultInTransaction(
        compound: Compound,
        molecules: Molecule[],
        atoms: Atom[],
        buckets: string[],
        provenanceType: 'internal' | 'external',
        molecularSignature: string,
        onProgress?: (step: number, totalSteps: number, description: string) => void,
    ) {
        const totalSteps = 5; // Total persistence steps (removed compound persist)
        let currentStep = 0;

        // 1. Persist Atoms (Tags)
        const atomsStart = Date.now();
        const uniqueAtomsMap = new Map<string, Atom>();
        for (const a of atoms) {
            if (!uniqueAtomsMap.has(a.id)) {
                uniqueAtomsMap.set(a.id, a);
            }
        }
        const uniqueAtoms = Array.from(uniqueAtomsMap.values());

        if (uniqueAtoms.length > 0) {
            await this.batchWriteAtoms(uniqueAtoms, provenanceType);
        }
        console.log(`[AtomicIngest] ⏱️ Atoms persisted: ${Date.now() - atomsStart}ms`);
        onProgress?.(++currentStep, totalSteps, `Persisted ${uniqueAtoms.length} atoms`);

        // 1.5. Persist Tags Table (The Nervous System)
        const tagsStart = Date.now();
        if (uniqueAtoms.length > 0) {
            await this.batchWriteTags(uniqueAtoms, buckets);
        }
        console.log(`[AtomicIngest] ⏱️ Tags persisted: ${Date.now() - tagsStart}ms`);

        // 2. Persist Molecules
        const moleculesStart = Date.now();
        if (molecules.length > 0) {
            await this.batchWriteMolecules(molecules, molecularSignature, provenanceType, compound.path);
        }
        console.log(`[AtomicIngest] ⏱️ Molecules persisted: ${((Date.now() - moleculesStart) / 1000).toFixed(2)}s`);
        onProgress?.(++currentStep, totalSteps, `Persisted ${molecules.length} molecules`);

        // 3. Persist Atom Edges (Graph)
        const edgesStart = Date.now();
        if (compound.atoms && compound.atoms.length > 0) {
            await this.batchWriteEdges(compound.id, compound.atoms);
        }
        console.log(`[AtomicIngest] ⏱️ Edges persisted: ${Date.now() - edgesStart}ms`);

        // 4. LEGACY BRIDGE: Populate 'atoms' table (was 'memory')
        const memoryStart = Date.now();
        await this.batchWriteMemory(compound, molecules, atoms, buckets, molecularSignature, provenanceType);
        console.log(`[AtomicIngest] ⏱️ Memory/Atoms persisted: ${((Date.now() - memoryStart) / 1000).toFixed(2)}s`);
        onProgress?.(++currentStep, totalSteps, `Updated memory table`);

        // Standard 016: Invalidate search cache after successful atomic ingestion
        // This ensures fresh search results after new content is added
        try {
            const { searchCache } = await import('../search/search.js');
            searchCache.clear();
            console.log('[AtomicIngest] ✅ Search cache invalidated after atomic ingestion');
        } catch (e) {
            console.warn('[AtomicIngest] Could not invalidate search cache:', e);
        }

        // 6. Persist Atom Positions (Lazy Molecule Inflation)
        const positionsStart = Date.now();
        const atomLabelMap = new Map<string, string>();
        atoms.forEach(a => atomLabelMap.set(a.id, a.label));

        await this.batchWriteAtomPositions(molecules, atomLabelMap);
        console.log(`[AtomicIngest] ⏱️ Atom positions persisted: ${Date.now() - positionsStart}ms`);
        onProgress?.(++currentStep, totalSteps, `Finalized positions`);
    }

    private async batchWriteAtoms(atoms: Atom[], provenanceType: 'internal' | 'external') {
        const BATCH = 50;

        for (let i = 0; i < atoms.length; i += BATCH) {
            const batch = atoms.slice(i, i + BATCH);
            if (i % 500 === 0 && i > 0) await new Promise(resolve => setImmediate(resolve));

            const placeholders: string[] = [];
            const values: any[] = [];
            const now = Date.now();
            const zeroVec = JSON.stringify(this.zeroVector());
            let p = 1;

            for (const atom of batch) {
                placeholders.push(`($${p++}, $${p++}, $${p++}, $${p++}, $${p++}, $${p++}, $${p++}, $${p++})`);
                values.push(
                    atom.id,
                    'atom_source',
                    now,
                    '0',
                    zeroVec,
                    provenanceType,
                    ['atoms'],
                    [normalizeTag(atom.label) || atom.label],
                );
            }

            await db.run(
                `INSERT INTO atoms (id, source_path, timestamp, simhash, embedding, provenance, buckets, tags)
                 VALUES ${placeholders.join(', ')}
                 ON CONFLICT (id) DO UPDATE SET
                   source_path = EXCLUDED.source_path,
                   timestamp = EXCLUDED.timestamp,
                   simhash = EXCLUDED.simhash,
                   embedding = EXCLUDED.embedding,
                   provenance = EXCLUDED.provenance,
                   buckets = EXCLUDED.buckets,
                   tags = EXCLUDED.tags`,
                values,
            );
        }
    }

    private async batchWriteTags(atoms: Atom[], buckets: string[]) {
        const batchSize = 1000;
        let batchValues: any[] = [];
        let placeHolders: string[] = [];
        const flush = async () => {
            if (batchValues.length === 0) return;
            const query = `
                INSERT INTO tags (atom_id, tag, bucket) 
                VALUES ${placeHolders.join(', ')} 
                ON CONFLICT DO NOTHING
            `;
            await db.run(query, batchValues);
            batchValues = [];
            placeHolders = [];
        };

        for (const atom of atoms) {
            if (!atom.label) continue;
            // Ensure buckets are included
            const allBuckets = new Set([...buckets, ...(atom as any).buckets || []]);

            // Filter atom label through blacklist
            const filteredTags = filterTags([normalizeTag(atom.label) || atom.label]);
            const tags = filteredTags.length > 0 ? filteredTags : [normalizeTag(atom.label) || atom.label]; // Normalize before fallback

            for (const bucket of allBuckets) {
                for (const tag of tags) {
                    batchValues.push(atom.id, tag, bucket);
                    const offset = batchValues.length - 3;
                    placeHolders.push(`($${offset + 1}, $${offset + 2}, $${offset + 3})`);
                    if (placeHolders.length >= batchSize) await flush();
                }
            }
        }
        await flush();
    }

    // O(n/b) bulk INSERT — byte-budget batching to avoid PGlite WASM wire buffer overflow.
    // PGlite has an ~1MB wire message limit; large chat molecules can overflow with fixed row counts.
    private async batchWriteMolecules(
        molecules: Molecule[],
        molecularSignature: string,
        provenanceType: 'internal' | 'external',
        sourcePath: string,
    ) {
        const MAX_BATCH_ROWS = 50;
        const MAX_BATCH_BYTES = 512 * 1024; // 512KB per INSERT message (safe margin under PGlite's ~1MB limit)
        const total = molecules.length;
        // Batch every 50 items instead of every 10%
const BATCH_SIZE = 50;
const logInterval = Math.max(BATCH_SIZE, Math.ceil(total / 20));
        const molStart = Date.now();
        let i = 0;

        while (i < molecules.length) {
            // Build batch: add rows until we hit row limit OR byte budget
            const batch: Molecule[] = [];
            let batchBytes = 0;
            while (i < molecules.length && batch.length < MAX_BATCH_ROWS) {
                const m = molecules[i];
                const rowBytes = (m.id?.length ?? 0) + 200; // 200 = overhead estimate (no content - pointers only)
                if (batch.length > 0 && batchBytes + rowBytes > MAX_BATCH_BYTES) break;
                batch.push(m);
                batchBytes += rowBytes;
                i++;
            }

            // Progress logging for large batches
            if (total > 1000 && i % logInterval === 0 && i > 0) {
                const elapsed = ((Date.now() - molStart) / 1000).toFixed(1);
                const rate = Math.round(i / ((Date.now() - molStart) / 1000));
                if (i % BATCH_SIZE < BATCH_SIZE && i % BATCH_SIZE === 49) { console.log(`[AtomicIngest] ⏱️ Molecules batch: ${Math.floor(i/BATCH_SIZE)*BATCH_SIZE + 1}-${Math.min(i+1, total)} of ${total}`); }
            }

            // Yield to event loop every 500 rows
            if (i % 500 === 0 && i > 0) {
                await new Promise(resolve => setImmediate(resolve));
            }

            // Build bulk INSERT with multiple VALUES
            const placeholders: string[] = [];
            const values: any[] = [];
            let paramIdx = 1;

            for (const m of batch) {
                placeholders.push(`($${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++})`);
                values.push(
                    m.id,
                    m.content || '',
                    molecularSignature,
                    m.sequence,
                    m.start_byte || 0,
                    m.end_byte || 0,
                    m.type || 'prose',
                    // numeric_value: PostgreSQL real has range ~1E±37, clamp out-of-range to null
                    (m.numeric_value !== undefined && m.numeric_value !== null && Math.abs(m.numeric_value) < 1e37) ? m.numeric_value : null,
                    m.numeric_unit || null,
                    molecularSignature,
                    JSON.stringify(this.zeroVector()), // embedding (we don't compute embeddings here anymore)
                    m.timestamp || Date.now(),
                    JSON.stringify(m.tags || []),
                    JSON.stringify(m.entities || {}),
                    sourcePath,
                    provenanceType,
                );
            }

            await db.run(
                `INSERT INTO molecules (id, content, compound_id, sequence, start_byte, end_byte, type, numeric_value, numeric_unit, molecular_signature, embedding, timestamp, tags, entities, source_path, provenance)
                 VALUES ${placeholders.join(', ')}
                 ON CONFLICT (id) DO UPDATE SET
                   content = EXCLUDED.content,
                   compound_id = EXCLUDED.compound_id,
                   sequence = EXCLUDED.sequence,
                   start_byte = EXCLUDED.start_byte,
                   end_byte = EXCLUDED.end_byte,
                   type = EXCLUDED.type,
                   numeric_value = EXCLUDED.numeric_value,
                   numeric_unit = EXCLUDED.numeric_unit,
                   molecular_signature = EXCLUDED.molecular_signature,
                   embedding = EXCLUDED.embedding,
                   timestamp = EXCLUDED.timestamp,
                   tags = EXCLUDED.tags,
                   entities = EXCLUDED.entities,
                   source_path = EXCLUDED.source_path,
                   provenance = EXCLUDED.provenance`,
                values,
            );
        }

        const molElapsed = ((Date.now() - molStart) / 1000).toFixed(1);
        console.log(`[AtomicIngest] ⏱️ Molecules batch complete: ${total} molecules, ${molElapsed}s`);
    }

    private async batchWriteEdges(compoundId: string, atomIds: string[]) {
        const BATCH = 50;

        for (let i = 0; i < atomIds.length; i += BATCH) {
            const batch = atomIds.slice(i, i + BATCH);
            if (i % 500 === 0 && i > 0) await new Promise(resolve => setImmediate(resolve));

            const placeholders: string[] = [];
            const values: any[] = [];
            let p = 1;

            for (const atomId of batch) {
                placeholders.push(`($${p++}, $${p++}, $${p++}, $${p++})`);
                values.push(compoundId, atomId, 1.0, 'has_tag');
            }

            await db.run(
                `INSERT INTO edges (source_id, target_id, weight, relation)
                 VALUES ${placeholders.join(', ')}
                 ON CONFLICT (source_id, target_id, relation) DO UPDATE SET
                   weight = EXCLUDED.weight,
                   relation = EXCLUDED.relation`,
                values,
            );
        }
    }

    private async batchWriteCompounds(compounds: Compound[]) {
        // No-op: compounds table has been removed.
        // Molecules are linked via compound_id for lookups; atoms via edges.
    }

    // O(n/b) bulk INSERT for atoms
    // LEGACY BRIDGE: Populates 'atoms' table for backward compatibility (pointer-only, no content)
    private async batchWriteMemory(
        compound: Compound,
        molecules: Molecule[],
        atoms: Atom[],
        buckets: string[],
        molecularSignature: string,
        provenanceType: 'internal' | 'external',
    ) {
        // 1. Write Compound Row (pointer-only, no content)
        // Guard against NaN/invalid timestamps from atomizer extraction
        const safeTimestamp = (typeof compound.timestamp === 'number' && !isNaN(compound.timestamp))
            ? compound.timestamp : Date.now();
        await db.run(
            `INSERT INTO atoms (id, source_path, timestamp, simhash, embedding, provenance, buckets, tags, compound_id, start_byte, end_byte)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
             ON CONFLICT (id) DO UPDATE SET
               source_path = EXCLUDED.source_path,
               timestamp = EXCLUDED.timestamp,
               simhash = EXCLUDED.simhash,
               embedding = EXCLUDED.embedding,
               provenance = EXCLUDED.provenance,
               buckets = EXCLUDED.buckets,
               tags = EXCLUDED.tags,
               compound_id = EXCLUDED.compound_id,
               start_byte = EXCLUDED.start_byte,
               end_byte = EXCLUDED.end_byte`,
            [
                compound.id,
                compound.path,
                safeTimestamp,
                molecularSignature || '0',
                JSON.stringify(this.zeroVector()),
                provenanceType,
                buckets,
                atoms.map(a => a.label),
                compound.id,
                0,
                0,
            ],
        );

        // 2. Write Molecule Rows in Batches (pointer-only, no content)
        const atomLabelMap = new Map<string, string>();
        atoms.forEach(a => atomLabelMap.set(a.id, a.label));

        const batchSize = 50;
        const total = molecules.length;
        // Batch every 50 items instead of every 10%
const BATCH_SIZE = 50;
const logInterval = Math.max(BATCH_SIZE, Math.ceil(total / 20));

        for (let i = 0; i < molecules.length; i += batchSize) {
            const batch = molecules.slice(i, Math.min(i + batchSize, molecules.length));

            // Progress logging
            if (total > 1000 && i % logInterval === 0 && i > 0) {
                console.log(`[AtomicIngest] ⏱️ Memory/Atoms: ${((i / total) * 100).toFixed(0)}% (${i}/${total})`);
            }
            if (i % 500 === 0 && i > 0) await new Promise(resolve => setImmediate(resolve));

            const placeholders: string[] = [];
            const values: any[] = [];
            let paramIdx = 1;

            for (const m of batch) {
                // Extract tags from atoms and filter through blacklist
                const rawTags = (m.atoms || []).map(id => atomLabelMap.get(id)).filter(l => l !== undefined);
                const specificTags = filterTags(rawTags);

                placeholders.push(`($${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++})`);

                values.push(
                    m.id,
                    compound.path,
                    m.timestamp || compound.timestamp,
                    molecularSignature,
                    JSON.stringify(this.zeroVector()),
                    provenanceType,
                    buckets,
                    specificTags,
                    m.compoundId,
                    m.start_byte || 0,
                    m.end_byte || 0,
                );
            }

            await db.run(
                `INSERT INTO atoms (id, source_path, timestamp, simhash, embedding, provenance, buckets, tags, compound_id, start_byte, end_byte)
                 VALUES ${placeholders.join(', ')}
                 ON CONFLICT (id) DO UPDATE SET
                   source_path = EXCLUDED.source_path,
                   timestamp = EXCLUDED.timestamp,
                   simhash = EXCLUDED.simhash,
                   embedding = EXCLUDED.embedding,
                   provenance = EXCLUDED.provenance,
                   buckets = EXCLUDED.buckets,
                   tags = EXCLUDED.tags,
                   compound_id = EXCLUDED.compound_id,
                   start_byte = EXCLUDED.start_byte,
                   end_byte = EXCLUDED.end_byte`,
                values,
            );
        }
    }

    // Bulk INSERT for atom positions (Lazy Molecule Inflation)
    private async batchWriteAtomPositions(molecules: Molecule[], atomLabelMap: Map<string, string>) {
        const batchSize = 100;
        let batch: any[] = [];

        // Iterate molecules and generate position rows on the fly
        // This avoids creating a massive array of all position rows in memory
        for (const m of molecules) {
            if (!m.atoms || m.atoms.length === 0) continue;
            const midByte = m.start_byte !== undefined ? Math.floor((m.start_byte + (m.end_byte || m.start_byte)) / 2) : 0;

            for (const atomId of m.atoms) {
                const label = atomLabelMap.get(atomId);
                if (label) {
                    batch.push(m.compoundId, label, midByte);

                    // If batch is full, flush it
                    if (batch.length >= batchSize * 3) { // 3 params per row * batchSize
                        await this.flushAtomPositionsBatch(batch);
                        batch = [];
                    }
                }
            }
        }

        // Flush remaining
        if (batch.length > 0) {
            await this.flushAtomPositionsBatch(batch);
        }
    }

    private async flushAtomPositionsBatch(flatValues: any[]) {
        const rowsCount = flatValues.length / 3;
        const placeholders: string[] = [];
        let paramIdx = 1;

        for (let i = 0; i < rowsCount; i++) {
            placeholders.push(`($${paramIdx++}, $${paramIdx++}, $${paramIdx++})`);
        }

        await db.run(
            `INSERT INTO atom_positions (compound_id, atom_label, byte_offset)
             VALUES ${placeholders.join(', ')}
             ON CONFLICT (compound_id, atom_label, byte_offset) DO NOTHING`,
            flatValues,
        );
    }


    private zeroVector() {
        return new Array(config.MODELS.EMBEDDING_DIM).fill(0.1);
    }

    private generateHash(str: string): string {
        // Simple hash for legacy field
        let hash = 0;
        if (str.length === 0) return '0';
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash |= 0;
        }
        return hash.toString(16);
    }

    /**
     * Generate a compound signature for molecular level identification
     */
    private generateCompoundSignature(id: string, path?: string): string {
        // Use content hash if available, otherwise use ID + path
        const content = id || (path || '');
        // Simple deterministic hash using basic operations (no crypto dependency)
        let hash = 0;
        for (let i = 0; i < content.length; i++) {
            hash = ((hash << 5) - hash) + content.charCodeAt(i);
            hash |= 0; // Convert to 32-bit integer
        }
        return Math.abs(hash).toString(16);
    }
}