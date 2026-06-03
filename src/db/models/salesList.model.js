const mongoose = require('mongoose');

const salesListSchema = new mongoose.Schema(
	{
		saleOrderItemCode: {
			type: String,
			required: true,
			unique: true,
		},
		itemSKUCode: {
			type: String,
			required: true,
		},
		facility: {
			type: String,
			default: null,
		},
		category: {
			type: String,
			default: null,
		},
		itemTypeColor: {
			type: String,
			default: null,
		},
		itemTypeBrand: {
			type: String,
			default: null,
		},
		itemTypeSize: {
			type: String,
			default: null,
		},
		mrp: {
			type: String,
			default: null,
		},
		totalPrice: {
			type: String,
			default: null,
		},
		discount: {
			type: String,
			default: null,
		},
		shippingAddressCity: {
			type: String,
			default: null,
		},
		shippingAddressState: {
			type: String,
			default: null,
		},
		shippingAddressPincode: {
			type: String,
			default: null,
		},
		orderDate: {
			type: Date,
			required: true,
		},
		productImage: {
			type: String,
			default: '',
		},
		saleOrderStatus: {
			type: String,
			default: null,
		},
		skuName: {
			type: String,
			required: true,
		},
		saleCount: {
			type: Number,
			default: 1,
		},
	},
	{
		timestamps: false,
		collection: 'salesList',
	}
);

const SalesList = mongoose.model('SalesList', salesListSchema);
module.exports = SalesList;
