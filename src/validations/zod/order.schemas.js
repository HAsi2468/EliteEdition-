const { z } = require('zod');
const {
  objectIdSchema,
  createPaginationQuerySchema,
  strictBody,
} = require('./common.schemas');

/**
 * Route parameter schema for order identifier (MongoDB ObjectId)
 */
const getOrderParamsSchema = {
  params: z
    .object({
      orderId: objectIdSchema,
    })
    .strict(),
};

/**
 * Query schema for order listing with strict enum allowlist for sortBy
 * Enforces z.enum(['createdAt', 'name', 'status', 'totalAmount', 'orderNumber'])
 */
const getOrdersQuerySchema = {
  query: createPaginationQuerySchema(
    ['createdAt', 'updatedAt', 'name', 'status', 'totalAmount', 'orderNumber'],
    'createdAt',
    'desc'
  ),
};

/**
 * Order creation schema with strict body checking
 */
const createOrderSchema = {
  body: strictBody({
    name: z.string().trim().min(1, { message: 'Order name cannot be empty' }).max(150),
    orderNumber: z.string().trim().min(1).max(50).optional(),
    customer: objectIdSchema,
    items: z
      .array(
        z
          .object({
            productId: objectIdSchema,
            quantity: z.number().int().positive({ message: 'Quantity must be positive' }),
            unitPrice: z.number().nonnegative({ message: 'Unit price cannot be negative' }),
          })
          .strict()
      )
      .min(1, { message: 'Order must contain at least one item' }),
    totalAmount: z.number().nonnegative().optional(),
    notes: z.string().trim().max(500).optional(),
  }),
};

module.exports = {
  getOrderParamsSchema,
  getOrdersQuerySchema,
  createOrderSchema,
};
