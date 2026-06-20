/**
 * Validation Middleware Tests
 * 
 * Tests for the request validation middleware
 */

import { describe, it, expect } from 'vitest';
import { validate, schemas } from '../../src/middleware/validate.js';
import { Request, Response } from 'express';

describe('Validation Middleware', () => {
  describe('validateField', () => {
    it('should require required fields', () => {
      const mockReq = { body: {} } as Request;
      const mockRes = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn().mockReturnThis()
      } as unknown as Response;
      const mockNext = vi.fn();

      validate(schemas.memorySearch)(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Validation failed',
        details: ["'query' is required"]
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should pass validation for valid input', () => {
      const mockReq = { body: { query: 'test query' } } as Request;
      const mockRes = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn().mockReturnThis()
      } as unknown as Response;
      const mockNext = vi.fn();

      validate(schemas.memorySearch)(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should validate string minLength', () => {
      const mockReq = { body: { query: '' } } as Request;
      const mockRes = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn().mockReturnThis()
      } as unknown as Response;
      const mockNext = vi.fn();

      validate(schemas.memorySearch)(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    it('should validate number range', () => {
      const mockReq = { body: { query: 'test', max_chars: -1 } } as Request;
      const mockRes = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn().mockReturnThis()
      } as unknown as Response;
      const mockNext = vi.fn();

      validate(schemas.memorySearch)(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    it('should validate array type', () => {
      const mockReq = { body: { query: 'test', buckets: 'not-an-array' } } as Request;
      const mockRes = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn().mockReturnThis()
      } as unknown as Response;
      const mockNext = vi.fn();

      validate(schemas.memorySearch)(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    it('should validate array item types', () => {
      const mockReq = { body: { query: 'test', buckets: [1, 2, 3] } } as Request;
      const mockRes = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn().mockReturnThis()
      } as unknown as Response;
      const mockNext = vi.fn();

      validate(schemas.memorySearch)(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });
  });

  describe('Schemas', () => {
    it('should have ingest schema', () => {
      expect(schemas.ingest).toBeDefined();
      expect(schemas.ingest.content).toBeDefined();
    });

    it('should have memorySearch schema', () => {
      expect(schemas.memorySearch).toBeDefined();
      expect(schemas.memorySearch.query).toBeDefined();
    });

    it('should have githubRepos schema', () => {
      expect(schemas.githubRepos).toBeDefined();
      expect(schemas.githubRepos.url).toBeDefined();
      expect(schemas.githubRepos.bucket).toBeDefined();
    });

    it('should have terminalExec schema', () => {
      expect(schemas.terminalExec).toBeDefined();
      expect(schemas.terminalExec.command).toBeDefined();
    });

    it('should have configIngestion schema', () => {
      expect(schemas.configIngestion).toBeDefined();
    });
  });
});

// Import vi for mocking
import { vi } from 'vitest';