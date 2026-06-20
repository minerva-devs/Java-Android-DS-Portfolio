/**
 * PATHS Configuration Tests
 *
 * Verifies path configuration is correct per Standard 024 (Ephemeral Database
 * Architecture) and doc_policy §5: all runtime data routes to $HOME/.anchor/.
 */

import { test, expect } from 'vitest';
import { PATHS, PROJECT_ROOT } from '../../src/config/paths.js';
import * as path from 'path';
import { homedir } from 'os';

const ANCHOR_ROOT = path.resolve(homedir(), '.anchor');

describe('PATHS Configuration', () => {
  describe('PROJECT_ROOT', () => {
    it('should be an absolute path', () => {
      expect(path.isAbsolute(PROJECT_ROOT)).toBe(true);
    });

    it('should exist on the filesystem', () => {
      const fs = require('fs');
      expect(fs.existsSync(PROJECT_ROOT)).toBe(true);
    });
  });

  describe('INBOX_DIR', () => {
    it('should be under .anchor/', () => {
      // Standard 024: all runtime data under $HOME/.anchor/
      const normalized = PATHS.INBOX_DIR.replace(/\\/g, '/');
      const anchorNormalized = ANCHOR_ROOT.replace(/\\/g, '/');
      expect(normalized.startsWith(anchorNormalized)).toBe(true);
    });

    it('should be an absolute path', () => {
      expect(path.isAbsolute(PATHS.INBOX_DIR)).toBe(true);
    });
  });

  describe('EXTERNAL_INBOX_DIR', () => {
    it('should be under .anchor/', () => {
      const normalized = PATHS.EXTERNAL_INBOX_DIR.replace(/\\/g, '/');
      const anchorNormalized = ANCHOR_ROOT.replace(/\\/g, '/');
      expect(normalized.startsWith(anchorNormalized)).toBe(true);
    });

    it('should be an absolute path', () => {
      expect(path.isAbsolute(PATHS.EXTERNAL_INBOX_DIR)).toBe(true);
    });
  });

  describe('MIRRORED_BRAIN_DIR', () => {
    it('should be under .anchor/', () => {
      const normalized = PATHS.MIRRORED_BRAIN_DIR.replace(/\\/g, '/');
      const anchorNormalized = ANCHOR_ROOT.replace(/\\/g, '/');
      expect(normalized.startsWith(anchorNormalized)).toBe(true);
    });

    it('should be an absolute path', () => {
      expect(path.isAbsolute(PATHS.MIRRORED_BRAIN_DIR)).toBe(true);
    });
  });

  describe('Path Separation', () => {
    it('should have different paths for inbox and external-inbox', () => {
      expect(PATHS.INBOX_DIR).not.toBe(PATHS.EXTERNAL_INBOX_DIR);
    });

    it('should have different paths for inbox and mirrored_brain', () => {
      expect(PATHS.INBOX_DIR).not.toBe(PATHS.MIRRORED_BRAIN_DIR);
    });

    it('should have different paths for external-inbox and mirrored_brain', () => {
      expect(PATHS.EXTERNAL_INBOX_DIR).not.toBe(PATHS.MIRRORED_BRAIN_DIR);
    });
  });

  describe('Data Directory Structure', () => {
    it('should have all data directories under .anchor/', () => {
      const dataPaths = [PATHS.INBOX_DIR, PATHS.EXTERNAL_INBOX_DIR, PATHS.MIRRORED_BRAIN_DIR];
      const anchorNormalized = ANCHOR_ROOT.replace(/\\/g, '/');

      for (const p of dataPaths) {
        const normalized = p.replace(/\\/g, '/');
        expect(normalized.startsWith(anchorNormalized)).toBe(true);
      }
    });
  });

  describe('Other Critical Paths', () => {
    it('should have CONTEXT_DIR defined', () => {
      expect(PATHS.CONTEXT_DIR).toBeDefined();
      expect(path.isAbsolute(PATHS.CONTEXT_DIR)).toBe(true);
    });

    it('should have DATABASE_FILE defined', () => {
      expect(PATHS.DATABASE_FILE).toBeDefined();
      expect(PATHS.DATABASE_FILE.endsWith('.db')).toBe(true);
    });

    it('should have LOGS_DIR defined', () => {
      expect(PATHS.LOGS_DIR).toBeDefined();
      expect(path.isAbsolute(PATHS.LOGS_DIR)).toBe(true);
    });
  });

  describe('Provenance Detection Compatibility', () => {
    it('inbox paths should be detectable as internal', () => {
      const testPath = path.join(PATHS.INBOX_DIR, 'test.md');
      const normalized = testPath.replace(/\\/g, '/');
      expect(normalized.includes('/inbox/') || normalized.endsWith('/inbox')).toBe(true);
    });

    it('external-inbox paths should be detectable as external', () => {
      const testPath = path.join(PATHS.EXTERNAL_INBOX_DIR, 'test.md');
      const normalized = testPath.replace(/\\/g, '/');
      expect(normalized.includes('/external-inbox/') || normalized.endsWith('/external-inbox')).toBe(true);
    });
  });
});
