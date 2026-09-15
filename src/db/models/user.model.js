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
