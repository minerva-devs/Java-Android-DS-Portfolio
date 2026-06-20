
import { db } from '../../engine/src/core/db.js';
import { performance } from 'perf_hooks';

async function setupData(atomCount: number) {
  console.log(`[Setup] Creating ${atomCount} atoms...`);

  // Clear existing atoms to avoid conflicts
  await db.run('DELETE FROM atoms');
  await db.run('DELETE FROM tags');

  const values: string[] = [];
  const params: any[] = [];

  for (let i = 0; i < atomCount; i++) {
    const id = `atom-${i}`;
    const tags = [`tagA-${i}`, `tagB-${i}`, 'common-tag'];
    const buckets = ['bucket1', 'bucket2'];

    // We need to insert into atoms table.
    // The schema has: id, tags (text[] or serialized?), buckets (text[]?)
    // In api.ts, it reads: row.tags as string[], row.buckets as string[]
    // In db.ts, it says: buckets TEXT[], tags TEXT[]
    // PGlite handles arrays as JS arrays if the column type is array.

    // Let's insert using a loop for now as setup speed is not critical,
    // but better to batch if possible.
    // For simplicity in setup, I'll use individual inserts or small batches.

    await db.run(
      `INSERT INTO atoms (id, content, tags, buckets) VALUES ($1, $2, $3, $4)`,
      [id, 'content', tags, buckets]
    );
  }
  console.log('[Setup] Done.');
}

async function badReindex() {
  const atoms = await db.run('SELECT id, tags, buckets FROM atoms');
  let count = 0;

  const start = performance.now();

  for (const row of atoms.rows) {
    const atomId = row.id;
    const tags = row.tags as string[];
    const buckets = row.buckets as string[];

    if (!tags || !buckets) continue;

    for (const bucket of buckets) {
      for (const tag of tags) {
        if (tag && bucket) {
          try {
            await db.run(
              `INSERT INTO tags (atom_id, tag, bucket) VALUES ($1, $2, $3)
                   ON CONFLICT (atom_id, tag, bucket) DO NOTHING`,
              [atomId, tag, bucket]
            );
            count++;
          } catch (e) { }
        }
      }
    }
  }

  const end = performance.now();
  return { time: end - start, count };
}

async function goodReindex() {
  const atoms = await db.run('SELECT id, tags, buckets FROM atoms');
  let count = 0;

  const start = performance.now();

  // Optimization: Batch inserts
  const batchSize = 1000;
  let currentBatch: any[] = [];
  let currentParams: any[] = [];

  for (const row of atoms.rows) {
    const atomId = row.id;
    const tags = row.tags as string[];
    const buckets = row.buckets as string[];

    if (!tags || !buckets) continue;

    for (const bucket of buckets) {
      for (const tag of tags) {
        if (tag && bucket) {
           // We can't easily do ON CONFLICT DO NOTHING with multi-values in all SQL dialects
           // but Postgres supports it.
           // However, constructing the query string dynamically is needed.

           currentBatch.push(`($${currentParams.length + 1}, $${currentParams.length + 2}, $${currentParams.length + 3})`);
           currentParams.push(atomId, tag, bucket);
           count++;

           if (currentBatch.length >= batchSize) {
             const values = currentBatch.join(',');
             await db.run(
               `INSERT INTO tags (atom_id, tag, bucket) VALUES ${values}
                ON CONFLICT (atom_id, tag, bucket) DO NOTHING`,
               currentParams
             );
             currentBatch = [];
             currentParams = [];
           }
        }
      }
    }
  }

  if (currentBatch.length > 0) {
     const values = currentBatch.join(',');
     await db.run(
       `INSERT INTO tags (atom_id, tag, bucket) VALUES ${values}
        ON CONFLICT (atom_id, tag, bucket) DO NOTHING`,
       currentParams
     );
  }

  const end = performance.now();
  return { time: end - start, count };
}

async function main() {
  console.log('Initializing DB...');
  await db.init();

  const ATOM_COUNT = 1000;
  await setupData(ATOM_COUNT);

  // Warmup?

  console.log('\n--- Running Bad Reindex (Baseline) ---');
  await db.run('DELETE FROM tags'); // Ensure clean state
  const resBad = await badReindex();
  console.log(`Time: ${resBad.time.toFixed(2)}ms`);
  console.log(`Inserted: ${resBad.count} tags`);

  console.log('\n--- Running Good Reindex (Optimized) ---');
  await db.run('DELETE FROM tags'); // Ensure clean state
  const resGood = await goodReindex();
  console.log(`Time: ${resGood.time.toFixed(2)}ms`);
  console.log(`Inserted: ${resGood.count} tags`);

  const speedup = resBad.time / resGood.time;
  console.log(`\nSpeedup: ${speedup.toFixed(2)}x`);

  await db.close();
}

main().catch(console.error);
