/**
 * Ultra-Fast Offline Postal & Location Resolution Service
 * Built-in 154,823 Indian Post Offices dataset (Zero external network dependencies)
 */

const lookup = require('india-pincode-lookup');
let pincodesRaw = null;
try {
  pincodesRaw = require('india-pincode-lookup/pincodes.json');
} catch (e) {
  pincodesRaw = [];
}

const GST_STATE_MAP = {
  'JAMMU AND KASHMIR': '01',
  'HIMACHAL PRADESH': '02',
  'PUNJAB': '03',
  'CHANDIGARH': '04',
  'UTTARAKHAND': '05',
  'HARYANA': '06',
  'DELHI': '07',
  'RAJASTHAN': '08',
  'UTTAR PRADESH': '09',
  'BIHAR': '10',
  'SIKKIM': '11',
  'ARUNACHAL PRADESH': '12',
  'NAGALAND': '13',
  'MANIPUR': '14',
  'MIZORAM': '15',
  'TRIPURA': '16',
  'MEGHALAYA': '17',
  'ASSAM': '18',
  'WEST BENGAL': '19',
  'JHARKHAND': '20',
  'ODISHA': '21',
  'CHHATTISGARH': '22',
  'MADHYA PRADESH': '23',
  'GUJARAT': '24',
  'DADRA AND NAGAR HAVELI AND DAMAN AND DIU': '26',
  'DAMAN AND DIU': '26',
  'DADRA AND NAGAR HAVELI': '26',
  'MAHARASHTRA': '27',
  'ANDHRA PRADESH': '37',
  'KARNATAKA': '29',
  'GOA': '30',
  'LAKSHADWEEP': '31',
  'KERALA': '32',
  'TAMIL NADU': '33',
  'PUDUCHERRY': '34',
  'ANDAMAN AND NICOBAR ISLANDS': '35',
  'TELANGANA': '36',
  'LADAKH': '38'
};

function toTitleCase(str) {
  if (!str) return '';
  return String(str).toLowerCase().replace(/(?:^|\s|-)\S/g, c => c.toUpperCase());
}

function resolveStateCode(stateName) {
  if (!stateName) return '24';
  const clean = String(stateName).trim().toUpperCase();
  if (GST_STATE_MAP[clean]) return GST_STATE_MAP[clean];
  for (const [s, code] of Object.entries(GST_STATE_MAP)) {
    if (clean.includes(s) || s.includes(clean)) return code;
  }
  return '24';
}

// Major Commercial & Textile Hubs
const MAJOR_COMMERCIAL_HUBS = {
  'surat': { pincode: '395002', city: 'Surat', district: 'Surat', state: 'Gujarat', stateCode: '24' },
  'ahmedabad': { pincode: '380001', city: 'Ahmedabad', district: 'Ahmedabad', state: 'Gujarat', stateCode: '24' },
  'rajkot': { pincode: '360001', city: 'Rajkot', district: 'Rajkot', state: 'Gujarat', stateCode: '24' },
  'vadodara': { pincode: '390001', city: 'Vadodara', district: 'Vadodara', state: 'Gujarat', stateCode: '24' },
  'mumbai': { pincode: '400001', city: 'Mumbai', district: 'Mumbai', state: 'Maharashtra', stateCode: '27' },
  'pune': { pincode: '411001', city: 'Pune', district: 'Pune', state: 'Maharashtra', stateCode: '27' },
  'bhiwandi': { pincode: '421501', city: 'Bhiwandi', district: 'Thane', state: 'Maharashtra', stateCode: '27' },
  'delhi': { pincode: '110001', city: 'Delhi', district: 'New Delhi', state: 'Delhi', stateCode: '07' },
  'new delhi': { pincode: '110001', city: 'New Delhi', district: 'New Delhi', state: 'Delhi', stateCode: '07' },
  'jaipur': { pincode: '302001', city: 'Jaipur', district: 'Jaipur', state: 'Rajasthan', stateCode: '08' },
  'jodhpur': { pincode: '342001', city: 'Jodhpur', district: 'Jodhpur', state: 'Rajasthan', stateCode: '08' },
  'kolkata': { pincode: '700001', city: 'Kolkata', district: 'Kolkata', state: 'West Bengal', stateCode: '19' },
  'bengaluru': { pincode: '560001', city: 'Bengaluru', district: 'Bengaluru', state: 'Karnataka', stateCode: '29' },
  'bangalore': { pincode: '560001', city: 'Bengaluru', district: 'Bengaluru', state: 'Karnataka', stateCode: '29' },
  'chennai': { pincode: '600001', city: 'Chennai', district: 'Chennai', state: 'Tamil Nadu', stateCode: '33' },
  'tirupur': { pincode: '641601', city: 'Tirupur', district: 'Tiruppur', state: 'Tamil Nadu', stateCode: '33' },
  'hyderabad': { pincode: '500001', city: 'Hyderabad', district: 'Hyderabad', state: 'Telangana', stateCode: '36' },
  'ludhiana': { pincode: '141001', city: 'Ludhiana', district: 'Ludhiana', state: 'Punjab', stateCode: '03' },
  'indore': { pincode: '452001', city: 'Indore', district: 'Indore', state: 'Madhya Pradesh', stateCode: '23' }
};

// Lazy index for cities
let cityIndex = null;
function getCityIndex() {
  if (!cityIndex) {
    cityIndex = new Map();
    for (const [k, v] of Object.entries(MAJOR_COMMERCIAL_HUBS)) {
      cityIndex.set(k, v);
    }
    if (Array.isArray(pincodesRaw)) {
      for (const p of pincodesRaw) {
        const d = (p.districtName || '').trim().toLowerCase();
        const t = (p.taluk || '').trim().toLowerCase();
        if (d && !cityIndex.has(d)) {
          cityIndex.set(d, {
            pincode: String(p.pincode),
            city: toTitleCase(p.districtName),
            district: toTitleCase(p.districtName),
            state: toTitleCase(p.stateName),
            stateCode: resolveStateCode(p.stateName),
            country: 'India'
          });
        }
        if (t && !cityIndex.has(t)) {
          cityIndex.set(t, {
            pincode: String(p.pincode),
            city: toTitleCase(p.taluk),
            district: toTitleCase(p.districtName),
            state: toTitleCase(p.stateName),
            stateCode: resolveStateCode(p.stateName),
            country: 'India'
          });
        }
      }
    }
  }
  return cityIndex;
}

/**
 * Resolves a 5 or 6 digit PIN code
 */
function lookupPincode(rawPin) {
  const pinStr = String(rawPin || '').trim().replace(/\D/g, '');
  if (!pinStr) return null;

  // 1. Direct 6-digit lookup
  let list = lookup.lookup(pinStr);
  let resolvedPin = pinStr;

  // 2. 5-digit candidate recovery (e.g. 11024 -> 110024, 39506 -> 395006)
  if ((!list || list.length === 0) && pinStr.length === 5) {
    for (let i = 1; i <= 4; i++) {
      const candidate = pinStr.slice(0, i) + '0' + pinStr.slice(i);
      const test = lookup.lookup(candidate);
      if (test && test.length > 0) {
        list = test;
        resolvedPin = candidate;
        break;
      }
    }
    // Try prefix 0 e.g. 011024
    if (!list || list.length === 0) {
      const test = lookup.lookup('0' + pinStr);
      if (test && test.length > 0) {
        list = test;
        resolvedPin = '0' + pinStr;
      }
    }
  }

  if (!list || list.length === 0) return null;

  const primary = list[0];
  const state = toTitleCase(primary.stateName);
  const city = toTitleCase(primary.districtName || primary.taluk || primary.officeName);
  const stateCode = resolveStateCode(primary.stateName);

  return {
    pincode: resolvedPin,
    originalQuery: pinStr,
    autoCorrected: resolvedPin !== pinStr,
    city,
    district: toTitleCase(primary.districtName),
    state,
    stateCode,
    country: 'India',
    postOffices: list.map(p => p.officeName)
  };
}

/**
 * Resolves by City, District, or PIN code
 */
function lookupLocation(query) {
  if (!query) return null;
  const clean = String(query).trim();

  // If numbers, do pincode lookup
  if (/^\d{3,6}$/.test(clean)) {
    return lookupPincode(clean);
  }

  // Look up city / district
  const idx = getCityIndex();
  const lower = clean.toLowerCase();
  if (idx.has(lower)) {
    return idx.get(lower);
  }

  // Substring match
  for (const [key, val] of idx.entries()) {
    if (key.startsWith(lower) || lower.startsWith(key)) {
      return val;
    }
  }

  return null;
}

module.exports = {
  lookupPincode,
  lookupLocation,
  resolveStateCode,
  toTitleCase,
  GST_STATE_MAP
};

