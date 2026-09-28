/**
 * Standardized Formatters for Elite Edition ERP
 * 
 * Rules:
 * 1. Indian number grouping: 1,23,456.00
 * 2. One consistent date/time format: '28 Sep 2026, 04:30 PM'
 * 3. Tabular numerals for alignment in financial/metric tables
 */

/**
 * Format currency with Indian comma separation: ₹ 1,23,456.00
 */
export function formatIndianCurrency(amount, showSymbol = true) {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return showSymbol ? '₹ 0.00' : '0.00';
  }
  const num = Number(amount);
  const isNegative = num < 0;
  const absNum = Math.abs(num);
  const fixed = absNum.toFixed(2);
  const [intPart, decPart] = fixed.split('.');

  // Indian currency numbering regex: 3 digits, then groups of 2
  let lastThree = intPart.substring(intPart.length - 3);
  const otherNumbers = intPart.substring(0, intPart.length - 3);
  if (otherNumbers !== '') {
    lastThree = ',' + lastThree;
  }
  const formattedInt = otherNumbers.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + lastThree;
  const result = `${formattedInt}.${decPart}`;

  return `${isNegative ? '-' : ''}${showSymbol ? '₹ ' : ''}${result}`;
}

/**
 * Format quantity or count with Indian commas: 1,23,456
 */
export function formatIndianNumber(val) {
  if (val === null || val === undefined || isNaN(val)) return '0';
  const num = Math.round(Number(val));
  const isNegative = num < 0;
  const intStr = Math.abs(num).toString();

  let lastThree = intStr.substring(intStr.length - 3);
  const otherNumbers = intStr.substring(0, intStr.length - 3);
  if (otherNumbers !== '') {
    lastThree = ',' + lastThree;
  }
  const formatted = otherNumbers.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + lastThree;
  return `${isNegative ? '-' : ''}${formatted}`;
}

/**
 * Consistent Date format across entire ERP: '28 Sep 2026' or '28 Sep 2026, 04:30 PM'
 */
export function formatConsistentDate(dateInput, includeTime = false) {
  if (!dateInput) return '—';
  try {
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return '—';

    const day = String(d.getDate()).padStart(2, '0');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[d.getMonth()];
    const year = d.getFullYear();

    if (!includeTime) {
      return `${day} ${month} ${year}`;
    }

    let hours = d.getHours();
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12; // 0 is 12
    const strHours = String(hours).padStart(2, '0');

    return `${day} ${month} ${year}, ${strHours}:${minutes} ${ampm}`;
  } catch (e) {
    return '—';
  }
}
