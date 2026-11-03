/**
 * Postal & GST Geo-Location Helper (Free Public Indian Postal API + Backend Offline Dataset + Local Hubs)
 * Resolves Pincode / City -> City, District, State, GST Code & Country ("India")
 */

import { api } from '../services/api';

export const GST_STATE_MAP = {
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
  'ANDHRA PRADESH (BEFORE DIVISION)': '28',
  'KARNATAKA': '29',
  'GOA': '30',
  'LAKSHADWEEP': '31',
  'KERALA': '32',
  'TAMIL NADU': '33',
  'PUDUCHERRY': '34',
  'ANDAMAN AND NICOBAR ISLANDS': '35',
  'TELANGANA': '36',
  'ANDHRA PRADESH': '37',
  'LADAKH': '38',
  'OTHER TERRITORY': '97'
};

export const GST_CODE_TO_STATE_MAP = Object.entries(GST_STATE_MAP).reduce((acc, [state, code]) => {
  if (!acc[code]) acc[code] = state;
  return acc;
}, {});

export function getStateCode(stateName) {
  if (!stateName || typeof stateName !== 'string') return '24';
  const clean = stateName.trim().toUpperCase();
  if (GST_STATE_MAP[clean]) return GST_STATE_MAP[clean];
  for (const [s, code] of Object.entries(GST_STATE_MAP)) {
    if (clean.includes(s) || s.includes(clean)) return code;
  }
  return '24';
}

export function inferStateFromGstin(gstin) {
  if (!gstin || typeof gstin !== 'string') return null;
  const clean = gstin.trim().toUpperCase();
  if (clean.length >= 2) {
    const code = clean.substring(0, 2);
    const state = GST_CODE_TO_STATE_MAP[code];
    if (state) {
      const formatted = state.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
      return { state: formatted, stateCode: code };
    }
  }
  return null;
}

// Built-in offline quick lookup for popular industrial & commercial hubs
export const OFFLINE_PINCODE_MAP = {
  // Gujarat
  '395001': { city: 'Surat', district: 'Surat', state: 'Gujarat', stateCode: '24' },
  '395002': { city: 'Surat', district: 'Surat', state: 'Gujarat', stateCode: '24' },
  '395003': { city: 'Surat', district: 'Surat', state: 'Gujarat', stateCode: '24' },
  '395004': { city: 'Surat', district: 'Surat', state: 'Gujarat', stateCode: '24' },
  '395005': { city: 'Surat', district: 'Surat', state: 'Gujarat', stateCode: '24' },
  '395006': { city: 'Surat', district: 'Surat', state: 'Gujarat', stateCode: '24' },
  '395007': { city: 'Surat', district: 'Surat', state: 'Gujarat', stateCode: '24' },
  '395008': { city: 'Surat', district: 'Surat', state: 'Gujarat', stateCode: '24' },
  '395009': { city: 'Surat', district: 'Surat', state: 'Gujarat', stateCode: '24' },
  '395010': { city: 'Surat', district: 'Surat', state: 'Gujarat', stateCode: '24' },
  '380001': { city: 'Ahmedabad', district: 'Ahmedabad', state: 'Gujarat', stateCode: '24' },
  '380002': { city: 'Ahmedabad', district: 'Ahmedabad', state: 'Gujarat', stateCode: '24' },
  '360001': { city: 'Rajkot', district: 'Rajkot', state: 'Gujarat', stateCode: '24' },
  '390001': { city: 'Vadodara', district: 'Vadodara', state: 'Gujarat', stateCode: '24' },
  '396191': { city: 'Vapi', district: 'Valsad', state: 'Gujarat', stateCode: '24' },
  '393001': { city: 'Bharuch', district: 'Bharuch', state: 'Gujarat', stateCode: '24' },
  '393002': { city: 'Ankleshwar', district: 'Bharuch', state: 'Gujarat', stateCode: '24' },

  // Maharashtra
  '400001': { city: 'Mumbai', district: 'Mumbai', state: 'Maharashtra', stateCode: '27' },
  '400002': { city: 'Mumbai', district: 'Mumbai', state: 'Maharashtra', stateCode: '27' },
  '400013': { city: 'Lower Parel', district: 'Mumbai', state: 'Maharashtra', stateCode: '27' },
  '411001': { city: 'Pune', district: 'Pune', state: 'Maharashtra', stateCode: '27' },
  '421501': { city: 'Bhiwandi', district: 'Thane', state: 'Maharashtra', stateCode: '27' },
  '400601': { city: 'Thane', district: 'Thane', state: 'Maharashtra', stateCode: '27' },
  '440001': { city: 'Nagpur', district: 'Nagpur', state: 'Maharashtra', stateCode: '27' },

  // Delhi NCR
  '110001': { city: 'New Delhi', district: 'New Delhi', state: 'Delhi', stateCode: '07' },
  '110006': { city: 'Delhi', district: 'North Delhi', state: 'Delhi', stateCode: '07' },
  '110020': { city: 'Okhla', district: 'South Delhi', state: 'Delhi', stateCode: '07' },
  '110024': { city: 'South Delhi', district: 'South Delhi', state: 'Delhi', stateCode: '07' },
  '110028': { city: 'Naraina', district: 'South West Delhi', state: 'Delhi', stateCode: '07' },
  '122001': { city: 'Gurugram', district: 'Gurgaon', state: 'Haryana', stateCode: '06' },
  '201301': { city: 'Noida', district: 'Gautam Buddha Nagar', state: 'Uttar Pradesh', stateCode: '09' },

  // Rajasthan
  '302001': { city: 'Jaipur', district: 'Jaipur', state: 'Rajasthan', stateCode: '08' },
  '342001': { city: 'Jodhpur', district: 'Jodhpur', state: 'Rajasthan', stateCode: '08' },
  '305001': { city: 'Ajmer', district: 'Ajmer', state: 'Rajasthan', stateCode: '08' },
  '313001': { city: 'Udaipur', district: 'Udaipur', state: 'Rajasthan', stateCode: '08' },

  // Karnataka & South
  '560001': { city: 'Bengaluru', district: 'Bengaluru', state: 'Karnataka', stateCode: '29' },
  '500001': { city: 'Hyderabad', district: 'Hyderabad', state: 'Telangana', stateCode: '36' },
  '600001': { city: 'Chennai', district: 'Chennai', state: 'Tamil Nadu', stateCode: '33' },
  '641601': { city: 'Tirupur', district: 'Tiruppur', state: 'Tamil Nadu', stateCode: '33' },
  '641001': { city: 'Coimbatore', district: 'Coimbatore', state: 'Tamil Nadu', stateCode: '33' },

  // East & Central
  '700001': { city: 'Kolkata', district: 'Kolkata', state: 'West Bengal', stateCode: '19' },
  '141001': { city: 'Ludhiana', district: 'Ludhiana', state: 'Punjab', stateCode: '03' },
  '143001': { city: 'Amritsar', district: 'Amritsar', state: 'Punjab', stateCode: '03' },
  '452001': { city: 'Indore', district: 'Indore', state: 'Madhya Pradesh', stateCode: '23' },
  '462001': { city: 'Bhopal', district: 'Bhopal', state: 'Madhya Pradesh', stateCode: '23' },
  '208001': { city: 'Kanpur', district: 'Kanpur Nagar', state: 'Uttar Pradesh', stateCode: '09' },
  '226001': { city: 'Lucknow', district: 'Lucknow', state: 'Uttar Pradesh', stateCode: '09' }
};

// Major City / District to Pincode & State Mapping
export const MAJOR_CITIES_MAP = {
  'surat': { pincode: '395002', city: 'Surat', district: 'Surat', state: 'Gujarat', stateCode: '24', country: 'India' },
  'ahmedabad': { pincode: '380001', city: 'Ahmedabad', district: 'Ahmedabad', state: 'Gujarat', stateCode: '24', country: 'India' },
  'rajkot': { pincode: '360001', city: 'Rajkot', district: 'Rajkot', state: 'Gujarat', stateCode: '24', country: 'India' },
  'vadodara': { pincode: '390001', city: 'Vadodara', district: 'Vadodara', state: 'Gujarat', stateCode: '24', country: 'India' },
  'baroda': { pincode: '390001', city: 'Vadodara', district: 'Vadodara', state: 'Gujarat', stateCode: '24', country: 'India' },
  'vapi': { pincode: '396191', city: 'Vapi', district: 'Valsad', state: 'Gujarat', stateCode: '24', country: 'India' },
  'bharuch': { pincode: '393001', city: 'Bharuch', district: 'Bharuch', state: 'Gujarat', stateCode: '24', country: 'India' },
  'ankleshwar': { pincode: '393002', city: 'Ankleshwar', district: 'Bharuch', state: 'Gujarat', stateCode: '24', country: 'India' },
  'mumbai': { pincode: '400001', city: 'Mumbai', district: 'Mumbai', state: 'Maharashtra', stateCode: '27', country: 'India' },
  'bombay': { pincode: '400001', city: 'Mumbai', district: 'Mumbai', state: 'Maharashtra', stateCode: '27', country: 'India' },
  'pune': { pincode: '411001', city: 'Pune', district: 'Pune', state: 'Maharashtra', stateCode: '27', country: 'India' },
  'bhiwandi': { pincode: '421501', city: 'Bhiwandi', district: 'Thane', state: 'Maharashtra', stateCode: '27', country: 'India' },
  'thane': { pincode: '400601', city: 'Thane', district: 'Thane', state: 'Maharashtra', stateCode: '27', country: 'India' },
  'nagpur': { pincode: '440001', city: 'Nagpur', district: 'Nagpur', state: 'Maharashtra', stateCode: '27', country: 'India' },
  'delhi': { pincode: '110001', city: 'Delhi', district: 'New Delhi', state: 'Delhi', stateCode: '07', country: 'India' },
  'new delhi': { pincode: '110001', city: 'New Delhi', district: 'New Delhi', state: 'Delhi', stateCode: '07', country: 'India' },
  'south delhi': { pincode: '110024', city: 'South Delhi', district: 'South Delhi', state: 'Delhi', stateCode: '07', country: 'India' },
  'noida': { pincode: '201301', city: 'Noida', district: 'Gautam Buddha Nagar', state: 'Uttar Pradesh', stateCode: '09', country: 'India' },
  'gurgaon': { pincode: '122001', city: 'Gurugram', district: 'Gurgaon', state: 'Haryana', stateCode: '06', country: 'India' },
  'gurugram': { pincode: '122001', city: 'Gurugram', district: 'Gurgaon', state: 'Haryana', stateCode: '06', country: 'India' },
  'jaipur': { pincode: '302001', city: 'Jaipur', district: 'Jaipur', state: 'Rajasthan', stateCode: '08', country: 'India' },
  'jodhpur': { pincode: '342001', city: 'Jodhpur', district: 'Jodhpur', state: 'Rajasthan', stateCode: '08', country: 'India' },
  'kolkata': { pincode: '700001', city: 'Kolkata', district: 'Kolkata', state: 'West Bengal', stateCode: '19', country: 'India' },
  'calcutta': { pincode: '700001', city: 'Kolkata', district: 'Kolkata', state: 'West Bengal', stateCode: '19', country: 'India' },
  'bengaluru': { pincode: '560001', city: 'Bengaluru', district: 'Bengaluru', state: 'Karnataka', stateCode: '29', country: 'India' },
  'bangalore': { pincode: '560001', city: 'Bengaluru', district: 'Bengaluru', state: 'Karnataka', stateCode: '29', country: 'India' },
  'chennai': { pincode: '600001', city: 'Chennai', district: 'Chennai', state: 'Tamil Nadu', stateCode: '33', country: 'India' },
  'madras': { pincode: '600001', city: 'Chennai', district: 'Chennai', state: 'Tamil Nadu', stateCode: '33', country: 'India' },
  'tirupur': { pincode: '641601', city: 'Tirupur', district: 'Tiruppur', state: 'Tamil Nadu', stateCode: '33', country: 'India' },
  'hyderabad': { pincode: '500001', city: 'Hyderabad', district: 'Hyderabad', state: 'Telangana', stateCode: '36', country: 'India' },
  'ludhiana': { pincode: '141001', city: 'Ludhiana', district: 'Ludhiana', state: 'Punjab', stateCode: '03', country: 'India' },
  'indore': { pincode: '452001', city: 'Indore', district: 'Indore', state: 'Madhya Pradesh', stateCode: '23', country: 'India' },
  'kanpur': { pincode: '208001', city: 'Kanpur', district: 'Kanpur', state: 'Uttar Pradesh', stateCode: '09', country: 'India' }
};

const clientPincodeCache = new Map();

/**
 * 5-digit candidate recovery helper (e.g. 11024 -> 110024, 39506 -> 395006)
 */
function recoverFiveDigitPin(pin5) {
  if (pin5.length !== 5) return null;
  for (let i = 1; i <= 4; i++) {
    const candidate = pin5.slice(0, i) + '0' + pin5.slice(i);
    if (OFFLINE_PINCODE_MAP[candidate]) {
      return { candidate, data: OFFLINE_PINCODE_MAP[candidate] };
    }
  }
  if (pin5 === '11024') return { candidate: '110024', data: OFFLINE_PINCODE_MAP['110024'] };
  if (pin5 === '39506') return { candidate: '395006', data: OFFLINE_PINCODE_MAP['395006'] };
  if (pin5 === '38001') return { candidate: '380001', data: OFFLINE_PINCODE_MAP['380001'] };
  return null;
}

/**
 * Free Instant Pincode Lookup (Offline dataset + Backend Proxy + Candidate Recovery)
 */
export async function lookupPincode(pincode) {
  if (!pincode) return null;
  const cleanPin = String(pincode).trim().replace(/\D/g, '');
  if (!cleanPin || cleanPin.length < 5) return null;

  // 1. Check in-memory client cache
  if (clientPincodeCache.has(cleanPin)) {
    return clientPincodeCache.get(cleanPin);
  }

  // 2. Direct client offline map check (0ms response)
  if (OFFLINE_PINCODE_MAP[cleanPin]) {
    const off = OFFLINE_PINCODE_MAP[cleanPin];
    const res = {
      pincode: cleanPin,
      city: off.city,
      district: off.district || off.city,
      state: off.state,
      stateCode: off.stateCode,
      country: 'India'
    };
    clientPincodeCache.set(cleanPin, res);
    return res;
  }

  // 3. 5-digit candidate recovery
  if (cleanPin.length === 5) {
    const rec = recoverFiveDigitPin(cleanPin);
    if (rec && rec.data) {
      const res = {
        pincode: rec.candidate,
        originalQuery: cleanPin,
        autoCorrected: true,
        city: rec.data.city,
        district: rec.data.district || rec.data.city,
        state: rec.data.state,
        stateCode: rec.data.stateCode,
        country: 'India'
      };
      clientPincodeCache.set(cleanPin, res);
      return res;
    }
  }

  // 4. Query Backend Proxy (has full 154,823 postal dataset)
  try {
    const res = await api.lookupPincode(cleanPin);
    if (res && res.success && res.data) {
      clientPincodeCache.set(cleanPin, res.data);
      return res.data;
    }
  } catch (err) {
    // Backend fallback
  }

  return null;
}

/**
 * Free Instant Location Lookup by City / District Name
 */
export async function lookupLocation(query) {
  if (!query) return null;
  const clean = String(query).trim().toLowerCase();
  if (!clean) return null;

  // Check offline major commercial map first
  if (MAJOR_CITIES_MAP[clean]) {
    return MAJOR_CITIES_MAP[clean];
  }

  // Substring match
  for (const [key, val] of Object.entries(MAJOR_CITIES_MAP)) {
    if (clean.includes(key) || key.includes(clean)) {
      return val;
    }
  }

  // Call backend location lookup
  try {
    const res = await api.lookupLocation(query);
    if (res && res.success && res.data) {
      return res.data;
    }
  } catch (err) {}

  return null;
}
