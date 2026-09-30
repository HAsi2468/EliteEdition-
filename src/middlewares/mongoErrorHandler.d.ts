import { ErrorRequestHandler } from 'express';

export function maskSensitiveParameters<T>(value: T): T;

export function isMongoError(err: any): boolean;

export const mongoErrorHandler: ErrorRequestHandler;
