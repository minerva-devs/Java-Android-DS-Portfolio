/**
 * Build script for anchor-engine-node.
 * Cleans engine/dist/ and runs tsc to emit TypeScript → JavaScript.
 */

import { execSync } from 'child_process';
import { rmSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');
const engineDir = join(rootDir, 'engine');

// Clean previous build
rmSync(join(engineDir, 'dist'), { recursive: true, force: true });

console.log('Building anchor-engine...');
// Use pnpm exec for cross-platform tsc (handles Windows .cmd wrapping)
execSync('pnpm exec tsc', {
  cwd: engineDir,
  stdio: 'inherit',
});

console.log('Build complete.');
