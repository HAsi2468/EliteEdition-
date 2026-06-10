const mongoose = require('mongoose');

const deliveryPartnerSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    phone: {
      type: String,
      trim: true,
      default: '',
    },
    address: {
      type: String,
      trim: true,
      default: '',
    },
    parties: {
      type: [String],
      default: [],
    },
  },
  {
    timestamps: {
      createdAt: 'created_date_time',
      updatedAt: 'modified_date_time',
    },
    collection: 'deliveryPartners',
  }
);

const DeliveryPartner = mongoose.model('DeliveryPartner', deliveryPartnerSchema);
module.exports = DeliveryPartner;
