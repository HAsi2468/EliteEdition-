const { z } = require('zod');
const {
  entityIdSchema,
  createPaginationQuerySchema,
  strictBody,
} = require('./common.schemas');

/**
 * Route parameters schema for user identifier (ObjectId or UUID)
 */
const getUserParamsSchema = {
  params: z
    .object({
      userId: entityIdSchema,
    })
    .strict(),
};

/**
 * Profile update schema:
 * Enforces .strict() to reject undeclared privilege elevation fields
 * such as "isAdmin", "role", "permissions", or "balance".
 */
const updateProfileSchema = {
  body: strictBody({
    name: z.string().trim().min(1).max(100).optional(),
    phone: z.string().trim().max(20).optional(),
    avatar: z.string().trim().url({ message: 'Invalid avatar URL' }).optional(),
    bio: z.string().trim().max(500).optional(),
  }),
};

/**
 * Users listing query schema with strict sort fields and clamped pagination
 */
const getUsersQuerySchema = {
  query: createPaginationQuerySchema(
    ['createdAt', 'updatedAt', 'name', 'status', 'email'],
    'createdAt',
    'desc'
  ),
};

module.exports = {
  getUserParamsSchema,
  updateProfileSchema,
  getUsersQuerySchema,
};
