#!/usr/bin/env node
// Syncs the root package.json version to engine/package.json and README.md
// Runs automatically via the "postversion" npm hook.

import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// Read new version from root package.json
const rootPkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
const version = rootPkg.version;

// Sync engine/package.json
const enginePkgPath = resolve(root, 'engine', 'package.json');
const enginePkg = JSON.parse(readFileSync(enginePkgPath, 'utf8'));
enginePkg.version = version;
writeFileSync(enginePkgPath, JSON.stringify(enginePkg, null, 2) + '\n');
console.log(`engine/package.json → ${version}`);

// Sync README.md version badge line
const readmePath = resolve(root, 'README.md');
const readme = readFileSync(readmePath, 'utf8');
const updated = readme.replace(
  /(\*\*Version:\*\* )\d+\.\d+\.\d+/,
  `$1${version}`
);
if (updated === readme) {
  console.warn('README.md: no version badge found to update');
} else {
  writeFileSync(readmePath, updated);
  console.log(`README.md → ${version}`);
}
