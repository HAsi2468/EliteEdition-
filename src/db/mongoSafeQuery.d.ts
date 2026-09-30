import { Model } from 'mongoose';

export class UnsafeMongoQueryException extends Error {
  querySample?: any;
  constructor(message: string, querySample?: any);
}

export function safeRegexEscape(str: string): string;

export function assertNoUnsanitizedOperators(value: any, path?: string): void;

export function auditMongoRepositoryMethod(
  fnOrCode: Function | string
): { safe: boolean; violations: string[] };

export interface SafeMongoFindOptions {
  projection?: Record<string, number> | string | null;
  sort?: Record<string, number>;
  skip?: number;
  limit?: number;
  maxTimeMS?: number;
}

export function safeMongoFind<T = any>(
  model: Model<any>,
  filter?: Record<string, any>,
  options?: SafeMongoFindOptions
): Promise<T[]>;
