import { ErrorRequestHandler } from 'express';

export function maskSensitiveParameters<T>(value: T): T;

export function isPostgresError(err: any): boolean;

export const databaseErrorHandler: ErrorRequestHandler;
