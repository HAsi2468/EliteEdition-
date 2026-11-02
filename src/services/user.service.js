const httpStatus = require('http-status').default;
const { getOffset } = require('../utils/query');
const ApiError = require('../utils/ApiError');
const { encryptData } = require('../utils/auth');
const config = require('../config/config.js');
const db = require('../db/models');

const MASTER_ADMIN_EMAIL = 'harshitsidapara2468@gmail.com';

async function getUserByEmail(email) {
	if (!email) return null;
	const cleanEmail = String(email).trim().toLowerCase();
	const user = await db.user.findOne({
		email: { $regex: new RegExp(`^${cleanEmail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
	}).lean();
	if (user) {
		user.id = user._id.toString();
	}
	return user;
}

async function getUserById(id) {
	const user = await db.user.findOne({ _id: id }, {
		password: 0,
		pushSubscriptions: 0,
		webPushSubscription: 0,
		subscription: 0,
		pushSubscription: 0
	}).lean();
	if (user) {
		user.id = user._id.toString();
	}
	return user;
}

async function createUser(req) {
  const {
    email,
    name,
    password,
    role,
    permissions,
    isMainAdmin,
    allowedCompanies,
    department,
    canManageTasks,
    canBroadcastChat,
    canExportReports,
    canDeleteRecords,
    canViewFinancials,
    status
  } = req.body;
  // Validate required role field
  if (!role) {
    throw new ApiError(httpStatus.BAD_REQUEST, '`role` is required');
  }

  const requesterEmail = (req.user?.email || '').toLowerCase();
  const isMasterAdmin = requesterEmail === MASTER_ADMIN_EMAIL;
  const isRequesterMainAdmin = req.user?.isMainAdmin === true || isMasterAdmin;
  const isCompanyAdmin = req.user?.role === 'admin' && !isRequesterMainAdmin;

  let finalAllowedCompanies = Array.isArray(allowedCompanies)
    ? allowedCompanies
    : ['Elite Online', 'Elite Digital Print', 'Elite Stitching', 'Elite Edition', 'Elite Fabtex', 'Sobise', 'Ethno wear', 'Yamunaji', 'EXEDP'];

  if (isCompanyAdmin) {
    if (isMainAdmin) {
      throw new ApiError(httpStatus.FORBIDDEN, 'Company Admins cannot create Main Admin accounts.');
    }
    const requesterAllowed = Array.isArray(req.user?.allowedCompanies) ? req.user.allowedCompanies : [];
    finalAllowedCompanies = finalAllowedCompanies.filter(c => requesterAllowed.includes(c));
    if (finalAllowedCompanies.length === 0) {
      finalAllowedCompanies = requesterAllowed;
    }
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
    isMainAdmin: isCompanyAdmin ? false : Boolean(isMainAdmin),
    allowedCompanies: finalAllowedCompanies,
    permissions: permissions || [],
    department: department || 'General',
    canManageTasks: canManageTasks !== undefined ? Boolean(canManageTasks) : true,
    canBroadcastChat: canBroadcastChat !== undefined ? Boolean(canBroadcastChat) : true,
    canExportReports: canExportReports !== undefined ? Boolean(canExportReports) : true,
    canDeleteRecords: canDeleteRecords !== undefined ? Boolean(canDeleteRecords) : true,
    canViewFinancials: canViewFinancials !== undefined ? Boolean(canViewFinancials) : true,
    canCreateJobCards: req.body.canCreateJobCards !== undefined ? Boolean(req.body.canCreateJobCards) : true,
    canEditJobCards: req.body.canEditJobCards !== undefined ? Boolean(req.body.canEditJobCards) : true,
    canDeleteJobCards: req.body.canDeleteJobCards !== undefined ? Boolean(req.body.canDeleteJobCards) : true,
    canAdvanceJobStage: req.body.canAdvanceJobStage !== undefined ? Boolean(req.body.canAdvanceJobStage) : true,
    canViewJobCosts: req.body.canViewJobCosts !== undefined ? Boolean(req.body.canViewJobCosts) : true,
    canCreateDesigns: req.body.canCreateDesigns !== undefined ? Boolean(req.body.canCreateDesigns) : true,
    canEditDesigns: req.body.canEditDesigns !== undefined ? Boolean(req.body.canEditDesigns) : true,
    canDeleteDesigns: req.body.canDeleteDesigns !== undefined ? Boolean(req.body.canDeleteDesigns) : true,
    canViewDesignCosts: req.body.canViewDesignCosts !== undefined ? Boolean(req.body.canViewDesignCosts) : true,
    canAddFabricInward: req.body.canAddFabricInward !== undefined ? Boolean(req.body.canAddFabricInward) : true,
    canIssueFabricOutward: req.body.canIssueFabricOutward !== undefined ? Boolean(req.body.canIssueFabricOutward) : true,
    canTransferFabricLot: req.body.canTransferFabricLot !== undefined ? Boolean(req.body.canTransferFabricLot) : true,
    canDeleteFabricLogs: req.body.canDeleteFabricLogs !== undefined ? Boolean(req.body.canDeleteFabricLogs) : true,
    canViewFabricPrices: req.body.canViewFabricPrices !== undefined ? Boolean(req.body.canViewFabricPrices) : true,
    canCreateInvoices: req.body.canCreateInvoices !== undefined ? Boolean(req.body.canCreateInvoices) : true,
    canEditInvoiceRates: req.body.canEditInvoiceRates !== undefined ? Boolean(req.body.canEditInvoiceRates) : true,
    canCancelInvoices: req.body.canCancelInvoices !== undefined ? Boolean(req.body.canCancelInvoices) : true,
    canRecordPayments: req.body.canRecordPayments !== undefined ? Boolean(req.body.canRecordPayments) : true,
    canCreateStitchingJobs: req.body.canCreateStitchingJobs !== undefined ? Boolean(req.body.canCreateStitchingJobs) : true,
    canIssueStitchingChallans: req.body.canIssueStitchingChallans !== undefined ? Boolean(req.body.canIssueStitchingChallans) : true,
    canManageWorkerRates: req.body.canManageWorkerRates !== undefined ? Boolean(req.body.canManageWorkerRates) : true,
    status: status || 'Active',
  });

  const createdUser = createdUserDoc.toObject();
  createdUser.id = createdUser._id.toString();

  return createdUser;
}

async function getUsers(req) {
	const { page: defaultPage, limit: defaultLimit } = config.pagination;
	const { page = defaultPage, limit = defaultLimit, companyEntity } = req.query;

	const offset = getOffset(page, limit);

	const userFilter = {
		name: { $not: /^TEST/i },
		username: { $not: /^TEST/i },
		email: { $not: /test-load|qa-bot|testbot/i },
		isTest: { $ne: true }
	};

	const requesterEmail = (req.user?.email || '').toLowerCase();
	const isMasterAdmin = requesterEmail === MASTER_ADMIN_EMAIL;
	const isMainAdmin = req.user?.isMainAdmin === true || isMasterAdmin;
	const isCompanyAdmin = req.user?.role === 'admin' && !isMainAdmin;

	if (isCompanyAdmin) {
		const allowed = Array.isArray(req.user?.allowedCompanies) ? req.user.allowedCompanies : [];
		if (companyEntity && companyEntity !== 'ALL') {
			userFilter.allowedCompanies = companyEntity;
		} else {
			userFilter.allowedCompanies = { $in: allowed };
		}
	} else if (companyEntity && companyEntity !== 'ALL') {
		userFilter.allowedCompanies = companyEntity;
	}

	const usersList = await db.user.find(userFilter, {
		password: 0,
		pushSubscriptions: 0,
		webPushSubscription: 0,
		subscription: 0,
		pushSubscription: 0
	})
		.sort({ name: 1, created_date_time: -1, modified_date_time: -1 })
		.skip(offset)
		.limit(limit)
		.lean();

	const count = await db.user.countDocuments(userFilter);

	return {
		rows: usersList.map((u) => ({ ...u, id: u._id.toString() })),
		count,
	};
}

async function deleteUserById(userId, requesterUser) {
	const targetUser = await db.user.findById(userId).lean();
	if (!targetUser) {
		throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
	}

	if (String(targetUser.email).toLowerCase() === MASTER_ADMIN_EMAIL) {
		throw new ApiError(httpStatus.FORBIDDEN, 'Root Master Admin account is permanently protected and cannot be deleted.');
	}

	const requesterEmail = (requesterUser?.email || '').toLowerCase();
	const isMasterAdmin = requesterEmail === MASTER_ADMIN_EMAIL;
	const isMainAdmin = requesterUser?.isMainAdmin === true || isMasterAdmin;
	const isCompanyAdmin = requesterUser?.role === 'admin' && !isMainAdmin;

	if (isCompanyAdmin) {
		if (targetUser.role === 'admin' || targetUser.isMainAdmin) {
			throw new ApiError(httpStatus.FORBIDDEN, 'Company Admins cannot delete other Administrators.');
		}
		const allowed = Array.isArray(requesterUser?.allowedCompanies) ? requesterUser.allowedCompanies : [];
		const hasOverlap = (targetUser.allowedCompanies || []).some(c => allowed.includes(c));
		if (!hasOverlap) {
			throw new ApiError(httpStatus.FORBIDDEN, 'You can only delete staff members belonging to your assigned company.');
		}
	}

	const result = await db.user.deleteOne({ _id: userId });

	if (result.deletedCount === 0) {
		throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
	}

	return result;
}

async function updateUser(req) {
	const { password, email } = req.body;
	const userId = req.params.id || req.body.id;

	const targetUser = await db.user.findById(userId).lean();
	if (!targetUser) {
		throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
	}

	const requesterEmail = (req.user?.email || '').toLowerCase();
	const targetEmail = String(targetUser.email).toLowerCase();
	const isMasterAdmin = requesterEmail === MASTER_ADMIN_EMAIL;
	const isMainAdmin = req.user?.isMainAdmin === true || isMasterAdmin;
	const isCompanyAdmin = req.user?.role === 'admin' && !isMainAdmin;

	// Master Admin Protection
	if (targetEmail === MASTER_ADMIN_EMAIL) {
		if (requesterEmail !== MASTER_ADMIN_EMAIL) {
			throw new ApiError(httpStatus.FORBIDDEN, 'Root Master Admin account can only be edited by the Master Admin.');
		}
		// Preserve root authority
		req.body.role = 'admin';
		req.body.isMainAdmin = true;
		req.body.status = 'Active';
	}

	if (isCompanyAdmin) {
		if (req.body.isMainAdmin) {
			delete req.body.isMainAdmin;
		}
		if (targetUser.role === 'admin' && requesterEmail !== targetEmail) {
			throw new ApiError(httpStatus.FORBIDDEN, 'Company Admins cannot modify other Administrators.');
		}
		if (Array.isArray(req.body.allowedCompanies)) {
			const allowed = Array.isArray(req.user?.allowedCompanies) ? req.user.allowedCompanies : [];
			req.body.allowedCompanies = req.body.allowedCompanies.filter(c => allowed.includes(c));
			if (req.body.allowedCompanies.length === 0) {
				req.body.allowedCompanies = allowed;
			}
		}
	}

	if (password && String(password).trim()) {
		const hashedPassword = await encryptData(String(password).trim());

		if (!hashedPassword) {
			throw new ApiError(
				httpStatus.INTERNAL_SERVER_ERROR,
				'Internal Server Error'
			);
		}

		req.body.password = hashedPassword;
	} else {
		delete req.body.password;
	}

	if (email) {
		const existedUser = await getUserByEmail(email);

		if (existedUser && existedUser._id.toString() !== String(userId)) {
			throw new ApiError(
				httpStatus.CONFLICT,
				'This email already exists'
			);
		}
	}

	delete req.body.id;
	delete req.body._id;

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
