export class InvalidMongoIdentifierException extends Error {
  identifier?: string;
  constructor(message: string, identifier?: string);
}

export const ALLOWED_SORT_FIELDS: {
  readonly createdAt: 'createdAt';
  readonly updatedAt: 'updatedAt';
  readonly name: 'name';
  readonly status: 'status';
  readonly totalAmount: 'totalAmount';
  readonly jobNumber: 'jobNumber';
  readonly lotNumber: 'lotNumber';
  readonly totalMeters: 'totalMeters';
  readonly email: 'email';
  readonly id: '_id';
};

export const ALLOWED_FILTER_FIELDS: {
  readonly status: 'status';
  readonly companyId: 'companyId';
  readonly createdBy: 'createdBy';
  readonly clientName: 'clientName';
  readonly fabricType: 'fabricType';
  readonly isDeleted: 'isDeleted';
  readonly role: 'role';
  readonly department: 'department';
};

export const SAFE_DEFAULT_PROJECTION: Record<string, number>;

export function resolveMongoSort(
  clientSort?: string,
  order?: 'asc' | 'desc' | 'ASC' | 'DESC',
  dictionary?: Record<string, string>
): Record<string, 1 | -1>;

export interface SafeMongoQueryOptions {
  filter?: Record<string, any>;
  search?: string | null;
  searchFields?: string[];
  sortBy?: string;
  order?: 'asc' | 'desc' | 'ASC' | 'DESC';
  page?: number;
  limit?: number;
  sortDictionary?: Record<string, string>;
  filterDictionary?: Record<string, string>;
  customProjection?: Record<string, number> | null;
}

export function buildSafeMongoQuery(options?: SafeMongoQueryOptions): {
  filter: Record<string, any>;
  sort: Record<string, 1 | -1>;
  skip: number;
  limit: number;
  projection: Record<string, number>;
};
