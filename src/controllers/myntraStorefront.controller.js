const PDFDocument = require('pdfkit');
const logger = require('../config/logger');

/**
 * Controller for Myntra Outbound APIs (Storefront v4 & Failure Inventory).
 * These endpoints are called directly by Myntra / Mockify Simulator into the Seller OMS.
 *
 * Official Postman Collection:
 * https://documenter.getpostman.com/view/34879541/2sA3JNbLQG#dcb41f88-cf96-4def-be53-8bcd7d8fa229
 */

// In-memory audit log of outbound events for debugging & visibility in OMS UI
const outboundEvents = [];

const logOutboundEvent = (api, params, body, headers) => {
  const entry = {
    id: `evt_out_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    timestamp: new Date().toISOString(),
    api,
    params,
    body,
    partnerStore: headers['x-partner-store'] || headers['store'] || 'default',
    ip: headers['x-forwarded-for'] || 'direct'
  };
  outboundEvents.unshift(entry);
  if (outboundEvents.length > 200) outboundEvents.pop();
  logger.info(`[Myntra Outbound] ${api}: ${JSON.stringify(params)}`);
  return entry;
};

/**
 * 1. Create Order
 * POST {{seller-domain}}/storefront/v4/order/:sellerorderId
 */
const createOrder = async (req, res) => {
  try {
    const { sellerorderId } = req.params;
    logOutboundEvent('CREATE_ORDER', { sellerorderId }, req.body, req.headers);

    return res.status(200).json({
      statusCode: 1006,
      statusMessage: 'Order created successfully.',
      statusType: 'SUCCESS'
    });
  } catch (error) {
    logger.error(`[Myntra Outbound] Create Order error: ${error.message}`);
    return res.status(500).json({
      statusCode: 3001,
      statusMessage: 'Error while Creating Order',
      statusType: 'ERROR'
    });
  }
};

/**
 * 2. Update Order
 * PUT {{seller-domain}}/storefront/v4/order/:sellerorderId/:EventType
 */
const updateOrder = async (req, res) => {
  try {
    const { sellerorderId, EventType } = req.params;
    logOutboundEvent('UPDATE_ORDER', { sellerorderId, EventType }, req.body, req.headers);

    return res.status(200).json({
      statusCode: 1008,
      statusMessage: 'Order updated successfully',
      statusType: 'SUCCESS'
    });
  } catch (error) {
    logger.error(`[Myntra Outbound] Update Order error: ${error.message}`);
    return res.status(500).json({
      statusCode: 3002,
      statusMessage: 'Error while updating Order',
      statusType: 'ERROR'
    });
  }
};

/**
 * 3. Download Invoice
 * GET {{seller-domain}}/storefront/v4/packet/downloadinvoice/:packetId
 * Returns application/pdf byte stream
 */
const downloadInvoice = async (req, res) => {
  try {
    const { packetId } = req.params;
    logOutboundEvent('DOWNLOAD_INVOICE', { packetId }, null, req.headers);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="invoice-${packetId || 'myntra'}.pdf"`);

    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    doc.pipe(res);

    // Header
    doc.fontSize(18).fillColor('#111827').text('TAX INVOICE', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(10).fillColor('#4B5563').text('Elite Edition - Authorized Myntra Partner OMS', { align: 'center' });
    doc.moveDown(1);

    // Invoice Meta Box
    doc.rect(40, 100, 515, 70).strokeColor('#E5E7EB').stroke();
    doc.fontSize(10).fillColor('#1F2937');
    doc.text(`Invoice No: INV-MYN-${Date.now().toString().slice(-6)}`, 50, 110);
    doc.text(`Date: ${new Date().toLocaleDateString('en-IN')}`, 50, 125);
    doc.text(`Packet ID: ${packetId || 'N/A'}`, 50, 140);

    doc.text('Seller: Elite Edition', 320, 110);
    doc.text('GSTIN: 24AAAFE1234F1Z5', 320, 125);
    doc.text('State: Gujarat (24)', 320, 140);

    // Table Header
    doc.moveDown(4);
    const startY = 190;
    doc.rect(40, startY, 515, 25).fillColor('#F3F4F6').fill();
    doc.fontSize(9).fillColor('#374151');
    doc.text('Item Description / SKU', 50, startY + 7);
    doc.text('Qty', 320, startY + 7);
    doc.text('Rate', 380, startY + 7);
    doc.text('Total', 480, startY + 7);

    // Table Row
    const rowY = startY + 30;
    doc.fontSize(9).fillColor('#1F2937');
    doc.text(`Myntra Fashion Apparel (${packetId})`, 50, rowY);
    doc.text('1', 320, rowY);
    doc.text('₹1,499.00', 380, rowY);
    doc.text('₹1,499.00', 480, rowY);

    // Total section
    doc.rect(40, rowY + 30, 515, 1).fillColor('#E5E7EB').fill();
    doc.fontSize(10).fillColor('#111827');
    doc.text('Net Total: ₹1,499.00', 400, rowY + 45);
    doc.text('(Includes applicable GST)', 400, rowY + 60);

    doc.moveDown(6);
    doc.fontSize(8).fillColor('#9CA3AF').text('This is a computer generated invoice and does not require a physical signature.', { align: 'center' });

    doc.end();
  } catch (error) {
    logger.error(`[Myntra Outbound] Download Invoice error: ${error.message}`);
    return res.status(500).json({
      statusCode: 500,
      statusMessage: 'No Invoice to download for this Order',
      statusType: 'ERROR'
    });
  }
};

/**
 * 4. Failure Inventory Update
 * POST {{seller-domain}}/failureinventory/update
 */
const failureInventoryUpdate = async (req, res) => {
  try {
    logOutboundEvent('FAILURE_INVENTORY_UPDATE', null, req.body, req.headers);

    return res.status(200).json({
      statusCode: 1001,
      statusMessage: 'Inventory updated successfully',
      statusType: 'SUCCESS'
    });
  } catch (error) {
    logger.error(`[Myntra Outbound] Failure Inventory Update error: ${error.message}`);
    return res.status(500).json({
      statusCode: 3001,
      statusMessage: 'Error while updating inventory failure',
      statusType: 'ERROR'
    });
  }
};

/**
 * 5. Create Return RTO (Courier Return)
 * POST {{seller-domain}}/storefront/v4/return/:PacketId
 */
const createReturnRTO = async (req, res) => {
  try {
    const { PacketId } = req.params;
    logOutboundEvent('CREATE_RETURN_RTO', { PacketId }, req.body, req.headers);

    return res.status(200).json({
      statusCode: 1006,
      statusMessage: 'Return Created Successfully',
      statusType: 'SUCCESS'
    });
  } catch (error) {
    logger.error(`[Myntra Outbound] Create Return RTO error: ${error.message}`);
    return res.status(500).json({
      statusCode: 3001,
      statusMessage: 'Error while updating return',
      statusType: 'ERROR'
    });
  }
};

/**
 * 6. Create Customer Return (RTV)
 * POST {{seller-domain}}/storefront/v4/return/:returnId
 */
const createCustomerReturn = async (req, res) => {
  try {
    const { returnId } = req.params;
    logOutboundEvent('CREATE_CUSTOMER_RETURN', { returnId }, req.body, req.headers);

    return res.status(200).json({
      statusCode: 1006,
      statusMessage: 'Return Created Successfully',
      statusType: 'SUCCESS'
    });
  } catch (error) {
    logger.error(`[Myntra Outbound] Create Customer Return error: ${error.message}`);
    return res.status(500).json({
      statusCode: 3001,
      statusMessage: 'Error while creating return',
      statusType: 'ERROR'
    });
  }
};

/**
 * 7. Update Return
 * PUT {{seller-domain}}/storefront/v4/return/:returnId/update
 */
const updateReturn = async (req, res) => {
  try {
    const { returnId } = req.params;
    logOutboundEvent('UPDATE_RETURN', { returnId }, req.body, req.headers);

    return res.status(200).json({
      statusCode: 1008,
      statusMessage: 'Return Updated Successfully',
      statusType: 'SUCCESS'
    });
  } catch (error) {
    logger.error(`[Myntra Outbound] Update Return error: ${error.message}`);
    return res.status(500).json({
      statusCode: 3002,
      statusMessage: 'Error while updating return',
      statusType: 'ERROR'
    });
  }
};

/**
 * Helper to inspect received outbound events in OMS
 */
const getOutboundEvents = (req, res) => {
  return res.status(200).json({
    total: outboundEvents.length,
    events: outboundEvents
  });
};

module.exports = {
  createOrder,
  updateOrder,
  downloadInvoice,
  failureInventoryUpdate,
  createReturnRTO,
  createCustomerReturn,
  updateReturn,
  getOutboundEvents
};
