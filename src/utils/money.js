/**
 * Integer-Paise Invoice & Monetary Calculation Engine (BUG-017, BUG-019, BUG-057, BUG-060)
 * Uses integer paise to guarantee:
 * - totalTax === CGST + SGST (or IGST) by construction
 * - Amount in words never outputs "undefined" and formats Indian system (Crore, Lakh, Thousand, Paise)
 * - Strict limits and range validation rejecting exponent strings and out-of-range floats
 */
const { AppError } = require('./errors');

const LIMITS = {
  maxQtyMilli: 10000000 * 1000, // 1 crore units, 3 decimal places
  maxRatePaise: 10000000 * 100, // ₹1 crore per unit
  maxLinePaise: 10000000000 * 100, // ₹1000 crore (keeps sums safely below MAX_SAFE_INTEGER)
  allowedGstBp: [0, 25, 300, 500, 1200, 1800, 2800], // GST rates in basis points
};

/**
 * Parses a decimal string or number into an integer scaled by 10^dp.
 * Rejects exponent strings ("1e9" -> BUG-038, "1e3" -> BUG-046).
 */
function toFixedInt(v, dp, field) {
  const invalid = () => new AppError(422, 'INVALID_NUMBER', `${field} must be a plain decimal number.`, { [field]: 'Invalid number.' });
  const tooPrecise = () => new AppError(422, 'TOO_PRECISE', `${field} allows at most ${dp} decimals.`, { [field]: `Max ${dp} decimals.` });

  if (typeof v === 'number') {
    if (!Number.isFinite(v)) throw invalid();
    const scaled = v * 10 ** dp;
    const n = Math.round(scaled);
    if (Math.abs(scaled - n) > 1e-6 * Math.max(1, Math.abs(scaled))) throw tooPrecise();
    if (!Number.isSafeInteger(n)) throw invalid();
    return n;
  }

  const str = String(v ?? '').trim();
  const m = /^(-)?(\d{1,15})(?:\.(\d+))?$/.exec(str);
  if (!m) throw invalid();
  const [, neg, intPart, fracPart = ''] = m;
  if (/[1-9]/.test(fracPart.slice(dp))) throw tooPrecise();
  const n = Number(intPart) * 10 ** dp + Number((fracPart + '0'.repeat(dp)).slice(0, dp) || '0');
  if (!Number.isSafeInteger(n)) throw invalid();
  return neg ? -n : n;
}

/** Half-up division of non-negative integers */
function divRound(num, den) {
  if (num < 0 || den <= 0) throw new Error('divRound expects non-negative input');
  return Math.floor((num * 2 + den) / (2 * den));
}

function computeLine(line, interState = false) {
  const qtyMilli = toFixedInt(line.qty, 3, 'qty');
  const ratePaise = toFixedInt(line.rate != null ? line.rate : (line.unitPrice || 0), 2, 'rate');
  const discBp = toFixedInt(line.discountPct ?? 0, 2, 'discountPct'); // 7.5% -> 750
  const gstBp = toFixedInt(line.gstPct != null ? line.gstPct : (line.taxRate || 0), 2, 'gstPct');

  if (qtyMilli <= 0 || qtyMilli > LIMITS.maxQtyMilli) {
    throw new AppError(422, 'QTY_RANGE', 'Quantity must be > 0 and within limit.', { qty: 'Out of range.' });
  }
  if (ratePaise < 0 || ratePaise > LIMITS.maxRatePaise) {
    throw new AppError(422, 'RATE_RANGE', 'Rate must be ≥ 0 and within limit.', { rate: 'Out of range.' });
  }
  if (discBp < 0 || discBp > 10000) {
    throw new AppError(422, 'DISCOUNT_RANGE', 'Discount must be between 0 and 100%.', { discountPct: '0–100%.' });
  }
  if (!LIMITS.allowedGstBp.includes(gstBp)) {
    throw new AppError(422, 'GST_RATE', 'Unsupported GST rate.', { gstPct: 'Invalid GST rate.' });
  }

  const grossBig = (BigInt(qtyMilli) * BigInt(ratePaise) * 2n + 1000n) / 2000n;
  if (grossBig > BigInt(LIMITS.maxLinePaise)) {
    throw new AppError(422, 'LINE_TOO_LARGE', 'Line amount exceeds the maximum allowed.', { qty: 'Too large.' });
  }
  const grossPaise = Number(grossBig);
  const discountPaise = divRound(grossPaise * discBp, 10000);
  const taxablePaise = grossPaise - discountPaise;

  let cgstPaise = 0;
  let sgstPaise = 0;
  let igstPaise = 0;

  if (interState) {
    igstPaise = divRound(taxablePaise * gstBp, 10000);
  } else {
    cgstPaise = divRound(taxablePaise * gstBp, 20000);
    sgstPaise = cgstPaise;
  }
  const taxPaise = cgstPaise + sgstPaise + igstPaise;

  return {
    qtyMilli,
    ratePaise,
    grossPaise,
    discountPaise,
    taxablePaise,
    cgstPaise,
    sgstPaise,
    igstPaise,
    taxPaise,
    totalPaise: taxablePaise + taxPaise,
    // Convenient float representations (2 decimal places) for backward compatibility
    taxable: taxablePaise / 100,
    cgstAmount: cgstPaise / 100,
    sgstAmount: sgstPaise / 100,
    igstAmount: igstPaise / 100,
    taxAmount: taxPaise / 100,
    totalAmount: (taxablePaise + taxPaise) / 100
  };
}

function computeInvoice(lines, interState = false) {
  if (!Array.isArray(lines) || lines.length === 0) {
    throw new AppError(422, 'NO_LINES', 'Add at least one line.');
  }

  const computedLines = lines.map((l) => computeLine(l, interState));
  const sum = (k) => computedLines.reduce((acc, x) => acc + x[k], 0);

  const taxablePaise = sum('taxablePaise');
  const totalTaxPaise = sum('taxPaise'); // == cgst + sgst + igst by construction (BUG-057)
  const preRound = taxablePaise + totalTaxPaise;
  const grandTotalPaise = divRound(preRound, 100) * 100; // nearest rupee, half-up

  if (grandTotalPaise <= 0) {
    throw new AppError(422, 'GRAND_TOTAL_INVALID', 'Grand Total is invalid.');
  }

  const roundOffPaise = grandTotalPaise - preRound;

  return {
    lines: computedLines,
    subtotalPaise: sum('grossPaise'),
    discountPaise: sum('discountPaise'),
    taxablePaise,
    cgstPaise: sum('cgstPaise'),
    sgstPaise: sum('sgstPaise'),
    igstPaise: sum('igstPaise'),
    totalTaxPaise,
    roundOffPaise,
    grandTotalPaise,
    amountInWords: amountInWords(grandTotalPaise),
    // Decimal rupee values
    subtotal: sum('grossPaise') / 100,
    discount: sum('discountPaise') / 100,
    taxableAmount: taxablePaise / 100,
    cgstAmount: sum('cgstPaise') / 100,
    sgstAmount: sum('sgstPaise') / 100,
    igstAmount: sum('igstPaise') / 100,
    totalTax: totalTaxPaise / 100,
    roundOff: roundOffPaise / 100,
    grandTotal: grandTotalPaise / 100
  };
}

/* Indian-system amount in words, never "undefined" (BUG-017, BUG-019) */
const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function below100(n) {
  return n < 20 ? ONES[n] : `${TENS[Math.floor(n / 10)]}${n % 10 ? ' ' + ONES[n % 10] : ''}`;
}

function below1000(n) {
  const h = Math.floor(n / 100);
  const r = n % 100;
  return [h ? `${ONES[h]} Hundred` : '', r ? below100(r) : ''].filter(Boolean).join(' ');
}

function rupeesInWords(n) {
  if (!Number.isSafeInteger(n) || n < 0) {
    throw new Error('rupeesInWords expects a non-negative integer');
  }
  if (n === 0) return 'Zero';

  const parts = [];
  const crore = Math.floor(n / 1e7);
  n %= 1e7;
  const lakh = Math.floor(n / 1e5);
  n %= 1e5;
  const thousand = Math.floor(n / 1e3);
  n %= 1e3;

  if (crore) parts.push(`${rupeesInWords(crore)} Crore`);
  if (lakh) parts.push(`${below100(lakh)} Lakh`);
  if (thousand) parts.push(`${below100(thousand)} Thousand`);
  if (n) parts.push(below1000(n));

  return parts.join(' ');
}

function amountInWords(paise) {
  if (!Number.isSafeInteger(paise) || paise < 0) {
    throw new Error('amountInWords expects non-negative integer paise');
  }
  const r = Math.floor(paise / 100);
  const p = paise % 100;
  return `Rupees ${rupeesInWords(r)}${p ? ` and ${below100(p)} Paise` : ''} Only`;
}

const fmtINR = (paise) =>
  (paise / 100).toLocaleString('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 });

module.exports = {
  LIMITS,
  toFixedInt,
  divRound,
  computeLine,
  computeInvoice,
  rupeesInWords,
  amountInWords,
  fmtINR
};

