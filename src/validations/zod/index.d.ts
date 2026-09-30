import { z } from 'zod';

export const objectIdSchema: z.ZodEffects<z.ZodString, string, string>;
export const mongoIdSchema: typeof objectIdSchema;
export const uuidSchema: z.ZodString;
export const entityIdSchema: z.ZodUnion<[typeof objectIdSchema, typeof uuidSchema]>;
export const positiveIntIdSchema: z.ZodNumber;
export const emailSchema: z.ZodString;
export const passwordSchema: z.ZodString;

export const PRIVILEGED_FIELDS: readonly ['role', 'isAdmin', 'isVerified', 'permissions', 'balance'];
export function rejectPrivilegedFields<T extends z.ZodTypeAny>(schema: T): T;

export function createPaginationQuerySchema<T extends [string, ...string[]]>(
  allowedSortFields?: T | string[],
  defaultSort?: string,
  defaultOrder?: 'asc' | 'desc'
): z.ZodObject<any>;

export function strictBody<T extends z.ZodRawShape>(shape: T): z.ZodObject<T>;

export const loginSchema: {
  body: z.ZodObject<{
    email: typeof emailSchema;
    password: z.ZodString;
  }>;
};

export const registerSchema: {
  body: z.ZodObject<{
    name: z.ZodString;
    email: typeof emailSchema;
    password: typeof passwordSchema;
    companyId?: z.ZodOptional<z.ZodString>;
  }>;
};

export const getUserParamsSchema: {
  params: z.ZodObject<{
    userId: typeof entityIdSchema;
  }>;
};

export const updateProfileSchema: {
  body: z.ZodObject<{
    name?: z.ZodOptional<z.ZodString>;
    phone?: z.ZodOptional<z.ZodString>;
    avatar?: z.ZodOptional<z.ZodString>;
    bio?: z.ZodOptional<z.ZodString>;
  }>;
};

export const getUsersQuerySchema: {
  query: z.ZodObject<any>;
};

export const getOrderParamsSchema: {
  params: z.ZodObject<{
    orderId: typeof objectIdSchema;
  }>;
};

export const getOrdersQuerySchema: {
  query: z.ZodObject<any>;
};

export const createOrderSchema: {
  body: z.ZodObject<any>;
};
