const mongoose = require('mongoose');

const companyApprovalPolicySchema = new mongoose.Schema(
  {
    companyEntity: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    enabled: {
      type: Boolean,
      default: true,
    },
    interceptEdit: {
      type: Boolean,
      default: true,
    },
    interceptDelete: {
      type: Boolean,
      default: true,
    },
    updatedBy: {
      type: String,
      default: 'Admin',
    },
    updatedByEmail: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('CompanyApprovalPolicy', companyApprovalPolicySchema);

