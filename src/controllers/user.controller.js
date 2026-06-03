const httpStatus = require('http-status');
const catchAsync = require('../utils/catchAsync');
const ApiError = require('../utils/ApiError');
const { userService } = require('../services');

const getUsers = catchAsync(async (req, res) => {
	const users = await userService.getUsers(req);
	res.send({ users });
});

const getUser = catchAsync(async (req, res) => {
	const userId = req.params?.id;
	if (!userId) {
		throw new ApiError(httpStatus.BAD_REQUEST, '`id` param is required');
	}
	const user = await userService.getUserById(userId);

	if (!user) {
		throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
	}

	delete user.password;
	res.send({ user });
});

const deleteUser = catchAsync(async (req, res) => {
	const userId = req.params?.id;
	if (!userId) {
		throw new ApiError(httpStatus.BAD_REQUEST, '`id` param is required');
	}
	await userService.deleteUserById(userId);
	res.send({ success: true });
});

const createUser = catchAsync(async (req, res) => {
	// Expect body: { name, email, password, role }
	const user = await userService.createUser(req);
	if (!user) {
		throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to create user');
	}
	delete user.password;
	res.status(httpStatus.CREATED).send({ user });
});

const updateUser = catchAsync(async (req, res) => {
	if (!req.params?.id) {
		throw new ApiError(httpStatus.BAD_REQUEST, '`id` param is required');
	}
	const user = await userService.updateUser(req);

	if (!user) {
		throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
	}

	delete user.password;
	res.send({ user });
});

module.exports = {
	getUsers,
	getUser,
	createUser,
	updateUser,
	deleteUser,
};
