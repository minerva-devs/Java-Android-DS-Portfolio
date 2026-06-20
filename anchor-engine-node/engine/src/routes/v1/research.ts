import type { Application, Request, Response } from 'express';

export function setupResearchRoutes(app: Application) {
  // Stub implementation
  app.get('/v1/research', async (_req: Request, res: Response) => {
    res.json({ status: 'ok', message: 'Research stub - not implemented' });
  });
}