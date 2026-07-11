import { NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { ApiError } from './errors';
import { errorResponse } from './response';
import { logger } from '../logger';

type RouteHandler = (req: NextRequest, ...args: any[]) => Promise<NextResponse> | NextResponse;

export function withErrorHandler(handler: RouteHandler): RouteHandler {
  return async (req: NextRequest, ...args: any[]) => {
    const path = req.nextUrl?.pathname || req.url || 'unknown path';
    try {
      return await handler(req, ...args);
    } catch (error: any) {
      if (error instanceof ZodError || error.name === 'ZodError') {
        const zodError = error as any;
        logger.warn('Validation Error', { path, errors: zodError.errors });
        return errorResponse(
          'Datos de entrada inválidos',
          'VALIDATION_ERROR',
          400,
          zodError.errors.map((e: any) => ({ field: e.path.join('.'), message: e.message }))
        );
      }

      if (error instanceof ApiError) {
        // We log 4xx as warnings (except 404), and 5xx as errors
        if (error.statusCode >= 500) {
          logger.error(`API Error: ${error.message}`, error, { path, code: error.code });
        } else if (error.statusCode !== 404) {
          logger.warn(`API Warning: ${error.message}`, { path, code: error.code });
        }
        return errorResponse(error.message, error.code, error.statusCode, error.details);
      }

      // Unhandled Internal Errors
      logger.error('Unhandled API Error', error, { path });
      return errorResponse('Error interno del servidor', 'INTERNAL_ERROR', 500);
    }
  };
}
