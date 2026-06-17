const Joi = require('@hapi/joi');
const { password } = require('./custom.validation');

const createUser = {
	body: Joi.object().keys({
		email: Joi.string().required().email(),
		password: Joi.string().required().custom(password),
		name: Joi.string().required(),
		role: Joi.string().valid('admin', 'user').required(),
		permissions: Joi.array().items(Joi.string()).optional(),
	}),
};

const getUsers = {
	query: Joi.object().keys({
		name: Joi.string(),
		email: Joi.string().email(),
		limit: Joi.number().min(1),
		page: Joi.number().min(1),
	}),
};

const getUser = {
	params: Joi.object().keys({
		id: Joi.string().required(),
	}),
};

const updateUser = {
	params: Joi.object().keys({
		id: Joi.required(),
	}),
	body: Joi.object()
		.keys({
			email: Joi.string().email(),
			password: Joi.string().custom(password),
			name: Joi.string(),
			role: Joi.string().valid('admin', 'user'),
			permissions: Joi.array().items(Joi.string()),
		})
		.min(1),
};

const deleteUser = {
	params: Joi.object().keys({
		id: Joi.string().required(),
	}),
};

module.exports = {
	createUser,
	getUsers,
	getUser,
	updateUser,
	deleteUser,
};
