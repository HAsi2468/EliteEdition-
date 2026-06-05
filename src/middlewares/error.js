const httpStatus = require('http-status').default;
const config = require('../config/config');
const logger = require('../config/logger');
const ApiError = require('../utils/ApiError');

const errorConverter = (err, req, res, next) => {
	let error = err;
	if (!(error instanceof ApiError)) {
		const statusCode = error.statusCode || httpStatus.INTERNAL_SERVER_ERROR;
		const message = error.message || httpStatus[statusCode];
		error = new ApiError(statusCode, message, false, err.stack);
	}
	next(error);
};

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
	let statusCode;
	let message;
	if (err && typeof err === 'object') {
		statusCode = err.statusCode;
		message = err.message;
	}
	// Ensure we have a valid numeric status code
	if (!Number.isInteger(statusCode) || statusCode < 100 || statusCode > 599) {
		statusCode = httpStatus.INTERNAL_SERVER_ERROR;
	}
	if (!message) {
		message = httpStatus[statusCode] || 'Error';
	}
	if (config.env === 'production' && !err?.isOperational) {
		statusCode = httpStatus.INTERNAL_SERVER_ERROR;
		message = httpStatus[httpStatus.INTERNAL_SERVER_ERROR];
	}

	res.locals.errorMessage = err.message || message;

	const response = {
		code: statusCode,
		message,
		...(config.env === 'development' && { stack: err.stack }),
	};

	if (config.env === 'development') {
		logger.error(err);
	}

	res.status(statusCode).send(response);
};

module.exports = {
	errorConverter,
	errorHandler,
};
