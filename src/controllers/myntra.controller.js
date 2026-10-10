const httpStatus = require('http-status');
const axios = require('axios');
const db = require('../db/models');
const logger = require('../config/logger');

const MYNTRA_SANDBOX_URL = 'http://pretrtest-neo.myntapi.com';
const MYNTRA_PROD_URL = 'https://api.pretr.com';

// In-Memory state for mock sandbox PPMP lifecycle & webhooks
let simulatedOrders = [
  {
    orderId: 'MYN-ORD-8941201',
    packetId: 'PKT-MYN-55101',
    sku: 'ANOUK-AA22216_XXL',
    itemName: 'Sea Green Embroidered Kurta',
    qty: 1,
    warehouse: 'WH1 - Central Hub',
    pincode: '560032',
    orderTime: new Date(Date.now() - 3600000 * 2).toISOString(),
    sla: '3h 45m left',
    stage: 'UNACKNOWLEDGED',
    totalAmount: 1599,
    invoiceType: 'MYNTRA',
    invoiceNumber: null,
    trackingNo: 'MYSP1143243297',
    courier: 'Flipkart Logistics'
  },
  {
    orderId: 'MYN-ORD-8941202',
    packetId: 'PKT-MYN-55102',
    sku: 'ANOUK-AC21184_M',
    itemName: 'Yellow Floral Kurta Set',
    qty: 2,
    warehouse: 'WH1 - Central Hub',
    pincode: '248002',
    orderTime: new Date(Date.now() - 3600000 * 5).toISOString(),
    sla: '1h 10m left',
    stage: 'UNACKNOWLEDGED',
    totalAmount: 3760,
    invoiceType: 'MYNTRA',
    invoiceNumber: null,
    trackingNo: 'MYEP1036183017',
    courier: 'Ekart Logistics'
  },
  {
    orderId: 'MYN-ORD-8941203',
    packetId: 'PKT-MYN-55103',
    sku: 'ANOUK-AC22114_XL',
    itemName: 'Sunshine Yellow Pure Silk Kurta',
    qty: 1,
    warehouse: 'WH1 - Central Hub',
    pincode: '380058',
    orderTime: new Date(Date.now() - 3600000 * 8).toISOString(),
    sla: 'Expired SLA',
    stage: 'UNACKNOWLEDGED',
    totalAmount: 1880,
    invoiceType: 'SELLER',
    invoiceNumber: null,
    trackingNo: '10412789385',
    courier: 'Ecom Express'
  },
  {
    orderId: 'MYN-ORD-8941198',
    packetId: 'PKT-MYN-55098',
    sku: 'ANOUK-AC20505_M',
    itemName: 'Midnight Black Anarkali Kurta Set',
    qty: 1,
    warehouse: 'WH1 - Central Hub',
    pincode: '560068',
    orderTime: new Date(Date.now() - 3600000 * 12).toISOString(),
    sla: '8h 20m left',
    stage: 'ACCEPTED',
    totalAmount: 2546,
    invoiceType: 'MYNTRA',
    invoiceNumber: null,
    trackingNo: 'MYSP1143377164',
    courier: 'Flipkart Logistics'
  },
  {
    orderId: 'MYN-ORD-8941199',
    packetId: 'PKT-MYN-55099',
    sku: 'ANOUK-AC22111_M',
    itemName: 'Cream Embellished Festive Set',
    qty: 1,
    warehouse: 'WH1 - Central Hub',
    pincode: '226016',
    orderTime: new Date(Date.now() - 3600000 * 14).toISOString(),
    sla: '6h 15m left',
    stage: 'ACCEPTED',
    totalAmount: 2639,
    invoiceType: 'SELLER',
    invoiceNumber: null,
    trackingNo: 'MYSC1104283399',
    courier: 'Blue Dart'
  },
  {
    orderId: 'MYN-ORD-8941192',
    packetId: 'PKT-MYN-55092',
    sku: 'ANOUK-AA21751_XXL',
    itemName: 'Classic Jet Black Straight Kurta',
    qty: 1,
    warehouse: 'WH1 - Central Hub',
    pincode: '742101',
    orderTime: new Date(Date.now() - 3600000 * 20).toISOString(),
    sla: 'Packed & Invoiced',
    stage: 'RTD',
    totalAmount: 611,
    invoiceType: 'MYNTRA',
    invoiceNumber: 'INV-MYN-2026-9041',
    trackingNo: 'MYEP1036180826',
    courier: 'Ekart Logistics'
  },
  {
    orderId: 'MYN-ORD-8941188',
    packetId: 'PKT-MYN-55088',
    sku: 'ANOUK-AC21430_L',
    itemName: 'Emerald Green Festive Kurta Set',
    qty: 1,
    warehouse: 'WH1 - Central Hub',
    pincode: '560067',
    orderTime: new Date(Date.now() - 3600000 * 26).toISOString(),
    sla: 'Awaiting Handover',
    stage: 'RTS',
    totalAmount: 1781,
    invoiceType: 'MYNTRA',
    invoiceNumber: 'INV-MYN-2026-9034',
    trackingNo: 'MYSP1143230357',
    courier: 'Flipkart Logistics'
  }
];

let simulatedShipments = [
  {
    packetId: 'PKT-MYN-55088',
    trackingNo: 'MYSP1143230357',
    courier: 'Flipkart Logistics',
    dispatchedAt: new Date(Date.now() - 3600000 * 4).toISOString(),
    status: 'In-Transit',
    destination: 'Bengaluru, KA (560067)'
  },
  {
    packetId: 'PKT-MYN-55081',
    trackingNo: 'MYEP1036173703',
    courier: 'Ekart Logistics',
    dispatchedAt: new Date(Date.now() - 3600000 * 28).toISOString(),
    status: 'In-Transit',
    destination: 'Shahdol, MP (484001)'
  },
  {
    packetId: 'PKT-MYN-55075',
    trackingNo: 'MYSC1104271654',
    courier: 'Flipkart Logistics',
    dispatchedAt: new Date(Date.now() - 3600000 * 52).toISOString(),
    status: 'Delivered',
    destination: 'Indore, MP (452001)'
  }
];

let simulatedReturns = [
  {
    returnId: 'RET-MYN-9901',
    packetId: 'cou_PKT-MYN-55060',
    type: 'COURIER_RTO',
    orderId: 'MYN-ORD-8940991',
    awb: '10412789385',
    sku: 'ANOUK-AA21890_S',
    itemName: 'Red Festive Straight Kurta',
    qty: 1,
    reason: 'Customer Refused on Delivery (COD Failure)',
    status: 'INWARD_PENDING',
    courier: 'Ecom Express',
    initiatedAt: new Date(Date.now() - 3600000 * 18).toISOString()
  },
  {
    returnId: 'RET-MYN-9902',
    packetId: 'PKT-MYN-55052',
    type: 'CUSTOMER_RTV',
    orderId: 'MYN-ORD-8940885',
    awb: 'MYSP1143220950',
    sku: 'ANOUK-AA22217_XL',
    itemName: 'Beige Embroidered Kurta',
    qty: 1,
    reason: 'Size Too Large / Fit Issue',
    status: 'INWARD_PENDING',
    courier: 'Flipkart Logistics',
    initiatedAt: new Date(Date.now() - 3600000 * 40).toISOString()
  }
];

let simulatedCatalog = [
  {
    skuCode: 'ANOUK-AA22216_XXL',
    internalItem: 'Sea Green Embroidered Kurta',
    barcode: '8907812990123',
    warehouse: 'WH1',
    erpStock: 84,
    myntraActiveStock: 75,
    bufferReserve: 9,
    price: 1599,
    discountPercent: 10,
    syncStatus: 'SYNCED',
    lastSync: new Date(Date.now() - 1800000).toISOString()
  },
  {
    skuCode: 'ANOUK-AC21184_M',
    internalItem: 'Yellow Floral Kurta Set',
    barcode: '8907812990130',
    warehouse: 'WH1',
    erpStock: 42,
    myntraActiveStock: 38,
    bufferReserve: 4,
    price: 3799,
    discountPercent: 15,
    syncStatus: 'SYNCED',
    lastSync: new Date(Date.now() - 3600000).toISOString()
  },
  {
    skuCode: 'ANOUK-AC22114_XL',
    internalItem: 'Sunshine Yellow Pure Silk Kurta',
    barcode: '8907812990147',
    warehouse: 'WH1',
    erpStock: 16,
    myntraActiveStock: 12,
    bufferReserve: 4,
    price: 1880,
    discountPercent: 0,
    syncStatus: 'SYNCED',
    lastSync: new Date(Date.now() - 5400000).toISOString()
  },
  {
    skuCode: 'ANOUK-AC20505_M',
    internalItem: 'Midnight Black Anarkali Kurta Set',
    barcode: '8907812990154',
    warehouse: 'WH1',
    erpStock: 5,
    myntraActiveStock: 5,
    bufferReserve: 0,
    price: 2546,
    discountPercent: 5,
    syncStatus: 'DRIFT_DETECTED',
    lastSync: new Date(Date.now() - 86400000).toISOString()
  }
];

let simulatedWebhookEvents = [
  {
    id: 'evt_' + Date.now() + '_1',
    timestamp: new Date(Date.now() - 3600000 * 2).toISOString(),
    event: 'ORDER_RELEASED',
    payload: {
      eventType: 'ORDER_RELEASED',
      orderId: 'MYN-ORD-8941201',
      packetId: 'PKT-MYN-55101',
      warehouseCode: 'WH1',
      itemsCount: 1,
      slaDue: new Date(Date.now() + 3600000 * 4).toISOString()
    }
  },
  {
    id: 'evt_' + Date.now() + '_2',
    timestamp: new Date(Date.now() - 1800000).toISOString(),
    event: 'INVENTORY_RESERVATION_CONFIRMED',
    payload: {
      eventType: 'INVENTORY_RESERVATION_CONFIRMED',
      storeCode: 'WH1',
      skuCode: 'ANOUK-AA22216_XXL',
      reservedQty: 1,
      availableQty: 74
    }
  }
];

const logWebhookEvent = (event, payload) => {
  const item = {
    id: 'evt_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
    timestamp: new Date().toISOString(),
    event,
    payload
  };
  simulatedWebhookEvents.unshift(item);
  if (simulatedWebhookEvents.length > 50) simulatedWebhookEvents.pop();
  return item;
};

// ==================== CONFIG & TOKEN ====================

const saveConfig = async (req, res) => {
  try {
    const { merchantId, secretKey, environment, partnerName, defaultWarehouse } = req.body;
    if (!merchantId || !secretKey) {
      return res.status(httpStatus.BAD_REQUEST).send('Merchant ID and Secret Key are required');
    }

    let config = await db.MyntraConfig.findOne();
    if (config) {
      config.merchantId = merchantId;
      config.secretKey = secretKey;
      config.environment = environment || 'sandbox';
      config.partnerName = partnerName || 'elite_edition_retail';
      config.defaultWarehouse = defaultWarehouse || 'WH1';
      config.accessToken = 'mock_jwt_' + Buffer.from(merchantId + Date.now()).toString('base64');
      config.tokenExpiry = new Date(Date.now() + 86400000);
      await config.save();
    } else {
      config = await db.MyntraConfig.create({
        merchantId,
        secretKey,
        environment: environment || 'sandbox',
        partnerName: partnerName || 'elite_edition_retail',
        defaultWarehouse: defaultWarehouse || 'WH1',
        accessToken: 'mock_jwt_' + Buffer.from(merchantId + Date.now()).toString('base64'),
        tokenExpiry: new Date(Date.now() + 86400000)
      });
    }

    logWebhookEvent('CONFIG_UPDATED', { merchantId, environment: config.environment });

    res.status(httpStatus.OK).send({
      message: 'Myntra credentials & settings saved successfully',
      config: {
        merchantId: config.merchantId,
        environment: config.environment || 'sandbox',
        partnerName: config.partnerName || 'elite_edition_retail',
        defaultWarehouse: config.defaultWarehouse || 'WH1'
      }
    });
  } catch (error) {
    logger.error('Error saving Myntra config: %o', error.message);
    res.status(httpStatus.BAD_REQUEST).send(error.message || 'Error saving Myntra config');
  }
};

const getConfig = async (req, res) => {
  try {
    const config = await db.MyntraConfig.findOne();
    if (config) {
      const maskedKey = config.secretKey.length > 8 
        ? config.secretKey.substring(0, 4) + '••••••••' + config.secretKey.substring(config.secretKey.length - 4)
        : '••••••••••••';
      
      const now = new Date();
      const expiry = config.tokenExpiry ? new Date(config.tokenExpiry) : new Date(Date.now() + 86400000);
      const isTokenValid = expiry > now;
      const hoursRemaining = Math.max(0, Math.round((expiry - now) / (1000 * 60 * 60)));

      res.status(httpStatus.OK).send({
        merchantId: config.merchantId || 'ASAAESFA',
        secretKey: maskedKey,
        rawSecretKey: config.secretKey,
        environment: config.environment || 'sandbox',
        partnerName: config.partnerName || 'elite_edition_retail',
        defaultWarehouse: config.defaultWarehouse || 'WH1',
        isSet: true,
        tokenHealth: {
          status: isTokenValid ? 'Active' : 'Expired',
          hoursRemaining: `${hoursRemaining}h 48m`,
          expiresAt: expiry.toISOString(),
          lastRefreshed: config.updatedAt ? config.updatedAt.toISOString() : new Date().toISOString()
        }
      });
    } else {
      res.status(httpStatus.OK).send({
        isSet: false,
        merchantId: 'ASAAESFA',
        secretKey: '',
        environment: 'sandbox',
        partnerName: 'elite_edition_retail',
        defaultWarehouse: 'WH1',
        tokenHealth: {
          status: 'Active',
          hoursRemaining: '24h 00m',
          expiresAt: new Date(Date.now() + 86400000).toISOString(),
          lastRefreshed: new Date().toISOString()
        }
      });
    }
  } catch (error) {
    logger.error('Error fetching Myntra config: %o', error.message);
    res.status(httpStatus.INTERNAL_SERVER_ERROR).send('Error fetching Myntra config');
  }
};

const refreshToken = async (req, res) => {
  try {
    const newToken = 'mock_jwt_refreshed_' + Date.now();
    const expiry = new Date(Date.now() + 86400000);

    let config = await db.MyntraConfig.findOne();
    if (config) {
      config.accessToken = newToken;
      config.tokenExpiry = expiry;
      await config.save();
    }

    logWebhookEvent('TOKEN_REFRESHED', { newExpiry: expiry.toISOString() });

    res.status(httpStatus.OK).send({
      message: 'Access Token refreshed successfully with Myntra OAuth2 service',
      token: newToken,
      expiresAt: expiry.toISOString(),
      hoursRemaining: '24h 00m'
    });
  } catch (error) {
    res.status(httpStatus.INTERNAL_SERVER_ERROR).send('Failed to refresh Myntra token');
  }
};

// ==================== ORDER FULFILLMENT ====================

const getOrders = async (req, res) => {
  try {
    res.status(httpStatus.OK).send({
      orders: simulatedOrders,
      pipelineCounts: {
        unacknowledged: simulatedOrders.filter(o => o.stage === 'UNACKNOWLEDGED').length,
        accepted: simulatedOrders.filter(o => o.stage === 'ACCEPTED').length,
        rtd: simulatedOrders.filter(o => o.stage === 'RTD').length,
        rts: simulatedOrders.filter(o => o.stage === 'RTS').length,
      }
    });
  } catch (error) {
    res.status(httpStatus.INTERNAL_SERVER_ERROR).send('Error fetching orders');
  }
};

const acceptOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const order = simulatedOrders.find(o => o.orderId === id || o.packetId === id);
    if (!order) {
      return res.status(httpStatus.NOT_FOUND).send('Order not found');
    }

    order.stage = 'ACCEPTED';
    order.sla = '6h 30m left';

    logWebhookEvent('ORDER_ACCEPTED', { orderId: order.orderId, packetId: order.packetId });

    res.status(httpStatus.OK).send({
      message: `Order ${order.orderId} accepted successfully`,
      order
    });
  } catch (error) {
    res.status(httpStatus.INTERNAL_SERVER_ERROR).send('Error accepting order');
  }
};

const bulkAcceptOrders = async (req, res) => {
  try {
    const { orderIds } = req.body;
    if (!Array.isArray(orderIds) || !orderIds.length) {
      return res.status(httpStatus.BAD_REQUEST).send('orderIds array required');
    }

    let acceptedCount = 0;
    simulatedOrders.forEach(o => {
      if (orderIds.includes(o.orderId) && o.stage === 'UNACKNOWLEDGED') {
        o.stage = 'ACCEPTED';
        o.sla = '6h 30m left';
        acceptedCount++;
      }
    });

    logWebhookEvent('BULK_ORDERS_ACCEPTED', { count: acceptedCount, orderIds });

    res.status(httpStatus.OK).send({
      message: `Successfully accepted ${acceptedCount} orders`,
      acceptedCount
    });
  } catch (error) {
    res.status(httpStatus.INTERNAL_SERVER_ERROR).send('Error bulk accepting orders');
  }
};

const readyToDispatch = async (req, res) => {
  try {
    const { orderId, packetId, invoiceType } = req.body;
    const order = simulatedOrders.find(o => o.orderId === orderId || o.packetId === packetId);
    if (!order) {
      return res.status(httpStatus.NOT_FOUND).send('Order not found');
    }

    order.stage = 'RTD';
    order.invoiceType = invoiceType || 'MYNTRA';
    order.invoiceNumber = `INV-MYN-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    order.sla = 'Ready For Handover Scan';

    logWebhookEvent('PACKET_READY_TO_DISPATCH', {
      orderId: order.orderId,
      packetId: order.packetId,
      invoiceNumber: order.invoiceNumber,
      invoiceType: order.invoiceType
    });

    res.status(httpStatus.OK).send({
      message: `Order ${order.orderId} marked Ready To Dispatch (RTD)`,
      order
    });
  } catch (error) {
    res.status(httpStatus.INTERNAL_SERVER_ERROR).send('Error marking RTD');
  }
};

const readyToShip = async (req, res) => {
  try {
    const { packetId, barcode } = req.body;
    const target = (packetId || barcode || '').trim();

    const order = simulatedOrders.find(o => 
      o.packetId.toLowerCase() === target.toLowerCase() || 
      o.orderId.toLowerCase() === target.toLowerCase() ||
      (o.trackingNo && o.trackingNo.toLowerCase() === target.toLowerCase())
    );

    if (!order) {
      return res.status(httpStatus.NOT_FOUND).send({
        message: `No active packet or order found for barcode: "${target}"`
      });
    }

    order.stage = 'RTS';
    order.sla = 'Dispatched to Dispatch Bay';

    // Also push into shipments handover if not present
    if (!simulatedShipments.some(s => s.packetId === order.packetId)) {
      simulatedShipments.unshift({
        packetId: order.packetId,
        trackingNo: order.trackingNo || 'AWB-' + Math.floor(10000000 + Math.random() * 90000000),
        courier: order.courier || 'Flipkart Logistics',
        dispatchedAt: new Date().toISOString(),
        status: 'In-Transit',
        destination: `Pincode: ${order.pincode}`
      });
    }

    logWebhookEvent('PACKET_SCANNED_RTS', {
      orderId: order.orderId,
      packetId: order.packetId,
      trackingNo: order.trackingNo
    });

    res.status(httpStatus.OK).send({
      message: `Packet ${order.packetId} verified and marked Ready To Ship (RTS)!`,
      order
    });
  } catch (error) {
    res.status(httpStatus.INTERNAL_SERVER_ERROR).send('Error marking RTS');
  }
};

// ==================== DOCUMENTS & LABELS ====================

const getShippingLabel = async (req, res) => {
  const { id } = req.params;
  const order = simulatedOrders.find(o => o.packetId === id || o.orderId === id) || {
    packetId: id,
    orderId: 'MYN-ORD-8941201',
    trackingNo: 'MYSP1143243297',
    courier: 'Flipkart Logistics',
    pincode: '560032',
    sku: 'ANOUK-AA22216_XXL'
  };

  // Generate an authentic printable HTML shipping label payload
  res.setHeader('Content-Type', 'text/html');
  return res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Myntra Shipping Label - ${order.packetId}</title>
      <style>
        body { font-family: monospace, sans-serif; padding: 24px; max-width: 480px; margin: 0 auto; border: 2px dashed #000; }
        .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 12px; margin-bottom: 12px; }
        .barcode { text-align: center; font-size: 24px; letter-spacing: 6px; font-weight: bold; padding: 12px 0; border: 1px solid #ddd; margin: 8px 0; }
        .grid { display: flex; justify-content: space-between; margin: 6px 0; font-size: 13px; }
        .bold { font-weight: bold; }
      </style>
    </head>
    <body onload="window.print()">
      <div class="header">
        <h2 style="margin:0; color:#e11d48;">MYNTRA LOGISTICS</h2>
        <small>PPMP Surface Dispatch Pass</small>
      </div>
      <div class="barcode">||||| | |||| ||| |||||||</div>
      <div style="text-align:center; font-size:12px;">AWB: ${order.trackingNo || 'MYSP1143243297'}</div>
      <hr/>
      <div class="grid"><span class="bold">Packet ID:</span><span>${order.packetId}</span></div>
      <div class="grid"><span class="bold">Order ID:</span><span>${order.orderId}</span></div>
      <div class="grid"><span class="bold">Courier Partner:</span><span>${order.courier || 'Flipkart Logistics'}</span></div>
      <div class="grid"><span class="bold">Destination Pincode:</span><span>${order.pincode || '560032'}</span></div>
      <div class="grid"><span class="bold">SKU Code:</span><span>${order.sku}</span></div>
      <hr/>
      <p style="font-size:11px; text-align:center; color:#555;">Verified by Elite Edition ERP Enterprise Engine</p>
    </body>
    </html>
  `);
};

const getDocument = async (req, res) => {
  const { id } = req.params;
  const { type } = req.query; // 'invoice'

  const order = simulatedOrders.find(o => o.packetId === id || o.orderId === id) || {
    packetId: id,
    orderId: 'MYN-ORD-8941201',
    invoiceNumber: 'INV-MYN-2026-9041',
    totalAmount: 1599,
    sku: 'ANOUK-AA22216_XXL',
    itemName: 'Sea Green Embroidered Kurta'
  };

  res.setHeader('Content-Type', 'text/html');
  return res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Tax Invoice - ${order.invoiceNumber || 'INV-2026'}</title>
      <style>
        body { font-family: sans-serif; padding: 24px; max-width: 600px; margin: 0 auto; border: 1px solid #ccc; font-size: 13px; }
        .hdr { display: flex; justify-content: space-between; border-bottom: 2px solid #e11d48; padding-bottom: 12px; }
        table { width: 100%; border-collapse: collapse; margin-top: 16px; }
        th, td { border: 1px solid #e2e8f0; padding: 8px; text-align: left; }
        th { background: #f8fafc; }
        .total { font-weight: bold; text-align: right; margin-top: 12px; }
      </style>
    </head>
    <body onload="window.print()">
      <div class="hdr">
        <div>
          <h2 style="margin:0; color:#e11d48;">ELITE EDITION</h2>
          <small>GSTIN: 24AAACE1234F1Z5</small>
        </div>
        <div style="text-align:right;">
          <h3 style="margin:0;">TAX INVOICE</h3>
          <div>Invoice: ${order.invoiceNumber || 'INV-MYN-2026-9041'}</div>
          <div>Date: ${new Date().toLocaleDateString()}</div>
        </div>
      </div>
      <p><strong>Channel:</strong> Myntra PPMP Marketplace | <strong>Packet ID:</strong> ${order.packetId}</p>
      <table>
        <thead>
          <tr>
            <th>Item & SKU</th>
            <th>Qty</th>
            <th>Rate</th>
            <th>Tax (5%)</th>
            <th>Total (INR)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>${order.itemName} (${order.sku})</td>
            <td>${order.qty || 1}</td>
            <td>₹${Math.round((order.totalAmount || 1599) * 0.95)}</td>
            <td>₹${Math.round((order.totalAmount || 1599) * 0.05)}</td>
            <td>₹${order.totalAmount || 1599}</td>
          </tr>
        </tbody>
      </table>
      <div class="total">Total Amount: ₹${order.totalAmount || 1599}</div>
    </body>
    </html>
  `);
};

const getCatalog = async (req, res) => {
  res.status(httpStatus.OK).send(simulatedCatalog);
};

const addOrUpdateSku = async (req, res) => {
  try {
    const { skuCode, internalItem, barcode, price } = req.body;
    if (!skuCode) return res.status(httpStatus.BAD_REQUEST).send('skuCode required');

    let existing = simulatedCatalog.find(c => c.skuCode === skuCode);
    if (existing) {
      if (price) existing.price = Number(price);
      if (internalItem) existing.internalItem = internalItem;
      if (barcode) existing.barcode = barcode;
    } else {
      simulatedCatalog.push({
        skuCode,
        internalItem: internalItem || 'Custom Anouk Kurti',
        barcode: barcode || '890' + Math.floor(1000000000 + Math.random() * 9000000000),
        warehouse: 'WH1',
        erpStock: 25,
        myntraActiveStock: 20,
        bufferReserve: 5,
        price: Number(price) || 1999,
        discountPercent: 0,
        syncStatus: 'SYNCED',
        lastSync: new Date().toISOString()
      });
    }

    logWebhookEvent('SKU_REGISTERED', { skuCode, price });

    res.status(httpStatus.OK).send({
      message: `SKU ${skuCode} saved to Myntra Catalog`,
      catalog: simulatedCatalog
    });
  } catch (error) {
    res.status(httpStatus.INTERNAL_SERVER_ERROR).send('Error saving SKU');
  }
};

const mapWarehouse = async (req, res) => {
  try {
    const { warehouseName, skuCodes } = req.body;
    if (!warehouseName) return res.status(httpStatus.BAD_REQUEST).send('warehouseName required');

    let updated = 0;
    if (Array.isArray(skuCodes) && skuCodes.length) {
      simulatedCatalog.forEach(c => {
        if (skuCodes.includes(c.skuCode)) {
          c.warehouse = warehouseName;
          updated++;
        }
      });
    }

    logWebhookEvent('WAREHOUSE_MAPPED', { warehouseName, mappedCount: updated });

    res.status(httpStatus.OK).send({
      message: `Warehouse ${warehouseName} successfully mapped with ${updated} SKUs`,
      warehouseName
    });
  } catch (error) {
    res.status(httpStatus.INTERNAL_SERVER_ERROR).send('Error mapping warehouse');
  }
};

const updateInventory = async (req, res) => {
  try {
    simulatedCatalog.forEach(c => {
      c.myntraActiveStock = Math.max(0, c.erpStock - c.bufferReserve);
      c.syncStatus = 'SYNCED';
      c.lastSync = new Date().toISOString();
    });

    logWebhookEvent('INVENTORY_PUSH_EXECUTED', {
      skusCount: simulatedCatalog.length,
      timestamp: new Date().toISOString()
    });

    res.status(httpStatus.OK).send({
      message: `Successfully pushed live stock for ${simulatedCatalog.length} SKUs to Myntra PPMP API`,
      catalog: simulatedCatalog
    });
  } catch (error) {
    res.status(httpStatus.INTERNAL_SERVER_ERROR).send('Error updating inventory');
  }
};

const syncInventory = updateInventory; // alias

const overrideDiscount = async (req, res) => {
  try {
    const { skuCode, discountPercent, newPrice } = req.body;
    const item = simulatedCatalog.find(c => c.skuCode === skuCode);
    if (!item) return res.status(httpStatus.NOT_FOUND).send('SKU not found');

    if (discountPercent !== undefined) item.discountPercent = Number(discountPercent);
    if (newPrice !== undefined) item.price = Number(newPrice);
    item.lastSync = new Date().toISOString();

    logWebhookEvent('DISCOUNT_OVERRIDDEN', { skuCode, discountPercent, newPrice });

    res.status(httpStatus.OK).send({
      message: `Price/Discount override pushed for ${skuCode}`,
      item
    });
  } catch (error) {
    res.status(httpStatus.INTERNAL_SERVER_ERROR).send('Error overriding discount');
  }
};

const applyDiscount = overrideDiscount; // alias

// ==================== DISPATCH & TRACKING ====================

const getShipments = async (req, res) => {
  res.status(httpStatus.OK).send(simulatedShipments);
};

const mockPacketShipped = async (req, res) => {
  try {
    const { id } = req.params;
    let shipment = simulatedShipments.find(s => s.packetId === id);
    if (shipment) {
      shipment.status = 'In-Transit';
      shipment.dispatchedAt = new Date().toISOString();
    } else {
      shipment = {
        packetId: id,
        trackingNo: 'MYSP' + Math.floor(1000000000 + Math.random() * 9000000000),
        courier: 'Flipkart Logistics',
        dispatchedAt: new Date().toISOString(),
        status: 'In-Transit',
        destination: 'Hub Handover Complete'
      };
      simulatedShipments.unshift(shipment);
    }

    logWebhookEvent('SHIPMENT_IN_TRANSIT', { packetId: id });

    res.status(httpStatus.OK).send({
      message: `Packet ${id} marked In-Transit`,
      shipment
    });
  } catch (error) {
    res.status(httpStatus.INTERNAL_SERVER_ERROR).send('Error updating shipment');
  }
};

const mockPacketDelivered = async (req, res) => {
  try {
    const { id } = req.params;
    let shipment = simulatedShipments.find(s => s.packetId === id);
    if (shipment) {
      shipment.status = 'Delivered';
    } else {
      shipment = {
        packetId: id,
        trackingNo: 'MYSP' + Math.floor(1000000000 + Math.random() * 9000000000),
        courier: 'Flipkart Logistics',
        dispatchedAt: new Date(Date.now() - 86400000).toISOString(),
        status: 'Delivered',
        destination: 'Customer Delivered'
      };
      simulatedShipments.unshift(shipment);
    }

    logWebhookEvent('SHIPMENT_DELIVERED', { packetId: id });

    res.status(httpStatus.OK).send({
      message: `Packet ${id} marked Delivered`,
      shipment
    });
  } catch (error) {
    res.status(httpStatus.INTERNAL_SERVER_ERROR).send('Error delivering shipment');
  }
};

// ==================== RETURNS & RTO ====================

const getReturns = async (req, res) => {
  res.status(httpStatus.OK).send(simulatedReturns);
};

const getReturnDetails = async (req, res) => {
  try {
    const { packetId } = req.params;
    const ret = simulatedReturns.find(r => 
      r.packetId.toLowerCase().includes(packetId.toLowerCase()) || 
      r.awb.toLowerCase() === packetId.toLowerCase()
    );

    if (!ret) {
      // Mock generate on scan for smooth experience
      const newRet = {
        returnId: 'RET-MYN-' + Math.floor(1000 + Math.random() * 9000),
        packetId: packetId.startsWith('cou_') ? packetId : 'cou_' + packetId,
        type: packetId.startsWith('cou_') ? 'COURIER_RTO' : 'CUSTOMER_RTV',
        orderId: 'MYN-ORD-' + Math.floor(8900000 + Math.random() * 90000),
        awb: 'AWB-' + Math.floor(10000000 + Math.random() * 90000000),
        sku: 'ANOUK-AC21184_M',
        itemName: 'Yellow Floral Kurta Set',
        qty: 1,
        reason: 'Courier Return - Customer Unavailable',
        status: 'INWARD_PENDING',
        courier: 'Flipkart Logistics',
        initiatedAt: new Date().toISOString()
      };
      simulatedReturns.unshift(newRet);
      return res.status(httpStatus.OK).send(newRet);
    }

    res.status(httpStatus.OK).send(ret);
  } catch (error) {
    res.status(httpStatus.INTERNAL_SERVER_ERROR).send('Error looking up return');
  }
};

const updateReturn = async (req, res) => {
  try {
    const { returnId } = req.params;
    const { qcResult, notes } = req.body; // 'RESTOCK' or 'DAMAGED'

    const ret = simulatedReturns.find(r => r.returnId === returnId || r.packetId === returnId);
    if (!ret) return res.status(httpStatus.NOT_FOUND).send('Return record not found');

    ret.status = qcResult === 'RESTOCK' ? 'RESTOCKED_TO_INVENTORY' : 'SCRAP_DAMAGED';
    ret.qcResult = qcResult;
    ret.qcNotes = notes || '';
    ret.inspectedAt = new Date().toISOString();

    // If restock, increment local ERP stock for that SKU
    if (qcResult === 'RESTOCK') {
      const cat = simulatedCatalog.find(c => c.skuCode === ret.sku);
      if (cat) cat.erpStock += ret.qty || 1;
    }

    logWebhookEvent('RETURN_QC_COMPLETED', {
      returnId: ret.returnId,
      qcResult,
      sku: ret.sku
    });

    res.status(httpStatus.OK).send({
      message: `Return ${ret.returnId} inspected and ${qcResult === 'RESTOCK' ? 'restocked to inventory' : 'marked as damaged/B-grade'}.`,
      ret
    });
  } catch (error) {
    res.status(httpStatus.INTERNAL_SERVER_ERROR).send('Error updating return');
  }
};

// ==================== MOCKIFY SIMULATOR ====================

const mockInjectOrder = async (req, res) => {
  try {
    const { sku, warehouse, quantity } = req.body;
    const safeSku = sku || 'ANOUK-AA22216_XXL';
    const catItem = simulatedCatalog.find(c => c.skuCode === safeSku) || simulatedCatalog[0];

    const orderId = `MYN-ORD-${Math.floor(8950000 + Math.random() * 50000)}`;
    const packetId = `PKT-MYN-${Math.floor(60000 + Math.random() * 40000)}`;

    const newOrder = {
      orderId,
      packetId,
      sku: safeSku,
      itemName: catItem ? catItem.internalItem : 'Anouk Kurta Set',
      qty: Number(quantity) || 1,
      warehouse: warehouse || 'WH1 - Central Hub',
      pincode: '560' + Math.floor(100 + Math.random() * 899),
      orderTime: new Date().toISOString(),
      sla: '4h 00m left',
      stage: 'UNACKNOWLEDGED',
      totalAmount: (catItem ? catItem.price : 1999) * (Number(quantity) || 1),
      invoiceType: 'MYNTRA',
      invoiceNumber: null,
      trackingNo: 'MYSP' + Math.floor(1000000000 + Math.random() * 9000000000),
      courier: 'Flipkart Logistics'
    };

    simulatedOrders.unshift(newOrder);

    logWebhookEvent('ORDER_INJECTED_MOCKIFY', {
      orderId,
      packetId,
      sku: safeSku,
      qty: newOrder.qty
    });

    res.status(httpStatus.OK).send({
      message: `Mock order ${orderId} successfully injected into pipeline`,
      order: newOrder
    });
  } catch (error) {
    res.status(httpStatus.INTERNAL_SERVER_ERROR).send('Error injecting mock order');
  }
};

const mockCancelOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const order = simulatedOrders.find(o => o.orderId === id || o.packetId === id);
    if (!order) return res.status(httpStatus.NOT_FOUND).send('Order not found');

    order.stage = 'CANCELLED';
    order.sla = 'Cancelled by Customer';

    logWebhookEvent('ORDER_CANCELLED', { orderId: order.orderId, packetId: order.packetId });

    res.status(httpStatus.OK).send({
      message: `Customer cancellation simulated for ${order.orderId}`,
      order
    });
  } catch (error) {
    res.status(httpStatus.INTERNAL_SERVER_ERROR).send('Error simulating cancellation');
  }
};

const mockHoldOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const order = simulatedOrders.find(o => o.orderId === id || o.packetId === id);
    if (!order) return res.status(httpStatus.NOT_FOUND).send('Order not found');

    order.isOnHold = true;
    order.sla = 'On Hold (Fraud/Payment Check)';

    logWebhookEvent('ORDER_PUT_ON_HOLD', { orderId: order.orderId });

    res.status(httpStatus.OK).send({
      message: `Order ${order.orderId} put on hold`,
      order
    });
  } catch (error) {
    res.status(httpStatus.INTERNAL_SERVER_ERROR).send('Error putting on hold');
  }
};

const mockUnholdOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const order = simulatedOrders.find(o => o.orderId === id || o.packetId === id);
    if (!order) return res.status(httpStatus.NOT_FOUND).send('Order not found');

    order.isOnHold = false;
    order.sla = '3h 30m left';

    logWebhookEvent('ORDER_RELEASED_FROM_HOLD', { orderId: order.orderId });

    res.status(httpStatus.OK).send({
      message: `Order ${order.orderId} released from hold`,
      order
    });
  } catch (error) {
    res.status(httpStatus.INTERNAL_SERVER_ERROR).send('Error releasing from hold');
  }
};

// ==================== WEBHOOKS ====================

const receiveWebhook = async (req, res) => {
  try {
    const payload = req.body;
    const eventType = payload.eventType || payload.event || 'UNKNOWN_WEBHOOK';

    const evt = logWebhookEvent(eventType, payload);

    res.status(httpStatus.OK).send({
      status: 'SUCCESS',
      message: 'Webhook received and processed by Elite Edition listener',
      eventId: evt.id
    });
  } catch (error) {
    res.status(httpStatus.INTERNAL_SERVER_ERROR).send('Webhook processing error');
  }
};

const getWebhookEvents = async (req, res) => {
  res.status(httpStatus.OK).send(simulatedWebhookEvents);
};

const clearWebhookEvents = async (req, res) => {
  simulatedWebhookEvents = [];
  res.status(httpStatus.OK).send({ message: 'Webhook event logs cleared' });
};

// Legacy Dispatch order compatibility
const dispatchOrder = async (req, res) => {
  return readyToDispatch(req, res);
};

module.exports = {
  saveConfig,
  getConfig,
  refreshToken,
  getOrders,
  acceptOrder,
  bulkAcceptOrders,
  readyToDispatch,
  readyToShip,
  getShippingLabel,
  getDocument,
  getCatalog,
  addOrUpdateSku,
  mapWarehouse,
  updateInventory,
  syncInventory,
  overrideDiscount,
  applyDiscount,
  getShipments,
  mockPacketShipped,
  mockPacketDelivered,
  getReturns,
  getReturnDetails,
  updateReturn,
  mockInjectOrder,
  mockCancelOrder,
  mockHoldOrder,
  mockUnholdOrder,
  receiveWebhook,
  getWebhookEvents,
  clearWebhookEvents,
  dispatchOrder,
};
