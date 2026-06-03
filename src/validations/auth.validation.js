const Joi = require('@hapi/joi');
const { password } = require('./custom.validation');

const register = {
	body: Joi.object().keys({
		email: Joi.string().required().email(),
		password: Joi.string().required().min(8).regex(/^(?=.*[A-Za-z])(?=.*\d).+$/).message('password must be at least 8 characters and contain at least 1 letter and 1 number'),
		name: Joi.string().required(),
		role: Joi.string().required(),
	}),
};

const login = {
	body: Joi.object().keys({
		email: Joi.string().required(),
		password: Joi.string().required(),
	}),
};

const forgotPassword = {
	body: Joi.object().keys({
		email: Joi.string().email().required(),
	}),
};

const resetPassword = {
	query: Joi.object().keys({
		token: Joi.string().required(),
	}),
	body: Joi.object().keys({
		password: Joi.string().required().min(8).regex(/^(?=.*[A-Za-z])(?=.*\d).+$/).message('password must be at least 8 characters and contain at least 1 letter and 1 number'),
	}),
};

module.exports = {
	register,
	login,
	forgotPassword,
	resetPassword,
};
