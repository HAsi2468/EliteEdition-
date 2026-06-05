function parseDate(dateStr) {
  if (!dateStr) return null;
  if (dateStr instanceof Date) return dateStr;
  if (typeof dateStr !== 'string') return new Date(dateStr);

  // If it's already an ISO string or numeric timestamp
  if (!isNaN(Date.parse(dateStr)) && !dateStr.includes('/')) {
    return new Date(dateStr);
  }

  // Try dd/mm/yyyy hh:MM:ss format (e.g. 04/12/2024 00:11:34)
  const parts = dateStr.trim().split(/[\s/:]+/);
  if (parts.length >= 3) {
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1; // 0-based month
    const year = parseInt(parts[2], 10);
    const hour = parts[3] ? parseInt(parts[3], 10) : 0;
    const minute = parts[4] ? parseInt(parts[4], 10) : 0;
    const second = parts[5] ? parseInt(parts[5], 10) : 0;

    const parsedDate = new Date(year, month, day, hour, minute, second);
    if (!isNaN(parsedDate.getTime())) {
      return parsedDate;
    }
  }
  return new Date(dateStr);
}

function convertKeysToModelFields(jsonData) {
  return jsonData.map((item) => ({
    saleOrderItemCode: item['Sale Order Item Code'],
    displayOrderCode: item['Display Order Code'],
    reversePickupCode: item['Reverse Pickup Code'],
    reversePickupCreatedDate: item['Reverse Pickup Created Date'],
    reversePickupReason: item['Reverse Pickup Reason'],
    notificationEmail: item['Notification Email'],
    notificationMobile: item['Notification Mobile'],
    requireCustomization: item['Require Customization'],
    cod: item.COD,
    shippingAddressId: item['Shipping Address Id'],
    category: item.Category,
    invoiceCode: item['Invoice Code'],
    invoiceCreated: item['Invoice Created'],
    eWayBillNo: item['EWayBill No'],
    eWayBillDate: item['EWayBill Date'],
    eWayBillValidTill: item['EWayBill Valid Till'],
    shippingAddressName: item['Shipping Address Name'],
    shippingAddressLine1: item['Shipping Address Line 1'],
    shippingAddressLine2: item['Shipping Address Line 2'],
    shippingAddressCity: item['Shipping Address City'],
    shippingAddressState: item['Shipping Address State'],
    shippingAddressCountry: item['Shipping Address Country'],
    shippingAddressPincode: item['Shipping Address Pincode'],
    shippingAddressPhone: item['Shipping Address Phone'],
    billingAddressId: item['Billing Address Id'],
    billingAddressName: item['Billing Address Name'],
    billingAddressLine1: item['Billing Address Line 1'],
    billingAddressLine2: item['Billing Address Line 2'],
    billingAddressCity: item['Billing Address City'],
    billingAddressState: item['Billing Address State'],
    billingAddressCountry: item['Billing Address Country'],
    billingAddressPincode: item['Billing Address Pincode'],
    billingAddressPhone: item['Billing Address Phone'],
    shippingMethod: item['Shipping Method'],
    itemSKUCode: item['Item SKU Code'],
    channelProductId: item['Channel Product Id'],
    itemTypeName: item['Item Type Name'],
    itemTypeColor: item['Item Type Color'],
    itemTypeSize: item['Item Type Size'],
    itemTypeBrand: item['Item Type Brand'],
    channelName: item['Channel Name'],
    skuRequireCustomization: item['SKU Require Customization'],
    giftWrap: item['Gift Wrap'],
    giftMessage: item['Gift Message'],
    hsnCode: item['HSN Code'],
    mrp: item.MRP,
    totalPrice: item['Total Price'],
    costPrice: item['Cost Price'],
    prepaidAmount: item['Prepaid Amount'],
    discount: item.Discount,
    gstTaxTypeCode: item['GST Tax Type Code'],
    cgst: item.CGST,
    igst: item.IGST,
    sgst: item.SGST,
    utgst: item.UTGST,
    cess: item.CESS,
    cgstRate: item['CGST Rate'],
    igstRate: item['IGST Rate'],
    sgstRate: item['SGST Rate'],
    utgstRate: item['UTGST Rate'],
    cessRate: item['CESS Rate'],
    tcsAmount: item['TCS Amount'],
    taxPercentage: item['Tax %'],
    taxValue: item['Tax Value'],
    voucherCode: item['Voucher Code'],
    shippingCharges: item['Shipping Charges'],
    shippingMethodCharges: item['Shipping Method Charges'],
    codServiceCharges: item['COD Service Charges'],
    giftWrapCharges: item['Gift Wrap Charges'],
    packetNumber: item['Packet Number'],
    orderDate: parseDate(item['Order Date as dd/mm/yyyy hh:MM:ss']),
    saleOrderCode: item['Sale Order Code'],
    onHold: item['On Hold'],
    saleOrderStatus: item['Sale Order Status'],
    priority: item.Priority,
    currency: item.Currency,
    currencyConversionRate: item['Currency Conversion Rate'],
    saleOrderItemStatus: item['Sale Order Item Status'],
    cancellationReason: item['Cancellation Reason'],
    shippingProvider: item['Shipping provider'],
    shippingCourier: item['Shipping Courier'],
    shippingArrangedBy: item['Shipping Arranged By'],
    shippingPackageCode: item['Shipping Package Code'],
    shippingPackageCreationDate: item['Shipping Package Creation Date'],
    shippingPackageStatusCode: item['Shipping Package Status Code'],
    shippingPackageType: item['Shipping Package Type'],
    length: item['Length(mm)'],
    width: item['Width(mm)'],
    height: item['Height(mm)'],
    deliveryTime: item['Delivery Time'],
    trackingNumber: item['Tracking Number'],
    dispatchDate: item['Dispatch Date'],
    facility: item.Facility,
    returnDate: item['Return Date'],
    returnReason: item['Return Reason'],
    returnRemarks: item['Return Remarks'],
    combinationIdentifier: item['Combination Identifier'],
    combinationDescription: item['Combination Description'],
    transferPrice: item['Transfer Price'],
    itemCode: item['Item Code'],
    imei: item.IMEI,
    weight: item.Weight,
    gstin: item.GSTIN,
    customerGstin: item['Customer GSTIN'],
    tin: item.TIN,
    paymentInstrument: item['Payment Instrument'],
    fulfillmentTAT: item['Fulfillment TAT'],
    adjustmentInSellingPrice: item['Adjustment In Selling Price'],
    adjustmentInDiscount: item['Adjustment In Discount'],
    storeCredit: item['Store Credit'],
    irn: item.IRN,
    acknowledgementNumber: item['Acknowledgement Number'],
    bundleSkuCodeNumber: item['Bundle SKU Code Number'],
    skuName: item['SKU Name'],
    batchCode: item['Batch Code'],
    vendorBatchNumber: item['Vendor Batch Number'],
    sellerSkuCode: item['Seller SKU Code'],
    itemTypeEAN: item['Item Type EAN'],
    shippingCourierStatus: item['Shipping Courier Status'],
    shippingTrackingStatus: item['Shipping Tracking Status'],
    itemSealId: item['Item Seal Id'],
    parentSaleOrderCode: item['Parent Sale Order Code'],
    van: item.VAN ?? undefined,
    styleId: item['Style ID '] ?? undefined,
    channelShipping: item['Channel Shipping'],
    itemDetails: item['Item Details'],
  }));
}
function convertKeysV2(jsonData) {
  return jsonData.map((item) => {
    return {
      saleOrderItemCode: item.saleOrderItemCode,
      itemSKUCode: item.itemSKUCode.split('_')[0],
      facility: item.facility,
      category: item.category,
      itemTypeColor: item.itemTypeColor,
      itemTypeBrand: item.itemTypeBrand,
      itemTypeSize: item.itemTypeSize,
      mrp: item.mrp,
      totalPrice: item.totalPrice,
      discount: item.discount,
      shippingAddressCity: item.shippingAddressCity,
      shippingAddressState: item.shippingAddressState,
      shippingAddressPincode: item.shippingAddressPincode,
      orderDate: parseDate(item.orderDate),
      productImage: '',
      saleOrderStatus: item.saleOrderStatus,
      skuName: item.skuName,
      saleCount: item.saleOrderStatus === 'CANCELLED' ? 0 :1,
    };
  });
}
const transformProducts = (products) => {
  const groupedProducts = {};

  products.forEach(({ skuCode, color, ...product }) => {
    try {
      const [baseSkuCode, variation] = skuCode.split('_');

      if (!groupedProducts[baseSkuCode]) {
        groupedProducts[baseSkuCode] = {
          ...product,
          skuCode: baseSkuCode,
          size: new Set(),
          color: new Set(),
        };
      } else {
        // Merge non-null and non-empty properties from other variations
        for (const key in product) {
          if (product[key] !== null && product[key] !== undefined && product[key] !== '') {
            groupedProducts[baseSkuCode][key] = product[key];
          }
        }
      }

      if (variation) groupedProducts[baseSkuCode].size.add(variation);
      if (color) groupedProducts[baseSkuCode].color.add(color);
    } catch (error) {
      console.debug('Error processing product:', error);
    }
  });

  return Object.values(
    Object.fromEntries(
      Object.entries(groupedProducts).map(([key, product]) => [
        key,
        {
          ...product,
          size: Array.from(product.size),
          color: Array.from(product.color),
        },
      ])
    )
  );
};
module.exports = { convertKeysToModelFields, transformProducts, convertKeysV2 };
