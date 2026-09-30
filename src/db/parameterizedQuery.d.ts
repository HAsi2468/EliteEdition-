import { PoolClient, QueryResult } from 'pg';

export class UnsafeQueryException extends Error {
  querySample?: string;
  constructor(message: string, querySample?: string);
}

export function assertNoRawInterpolation(queryText: string): void;

export function auditRepositoryMethod(
  fnOrCode: Function | string
): { safe: boolean; violations: string[] };

export function safeQuery<R = any>(
  text: string,
  params?: any[],
  client?: PoolClient | null,
  statementName?: string | null
): Promise<QueryResult<R>>;

export function executeSafeTransaction<T>(
  transactionFn: (client: PoolClient) => Promise<T>
): Promise<T>;
