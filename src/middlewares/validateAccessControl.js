const httpStatus = require('http-status');
const { roles } = require('../config/roles');
const ApiError = require('../utils/ApiError');

function grantAccess(action, resource) {
	return async (req, _res, next) => {
		try {
			// Safely determine ownership without throwing when req.user or req.params are undefined
			const userId = req.user && req.user.userId ? req.user.userId : null;
			const paramUserId = req.params && req.params.id ? req.params.id : null;
			const isOwnedUser = userId && paramUserId && userId == paramUserId;
			const modifiedAction = isOwnedUser
				? action.replace('Any', 'Own')
				: action;

			// Currently the middleware does not enforce permissions; it only adjusts action for later checks.
			// If you have an authorization library, you would use `modifiedAction` and `resource` here.
			next();
		} catch (error) {
			next(error);
		}
	};
}

module.exports = { grantAccess };
