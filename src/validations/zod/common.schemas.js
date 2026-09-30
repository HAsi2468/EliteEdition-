const { z } = require('zod');

/**
 * MongoDB 24-character hexadecimal ObjectId schema
 * Enforces strict 24-hex pattern verification
 */
const objectIdSchema = z.string().refine((val) => /^[0-9a-fA-F]{24}$/.test(val), {
  message: 'Invalid MongoDB ObjectId',
});

// Backward-compatible alias
const mongoIdSchema = objectIdSchema;

/**
 * Standard RFC 4122 UUID schema (v1-v5)
 */
const uuidSchema = z.string().trim().uuid({
  message: 'Invalid UUID format',
});

/**
 * Flexible entity identifier accepting either standard UUID or MongoDB ObjectId
 */
const entityIdSchema = z.union([objectIdSchema, uuidSchema], {
  errorMap: () => ({
    message: 'Invalid ID: must be a valid 24-hex ObjectId or RFC UUID',
  }),
});

/**
 * Positive integer coercion schema (e.g. for relational sequence IDs)
 */
const positiveIntIdSchema = z.coerce
  .number()
  .int()
  .positive({ message: 'ID must be a positive integer' });

/**
 * Clean, trimmed email schema (immune to NoSQL object injection)
 */
const emailSchema = z
  .string({ required_error: 'Email is required', invalid_type_error: 'Email must be a string' })
  .trim()
  .min(1, { message: 'Email cannot be empty' })
  .email({ message: 'Invalid email format' })
  .toLowerCase();

/**
 * Enforced primitive password schema (immune to NoSQL object injection)
 */
const passwordSchema = z
  .string({ required_error: 'Password is required', invalid_type_error: 'Password must be a string' })
  .min(8, { message: 'Password must be at least 8 characters long' })
  .regex(/\d/, { message: 'Password must contain at least one numeric digit' })
  .regex(/[a-zA-Z]/, {
    message: 'Password must contain at least one alphabetic character',
  });

/**
 * Forbidden privileged fields targeted in mass-assignment and privilege escalation attacks
 */
const PRIVILEGED_FIELDS = ['role', 'isAdmin', 'isVerified', 'permissions', 'balance'];

/**
 * Refinement helper that explicitly rejects injection of privileged fields
 *
 * @param {import('zod').ZodTypeAny} schema
 * @returns {import('zod').ZodTypeAny}
 */
function rejectPrivilegedFields(schema) {
  return schema.superRefine((data, ctx) => {
    if (data && typeof data === 'object') {
      for (const field of PRIVILEGED_FIELDS) {
        if (field in data) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Modification of privileged field '${field}' is strictly prohibited`,
            path: [field],
          });
        }
      }
    }
  });
}

/**
 * Pagination & Sorting Query Schema Generator with strict enum allowlist
 *
 * @param {string[]} allowedSortFields List of valid field names for sorting
 * @param {string} [defaultSort='createdAt']
 * @param {'asc' | 'desc'} [defaultOrder='desc']
 */
function createPaginationQuerySchema(
  allowedSortFields = ['createdAt', 'updatedAt'],
  defaultSort = 'createdAt',
  defaultOrder = 'desc'
) {
  if (!allowedSortFields || allowedSortFields.length === 0) {
    throw new Error('createPaginationQuerySchema requires at least one allowedSortField');
  }

  return z
    .object({
      page: z.coerce
        .number({ invalid_type_error: 'page must be a number' })
        .int({ message: 'page must be an integer' })
        .min(1, { message: 'page must be greater than or equal to 1' })
        .default(1),
      limit: z.coerce
        .number({ invalid_type_error: 'limit must be a number' })
        .int({ message: 'limit must be an integer' })
        .min(1, { message: 'limit must be greater than or equal to 1' })
        .max(100, { message: 'limit cannot exceed 100 records per page' })
        .default(20),
      sortBy: z
        .enum(allowedSortFields, {
          message: `Invalid sortBy field. Allowed fields: [${allowedSortFields.join(', ')}]`,
        })
        .default(defaultSort),
      order: z
        .enum(['asc', 'desc'], {
          message: "order must be either 'asc' or 'desc'",
        })
        .default(defaultOrder),
      search: z.string().trim().max(100).optional(),
    })
    .strict();
}

/**
 * Helper factory that enforces `.strict()` across request body schemas
 * and actively blocks privileged escalation fields.
 *
 * @param {import('zod').ZodRawShape} shape
 * @returns {z.ZodObject}
 */
function strictBody(shape) {
  return rejectPrivilegedFields(z.object(shape).strict());
}

module.exports = {
  objectIdSchema,
  mongoIdSchema,
  uuidSchema,
  entityIdSchema,
  positiveIntIdSchema,
  emailSchema,
  passwordSchema,
  PRIVILEGED_FIELDS,
  rejectPrivilegedFields,
  createPaginationQuerySchema,
  strictBody,
};
