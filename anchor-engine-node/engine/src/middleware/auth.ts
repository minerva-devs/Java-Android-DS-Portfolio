/**
 * API Key Authentication Middleware for Anchor Engine
 *
 * Validates Bearer token from Authorization header against the configured API key.
 * An API key is REQUIRED - the engine will not start without one configured.
 * Configure in user_settings.json: { "server": { "api_key": "your-secret-key" } }
 */

import type { Request, Response, NextFunction } from 'express';
import { config } from '../config/index.js';

/**
 * Express middleware that validates API key from Authorization header.
 * Reads the key from config.API_KEY (sourced from user_settings.json → server.api_key).
 */
export function apiKeyAuth(req: Request, res: Response, next: NextFunction): void {
  const apiKey = config.API_KEY;

  // Allow health endpoints without auth (public monitoring)
  // SECURITY FIX (Standard 131): Remove /v1/test/* bypass - test endpoints can expose data or write to filesystem
  if (req.path === '/health' || req.path.startsWith('/health/')) {
    return next();
  }

  const authHeader = req.headers.authorization;

  if (!authHeader) {
    res.status(401).json({
      error: 'Authentication required',
      message: 'Provide an API key via Authorization: Bearer <key>',
    });
    return;
  }

  // Support "Bearer <key>" format
  const token = authHeader.startsWith('Bearer ')
    ? authHeader.slice(7).trim()
    : authHeader.trim();

  if (token !== apiKey) {
    res.status(403).json({
      error: 'Invalid API key',
      message: 'The provided API key is not valid',
    });
    return;
  }

  next();
}