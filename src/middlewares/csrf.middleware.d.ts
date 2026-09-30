import { Request, Response, NextFunction } from 'express';
import { CsrfManager } from '../utils/csrfManager';

export interface CsrfMiddlewareOptions {
  manager?: CsrfManager;
  exemptRoutes?: (string | RegExp)[];
}

export function createCsrfMiddleware(
  options?: CsrfMiddlewareOptions
): (req: Request, res: Response, next: NextFunction) => void;

export const verifyCsrfToken: (
  req: Request,
  res: Response,
  next: NextFunction
) => void;
