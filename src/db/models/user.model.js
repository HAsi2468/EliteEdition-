const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
	{
		name: {
			type: String,
			required: true,
			trim: true,
		},
		email: {
			type: String,
			required: true,
			unique: true,
			trim: true,
			lowercase: true,
		},
		role: {
			type: String,
			required: true,
			enum: ['admin', 'user'],
			default: 'user',
		},
		isMainAdmin: {
			type: Boolean,
			default: false,
		},
		allowedCompanies: {
			type: [String],
			default: ['Elite Online', 'Elite Digital Print', 'Elite Stitching', 'Elite Edition', 'Elite Fabtex'],
		},
		permissions: {
			type: [String],
			default: [],
		},
		department: {
			type: String,
			default: 'General',
		},
		canManageTasks: {
			type: Boolean,
			default: true,
		},
		canBroadcastChat: {
			type: Boolean,
			default: true,
		},
		canExportReports: {
			type: Boolean,
			default: true,
		},
		canDeleteRecords: {
			type: Boolean,
			default: true,
		},
		canViewFinancials: {
			type: Boolean,
			default: true,
		},
		canCreateJobCards: { type: Boolean, default: true },
		canEditJobCards: { type: Boolean, default: true },
		canDeleteJobCards: { type: Boolean, default: true },
		canAdvanceJobStage: { type: Boolean, default: true },
		canViewJobCosts: { type: Boolean, default: true },
		canCreateDesigns: { type: Boolean, default: true },
		canEditDesigns: { type: Boolean, default: true },
		canDeleteDesigns: { type: Boolean, default: true },
		canViewDesignCosts: { type: Boolean, default: true },
		canAddFabricInward: { type: Boolean, default: true },
		canIssueFabricOutward: { type: Boolean, default: true },
		canTransferFabricLot: { type: Boolean, default: true },
		canDeleteFabricLogs: { type: Boolean, default: true },
		canViewFabricPrices: { type: Boolean, default: true },
		canCreateInvoices: { type: Boolean, default: true },
		canEditInvoiceRates: { type: Boolean, default: true },
		canCancelInvoices: { type: Boolean, default: true },
		canRecordPayments: { type: Boolean, default: true },
		canCreateStitchingJobs: { type: Boolean, default: true },
		canIssueStitchingChallans: { type: Boolean, default: true },
		canManageWorkerRates: { type: Boolean, default: true },
		status: {
			type: String,
			enum: ['Active', 'Inactive'],
			default: 'Active',
		},
		created_date_time: {
			type: Date,
			default: Date.now,
		},
		modified_date_time: {
			type: Date,
			default: Date.now,
		},
		password: {
			type: String,
			required: true,
		},
	},
	{
		timestamps: false,
		collection: 'user',
	}
);

const User = mongoose.model('User', userSchema, 'user');
module.exports = User;
