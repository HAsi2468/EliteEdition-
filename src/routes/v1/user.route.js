const express = require('express');
const validate = require('../../middlewares/validate');
const userValidation = require('../../validations/user.validation');
const userController = require('../../controllers/user.controller');
const { grantAccess } = require('../../middlewares/validateAccessControl');
const { resources } = require('../../config/roles');

const router = express.Router();

router
	.route('/')
	.post(grantAccess('createAny', resources.USERINFO), validate(userValidation.createUser), userController.createUser)
	.get(validate(userValidation.getUsers), userController.getUsers);

router.get('/me', async (req, res) => {
	try {
		if (!req.user || !req.user.id) {
			return res.status(401).json({ success: false, code: 'UNAUTHORIZED', message: 'Unauthorized' });
		}
		const User = require('../../db/models').user || require('../../db/models/user.model');
		const user = await User.findById(req.user.id).select('-password').lean();
		if (!user) {
			return res.status(404).json({ success: false, message: 'User not found' });
		}
		return res.status(200).json({ success: true, user });
	} catch (error) {
		return res.status(500).json({ success: false, code: 'INTERNAL_SERVER_ERROR', message: error.message });
	}
});

router.patch('/me', async (req, res) => {
	try {
		const userId = req.user?.id || req.user?._id;
		if (!userId) {
			return res.status(401).json({ success: false, code: 'UNAUTHORIZED', message: 'Unauthorized' });
		}
		const User = require('../../db/models').user || require('../../db/models/user.model');
		const { name, about, phone, avatarUrl, department } = req.body;
		const updates = {};
		if (typeof name === 'string' && name.trim()) {
			updates.name = name.trim().substring(0, 60);
		}
		if (typeof about === 'string') {
			updates.about = about.trim().substring(0, 200);
		}
		if (typeof phone === 'string') {
			updates.phone = phone.trim().substring(0, 25);
		}
		if (typeof avatarUrl === 'string') {
			updates.avatarUrl = avatarUrl.trim();
		}
		if (typeof department === 'string' && department.trim() && req.user.role === 'admin') {
			updates.department = department.trim().substring(0, 60);
		}
		updates.modified_date_time = new Date();

		const updatedUser = await User.findByIdAndUpdate(userId, { $set: updates }, { new: true })
			.select('-password')
			.lean();

		if (!updatedUser) {
			return res.status(404).json({ success: false, message: 'User not found' });
		}
		return res.status(200).json({ success: true, user: updatedUser });
	} catch (error) {
		return res.status(500).json({ success: false, code: 'INTERNAL_SERVER_ERROR', message: error.message });
	}
});

router
	.route('/:id')
	.get(
		grantAccess('readAny', resources.USERINFO),
		validate(userValidation.getUser),
		userController.getUser
	)
	.patch(
		grantAccess('updateAny', resources.USERINFO),
		validate(userValidation.updateUser),
		userController.updateUser
	)
	.delete(
		grantAccess('deleteAny', resources.USERINFO),
		validate(userValidation.deleteUser),
		userController.deleteUser
	);

module.exports = router;

/**
 * @swagger
 * tags:
 *   name: Users
 *   description: User management and retrieval
 */

/**
 * @swagger
 * /users:
 *    post:
 *      summary: Create a user
 *      description: Only admins can create other users.
 *      tags: [Users]
 *      security:
 *        - bearerAuth: []
 *      requestBody:
 *        required: true
 *        content:
 *          application/json:
 *            schema:
 *              type: object
 *              required:
 *                - name
 *                - email
 *                - password
 *                - role
 *              properties:
 *                name:
 *                  type: string
 *                email:
 *                  type: string
 *                  format: email
 *                  description: must be unique
 *                password:
 *                  type: string
 *                  format: password
 *                  minLength: 8
 *                  description: At least one number and one letter
 *                role:
 *                   type: string
 *                   enum: [user, admin]
 *              example:
 *                name: fake name
 *                email: fake@example.com
 *                password: password1
 *                role: user
 *      responses:
 *        "201":
 *          description: Created
 *          content:
 *            application/json:
 *              schema:
 *                 $ref: '#/components/schemas/User'
 *        "400":
 *          $ref: '#/components/responses/DuplicateEmail'
 *        "401":
 *          $ref: '#/components/responses/Unauthorized'
 *        "403":
 *          $ref: '#/components/responses/Forbidden'
 *
 *    get:
 *      summary: Get all users
 *      description: Only admins can retrieve all users.
 *      tags: [Users]
 *      security:
 *        - bearerAuth: []
 *      parameters:
 *        - in: query
 *          name: name
 *          schema:
 *            type: string
 *          description: User name
 *        - in: query
 *          name: email
 *          schema:
 *            type: string
 *          description: User email
 *        - in: query
 *          name: role
 *          schema:
 *            type: string
 *          description: User role
 *        - in: query
 *          name: sortBy
 *          schema:
 *            type: string
 *          description: sort by query in the form of field:desc/asc (ex. name:asc)
 *        - in: query
 *          name: limit
 *          schema:
 *            type: integer
 *            minimum: 1
 *          default: 10
 *          description: Maximum number of users
 *        - in: query
 *          name: page
 *          schema:
 *            type: integer
 *            minimum: 1
 *            default: 1
 *          description: Page number
 *      responses:
 *        "200":
 *          description: OK
 *          content:
 *            application/json:
 *              schema:
 *                type: object
 *                properties:
 *                  results:
 *                    type: array
 *                    items:
 *                      $ref: '#/components/schemas/User'
 *                  page:
 *                    type: integer
 *                    example: 1
 *                  limit:
 *                    type: integer
 *                    example: 10
 *                  totalPages:
 *                    type: integer
 *                    example: 1
 *                  totalResults:
 *                    type: integer
 *                    example: 1
 *        "401":
 *          $ref: '#/components/responses/Unauthorized'
 *        "403":
 *          $ref: '#/components/responses/Forbidden'
 */

/**
 * @swagger
 * /users/{id}:
 *    get:
 *      summary: Get a user
 *      description: Logged in users can fetch only their own user information. Only admins can fetch other users.
 *      tags: [Users]
 *      security:
 *        - bearerAuth: []
 *      parameters:
 *        - in: path
 *          name: id
 *          required: true
 *          schema:
 *            type: string
 *          description: User id
 *      responses:
 *        "200":
 *          description: OK
 *          content:
 *            application/json:
 *              schema:
 *                 $ref: '#/components/schemas/User'
 *        "401":
 *          $ref: '#/components/responses/Unauthorized'
 *        "403":
 *          $ref: '#/components/responses/Forbidden'
 *        "404":
 *          $ref: '#/components/responses/NotFound'
 *
 *    patch:
 *      summary: Update a user
 *      description: Logged in users can only update their own information. Only admins can update other users.
 *      tags: [Users]
 *      security:
 *        - bearerAuth: []
 *      parameters:
 *        - in: path
 *          name: id
 *          required: true
 *          schema:
 *            type: string
 *          description: User id
 *      requestBody:
 *        required: true
 *        content:
 *          application/json:
 *            schema:
 *              type: object
 *              properties:
 *                name:
 *                  type: string
 *                email:
 *                  type: string
 *                  format: email
 *                  description: must be unique
 *                password:
 *                  type: string
 *                  format: password
 *                  minLength: 8
 *                  description: At least one number and one letter
 *              example:
 *                name: fake name
 *                email: fake@example.com
 *                password: password1
 *      responses:
 *        "200":
 *          description: OK
 *          content:
 *            application/json:
 *              schema:
 *                 $ref: '#/components/schemas/User'
 *        "400":
 *          $ref: '#/components/responses/DuplicateEmail'
 *        "401":
 *          $ref: '#/components/responses/Unauthorized'
 *        "403":
 *          $ref: '#/components/responses/Forbidden'
 *        "404":
 *          $ref: '#/components/responses/NotFound'
 *
 *    delete:
 *      summary: Delete a user
 *      description: Logged in users can delete only themselves. Only admins can delete other users.
 *      tags: [Users]
 *      security:
 *        - bearerAuth: []
 *      parameters:
 *        - in: path
 *          name: id
 *          required: true
 *          schema:
 *            type: string
 *          description: User id
 *      responses:
 *        "200":
 *          description: No content
 *        "401":
 *          $ref: '#/components/responses/Unauthorized'
 *        "403":
 *          $ref: '#/components/responses/Forbidden'
 *        "404":
 *          $ref: '#/components/responses/NotFound'
 */
