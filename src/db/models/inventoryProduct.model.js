const mongoose = require('mongoose');

const inventoryProductSchema = new mongoose.Schema(
	{
		skuCode: {
			type: String,
			required: true,
			unique: true,
			trim: true,
		},
		description: {
			type: String,
			default: null,
		},
		length: {
			type: Number,
			default: null,
		},
		width: {
			type: Number,
			default: null,
		},
		height: {
			type: Number,
			default: null,
		},
		weight: {
			type: Number,
			default: null,
		},
		price: {
			type: Number,
			default: null,
		},
		basePrice: {
			type: Number,
			default: null,
		},
		color: {
			type: [String],
			default: [],
		},
		size: {
			type: [String],
			default: [],
		},
		brand: {
			type: String,
			default: null,
		},
		taxTypeCode: {
			type: String,
			default: null,
		},
		gstTaxTypeCode: {
			type: String,
			default: null,
		},
		hsnCode: {
			type: String,
			default: null,
		},
		categoryName: {
			type: String,
			default: null,
		},
		categoryCode: {
			type: String,
			default: null,
		},
		productPageUrl: {
			type: String,
			default: null,
		},
		imageUrl: {
			type: String,
			default: null,
		},
		tags: {
			type: [String],
			default: [],
		},
		customFieldValues: {
			type: mongoose.Schema.Types.Mixed,
			default: null,
		},
		inventorySnapshots: {
			type: mongoose.Schema.Types.Mixed,
			default: null,
		},
		expirable: {
			type: Boolean,
			default: null,
		},
		enabled: {
			type: Boolean,
			default: null,
		},
		shelfLife: {
			type: Number,
			default: null,
		},
		skuType: {
			type: String,
			default: null,
		},
		itemDetailFieldDTOList: {
			type: mongoose.Schema.Types.Mixed,
			default: null,
		},
	},
	{
		timestamps: false,
		collection: 'inventory_products',
	}
);

const InventoryProduct = mongoose.model('InventoryProduct', inventoryProductSchema);
module.exports = InventoryProduct;
