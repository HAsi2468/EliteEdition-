const httpStatus = require('http-status').default;
const { getOffset } = require('../utils/query');
const ApiError = require('../utils/ApiError');
const { encryptData } = require('../utils/auth');
const config = require('../config/config.js');
const db = require('../db/models');

async function getUserByEmail(email) {
	const user = await db.user.findOne({ email }).lean();
	if (user) {
		user.id = user._id.toString();
	}
	return user;
}

async function getUserById(id) {
	const user = await db.user.findOne({ _id: id }).lean();
	if (user) {
		user.id = user._id.toString();
	}
	return user;
}

async function createUser(req) {
  const { email, name, password, role } = req.body;
  // Validate required role field
  if (!role) {
    throw new ApiError(httpStatus.BAD_REQUEST, '`role` is required');
  }
  const hashedPassword = await encryptData(password);
  const user = await getUserByEmail(email);

  if (user) {
    throw new ApiError(httpStatus.CONFLICT, 'This email already exists');
  }

  const createdUserDoc = await db.user.create({
    name,
    email,
    password: hashedPassword,
    role,
  });

  const createdUser = createdUserDoc.toObject();
  createdUser.id = createdUser._id.toString();

  return createdUser;
}

async function getUsers(req) {
	const { page: defaultPage, limit: defaultLimit } = config.pagination;
	const { page = defaultPage, limit = defaultLimit } = req.query;

	const offset = getOffset(page, limit);

	const usersList = await db.user.find({}, { password: 0 })
		.sort({ name: 1, created_date_time: -1, modified_date_time: -1 })
		.skip(offset)
		.limit(limit)
		.lean();

	const count = await db.user.countDocuments({});

	return {
		rows: usersList.map((u) => ({ ...u, id: u._id.toString() })),
		count,
	};
}

async function deleteUserById(userId) {
	const result = await db.user.deleteOne({ _id: userId });

	if (result.deletedCount === 0) {
		throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
	}

	return result;
}

async function updateUser(req) {
	const { password, email } = req.body;
	const userId = req.params.id || req.body.id;

	if (password) {
		const hashedPassword = await encryptData(password);

		if (!hashedPassword) {
			throw new ApiError(
				httpStatus.INTERNAL_SERVER_ERROR,
				'Internal Server Error'
			);
		}

		req.body.password = hashedPassword;
	}

	if (email) {
		const existedUser = await getUserByEmail(email);

		if (existedUser && existedUser.id !== userId) {
			throw new ApiError(
				httpStatus.CONFLICT,
				'This email already exists'
			);
		}
	}

	const updatedUser = await db.user.findOneAndUpdate(
		{ _id: userId },
		{ $set: { ...req.body, modified_date_time: new Date() } },
		{ new: true, lean: true }
	);

	if (updatedUser) {
		updatedUser.id = updatedUser._id.toString();
	}

	return updatedUser;
}

module.exports = {
	getUserByEmail,
	getUserById,
	createUser,
	updateUser,
	getUsers,
	deleteUserById,
};
