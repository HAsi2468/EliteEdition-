const { z } = require('zod');

const stockOutItemSchema = z.object({
  skuCode: z.string({ required_error: 'skuCode is required' }).trim().min(1, 'skuCode cannot be empty'),
  party: z.string({ required_error: 'party is required' }).trim().min(1, 'party cannot be empty'),
  qtyOut: z.coerce.number().int().positive().default(1),
  facility: z.string().trim().optional(),
});

const stockOutPayloadSchema = z.union([
  stockOutItemSchema,
  z.array(stockOutItemSchema).min(1, 'At least one item is required'),
  z.object({
    items: z.array(stockOutItemSchema).min(1, 'At least one item is required'),
  }),
]);

module.exports = {
  stockOutItemSchema,
  stockOutPayloadSchema,
};
