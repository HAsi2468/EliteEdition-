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

const User = mongoose.model('User', userSchema);
module.exports = User;
