const Joi = require('@hapi/joi');
const { password } = require('./custom.validation');

const createUser = {
	body: Joi.object()
		.keys({
			email: Joi.string().required().email(),
			password: Joi.string().required().custom(password),
			name: Joi.string().required(),
			role: Joi.string().valid('admin', 'user').required(),
			permissions: Joi.array().items(Joi.string()).optional(),
			isMainAdmin: Joi.boolean().optional(),
			allowedCompanies: Joi.array().items(Joi.string()).optional(),
			department: Joi.string().optional().allow(''),
			status: Joi.string().valid('Active', 'Inactive').optional(),
			canManageTasks: Joi.boolean().optional(),
			canBroadcastChat: Joi.boolean().optional(),
			canExportReports: Joi.boolean().optional(),
			canDeleteRecords: Joi.boolean().optional(),
			canViewFinancials: Joi.boolean().optional(),
			canCreateJobCards: Joi.boolean().optional(),
			canEditJobCards: Joi.boolean().optional(),
			canDeleteJobCards: Joi.boolean().optional(),
			canAdvanceJobStage: Joi.boolean().optional(),
			canViewJobCosts: Joi.boolean().optional(),
			canCreateDesigns: Joi.boolean().optional(),
			canEditDesigns: Joi.boolean().optional(),
			canDeleteDesigns: Joi.boolean().optional(),
			canViewDesignCosts: Joi.boolean().optional(),
			canAddFabricInward: Joi.boolean().optional(),
			canIssueFabricOutward: Joi.boolean().optional(),
			canTransferFabricLot: Joi.boolean().optional(),
			canDeleteFabricLogs: Joi.boolean().optional(),
			canViewFabricPrices: Joi.boolean().optional(),
			canCreateInvoices: Joi.boolean().optional(),
			canEditInvoiceRates: Joi.boolean().optional(),
			canCancelInvoices: Joi.boolean().optional(),
			canRecordPayments: Joi.boolean().optional(),
			canCreateStitchingJobs: Joi.boolean().optional(),
			canIssueStitchingChallans: Joi.boolean().optional(),
			canManageWorkerRates: Joi.boolean().optional(),
		})
		.unknown(true),
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
			password: Joi.string().allow('', null).optional().custom(password),
			name: Joi.string(),
			role: Joi.string().valid('admin', 'user'),
			permissions: Joi.array().items(Joi.string()),
			isMainAdmin: Joi.boolean().optional(),
			allowedCompanies: Joi.array().items(Joi.string()).optional(),
			department: Joi.string().optional().allow(''),
			status: Joi.string().valid('Active', 'Inactive').optional(),
			canManageTasks: Joi.boolean().optional(),
			canBroadcastChat: Joi.boolean().optional(),
			canExportReports: Joi.boolean().optional(),
			canDeleteRecords: Joi.boolean().optional(),
			canViewFinancials: Joi.boolean().optional(),
			canCreateJobCards: Joi.boolean().optional(),
			canEditJobCards: Joi.boolean().optional(),
			canDeleteJobCards: Joi.boolean().optional(),
			canAdvanceJobStage: Joi.boolean().optional(),
			canViewJobCosts: Joi.boolean().optional(),
			canCreateDesigns: Joi.boolean().optional(),
			canEditDesigns: Joi.boolean().optional(),
			canDeleteDesigns: Joi.boolean().optional(),
			canViewDesignCosts: Joi.boolean().optional(),
			canAddFabricInward: Joi.boolean().optional(),
			canIssueFabricOutward: Joi.boolean().optional(),
			canTransferFabricLot: Joi.boolean().optional(),
			canDeleteFabricLogs: Joi.boolean().optional(),
			canViewFabricPrices: Joi.boolean().optional(),
			canCreateInvoices: Joi.boolean().optional(),
			canEditInvoiceRates: Joi.boolean().optional(),
			canCancelInvoices: Joi.boolean().optional(),
			canRecordPayments: Joi.boolean().optional(),
			canCreateStitchingJobs: Joi.boolean().optional(),
			canIssueStitchingChallans: Joi.boolean().optional(),
			canManageWorkerRates: Joi.boolean().optional(),
		})
		.unknown(true)
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
