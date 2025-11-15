import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';

import { logger } from '../utils/logger.js';

export function errorHandler(
  error: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (error instanceof ZodError) {
    res.status(400).json({
      status: 'error',
      message: 'Validation failed',
      details: error.flatten()
    });
    return;
  }

  logger.error({ err: error }, 'Unhandled error');

  res.status(500).json({
    status: 'error',
    message: 'Internal server error'
  });
}
