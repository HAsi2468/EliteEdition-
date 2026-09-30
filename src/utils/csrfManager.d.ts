import { Request, Response } from 'express';

export const DEFAULT_CSRF_TTL_MS: number;

export interface CsrfVerificationResult {
  valid: boolean;
  reason?: 'CSRF_TOKEN_MISSING' | 'CSRF_TOKEN_INVALID' | 'CSRF_TOKEN_EXPIRED';
  message?: string;
}

export class CsrfManager {
  constructor(secret?: string, ttlMs?: number);
  getSecret(): string;
  setSecret(newSecret: string): void;
  generateToken(): string;
  safeCompare(a: string, b: string): boolean;
  verifyToken(token?: string | null): CsrfVerificationResult;
  issueCookie(res: Response, token: string): void;
  handshakeHandler(req: Request, res: Response): void;
}

export const csrfManager: CsrfManager;
