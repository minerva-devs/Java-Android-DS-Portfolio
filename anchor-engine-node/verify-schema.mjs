import Pglite from '@electric-sql/pglite';

const dbPath = process.env.PGLITE_DB_PATH || 'C:/Users/rsbii/.anchor/context_data/anchor.db';
console.log('Database path:', dbPath);

async function verifySchema() {
  const db = new Pglite({ uri: `sqlite:${dbPath}` });
  
  await db.ready;
  
  // List all tables
  const tablesResult = await db.all('SELECT name FROM sqlite_master WHERE type="table";');
  console.log('\n=== Current Tables ===');
  for (const t of tablesResult) {
    if (t.name !== 'sqlite_sequence') {
      console.log(`- ${t.name}`);
    }
  }

  // Check molecules table schema
  const molInfo = await db.all('PRAGMA table_info(molecules);');
  console.log('\n=== Molecules Table Columns ===');
  for (const col of molInfo) {
    console.log(`- ${col.name} (${col.type})`);
  }

  // Check atoms table schema  
  const atomInfo = await db.all('PRAGMA table_info(atoms);');
  console.log('\n=== Atoms Table Columns ===');
  for (const col of atomInfo) {
    console.log(`- ${col.name} (${col.type})`);
  }

  // Check if compounds table exists
  const compoundsCheck = await db.all('SELECT * FROM compounds LIMIT 1;', ['compounds']);
  if (Array.isArray(compoundsCheck)) {
    console.log('\n⚠️ WARNING: Compounds table still exists!');
    if (compoundsCheck.length > 0) {
      console.log('   Contains data:', compoundsCheck);
    }
  } else {
    console.log('\n✅ Compounds table does not exist (migration complete)');
  }

  // Count molecules with provenance
  const molWithProvenance = await db.all(
    'SELECT COUNT(*) FROM molecules WHERE provenance IS NOT NULL;',
    []
  );
  console.log(`\nMolecules with provenance data: ${molWithProvenance[0]?.COUNT || 0}`);

  // Count atoms with provenance  
  const atomWithProvenance = await db.all(
    'SELECT COUNT(*) FROM atoms WHERE provenance IS NOT NULL;',
    []
  );
  console.log(`Atoms with provenance data: ${atomWithProvenance[0]?.COUNT || 0}`);

  // Check if migration SQL exists
  const fs = await import('fs');
  const migrationFile = 'C:/Users/rsbii/Projects/anchor-engine-node/engine/src/core/schema-migration.sql';
  try {
    const content = fs.readFileSync(migrationFile, 'utf-8');
    console.log(`\nMigration SQL file exists: ${migrationFile}`);
    if (content.includes('CREATE TABLE molecules') && content.includes('CREATE TABLE atoms')) {
      console.log('   - Contains molecules table creation');
      console.log('   - Contains atoms table creation');
    }
  } catch (e) {
    console.log(`Migration SQL file not found: ${migrationFile}`);
  }

  await db.close();
}

verifySchema().catch(console.error);