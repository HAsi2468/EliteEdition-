import { Request, Response, NextFunction } from 'express';

export function isUnsafeGetMutation(req: Request): { unsafe: boolean; reason?: string };

export function safeRestGuard(req: Request, res: Response, next: NextFunction): void;
