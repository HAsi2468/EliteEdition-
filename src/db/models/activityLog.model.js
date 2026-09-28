const mongoose = require('mongoose');

const activityLogSchema = new mongoose.Schema(
  {
    company_id: {
      type: String,
      required: true,
      index: true,
      trim: true,
      default: 'elite_online',
    },
    companyName: {
      type: String,
      default: 'Elite Online',
      trim: true,
    },
    userId: {
      type: String,
      index: true,
      default: '',
    },
    userName: {
      type: String,
      default: 'System',
      trim: true,
    },
    userRole: {
      type: String,
      default: 'user',
      trim: true,
    },
    action: {
      type: String,
      required: true,
      index: true,
      enum: ['COMPANY_SWITCH', 'ACCESS_DENIED', 'LOGIN', 'LOGOUT', 'CREATE', 'UPDATE', 'DELETE', 'EXPORT', 'VIEW'],
      default: 'VIEW',
    },
    details: {
      type: String,
      default: '',
      trim: true,
    },
    ip: {
      type: String,
      default: '',
    },
    userAgent: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: {
      createdAt: 'created_date_time',
      updatedAt: 'modified_date_time',
    },
    collection: 'activityLogs',
  }
);

activityLogSchema.index({ company_id: 1, created_date_time: -1 });
activityLogSchema.index({ action: 1, created_date_time: -1 });

const ActivityLog = mongoose.model('ActivityLog', activityLogSchema);
module.exports = ActivityLog;
