const mongoose = require('mongoose');

const fabricDetailSchema = new mongoose.Schema({
  fabric_use: { type: String, default: '', trim: true },
  details: { type: String, default: '', trim: true },
  rate_per_unit: { type: Number, default: 0 },
  panna_width: { type: String, default: '', trim: true },
  consumption: { type: Number, default: 0 },
  purchase_qty: { type: Number, default: 0 },
  rate_per_pc: { type: Number, default: 0 },
  amount: { type: Number, default: 0 }
}, { _id: true });

const vendorDetailSchema = new mongoose.Schema({
  vendor_name: { type: String, default: '', trim: true },
  process_type: { type: String, default: '', trim: true },
  rate: { type: Number, default: 0 },
  quantity: { type: Number, default: 0 },
  received_quantity: { type: Number, default: 0 },
  amount: { type: Number, default: 0 }
}, { _id: true });

const garmentJobCardSchema = new mongoose.Schema(
  {
    job_number: { type: String, required: true, unique: true, trim: true, index: true },
    date: { type: String, default: '', trim: true },
    design_number: { type: String, default: '', trim: true, index: true },
    label: { type: String, default: '', trim: true },
    finishing: { type: String, default: '', trim: true },
    notes: { type: String, default: '', trim: true },
    department: { type: String, default: 'stitching', trim: true, index: true },
    status: { type: String, default: 'Pending', enum: ['Pending', 'In Production', 'Completed'], trim: true },

    size_ratios: {
      xs_34: { type: Number, default: 0 },
      s_36: { type: Number, default: 0 },
      m_38: { type: Number, default: 0 },
      l_40: { type: Number, default: 0 },
      xl_42: { type: Number, default: 0 },
      xl2_44: { type: Number, default: 0 },
      xl3_46: { type: Number, default: 0 },
      xl4_48: { type: Number, default: 0 },
      xl5_50: { type: Number, default: 0 },
      xl6_52: { type: Number, default: 0 }
    },
    total_pieces: { type: Number, default: 0 },

    fabric_details: [fabricDetailSchema],
    vendor_details: [vendorDetailSchema],

    total_fabric_cost: { type: Number, default: 0 },
    total_stitching_cost: { type: Number, default: 0 },
    overhead_cost: { type: Number, default: 0 },
    grand_total_cost: { type: Number, default: 0 },
    final_cost_per_pc: { type: Number, default: 0 }
  },
  {
    timestamps: {
      createdAt: 'created_at',
      updatedAt: 'updated_at'
    },
    collection: 'garmentJobCards'
  }
);

const GarmentJobCard = mongoose.model('GarmentJobCard', garmentJobCardSchema);
module.exports = GarmentJobCard;
