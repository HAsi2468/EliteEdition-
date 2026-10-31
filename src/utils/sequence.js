/**
 * Sequential Document Numbering Engine (BUG-015, BUG-056)
 * Generates gap-free, atomic sequential numbers per business unit and financial year.
 */
const mongoose = require('mongoose');
const { AppError } = require('./errors');

const CounterSchema = new mongoose.Schema(
  {
    _id: String,
    seq: { type: Number, default: 0 }
  },
  { versionKey: false, collection: 'counters' }
);

const CounterModel = mongoose.models.Counter || mongoose.model('Counter', CounterSchema);

const PREFIX = {
  digital_print: 'EDP',
  'Elite Digital Print': 'EDP',
  'Elite Digital Prints': 'EDP',
  elite_online: 'EO',
  'Elite Online': 'EO',
  elite_edition: 'EE',
  'Elite Edition': 'EE',
  elite_fabtex: 'EF',
  'Elite Fabtex': 'EF',
  sobise: 'SO',
  'Sobise': 'SO',
  stitching: 'ES',
  'Elite Stitching': 'ES',
  ethno_wear: 'EW',
  'Ethno wear': 'EW',
  yamunaji: 'YJ',
  'Yamunaji': 'YJ'
};

function financialYear(d = new Date()) {
  // Indian Financial Year (Apr-Mar) in IST (UTC + 5:30)
  const ist = new Date(d.getTime() + 330 * 60000);
  const y = ist.getUTCMonth() >= 3 ? ist.getUTCFullYear() : ist.getUTCFullYear() - 1;
  const start = String(y % 100).padStart(2, '0');
  const end = String((y + 1) % 100).padStart(2, '0');
  return `${start}-${end}`;
}

async function allocateInvoiceNo(companyId, session = null, d = new Date()) {
  const prefix = PREFIX[companyId] || PREFIX[String(companyId).toLowerCase()] || 'EDP';
  const fy = financialYear(d);
  const counterId = `invoice:${companyId}:${fy}`;

  const options = { upsert: true, new: true };
  if (session) options.session = session;

  const counter = await CounterModel.findOneAndUpdate(
    { _id: counterId },
    { $inc: { seq: 1 } },
    options
  ).lean();

  return `${prefix}/${fy}/${counter.seq}`;
}

async function assertManualNoFree(InvoiceModel, companyId, invoiceNo) {
  const exists = await InvoiceModel.exists({
    $or: [
      { companyId: String(companyId), invoiceNo },
      { companyEntity: String(companyId), invoiceNo }
    ]
  });

  if (exists) {
    throw new AppError(409, 'DUPLICATE_INVOICE_NO', `Invoice number ${invoiceNo} already exists.`, {
      invoiceNo: 'Already used.'
    });
  }
}

module.exports = {
  PREFIX,
  financialYear,
  allocateInvoiceNo,
  assertManualNoFree
};

