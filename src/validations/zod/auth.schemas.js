const { z } = require('zod');
const { emailSchema, passwordSchema, strictBody } = require('./common.schemas');

/**
 * Authentication login schema:
 * Enforces strict string primitives for email and password, blocking NoSQL objects like {"$gt": ""}
 */
const loginSchema = {
  body: strictBody({
    email: emailSchema,
    password: z
      .string({
        required_error: 'Password is required',
        invalid_type_error: 'Password must be a string',
      })
      .min(1, { message: 'Password cannot be empty' }),
  }),
};

/**
 * User registration schema:
 * Strictly blocks mass assignment of elevated roles (e.g. role, isAdmin)
 */
const registerSchema = {
  body: strictBody({
    name: z
      .string({ required_error: 'Name is required' })
      .trim()
      .min(2, { message: 'Name must be at least 2 characters long' })
      .max(100, { message: 'Name cannot exceed 100 characters' }),
    email: emailSchema,
    password: passwordSchema,
    companyId: z.string().trim().optional(),
  }),
};

module.exports = {
  loginSchema,
  registerSchema,
};
