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
        { saleOrderCode: regex }
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
          { saleOrderCode: regex }
        ]
      }).lean();
    }

    // 3. Search for any return record matching this AWB
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

    // Get product thumbnail from catalog if available
    let productImage = salesItem?.productImage || '';
    if (!productImage && itemSKUCode) {
      const catalog = await db.Product.findOne({ sku: itemSKUCode }).lean() ||
        await db.InventoryProduct.findOne({ skuCode: itemSKUCode }).lean();
      if (catalog?.imageUrl) productImage = catalog.imageUrl;
      else if (catalog?.images && catalog.images.length > 0) productImage = catalog.images[0];
    }

    // Extract current status
    let currentStage = 'PACKED';
    if (returnRecord) {
      currentStage = 'RETURNED';
    } else if (order?.deliveryTime) {
      currentStage = 'DELIVERED';
    } else if (order?.dispatchDate || order?.saleOrderStatus === 'DISPATCHED' || order?.saleOrderStatus === 'SHIPPED') {
      currentStage = 'IN_TRANSIT';
    } else if (order?.saleOrderStatus === 'COMPLETE') {
      currentStage = 'COMPLETE';
    }

    res.json({
      success: true,
      found: !!(order || salesItem),
      data: {
        awb: cleanCode,
        displayOrderCode,
        itemSKUCode,
        itemName,
        category: order?.category || salesItem?.category || 'Apparel',
        color: order?.itemTypeColor || salesItem?.itemTypeColor || '',
        size: order?.itemTypeSize || salesItem?.itemTypeSize || '',
        price: order?.totalPrice || salesItem?.totalPrice || 0,
        mrp: order?.mrp || salesItem?.mrp || 0,
        city: order?.shippingAddressCity || salesItem?.shippingAddressCity || '',
        state: order?.shippingAddressState || salesItem?.shippingAddressState || '',
        pincode: order?.shippingAddressPincode || salesItem?.shippingAddressPincode || '',
        courier,
        currentStage,
        orderDate: order?.orderDate || salesItem?.orderDate || null,
        dispatchDate: order?.dispatchDate || null,
        deliveryTime: order?.deliveryTime || null,
        returnDate: order?.returnDate || returnRecord?.createdAt || null,
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
// Marks AWB as Packed & Dispatched with auto-timestamp
const packOrder = async (req, res) => {
  try {
    const { awb, displayOrderCode, sku, courier, facility, notes } = req.body;
    if (!awb || !awb.trim()) {
      return res.status(400).json({ success: false, error: 'AWB code is required' });
    }

    const cleanAwb = String(awb).trim();
    const nowIso = new Date().toISOString();
    const cleanCourier = courier || detectCourier(cleanAwb);

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
        facility: facility || 'WH-MAIN'
      });
    }

    res.status(200).json({
      success: true,
      message: `AWB ${cleanAwb} marked as PACKED & DISPATCHED at ${new Date().toLocaleTimeString('en-IN')}`,
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
      party = 'Myntra'
    } = req.body;

    if (!awb || !awb.trim()) {
      return res.status(400).json({ success: false, error: 'AWB code is required for return processing' });
    }

    const cleanAwb = String(awb).trim();
    const nowIso = new Date().toISOString();
    const cleanQty = parseInt(quantity, 10) || 1;

    let status = 'STOCKED_IN';
    if (condition === 'NEEDS_REFINISHING') {
      status = 'PENDING_REFINISH';
    } else if (condition === 'WRONG_ITEM' || condition === 'DAMAGED') {
      status = 'DISPUTED';
    }

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
      status
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

// ── GET /api/v1/scan-pack/history ─────────────────────────────────────────────
// Returns recent scans with counts
const getScanHistory = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [dispatchedCount, deliveredCount, returnCount, recentDispatches, recentReturns] = await Promise.all([
      db.SaleOrder.countDocuments({ dispatchDate: { $gte: today.toISOString() } }),
      db.SaleOrder.countDocuments({ deliveryTime: { $gte: today.toISOString() } }),
      db.ReturnRecord.countDocuments({ createdAt: { $gte: today } }),
      db.SaleOrder.find({ dispatchDate: { $exists: true, $ne: null } })
        .sort({ updatedAt: -1 })
        .limit(25)
        .lean(),
      db.ReturnRecord.find({})
        .sort({ createdAt: -1 })
        .limit(25)
        .lean()
    ]);

    res.json({
      success: true,
      stats: {
        dispatchedToday: dispatchedCount,
        deliveredToday: deliveredCount,
        returnedToday: returnCount
      },
      recentDispatches,
      recentReturns
    });
  } catch (error) {
    logger.error('scanPack.getScanHistory error: %o', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

module.exports = {
  lookupAwb,
  packOrder,
  markDelivered,
  processReturnScan,
  getScanHistory
};
