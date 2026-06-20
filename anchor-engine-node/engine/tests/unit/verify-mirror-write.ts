/**
 * Manual Verification Script for Mirror Write Functionality
 * 
 * This script demonstrates how the new writeContentToMirror integration works.
 * Run this after starting the server and ingesting a file to verify everything is connected.
 */

import { getMirrorPath, MIRRORED_BRAIN_PATH } from '../src/services/mirror/mirror.js';
import fs from 'fs';
import path from 'path';

console.log('🔍 Mirror Write Verification Script\n');

// Example: Verify how a file would be mirrored
const testCases = [
    { sourcePath: 'inbox/my-notes.md', provenance: 'internal' },
    { sourcePath: 'external-inbox/web-page.html', provenance: 'external' },
    { sourcePath: 'quarantine/suspicious.txt', provenance: 'quarantine' },
];

console.log('📋 Path Mapping Examples:\n');

for (const testCase of testCases) {
    const mirrorPath = getMirrorPath(testCase.sourcePath, testCase.provenance);
    console.log(`  Source: ${testCase.sourcePath}`);
    console.log(`  Provenance: ${testCase.provenance}`);
    console.log(`  → Mirror Path: ${mirrorPath}`);
    
    // Check if file exists (for demonstration)
    if (fs.existsSync(mirrorPath)) {
        const stats = fs.statSync(mirrorPath);
        console.log(`  ✓ File exists (${stats.size} bytes)`);
    } else {
        console.log(`  ℹ️  File not found (expected for test)`);
    }
    console.log('');
}

// Verify mirrored_brain directory structure
console.log('📁 Checking mirrored_brain/ directory...\n');

if (!fs.existsSync(MIRRORED_BRAIN_PATH)) {
    console.log(`  ⚠️  ${MIRRORED_BRAIN_PATH} does not exist yet`);
    console.log('     This is normal - it will be created on first mirror write.\n');
} else {
    const files = fs.readdirSync(MIRRORED_BRAIN_PATH, { recursive: true });
    console.log(`  ✓ Directory exists with ${files.length} items\n`);
    
    // Check for provenance directories
    const provenanceDirs = ['@inbox', '@external-inbox', '@quarantine'];
    for (const dir of provenanceDirs) {
        const dirPath = path.join(MIRRORED_BRAIN_PATH, dir);
        if (fs.existsSync(dirPath)) {
            console.log(`  ✓ ${dir}/ exists`);
        } else {
            console.log(`  ℹ️  ${dir}/ not found (will be created on first write)`);
        }
    }
}

console.log('\n✅ Verification Complete!');
console.log('\n📝 How to Test:');
console.log('1. Start the server: npm run dev');
console.log('2. Ingest a file via API or upload');
console.log('3. Check mirrored_brain/@inbox/ for the file');
console.log('4. Run distillation and verify blocks are produced from mirrored content\n');
