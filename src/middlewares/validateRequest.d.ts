import { RequestHandler, Request } from 'express';
import { ZodTypeAny, ZodError } from 'zod';

export interface ValidationSchemas {
  body?: ZodTypeAny;
  query?: ZodTypeAny;
  params?: ZodTypeAny;
  headers?: ZodTypeAny;
}

export interface ValidationErrorDetail {
  field: string;
  message: string;
  code: string;
}

export interface Rfc7807ValidationError {
  type: string;
  title: string;
  status: number;
  error: string;
  message: string;
  instance: string;
  timestamp: string;
  details: ValidationErrorDetail[];
}

export function stripNoSqlOperators<T>(value: T): T;

export function formatZodDetails(
  error: ZodError,
  target: 'body' | 'query' | 'params' | 'headers'
): ValidationErrorDetail[];

export function createRfc7807ValidationError(
  details: ValidationErrorDetail[],
  instanceUrl?: string,
  message?: string
): Rfc7807ValidationError;

export function validateRequest(schemas?: ValidationSchemas): RequestHandler;

export const noSqlSanitizerMiddleware: RequestHandler;
