const mongoose = require('mongoose');

const saleOrderSchema = new mongoose.Schema(
	{
		saleOrderItemCode: {
			type: String,
			default: null,
		},
		displayOrderCode: {
			type: String,
			default: null,
		},
		reversePickupCode: {
			type: String,
			default: null,
		},
		reversePickupCreatedDate: {
			type: String,
			default: null,
		},
		reversePickupReason: {
			type: String,
			default: null,
		},
		notificationEmail: {
			type: String,
			default: null,
		},
		notificationMobile: {
			type: String,
			default: null,
		},
		requireCustomization: {
			type: String,
			default: 'false',
		},
		cod: {
			type: Number,
			default: null,
		},
		shippingAddressId: {
			type: String,
			default: null,
		},
		category: {
			type: String,
			default: null,
		},
		shippingAddressName: {
			type: String,
			default: null,
		},
		shippingAddressLine1: {
			type: String,
			default: null,
		},
		shippingAddressLine2: {
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
		shippingAddressCountry: {
			type: String,
			default: null,
		},
		shippingAddressPincode: {
			type: String,
			default: null,
		},
		shippingAddressPhone: {
			type: String,
			default: null,
		},
		billingAddressId: {
			type: String,
			default: null,
		},
		billingAddressName: {
			type: String,
			default: null,
		},
		billingAddressLine1: {
			type: String,
			default: null,
		},
		billingAddressLine2: {
			type: String,
			default: null,
		},
		billingAddressCity: {
			type: String,
			default: null,
		},
		billingAddressState: {
			type: String,
			default: null,
		},
		billingAddressCountry: {
			type: String,
			default: null,
		},
		billingAddressPincode: {
			type: String,
			default: null,
		},
		billingAddressPhone: {
			type: String,
			default: null,
		},
		shippingMethod: {
			type: String,
			default: null,
		},
		itemSKUCode: {
			type: String,
			required: true,
		},
		channelProductId: {
			type: String,
			default: null,
		},
		itemTypeName: {
			type: String,
			default: null,
		},
		itemTypeColor: {
			type: String,
			default: null,
		},
		itemTypeSize: {
			type: String,
			default: null,
		},
		itemTypeBrand: {
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
		orderDate: {
			type: Date,
			required: true,
		},
		saleOrderCode: {
			type: String,
			default: null,
		},
		onHold: {
			type: String,
			default: 'false',
		},
		saleOrderStatus: {
			type: String,
			default: null,
		},
		currency: {
			type: String,
			default: null,
		},
		currencyConversionRate: {
			type: String,
			default: null,
		},
		saleOrderItemStatus: {
			type: String,
			default: null,
		},
		shippingPackageCode: {
			type: String,
			default: null,
		},
		shippingPackageCreationDate: {
			type: String,
			default: null,
		},
		facility: {
			type: String,
			default: null,
		},
		weight: {
			type: String,
			default: null,
		},
	},
	{
		timestamps: true,
		collection: 'sale_orders',
	}
);

const SaleOrder = mongoose.model('SaleOrder', saleOrderSchema);
module.exports = SaleOrder;
