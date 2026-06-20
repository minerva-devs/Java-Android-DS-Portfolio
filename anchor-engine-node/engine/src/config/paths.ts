/**
 * Path Configuration for Sovereign Context Engine
 *
 * All paths are abstracted to ~/.anchor/user_settings.json.
 * No config files or output directories live in the project root.
 *
 * Priority: Environment variables > user_settings.json > defaults
 */

import * as path from 'path';
import { homedir } from 'os';
import * as fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Define base paths
// __dirname is engine/src/config, so we need to go up 3 levels to reach project root
export const PROJECT_ROOT = path.resolve(process.env.PROJECT_ROOT || path.join(__dirname, '..', '..', '..'));

// Load user_settings.json for path overrides
let userSettings: any = {};

// Define Anchor root (centralized user data) - in user's home directory (~/.anchor)
// This matches the standard config location (~/.config, ~/.gitconfig, etc.)
const ANCHOR_ROOT = path.resolve(
  process.env.ANCHOR_ROOT ||
  path.join(homedir(), '.anchor')
);

// Define local-data directory under .anchor (Standard 024 compliance)
const LOCAL_DATA_DIR = path.join(ANCHOR_ROOT, 'local-data');

// Windows reserved names that cannot be used in paths
const WINDOWS_RESERVED_NAMES = [
  'CON', 'PRN', 'AUX', 'NUL', // Standard console/printer devices
  'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9', // Serial ports
  'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9' // Parallel ports
];

// Windows path length limit (with long paths enabled, can be higher)
const WINDOWS_PATH_LENGTH_LIMIT = 260;

/**
 * Validate path components for Windows compatibility
 */
function validateWindowsPath(p: string): void {
  if (process.platform !== 'win32') return; // Skip on non-Windows platforms
  
  const upperPath = p.toUpperCase();
  const components = upperPath.split(path.sep).filter(c => c.length > 0);
  
  for (const component of components) {
    if (WINDOWS_RESERVED_NAMES.includes(component)) {
      throw new Error(
        `[PATHS] ERROR: Path contains Windows reserved name "${component}". ` +
        `Cannot use .anchor at this location. Consider moving it to a different directory.`
      );
    }
  }
}

/**
 * Warn about potential long path issues
 */
function checkPathLength(p: string, context: string): void {
  if (process.platform === 'win32' && p.length > WINDOWS_PATH_LENGTH_LIMIT - 50) {
    console.warn(
      `[PATHS] Warning: ${context} is very long (${p.length} chars). ` +
      `Windows has a ${WINDOWS_PATH_LENGTH_LIMIT}-char limit. ` +
      'Consider moving .anchor to the root directory or using shorter path names.'
    );
  }
}

// Load user_settings.json from .anchor/ (primary) or project root (fallback)
try {
  const anchorSettingsPath = path.join(ANCHOR_ROOT, 'user_settings.json');
  const projectSettingsPath = path.join(PROJECT_ROOT, 'user_settings.json');
  const settingsPath = fs.existsSync(anchorSettingsPath) ? anchorSettingsPath : projectSettingsPath;
  if (fs.existsSync(settingsPath)) {
    userSettings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
  }
} catch (e) {
  // Ignore errors - will use defaults
}

// Path configuration with user_settings.json overrides
// Priority: Environment variables > user_settings.json > defaults
export const NOTEBOOK_DIR = path.resolve(
  process.env.NOTEBOOK_DIR ||
  userSettings.paths?.notebook ||
  path.join(LOCAL_DATA_DIR, 'notebook')
);

export const CONTEXT_DIR = path.resolve(
  process.env.CONTEXT_DIR ||
  userSettings.paths?.context ||
  path.join(LOCAL_DATA_DIR, 'context')
);

export const MODELS_DIR = path.resolve(process.env.MODELS_DIR || path.join(LOCAL_DATA_DIR, 'models'));
export const DISTILL_DIR = path.resolve(process.env.DISTILL_DIR || userSettings.paths?.distill || path.join(LOCAL_DATA_DIR, 'distills'));
export const DIST_DIR = path.resolve(process.env.DIST_DIR || userSettings.paths?.dist || path.join(DISTILL_DIR, 'output'));
export const BASE_PATH = PROJECT_ROOT;

// Standard 024: Logs directory under .anchor for centralized logging (defined in user_settings.json.template)
export const LOGS_DIR = path.resolve(
  process.env.LOGS_DIR ||
  userSettings.paths?.logs ||
  path.join(ANCHOR_ROOT, 'logs')
);

// Context data directory under .anchor for database storage
export const CONTEXT_DATA_DIR = path.resolve(
  process.env.CONTEXT_DATA_DIR ||
  userSettings.paths?.context_data ||
  path.join(ANCHOR_ROOT, 'context_data')
);

// Test database directory under .anchor for test artifacts
export const TEST_DBS_DIR = path.resolve(
  process.env.TEST_DBS_DIR ||
  userSettings.paths?.test_dbs ||
  path.join(ANCHOR_ROOT, 'test-dbs')
);

// Validate Windows compatibility for critical paths
validateWindowsPath(ANCHOR_ROOT);
checkPathLength(ANCHOR_ROOT, 'Anchor root');
checkPathLength(CONTEXT_DATA_DIR, 'Context data directory');

// Define specific paths
export const PATHS = {
  PROJECT_ROOT,
  ANCHOR_ROOT,
  LOCAL_DATA_DIR,
  CONTEXT_DIR,
  MODELS_DIR,
  DIST_DIR,
  BACKUPS_DIR: path.resolve(process.env.BACKUPS_DIR || userSettings.paths?.backups || path.join(ANCHOR_ROOT, 'backups')),
  LOGS_DIR,
  CONTEXT_DATA_DIR,
  TEST_DBS_DIR,
  CONFIG_FILE: path.join(LOCAL_DATA_DIR, 'sovereign.yaml'),
  USER_SETTINGS: path.join(ANCHOR_ROOT, 'user_settings.json'),
  DATABASE_FILE: path.join(CONTEXT_DIR, 'context.db'),
  NOTEBOOK_DIR,
  // Standard 024: Centralized user data paths under local-data/
  INBOX_DIR: path.resolve(process.env.INBOX_DIR || userSettings.paths?.inbox || path.join(LOCAL_DATA_DIR, 'inbox')),
  EXTERNAL_INBOX_DIR: path.resolve(process.env.EXTERNAL_INBOX_DIR || userSettings.paths?.external_inbox || path.join(LOCAL_DATA_DIR, 'external-inbox')),
  INTERNAL_INBOX_DIR: path.resolve(process.env.INTERNAL_INBOX_DIR || userSettings.paths?.internal_inbox || path.join(NOTEBOOK_DIR, 'internal-inbox')),
  DISTILL_DIR: path.resolve(process.env.DISTILL_DIR || userSettings.paths?.distill || path.join(LOCAL_DATA_DIR, 'distills')),
  // Alias for backward compatibility - some code may still reference DISTILLS_DIR
  DISTILLS_DIR: DISTILL_DIR,
  MIRRORED_BRAIN_DIR: path.resolve(process.env.MIRRORED_BRAIN_DIR || userSettings.paths?.mirrored_brain || path.join(LOCAL_DATA_DIR, 'mirrored_brain')),
  SESSIONS_DIR: path.resolve(process.env.SESSIONS_DIR || userSettings.paths?.sessions || path.join(LOCAL_DATA_DIR, 'sessions')),
  LIBRARIES_DIR: path.join(CONTEXT_DIR, 'libraries'),
  MIRRORS_DIR: path.join(CONTEXT_DIR, 'mirrors'),
  ENGINE_BIN: path.join(PROJECT_ROOT, 'engine', 'bin'),
  ENGINE_SRC: path.join(PROJECT_ROOT, 'engine', 'src'),
  ENGINE_DIST: path.join(PROJECT_ROOT, 'engine', 'dist'),
  ENGINE_CONTEXT: path.join(LOCAL_DATA_DIR, 'engine-context'),
  ENGINE_PLUGINS: path.join(PROJECT_ROOT, 'engine', 'plugins'),
  DESKTOP_OVERLAY_SRC: path.join(PROJECT_ROOT, 'packages', 'desktop-overlay', 'src'),
  DESKTOP_OVERLAY_DIST: path.join(PROJECT_ROOT, 'packages', 'desktop-overlay', 'dist'),
};

  // Create subdirectories under ANCHOR_ROOT (runtime objects go here)
  const anchorSubdirs = ['context_data', 'test-dbs'];
  for (const subdir of anchorSubdirs) {
    const subdirPath = path.join(ANCHOR_ROOT, subdir);
    if (!fs.existsSync(subdirPath)) {
      fs.mkdirSync(subdirPath, { recursive: true });
      console.log(`[PATHS] Created directory: ${subdirPath}`);
    } else {
      // Verify write permission by creating and removing a test file
      const testFile = path.join(subdirPath, '.write-test');
      try {
        fs.writeFileSync(testFile, 'test', { flag: 'w' });
        fs.rmSync(testFile);
      } catch (err) {
        console.error(`[PATHS] Warning: Cannot write to ${subdirPath}:`, (err as Error).message);
      }
    }
  }

  // Create subdirectories under LOCAL_DATA_DIR (user data, not runtime)
  const localDataSubdirs = ['external-inbox', 'distills', 'mirrored_brain', 'sessions', 'logs', 'backups', 'notebook'];
  for (const subdir of localDataSubdirs) {
    const subdirPath = path.join(LOCAL_DATA_DIR, subdir);
    if (!fs.existsSync(subdirPath)) {
      fs.mkdirSync(subdirPath, { recursive: true });
      console.log(`[PATHS] Created directory: ${subdirPath}`);
    }
  }

  // Also ensure notebook directories exist (for backward compatibility)
  try {
    if (!fs.existsSync(NOTEBOOK_DIR)) {
      fs.mkdirSync(NOTEBOOK_DIR, { recursive: true });
      console.log(`[PATHS] Created directory: ${NOTEBOOK_DIR}`);
    }
    // inbox directory has been deprecated - use NOTEBOOK_DIR/internal-inbox or NOTEBOOK_DIR/external-inbox
    const externalInbox = path.join(NOTEBOOK_DIR, 'external-inbox');
    if (!fs.existsSync(externalInbox)) {
      fs.mkdirSync(externalInbox, { recursive: true });
      console.log(`[PATHS] Created directory: ${externalInbox}`);
    }
  } catch (e) {
    // Ignore errors - directories may already exist
  }

  // Ensure LOGS_DIR is writable (for log rotation)
  try {
    if (!fs.existsSync(LOGS_DIR)) {
      fs.mkdirSync(LOGS_DIR, { recursive: true });
      console.log(`[PATHS] Created directory: ${LOGS_DIR}`);
    } else {
      // Verify write permission
      const testFile = path.join(LOGS_DIR, '.write-test');
      try {
        fs.writeFileSync(testFile, 'test', { flag: 'w' });
        fs.rmSync(testFile);
      } catch (err) {
        console.error(`[PATHS] Warning: Cannot write to logs directory ${LOGS_DIR}:`, (err as Error).message);
      }
    }
  } catch (e) {
    // Ignore errors - may already exist and be writable
  }

// Export individual paths for convenience
export const {
  BACKUPS_DIR,
  EXTERNAL_INBOX_DIR,
  DISTILLS_DIR,
  MIRRORED_BRAIN_DIR,
  ENGINE_CONTEXT,
  ENGINE_PLUGINS,
  DESKTOP_OVERLAY_SRC,
  DESKTOP_OVERLAY_DIST,
} = PATHS;

// Export provenance configuration
export const DEFAULT_PROVENANCE = path.resolve(
  process.env.DEFAULT_PROVENANCE ||
  userSettings.paths?.default_provenance ||
  'internal'
);

export default PATHS;