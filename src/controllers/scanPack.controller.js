const httpStatus = require('http-status').default;
const db = require('../db/models');
const logger = require('../config/logger');

// Helper: Infer Courier from AWB Code pattern
const detectCourier = (code = '') => {
  const c = String(code).trim().toUpperCase();
  if (c.startsWith('MYSC') || c.startsWith('MYSP') || c.startsWith('MYEP')) return 'Flipkart Logistics / Ekart';
  if (c.startsWith('FMPC') || c.startsWith('FMPP')) return 'Ekart Logistics';
  if (c.startsWith('DELHIVERY') || /^\d{12,14}$/.test(c)) return 'Delhivery';
  if (c.startsWith('BD') || /^\d{9,11}$/.test(c)) return 'Blue Dart';
  if (c.startsWith('SF') || c.startsWith('SHADOW')) return 'Shadowfax';
  if (c.startsWith('XB') || c.startsWith('XPRESS')) return 'Xpressbees';
  if (c.startsWith('ECOM') || c.startsWith('EXPR')) return 'Ecom Express';
  return 'Standard Courier / Logistics';
};

// Helper: Resolve product image from catalog by SKU code or design number
const findProductImageBySku = async (skuStr) => {
  if (!skuStr) return '';
  const clean = String(skuStr).trim();
  try {
    // 1. Try exact match on Product and InventoryProduct
    let catalog = await db.Product.findOne({
      $or: [{ skuCode: clean }, { sku: clean }]
    }).lean() || await db.InventoryProduct.findOne({
      $or: [{ skuCode: clean }, { sku: clean }]
    }).lean();

    if (catalog?.imageUrl) return catalog.imageUrl;
    if (catalog?.images && catalog.images.length > 0) return catalog.images[0];

    // 2. Try normalized candidates (strip size prefix/suffix & match base design code)
    const baseWithoutSize = clean.replace(/[-_](XS|S|M|L|XL|XXL|2XL|3XL|4XL|5XL|[0-9]+[A-Z]+)$/i, '');
    const digits = clean.match(/\d{2,5}/g) || [];
    const candidates = Array.from(new Set([clean, baseWithoutSize, ...digits]));

    catalog = await db.Product.findOne({
      $or: [
        { skuCode: { $in: candidates } },
        { sku: { $in: candidates } }
      ]
    }).lean();

    if (catalog?.imageUrl) return catalog.imageUrl;
    if (catalog?.images && catalog.images.length > 0) return catalog.images[0];
  } catch (err) {
    // quiet fail
  }
  return '';
};

// Helper: Persistently record every scan operation into MongoDB ScanLog
const logScanEvent = async ({
  awb,
  shippingPackageCode = '',
  orderCode = '',
  sku = '',
  itemName = '',
  courier = '',
  channel = 'Myntra',
  mode = 'PACK',
  status = 'SCANNED',
  weightGrams = 0,
  price = 0,
  paymentMode = 'PREPAID',
  paymentStatus = 'PAID',
  codAmount = 0,
  customerName = '',
  city = '',
  brand = '',
  size = '',
  color = '',
  productImage = '',
  operator = 'Warehouse Operator',
  operatorId = null,
  facility = 'eliteedition',
  source = 'Barcode Scanner',
  notes = '',
  meta = {}
}) => {
  try {
    if (!awb || !db.ScanLog) return null;
    const cleanAwb = String(awb).trim().toUpperCase();
    if (!cleanAwb || cleanAwb === 'UNDEFINED' || cleanAwb === 'NULL' || cleanAwb === 'NAN' || cleanAwb.length < 4) {
      return null;
    }

    if (!productImage && sku) {
      productImage = await findProductImageBySku(sku);
    }

    const payload = {
      awb: cleanAwb,
      shippingPackageCode: String(shippingPackageCode || '').trim(),
      orderCode: String(orderCode || '').trim(),
      sku: String(sku || '').trim(),
      itemName: String(itemName || '').trim(),
      courier: courier || detectCourier(cleanAwb),
      channel: channel || 'Myntra',
      customerName: String(customerName || '').trim(),
      city: String(city || '').trim(),
      brand: String(brand || '').trim(),
      size: String(size || '').trim(),
      color: String(color || '').trim(),
      productImage: String(productImage || '').trim(),
      mode,
      status,
      weightGrams: Number(weightGrams) || 0,
      price: Number(price) || 0,
      paymentMode: String(paymentMode || 'PREPAID').toUpperCase(),
      paymentStatus: String(paymentStatus || 'PAID').toUpperCase(),
      codAmount: Number(codAmount) || 0,
      operator: operator || 'Warehouse Operator',
      operatorId,
      facility: facility || 'eliteedition',
      source: source || 'Barcode Scanner',
      notes: notes || '',
      meta: meta || {}
    };

    return await db.ScanLog.findOneAndUpdate(
      { awb: cleanAwb },
      { $set: payload },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  } catch (err) {
    logger.warn('Failed to log scan event to db: %s', err.message);
    return null;
  }
};

// ── GET /api/v1/scan-pack/lookup ──────────────────────────────────────────────
// Looks up an order/package by AWB code (e.g. MYSC1359190430) or Order Code
const lookupAwb = async (req, res) => {
  try {
    const rawCode = req.query.code || req.body.code;
    if (!rawCode || !rawCode.trim()) {
      return res.status(400).json({ success: false, error: 'AWB code or barcode is required' });
    }

    const cleanCode = String(rawCode).trim();
    const regex = new RegExp(`^${cleanCode}$`, 'i');

    // 1. Search in SaleOrder
    let order = await db.SaleOrder.findOne({
      $or: [
        { trackingNumber: regex },
        { shippingPackageCode: regex },
        { displayOrderCode: regex },
        { saleOrderItemCode: regex },
        { saleOrderCode: regex },
        { reversePickupCode: regex }
      ]
    }).lean();

    // 2. Search in SalesList if not in SaleOrder
    let salesItem = null;
    if (!order) {
      salesItem = await db.SalesList.findOne({
        $or: [
          { trackingNumber: regex },
          { saleOrderItemCode: regex },
          { displayOrderCode: regex },
          { saleOrderCode: regex },
          { reversePickupCode: regex }
        ]
      }).lean();
    }

    // 3. Fallback: Search live Unicommerce OMS if not in local cache
    if (!order && !salesItem) {
      try {
        const { getAccessToken, getSaleOrderLive } = require('../services/api.service');
        const token = await getAccessToken();
        if (token) {
          const liveRes = await getSaleOrderLive(token, cleanCode);
          if (liveRes && liveRes.successful && liveRes.saleOrder) {
            const so = liveRes.saleOrder;
            order = {
              displayOrderCode: so.displayOrderCode || so.code,
              itemSKUCode: so.saleOrderItems?.[0]?.itemSkuCode || '',
              itemTypeName: so.saleOrderItems?.[0]?.itemTypeName || '',
              itemTypeColor: so.saleOrderItems?.[0]?.color || '',
              itemTypeSize: so.saleOrderItems?.[0]?.size || '',
              itemTypeBrand: so.saleOrderItems?.[0]?.brand || '',
              channel: so.channel || 'Myntra',
              totalPrice: so.totalPrice || 0,
              mrp: so.saleOrderItems?.[0]?.maxRetailPrice || 0,
              shippingAddressCity: so.addresses?.[0]?.city || '',
              shippingAddressState: so.addresses?.[0]?.state || '',
              shippingAddressPincode: so.addresses?.[0]?.pincode || '',
              shippingAddressName: so.addresses?.[0]?.name || '',
              shippingAddressPhone: so.addresses?.[0]?.phone || '',
              shippingCourier: so.shippingPackages?.[0]?.shippingCourier || '',
              trackingNumber: so.shippingPackages?.[0]?.trackingNumber || cleanCode,
              orderDate: so.displayOrderDateTime,
              invoiceCode: so.invoices?.[0]?.code || '',
              cod: so.cod,
              productImage: so.saleOrderItems?.[0]?.itemTypeImageUrl || ''
            };
          }

          // Also try Uniware Shipping Package search by trackingNumber/AWB
          if (!order) {
            try {
              const axios = require('axios');
              const pkgRes = await axios.post('https://eliteedition.unicommerce.com/services/rest/v1/oms/shippingPackage/search', {
                trackingNumber: cleanCode
              }, {
                headers: { Authorization: `bearer ${token}`, 'Content-Type': 'application/json', Facility: 'Oequal', Cookie: 'unicommerce=app1' }
              });

              if (pkgRes.data && pkgRes.data.successful && pkgRes.data.elements && pkgRes.data.elements.length > 0) {
                const pkg = pkgRes.data.elements[0];
                const firstItemKey = Object.keys(pkg.items || {})[0];
                const itemObj = pkg.items?.[firstItemKey] || {};

                order = {
                  displayOrderCode: pkg.channelShipmentCode || pkg.saleOrderCode || cleanCode,
                  itemSKUCode: itemObj.itemSku || '',
                  itemTypeName: itemObj.itemName || '',
                  itemTypeColor: '',
                  itemTypeSize: '',
                  itemTypeBrand: '',
                  channel: pkg.channel || 'Myntra',
                  totalPrice: pkg.collectableAmount || 0,
                  mrp: 0,
                  shippingAddressCity: pkg.city || '',
                  shippingAddressState: '',
                  shippingAddressPincode: '',
                  shippingAddressName: pkg.customer || '',
                  shippingAddressPhone: '',
                  shippingCourier: pkg.shippingProvider || pkg.shippingCourier || detectCourier(cleanCode),
                  trackingNumber: pkg.trackingNumber || cleanCode,
                  orderDate: pkg.created ? new Date(pkg.created).toISOString() : null,
                  dispatchDate: pkg.dispatched ? new Date(pkg.dispatched).toISOString() : null,
                  invoiceCode: pkg.invoiceCode || '',
                  cod: pkg.shippingMethod && pkg.shippingMethod.toUpperCase().includes('COD'),
                  productImage: itemObj.itemTypeImageUrl || '',
                  shippingPackageStatusCode: pkg.status
                };
              }
            } catch (pkgErr) {
              // quiet fail
            }
          }
        }
      } catch (liveErr) {
        // Log quietly and proceed with local data
      }
    }

    // 4. Search for any return record matching this AWB
    const returnRecord = await db.ReturnRecord.findOne({
      $or: [
        { referenceId: regex },
        { displayOrderId: regex }
      ]
    }).sort({ createdAt: -1 }).lean();

    // Determine values
    const displayOrderCode = order?.displayOrderCode || salesItem?.displayOrderCode || cleanCode;
    const itemSKUCode = order?.itemSKUCode || salesItem?.itemSKUCode || '';
    const itemName = order?.itemTypeName || salesItem?.skuName || itemSKUCode || 'Garment / Apparel';
    const courier = order?.shippingCourier || order?.shippingProvider || detectCourier(cleanCode);
    const channel = order?.channel || salesItem?.channel || 'Myntra';
    const brand = order?.itemTypeBrand || salesItem?.itemTypeBrand || '';
    const isCod = order?.cod === true || order?.cod === 'true' || order?.cod === 'COD' ||
      (typeof order?.cod === 'number' && order?.cod > 0) || Number(order?.cod) > 0 ||
      salesItem?.cod === true || salesItem?.cod === 'true' ||
      (typeof salesItem?.cod === 'number' && salesItem?.cod > 0) || Number(salesItem?.cod) > 0 ||
      String(order?.paymentMethod || '').toUpperCase() === 'COD' ||
      String(order?.paymentType || '').toUpperCase() === 'COD';
    const paymentMode = isCod ? 'COD' : 'PREPAID';
    const priceVal = Number(order?.totalPrice || salesItem?.totalPrice) || 0;
    const codAmount = isCod ? (Number(order?.cod) > 1 ? Number(order.cod) : priceVal) : 0;
    const customerName = order?.shippingAddressName || salesItem?.shippingAddressName || '';
    const customerPhone = order?.shippingAddressPhone || order?.notificationMobile || salesItem?.shippingAddressPhone || '';
    const invoiceCode = order?.invoiceCode || salesItem?.invoiceCode || '';
    const shippingPackageCode = order?.ShippingPackageCode || order?.shippingPackageCode || salesItem?.shippingPackageCode || '';
    const reversePickupCode = order?.reversePickupCode || returnRecord?.referenceId || '';
    const returnReason = order?.reversePickupReason || order?.returnReason || returnRecord?.notes || '';

    // Get product thumbnail from catalog if available
    let productImage = order?.productImage || salesItem?.productImage || '';
    if (!productImage && itemSKUCode) {
      productImage = await findProductImageBySku(itemSKUCode);
    }

    // Extract current status & Intelligent Classification (Return vs New Order)
    const upperCode = cleanCode.toUpperCase();
    const isReturnAwbPrefix = upperCode.startsWith('MYSR') ||
      upperCode.startsWith('RPC') ||
      upperCode.startsWith('RP') ||
      upperCode.startsWith('RET') ||
      upperCode.startsWith('RMA') ||
      upperCode.startsWith('FMPR') ||
      upperCode.startsWith('RTO');

    const hasReturnRecord = !!returnRecord;
    const hasReverseCode = !!(order?.reversePickupCode || isReturnAwbPrefix);
    const hasReturnDate = !!(order?.returnedDate || order?.returnDate || returnRecord?.createdAt);
    const hasReturnReason = !!(order?.reversePickupReason || order?.returnReason || returnRecord?.notes);
    const pkgStatus = String(order?.shippingPackageStatusCode || order?.saleOrderStatus || order?.shippingCourierStatus || '').toUpperCase();
    const isRto = pkgStatus.includes('RTO') || (returnRecord?.returnType === 'RTO') || upperCode.startsWith('RTO');
    const isCustomerReturn = hasReverseCode || pkgStatus.includes('RETURN') || (!isRto && (hasReturnDate || hasReturnReason || hasReturnRecord));
    const isDelivered = !isCustomerReturn && !isRto && !!(order?.deliveryTime || pkgStatus === 'DELIVERED');
    const isDispatched = !isCustomerReturn && !isRto && !!(order?.dispatchDate || ['DISPATCHED', 'SHIPPED'].includes(pkgStatus));

    let orderClassification = 'NEW_DISPATCH';
    let orderClassificationLabel = 'NEW FORWARD ORDER (READY TO PACK)';
    let isReturn = false;

    if (isRto) {
      orderClassification = 'RETURN_RTO';
      orderClassificationLabel = 'COURIER RTO (UNDELIVERED RETURN)';
      isReturn = true;
    } else if (isCustomerReturn) {
      orderClassification = 'RETURN_CUSTOMER';
      orderClassificationLabel = 'CUSTOMER RETURN (CIR)';
      isReturn = true;
    } else if (isDelivered) {
      orderClassification = 'DELIVERED';
      orderClassificationLabel = 'DELIVERED TO CUSTOMER';
    } else if (isDispatched) {
      orderClassification = 'IN_TRANSIT';
      orderClassificationLabel = 'IN-TRANSIT (DISPATCHED)';
    } else {
      orderClassification = 'NEW_DISPATCH';
      orderClassificationLabel = 'NEW FORWARD ORDER (READY TO PACK)';
    }

    const isNewOrder = !isDispatched && !isReturn && !isDelivered;

    let currentStage = 'PACKED';
    if (isReturn) {
      currentStage = 'RETURNED';
    } else if (isDelivered) {
      currentStage = 'DELIVERED';
    } else if (isDispatched) {
      currentStage = 'IN_TRANSIT';
    } else if (order?.saleOrderStatus === 'COMPLETE') {
      currentStage = 'COMPLETE';
    }

    // Determine Payment Status (Paid / Pending / Refund Under Process / Not Collected)
    let paymentStatus = 'PAID';
    let paymentStatusLabel = 'Payment Done (Prepaid)';

    const orderStatusRaw = String(order?.saleOrderStatus || salesItem?.saleOrderStatus || '').toUpperCase();

    if (orderStatusRaw === 'CANCELLED') {
      paymentStatus = 'CANCELLED';
      paymentStatusLabel = 'Order Cancelled';
    } else if (isReturn) {
      if (isCod) {
        paymentStatus = 'NOT_COLLECTED';
        paymentStatusLabel = 'COD Not Collected (Returned / RTO)';
      } else {
        paymentStatus = 'REFUND_PENDING';
        paymentStatusLabel = 'Prepaid (Refund Under Process)';
      }
    } else if (isDelivered) {
      if (isCod) {
        paymentStatus = 'PAID';
        paymentStatusLabel = 'COD Collected (Payment Done)';
      } else {
        paymentStatus = 'PAID';
        paymentStatusLabel = 'Payment Done (Prepaid)';
      }
    } else {
      // Forward order in packing, dispatch, or in-transit
      if (isCod) {
        paymentStatus = 'PENDING';
        paymentStatusLabel = `Payment Pending (Collect ₹${codAmount || priceVal})`;
      } else {
        paymentStatus = 'PAID';
        paymentStatusLabel = 'Payment Done (Prepaid)';
      }
    }

    res.json({
      success: true,
      found: !!(order || salesItem),
      data: {
        awb: cleanCode,
        displayOrderCode,
        itemSKUCode,
        itemName,
        brand,
        channel,
        category: order?.category || salesItem?.category || 'Apparel',
        color: order?.itemTypeColor || salesItem?.itemTypeColor || '',
        size: order?.itemTypeSize || salesItem?.itemTypeSize || '',
        price: priceVal,
        mrp: order?.mrp || salesItem?.mrp || 0,
        paymentMode,
        paymentStatus,
        paymentStatusLabel,
        codAmount,
        isCod,
        customerName,
        customerPhone,
        invoiceCode,
        shippingPackageCode,
        city: order?.shippingAddressCity || salesItem?.shippingAddressCity || '',
        state: order?.shippingAddressState || salesItem?.shippingAddressState || '',
        pincode: order?.shippingAddressPincode || salesItem?.shippingAddressPincode || '',
        addressLine: [order?.shippingAddressLine1, order?.shippingAddressLine2].filter(Boolean).join(', ') || '',
        courier,
        currentStage,
        orderClassification,
        orderClassificationLabel,
        isReturn,
        isNewOrder,
        isDelivered,
        orderDate: order?.orderDate || salesItem?.orderDate || order?.displayOrderDateTime || null,
        dispatchDate: order?.dispatchDate || null,
        deliveryTime: order?.deliveryTime || null,
        returnDate: order?.returnDate || returnRecord?.createdAt || order?.returnedDate || null,
        reversePickupCode,
        returnReason,
        weightGrams: order?.weightGrams || order?.actualWeight || 0,
        returnWeightGrams: order?.returnWeightGrams || returnRecord?.weightGrams || 0,
        productImage,
        returnRecord: returnRecord || null
      }
    });
  } catch (error) {
    logger.error('scanPack.lookupAwb error: %o', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// ── POST /api/v1/scan-pack/pack ───────────────────────────────────────────────
// Marks AWB as Packed & Dispatched with auto-timestamp & weight check
const packOrder = async (req, res) => {
  try {
    const { awb, displayOrderCode, sku, courier, facility, weightGrams, notes } = req.body;
    if (!awb || !awb.trim()) {
      return res.status(400).json({ success: false, error: 'AWB code is required' });
    }

    const cleanAwb = String(awb).trim();
    const upperAwb = cleanAwb.toUpperCase();

    // Guard: Prevent accidental forward dispatch packing of Customer Returns / Reverse Pickups
    if (upperAwb.startsWith('MYSR') || upperAwb.startsWith('RPC') || upperAwb.startsWith('RP') || upperAwb.startsWith('FMPR')) {
      return res.status(400).json({
        success: false,
        error: `AWB "${cleanAwb}" is a Customer Return / Reverse Pickup code, not a Forward Dispatch code! Please process it via Screen 1 (Auto-Router) or Screen 3 (Return Station).`
      });
    }

    const nowIso = new Date().toISOString();
    const cleanCourier = courier || detectCourier(cleanAwb);
    const weight = Number(weightGrams) || 0;

    // Update or upsert in SaleOrder
    const filter = {
      $or: [
        { trackingNumber: cleanAwb },
        { shippingPackageCode: cleanAwb },
        ...(displayOrderCode ? [{ displayOrderCode }] : [])
      ]
    };

    let order = await db.SaleOrder.findOne(filter);
    if (order) {
      order.trackingNumber = cleanAwb;
      order.dispatchDate = nowIso;
      order.shippingCourier = cleanCourier;
      order.saleOrderStatus = 'DISPATCHED';
      order.saleOrderItemStatus = 'PACKED';
      if (weight > 0) order.weightGrams = weight;
      if (sku && !order.itemSKUCode) order.itemSKUCode = sku;
      if (facility) order.facility = facility;
      await order.save();
    } else {
      order = await db.SaleOrder.create({
        trackingNumber: cleanAwb,
        shippingPackageCode: cleanAwb,
        displayOrderCode: displayOrderCode || cleanAwb,
        itemSKUCode: sku || 'GENERAL-SKU',
        dispatchDate: nowIso,
        orderDate: new Date(),
        shippingCourier: cleanCourier,
        saleOrderStatus: 'DISPATCHED',
        saleOrderItemStatus: 'PACKED',
        weightGrams: weight,
        facility: facility || 'WH-MAIN'
      });
    }

    const isCod = order.cod === true || order.cod === 'true' || order.cod === 'COD' ||
      (typeof order.cod === 'number' && order.cod > 0) || Number(order.cod) > 0 ||
      String(order.paymentMethod || '').toUpperCase() === 'COD';
    const paymentMode = isCod ? 'COD' : 'PREPAID';
    const priceVal = Number(order.totalPrice) || 0;
    const codAmount = isCod ? (Number(order.cod) > 1 ? Number(order.cod) : priceVal) : 0;

    // Persist to ScanLog data store
    logScanEvent({
      awb: cleanAwb,
      shippingPackageCode: order.shippingPackageCode || cleanAwb,
      orderCode: order.displayOrderCode || displayOrderCode || cleanAwb,
      sku: order.itemSKUCode || sku,
      itemName: order.itemTypeName || '',
      courier: cleanCourier,
      channel: order.channel || 'Myntra',
      mode: 'PACK',
      status: 'PACKED',
      weightGrams: weight,
      price: priceVal,
      paymentMode,
      paymentStatus: isCod ? 'PENDING' : 'PAID',
      codAmount,
      facility: order.facility || facility || 'eliteedition',
      notes: notes || '',
      operator: req.user?.name || 'Warehouse Operator',
      operatorId: req.user?._id
    });

    res.status(200).json({
      success: true,
      message: `AWB ${cleanAwb} marked as PACKED & DISPATCHED (${weight > 0 ? `${weight}g` : 'Standard Weight'}) at ${new Date().toLocaleTimeString('en-IN')}`,
      data: order
    });
  } catch (error) {
    logger.error('scanPack.packOrder error: %o', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// ── POST /api/v1/scan-pack/deliver ───────────────────────────────────────────
// Marks AWB as Delivered with auto-timestamp
const markDelivered = async (req, res) => {
  try {
    const { awb, deliveryDate } = req.body;
    if (!awb || !awb.trim()) {
      return res.status(400).json({ success: false, error: 'AWB code is required' });
    }

    const cleanAwb = String(awb).trim();
    const deliveredAt = deliveryDate ? new Date(deliveryDate).toISOString() : new Date().toISOString();

    const order = await db.SaleOrder.findOneAndUpdate(
      {
        $or: [
          { trackingNumber: cleanAwb },
          { shippingPackageCode: cleanAwb },
          { displayOrderCode: cleanAwb }
        ]
      },
      {
        $set: {
          deliveryTime: deliveredAt,
          saleOrderStatus: 'DELIVERED',
          saleOrderItemStatus: 'DELIVERED'
        }
      },
      { new: true, upsert: true }
    );

    const isCod = order?.cod === true || order?.cod === 'true' || order?.cod === 'COD' ||
      (typeof order?.cod === 'number' && order?.cod > 0) || Number(order?.cod) > 0 ||
      String(order?.paymentMethod || '').toUpperCase() === 'COD';
    const paymentMode = isCod ? 'COD' : 'PREPAID';
    const priceVal = Number(order?.totalPrice) || 0;
    const codAmount = isCod ? (Number(order?.cod) > 1 ? Number(order.cod) : priceVal) : 0;

    // Persist to ScanLog data store
    logScanEvent({
      awb: cleanAwb,
      shippingPackageCode: order?.shippingPackageCode || '',
      orderCode: order?.displayOrderCode || '',
      sku: order?.itemSKUCode || '',
      itemName: order?.itemTypeName || '',
      courier: order?.shippingCourier,
      channel: order?.channel || 'Myntra',
      mode: 'DELIVERY',
      status: 'DELIVERED',
      price: priceVal,
      paymentMode,
      paymentStatus: 'PAID', // Delivered means payment has been settled/collected
      codAmount,
      facility: order?.facility || 'eliteedition',
      operator: req.user?.name || 'Warehouse Operator',
      operatorId: req.user?._id
    });

    res.status(200).json({
      success: true,
      message: `AWB ${cleanAwb} marked as DELIVERED successfully!`,
      data: order
    });
  } catch (error) {
    logger.error('scanPack.markDelivered error: %o', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// ── POST /api/v1/scan-pack/return ────────────────────────────────────────────
// Records Return / RTO Inward with auto-timestamp & auto-restocking
const processReturnScan = async (req, res) => {
  try {
    const {
      awb,
      returnType = 'RTO',
      condition = 'INTACT',
      displayOrderId,
      sku,
      quantity = 1,
      notes = '',
      party = 'Myntra',
      weightGrams = 0
    } = req.body;

    if (!awb || !awb.trim()) {
      return res.status(400).json({ success: false, error: 'AWB code is required for return processing' });
    }

    const cleanAwb = String(awb).trim();
    const nowIso = new Date().toISOString();
    const cleanQty = parseInt(quantity, 10) || 1;
    const returnWeight = Number(weightGrams) || 0;

    let status = 'STOCKED_IN';
    let defaultClaimStatus = 'NOT_APPLICABLE';
    if (condition === 'NEEDS_REFINISHING') {
      status = 'PENDING_REFINISH';
    } else if (condition === 'WRONG_ITEM' || condition === 'DAMAGED') {
      status = 'DISPUTED';
      defaultClaimStatus = 'CLAIM_PENDING';
    }

    const {
      images = [],
      claimStatus,
      claimId = '',
      claimAmount = 0,
      claimNotes = ''
    } = req.body;

    // 1. Create ReturnRecord
    const returnDoc = await db.ReturnRecord.create({
      party: party || 'Myntra',
      returnType,
      referenceId: cleanAwb,
      displayOrderId: displayOrderId || cleanAwb,
      sku: sku || 'SKU-RETURN',
      quantity: cleanQty,
      condition,
      notes: notes || `Return scanned via Scan & Pack station (${condition})`,
      status,
      weightGrams: returnWeight,
      images: Array.isArray(images) ? images : (images ? [images] : []),
      claimStatus: claimStatus || defaultClaimStatus,
      claimId,
      claimAmount: Number(claimAmount) || 0,
      claimNotes
    });

    // 2. Update SaleOrder record
    await db.SaleOrder.findOneAndUpdate(
      {
        $or: [
          { trackingNumber: cleanAwb },
          { shippingPackageCode: cleanAwb },
          { displayOrderCode: cleanAwb }
        ]
      },
      {
        $set: {
          returnDate: nowIso,
          returnReason: returnType,
          returnRemarks: `${condition} - ${notes}`,
          returnWeightGrams: returnWeight,
          saleOrderStatus: 'RETURNED'
        }
      }
    );

    // 3. Auto-restock if condition is INTACT
    let stockUpdated = false;
    if (status === 'STOCKED_IN' && sku) {
      await db.InventoryProduct.updateOne(
        { skuCode: sku },
        { $inc: { qty: cleanQty } }
      );
      const inv = await db.Inventory.findOne({ skuCode: sku });
      if (inv) {
        await db.Inventory.updateOne(
          { skuCode: sku },
          { $inc: { qty: cleanQty, currentlyAvailableStock: cleanQty } }
        );
      }
      stockUpdated = true;
    }

    // Retrieve order to get financial details
    const origOrder = await db.SaleOrder.findOne({
      $or: [{ trackingNumber: cleanAwb }, { shippingPackageCode: cleanAwb }, { displayOrderCode: displayOrderId }]
    }).lean();
    const isCod = origOrder?.cod === true || origOrder?.cod === 'true' || origOrder?.cod === 'COD' ||
      (typeof origOrder?.cod === 'number' && origOrder?.cod > 0) || Number(origOrder?.cod) > 0;
    const paymentMode = isCod ? 'COD' : 'PREPAID';
    const priceVal = Number(origOrder?.totalPrice) || 0;

    // Persist to ScanLog data store
    logScanEvent({
      awb: cleanAwb,
      shippingPackageCode: origOrder?.shippingPackageCode || '',
      orderCode: displayOrderId || origOrder?.displayOrderCode || '',
      sku: sku || origOrder?.itemSKUCode || '',
      itemName: origOrder?.itemTypeName || '',
      brand: origOrder?.itemTypeBrand || '',
      channel: origOrder?.channel || 'Myntra',
      customerName: origOrder?.shippingAddressName || '',
      city: origOrder?.shippingAddressCity || '',
      size: origOrder?.itemTypeSize || '',
      color: origOrder?.itemTypeColor || '',
      courier: detectCourier(cleanAwb),
      mode: returnType === 'RTO' ? 'RTO' : 'RETURN',
      status: status === 'STOCKED_IN' ? 'RESTOCKED' : 'SPF_CLAIM_FILED',
      weightGrams: returnWeight,
      price: priceVal,
      paymentMode,
      paymentStatus: isCod ? 'NOT_COLLECTED' : 'REFUND_PENDING',
      codAmount: 0,
      facility: 'eliteedition',
      notes: notes || '',
      operator: req.user?.name || 'Warehouse QC Desk',
      operatorId: req.user?._id,
      meta: { returnType, condition, returnRecordId: returnDoc._id }
    });

    res.status(201).json({
      success: true,
      message: `Return for AWB ${cleanAwb} processed (${status}).${stockUpdated ? ' Stock automatically incremented (+1).' : ''}`,
      data: returnDoc,
      stockUpdated
    });
  } catch (error) {
    logger.error('scanPack.processReturnScan error: %o', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// ── PUT /api/v1/scan-pack/return-claim/:id ───────────────────────────────────
// Updates SPF Claim status and details on a return record
const updateReturnClaim = async (req, res) => {
  try {
    const { id } = req.params;
    const { claimStatus, claimId, claimAmount, claimNotes, addImage } = req.body;

    const returnRec = await db.ReturnRecord.findById(id);
    if (!returnRec) {
      return res.status(404).json({ success: false, error: 'Return record not found' });
    }

    if (claimStatus) returnRec.claimStatus = claimStatus;
    if (claimId !== undefined) returnRec.claimId = claimId;
    if (claimAmount !== undefined) returnRec.claimAmount = Number(claimAmount) || 0;
    if (claimNotes !== undefined) returnRec.claimNotes = claimNotes;
    if (addImage) returnRec.images.push(addImage);

    await returnRec.save();

    res.json({
      success: true,
      message: 'Claim details updated successfully',
      data: returnRec
    });
  } catch (error) {
    logger.error('scanPack.updateReturnClaim error: %o', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// ── GET /api/v1/scan-pack/manifest/pending ───────────────────────────────────
// Lists today's or date-filtered dispatched packages grouped by courier partner
const getManifestPending = async (req, res) => {
  try {
    const { date, startDate, endDate, courier, channel } = req.query;
    let startOfDay, endOfDay;
    if (startDate || endDate) {
      startOfDay = startDate ? new Date(startDate) : new Date(0);
      startOfDay.setHours(0, 0, 0, 0);
      endOfDay = endDate ? new Date(endDate) : new Date();
      endOfDay.setHours(23, 59, 59, 999);
    } else if (date) {
      startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);
    } else {
      startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      endOfDay = new Date();
      endOfDay.setHours(23, 59, 59, 999);
    }

    const filter = {
      $or: [
        { dispatchDate: { $gte: startOfDay.toISOString(), $lte: endOfDay.toISOString() } },
        { updatedAt: { $gte: startOfDay, $lte: endOfDay }, saleOrderStatus: 'DISPATCHED' }
      ]
    };
    if (channel && channel !== 'ALL') {
      const channels = String(channel).split(',').map(s => s.trim()).filter(Boolean);
      if (channels.length > 1) {
        filter.channel = { $in: channels.map(c => new RegExp(`^${c.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}$`, 'i')) };
      } else if (channels.length === 1) {
        filter.channel = new RegExp(channels[0], 'i');
      }
    }
    if (courier && courier !== 'ALL') {
      const couriers = String(courier).split(',').map(s => s.trim()).filter(Boolean);
      if (couriers.length > 0) {
        filter.$and = filter.$and || [];
        const courierOr = [];
        couriers.forEach(c => {
          courierOr.push({ shippingCourier: new RegExp(c, 'i') });
          courierOr.push({ trackingNumber: new RegExp(c, 'i') });
        });
        filter.$and.push({ $or: courierOr });
      }
    }

    const orders = await db.SaleOrder.find(filter).sort({ dispatchDate: -1 }).lean();

    // Group by courier partner
    const courierGroups = {};
    orders.forEach(o => {
      const c = o.shippingCourier || detectCourier(o.trackingNumber) || 'Standard Logistics';
      if (!courierGroups[c]) {
        courierGroups[c] = { courier: c, count: 0, orders: [] };
      }
      courierGroups[c].count += 1;
      courierGroups[c].orders.push({
        awb: o.trackingNumber || o.shippingPackageCode || o.displayOrderCode,
        displayOrderCode: o.displayOrderCode,
        sku: o.itemSKUCode,
        itemName: o.itemTypeName || o.itemSKUCode,
        city: o.shippingAddressCity || '',
        customerName: o.shippingAddressName || o.billingAddressName || '',
        price: o.totalPrice || 0,
        dispatchedAt: o.dispatchDate
      });
    });

    res.json({
      success: true,
      date: startOfDay.toISOString().split('T')[0],
      totalDispatched: orders.length,
      groups: Object.values(courierGroups),
      orders
    });
  } catch (error) {
    logger.error('scanPack.getManifestPending error: %o', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// ── POST /api/v1/scan-pack/manifest/generate ─────────────────────────────────
// Saves an official courier handover manifest with sequential ID
const generateManifest = async (req, res) => {
  try {
    const { courier, driverName, driverPhone, vehicleNumber, packages = [], notes = '' } = req.body;
    if (!courier || !packages.length) {
      return res.status(400).json({ success: false, error: 'Courier and at least one package are required' });
    }

    // Generate Manifest ID: MNF-YYYYMMDD-XXXX
    const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const countToday = await db.CourierManifest.countDocuments({ createdAt: { $gte: todayStart } });
    const seq = String(countToday + 1).padStart(3, '0');
    const manifestId = `MNF-${todayStr}-${seq}`;

    const manifest = await db.CourierManifest.create({
      manifestId,
      courier,
      dispatchDate: new Date(),
      totalPackages: packages.length,
      packages,
      pickupDriverName: driverName || '',
      pickupDriverPhone: driverPhone || '',
      vehicleNumber: vehicleNumber || '',
      notes,
      status: 'HANDED_OVER'
    });

    res.status(201).json({
      success: true,
      message: `Manifest ${manifestId} generated with ${packages.length} packages!`,
      data: manifest
    });
  } catch (error) {
    logger.error('scanPack.generateManifest error: %o', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// ── GET /api/v1/scan-pack/manifest/list ───────────────────────────────────────
// Returns list of past generated manifests
const getManifests = async (req, res) => {
  try {
    const manifests = await db.CourierManifest.find({})
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    res.json({
      success: true,
      data: manifests
    });
  } catch (error) {
    logger.error('scanPack.getManifests error: %o', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// ── GET /api/v1/scan-pack/manifest/:manifestId ────────────────────────────────
// Returns a single manifest by ID
const getManifestById = async (req, res) => {
  try {
    const { manifestId } = req.params;
    const manifest = await db.CourierManifest.findOne({ manifestId }).lean();
    if (!manifest) {
      return res.status(404).json({ success: false, error: 'Manifest not found' });
    }

    res.json({
      success: true,
      data: manifest
    });
  } catch (error) {
    logger.error('scanPack.getManifestById error: %o', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// ── POST /api/v1/scan-pack/bulk-deliver ───────────────────────────────────────
// Marks multiple AWBs as DELIVERED from Courier MIS Excel/CSV paste
const bulkDeliver = async (req, res) => {
  try {
    const { awbs = [], deliveryDate } = req.body;
    if (!Array.isArray(awbs) || awbs.length === 0) {
      return res.status(400).json({ success: false, error: 'A list of AWB numbers is required' });
    }

    const cleanAwbs = [...new Set(awbs.map(a => String(a || '').trim()).filter(Boolean))];
    const deliveredAt = deliveryDate ? new Date(deliveryDate).toISOString() : new Date().toISOString();

    const result = await db.SaleOrder.updateMany(
      {
        $or: [
          { trackingNumber: { $in: cleanAwbs } },
          { shippingPackageCode: { $in: cleanAwbs } },
          { displayOrderCode: { $in: cleanAwbs } }
        ]
      },
      {
        $set: {
          deliveryTime: deliveredAt,
          saleOrderStatus: 'DELIVERED',
          saleOrderItemStatus: 'DELIVERED'
        }
      }
    );

    res.json({
      success: true,
      message: `Successfully marked ${result.modifiedCount} orders as DELIVERED!`,
      totalAwbsScanned: cleanAwbs.length,
      modifiedCount: result.modifiedCount,
      matchedCount: result.matchedCount
    });
  } catch (error) {
    logger.error('scanPack.bulkDeliver error: %o', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// ── POST /api/v1/scan-pack/log-scan ───────────────────────────────────────────
// Manually / directly persists a scan action into the ScanLog database
const recordScanLog = async (req, res) => {
  try {
    const {
      awb,
      shippingPackageCode,
      orderCode,
      sku,
      itemName,
      brand = '',
      channel = 'Myntra',
      size = '',
      color = '',
      productImage = '',
      customerName = '',
      city = '',
      courier,
      mode = 'PACK',
      status = 'SCANNED',
      weightGrams = 0,
      price = 0,
      paymentMode = 'PREPAID',
      paymentStatus = 'PAID',
      codAmount = 0,
      source = 'Barcode Scanner',
      notes = '',
      meta = {}
    } = req.body;

    if (!awb || !String(awb).trim()) {
      return res.status(400).json({ success: false, error: 'AWB code is required' });
    }

    const log = await logScanEvent({
      awb,
      shippingPackageCode,
      orderCode,
      sku,
      itemName,
      brand,
      channel,
      size,
      color,
      productImage,
      customerName,
      city,
      courier,
      mode,
      status,
      weightGrams,
      price,
      paymentMode,
      paymentStatus,
      codAmount,
      operator: req.user?.name || 'Warehouse Operator',
      operatorId: req.user?._id,
      facility: req.body.facility || 'eliteedition',
      source,
      notes,
      meta
    });

    res.status(201).json({ success: true, data: log });
  } catch (error) {
    logger.error('scanPack.recordScanLog error: %o', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// ── GET /api/v1/scan-pack/history ─────────────────────────────────────────────
// Returns persistent scan history from MongoDB with search, filters & pagination
const getScanHistory = async (req, res) => {
  try {
    const { limit = 50, page = 1, mode, search, startDate, endDate, courier, channel, status } = req.query;
    const cleanLimit = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 300);
    const cleanPage = Math.max(parseInt(page, 10) || 1, 1);
    const skip = (cleanPage - 1) * cleanLimit;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const returnPrefixRegex = /^(MYSR|RPC|RP|RET|RMA|FMPR)/i;
    const query = {};
    if (mode && mode !== 'ALL') {
      if (mode === 'RETURN') {
        query.$or = [
          { mode: { $in: ['RETURN', 'RTO'] } },
          { awb: returnPrefixRegex }
        ];
      } else if (mode === 'PACK' || mode === 'DISPATCH') {
        query.mode = { $in: ['PACK', 'DISPATCH'] };
        query.awb = { $not: returnPrefixRegex };
      } else if (mode === 'LOOKUP') {
        query.mode = { $in: ['LOOKUP', 'ALL'] };
      } else {
        query.mode = String(mode).toUpperCase();
      }
    }
    if (search && search.trim()) {
      const sRegex = new RegExp(search.trim(), 'i');
      query.$or = [
        { awb: sRegex },
        { shippingPackageCode: sRegex },
        { orderCode: sRegex },
        { sku: sRegex },
        { courier: sRegex },
        { customerName: sRegex },
        { city: sRegex }
      ];
    }
    if (courier && courier !== 'ALL') {
      const couriers = String(courier).split(',').map(s => s.trim()).filter(Boolean);
      if (couriers.length > 1) {
        query.courier = { $in: couriers.map(c => new RegExp(`^${c.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}$`, 'i')) };
      } else if (couriers.length === 1) {
        query.courier = new RegExp(couriers[0], 'i');
      }
    }
    if (channel && channel !== 'ALL') {
      const channels = String(channel).split(',').map(s => s.trim()).filter(Boolean);
      if (channels.length > 1) {
        query.channel = { $in: channels.map(c => new RegExp(`^${c.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}$`, 'i')) };
      } else if (channels.length === 1) {
        query.channel = new RegExp(channels[0], 'i');
      }
    }
    if (status && status !== 'ALL') {
      const statuses = String(status).split(',').map(s => s.trim()).filter(Boolean);
      if (statuses.length > 1) {
        query.status = { $in: statuses.map(s => new RegExp(`^${s.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}$`, 'i')) };
      } else if (statuses.length === 1) {
        query.status = new RegExp(statuses[0], 'i');
      }
    }
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query.createdAt.$lte = end;
      }
    }

    // Dynamic stats date range filter
    let statsStartIso, statsEndIso;
    let statsStartDate, statsEndDate;
    if (startDate || endDate) {
      if (startDate) {
        statsStartDate = new Date(startDate);
        statsStartIso = statsStartDate.toISOString();
      }
      if (endDate) {
        statsEndDate = new Date(endDate);
        statsEndDate.setHours(23, 59, 59, 999);
        statsEndIso = statsEndDate.toISOString();
      }
    } else {
      statsStartDate = today;
      statsStartIso = today.toISOString();
    }

    const dispatchFilter = { dispatchDate: { $gte: statsStartIso } };
    if (statsEndIso) dispatchFilter.dispatchDate.$lte = statsEndIso;

    const deliveryFilter = { deliveryTime: { $gte: statsStartIso } };
    if (statsEndIso) deliveryFilter.deliveryTime.$lte = statsEndIso;

    const returnFilter = { createdAt: { $gte: statsStartDate } };
    if (statsEndDate) returnFilter.createdAt.$lte = statsEndDate;

    if (channel && channel !== 'ALL') {
      dispatchFilter.channel = new RegExp(channel.trim(), 'i');
      deliveryFilter.channel = new RegExp(channel.trim(), 'i');
    }
    if (courier && courier !== 'ALL') {
      dispatchFilter.shippingCourier = new RegExp(courier.trim(), 'i');
      deliveryFilter.shippingCourier = new RegExp(courier.trim(), 'i');
    }

    const [dbLogs, totalLogsCount, dispatchedCount, deliveredCount, returnCount] = await Promise.all([
      db.ScanLog ? db.ScanLog.find(query).sort({ createdAt: -1 }).skip(skip).limit(cleanLimit).lean() : [],
      db.ScanLog ? db.ScanLog.countDocuments(query) : 0,
      db.SaleOrder.countDocuments(dispatchFilter),
      db.SaleOrder.countDocuments(deliveryFilter),
      db.ReturnRecord.countDocuments(returnFilter)
    ]);

    // Deduplicate dbLogs by unique AWB - each AWB code is strictly unique
    const uniqueLogsMap = new Map();
    for (const l of (dbLogs || [])) {
      const awbKey = String(l.awb || '').trim().toUpperCase();
      if (!awbKey || awbKey === 'UNDEFINED' || awbKey === 'NULL' || awbKey === 'NAN' || awbKey.length < 4) continue;
      if (!uniqueLogsMap.has(awbKey)) {
        uniqueLogsMap.set(awbKey, l);
      }
    }
    const cleanDbLogs = Array.from(uniqueLogsMap.values());

    // Format logs for frontend table
    let history = await Promise.all(cleanDbLogs.map(async (l) => {
      let img = l.productImage || '';
      if (!img && l.sku) {
        img = await findProductImageBySku(l.sku);
        if (img) {
          db.ScanLog.updateOne({ _id: l._id }, { $set: { productImage: img } }).catch(() => {});
        }
      }
      return {
        id: l._id,
        awb: l.awb,
        shippingPackageCode: l.shippingPackageCode || '',
        orderCode: l.orderCode || '',
        sku: l.sku || '',
        itemName: l.itemName || '',
        brand: l.brand || '',
        productImage: img,
        channel: l.channel || 'Myntra',
        customerName: l.customerName || '',
        city: l.city || '',
        size: l.size || '',
        color: l.color || '',
        weightGrams: l.weightGrams || 0,
        price: l.price || 0,
        paymentMode: l.paymentMode || 'PREPAID',
        paymentStatus: l.paymentStatus || 'PAID',
        codAmount: l.codAmount || 0,
        courier: l.courier || '',
        mode: l.mode,
        status: l.status,
        time: new Date(l.updatedAt || l.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        date: new Date(l.updatedAt || l.createdAt).toLocaleDateString('en-IN'),
        createdAt: l.updatedAt || l.createdAt,
        operator: l.operator || 'Warehouse Operator',
        notes: l.notes || '',
        source: l.source || '',
        meta: l.meta || {}
      };
    }));
    res.json({
      success: true,
      stats: {
        dispatchedToday: dispatchedCount,
        deliveredToday: deliveredCount,
        returnedToday: returnCount,
        totalScansToday: dispatchedCount + deliveredCount + returnCount
      },
      history,
      total: totalLogsCount || history.length,
      page: cleanPage,
      limit: cleanLimit
    });
  } catch (error) {
    logger.error('scanPack.getScanHistory error: %o', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// ── DELETE /api/v1/scan-pack/history/clear ──────────────────────────────────
// Optional purge for supervisors / clear test session logs
const clearScanHistory = async (req, res) => {
  try {
    const { daysOld = 0 } = req.body || {};
    let query = {};
    if (daysOld > 0) {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - parseInt(daysOld, 10));
      query = { createdAt: { $lt: cutoff } };
    }
    const result = await db.ScanLog.deleteMany(query);
    res.json({
      success: true,
      message: `Cleared ${result.deletedCount} scan history records.`,
      deletedCount: result.deletedCount
    });
  } catch (error) {
    logger.error('scanPack.clearScanHistory error: %o', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// ── GET /api/v1/scan-pack/analytics ──────────────────────────────────────────
// Computes courier partner performance, SLA turnaround & RTO return rates
const getCourierAnalytics = async (req, res) => {
  try {
    const { startDate, endDate, courier, channel } = req.query;

    const orderQuery = {
      $or: [
        { dispatchDate: { $exists: true, $ne: null } },
        { trackingNumber: { $exists: true, $ne: null } }
      ]
    };

    if (startDate || endDate) {
      const dateFilter = {};
      if (startDate) dateFilter.$gte = new Date(startDate).toISOString();
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        dateFilter.$lte = end.toISOString();
      }
      orderQuery.dispatchDate = dateFilter;
    }

    if (channel && channel !== 'ALL') {
      const channels = String(channel).split(',').map(s => s.trim()).filter(Boolean);
      if (channels.length > 1) {
        orderQuery.channel = { $in: channels.map(c => new RegExp(`^${c.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}$`, 'i')) };
      } else if (channels.length === 1) {
        orderQuery.channel = new RegExp(channels[0], 'i');
      }
    }

    if (courier && courier !== 'ALL') {
      const couriers = String(courier).split(',').map(s => s.trim()).filter(Boolean);
      if (couriers.length > 0) {
        orderQuery.$and = orderQuery.$and || [];
        const courierOr = [];
        couriers.forEach(c => {
          courierOr.push({ shippingCourier: new RegExp(c, 'i') });
          courierOr.push({ trackingNumber: new RegExp(c, 'i') });
        });
        orderQuery.$and.push({ $or: courierOr });
      }
    }

    const orders = await db.SaleOrder.find(orderQuery).lean();

    const courierStats = {};
    let totalDispatched = 0;
    let totalDelivered = 0;
    let totalReturned = 0;

    orders.forEach(o => {
      const c = o.shippingCourier || detectCourier(o.trackingNumber) || 'Standard Logistics';
      if (!courierStats[c]) {
        courierStats[c] = {
          courier: c,
          dispatched: 0,
          delivered: 0,
          returned: 0,
          inTransit: 0,
          totalValue: 0
        };
      }

      courierStats[c].dispatched += 1;
      totalDispatched += 1;
      courierStats[c].totalValue += (o.totalPrice || 0);

      if (o.returnDate || o.saleOrderStatus === 'RETURNED') {
        courierStats[c].returned += 1;
        totalReturned += 1;
      } else if (o.deliveryTime || o.saleOrderStatus === 'DELIVERED') {
        courierStats[c].delivered += 1;
        totalDelivered += 1;
      } else {
        courierStats[c].inTransit += 1;
      }
    });

    const summaryList = Object.values(courierStats).map(c => {
      const deliveryRate = c.dispatched > 0 ? ((c.delivered / c.dispatched) * 100).toFixed(1) : 0;
      const rtoRate = c.dispatched > 0 ? ((c.returned / c.dispatched) * 100).toFixed(1) : 0;
      return {
        ...c,
        deliveryRate: Number(deliveryRate),
        rtoRate: Number(rtoRate)
      };
    });

    // Claim stats
    const claimQuery = { claimStatus: { $ne: 'NOT_APPLICABLE' } };
    if (startDate || endDate) {
      claimQuery.createdAt = {};
      if (startDate) claimQuery.createdAt.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        claimQuery.createdAt.$lte = end;
      }
    }

    const [pendingClaims, approvedClaims, totalClaims] = await Promise.all([
      db.ReturnRecord.countDocuments({ ...claimQuery, claimStatus: 'CLAIM_PENDING' }),
      db.ReturnRecord.countDocuments({ ...claimQuery, claimStatus: 'CLAIM_APPROVED' }),
      db.ReturnRecord.find(claimQuery).lean()
    ]);

    const totalClaimAmount = totalClaims.reduce((acc, c) => acc + (c.claimAmount || 0), 0);

    res.json({
      success: true,
      overview: {
        totalDispatched,
        totalDelivered,
        totalReturned,
        overallRtoRate: totalDispatched > 0 ? ((totalReturned / totalDispatched) * 100).toFixed(1) : 0,
        pendingClaims,
        approvedClaims,
        totalClaimAmount
      },
      couriers: summaryList
    });
  } catch (error) {
    logger.error('scanPack.getCourierAnalytics error: %o', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

module.exports = {
  lookupAwb,
  packOrder,
  markDelivered,
  processReturnScan,
  updateReturnClaim,
  getManifestPending,
  generateManifest,
  getManifests,
  getManifestById,
  bulkDeliver,
  getScanHistory,
  recordScanLog,
  clearScanHistory,
  getCourierAnalytics
};
