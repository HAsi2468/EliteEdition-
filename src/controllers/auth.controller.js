const httpStatus = require('http-status').default;
const catchAsync = require('../utils/catchAsync');
const ApiError = require('../utils/ApiError');
const {
	authService,
	userService,
	emailService,
	tokenService,
} = require('../services');
const { verifyToken } = require('../utils/auth');

const register = catchAsync(async (req, res) => {
	const user = await userService.createUser(req);
	const tokens = await tokenService.generateAuthTokens({
		userId: user.id,
	});
	delete user.password;
	res.status(httpStatus.CREATED).send({ user, tokens });
});

const login = catchAsync(async (req, res) => {
	const user = await authService.loginUserWithEmailAndPassword(req);
	const tokens = await tokenService.generateAuthTokens({
		userId: user.id,
	});
	res.send({ user, tokens });
});

const refreshTokens = catchAsync(async (req, res) => {
	const refreshToken = req.body?.refreshToken || req.cookies?.refreshToken;
	if (!refreshToken) {
		throw new ApiError(httpStatus.UNAUTHORIZED, 'Refresh token required');
	}
	const payload = await verifyToken(refreshToken);
	if (!payload || !payload.userId) {
		throw new ApiError(httpStatus.UNAUTHORIZED, 'Invalid or expired refresh token');
	}
	const user = await userService.getUserById(payload.userId);
	if (!user) {
		throw new ApiError(httpStatus.UNAUTHORIZED, 'User not found');
	}
	const tokens = await tokenService.generateAuthTokens({
		userId: user.id,
	});
	res.send({ user, tokens });
});

const forgotPassword = catchAsync(async (req, res) => {
	const resetPasswordToken = await tokenService.generateResetPasswordToken(
		req.body.email
	);
	await emailService.sendResetPasswordEmail(
		req.body.email,
		resetPasswordToken
	);
	res.send({ success: true });
});

const resetPassword = catchAsync(async (req, res) => {
	const { id } = await verifyToken(req.query.token);
	req.body.id = id;
	await userService.updateUser(req);
	res.send({ success: true });
});

module.exports = {
	register,
	login,
	refreshTokens,
	forgotPassword,
	resetPassword,
};
