export class InvalidIdentifierException extends Error {
  identifier?: string;
  constructor(message: string, identifier?: string);
}

export const SORT_COLUMNS: {
  readonly createdAt: 'created_at';
  readonly updatedAt: 'updated_at';
  readonly name: 'customer_name';
  readonly status: 'status';
  readonly totalAmount: 'total_amount';
  readonly jobNumber: 'job_number';
  readonly totalMeters: 'total_meters';
  readonly availableMeters: 'available_meters';
  readonly lotNumber: 'lot_number';
  readonly id: 'id';
};

export const ALLOWED_TABLES: {
  readonly orders: 'orders';
  readonly users: 'users';
  readonly job_cards: 'job_cards';
  readonly lots: 'lots';
  readonly job_card_lot_usages: 'job_card_lot_usages';
  readonly lot_inventory_ledger: 'lot_inventory_ledger';
  readonly delivery_challans: 'delivery_challans';
};

export const FILTER_COLUMNS: {
  readonly status: 'status';
  readonly companyId: 'company_id';
  readonly createdBy: 'created_by';
  readonly clientName: 'client_name';
  readonly fabricType: 'fabric_type';
  readonly isDeleted: 'is_deleted';
};

export function safeQuoteIdentifier(identifier: string): string;

export function resolveSortColumn(
  clientField: string,
  dictionary?: Record<string, string>
): string;

export interface SafeSelectOptions {
  table: string;
  select?: string[];
  where?: Record<string, any>;
  search?: string | null;
  searchColumns?: string[];
  sortBy?: string;
  order?: 'asc' | 'desc' | 'ASC' | 'DESC';
  page?: number;
  limit?: number;
  sortDictionary?: Record<string, string>;
  filterDictionary?: Record<string, string>;
}

export function buildSafeSelectQuery(options: SafeSelectOptions): {
  text: string;
  values: any[];
};
