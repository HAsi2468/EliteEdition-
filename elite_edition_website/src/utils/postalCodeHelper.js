/**
 * Postal & GST Geo-Location Helper (Free Public Indian Postal API + Offline Cache)
 * Resolves Pincode -> City, District, State, GST Code & Country ("India")
 */

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
      // Convert to Title Case e.g. "Gujarat"
      const formatted = state.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
      return { state: formatted, stateCode: code };
    }
  }
  return null;
}

// Built-in offline quick lookup for popular industrial hubs
const OFFLINE_PINCODE_MAP = {
  '395001': { city: 'Surat', state: 'Gujarat', stateCode: '24' },
  '395002': { city: 'Surat', state: 'Gujarat', stateCode: '24' },
  '395003': { city: 'Surat', state: 'Gujarat', stateCode: '24' },
  '395004': { city: 'Surat', state: 'Gujarat', stateCode: '24' },
  '395005': { city: 'Surat', state: 'Gujarat', stateCode: '24' },
  '395006': { city: 'Surat', state: 'Gujarat', stateCode: '24' },
  '395007': { city: 'Surat', state: 'Gujarat', stateCode: '24' },
  '395008': { city: 'Surat', state: 'Gujarat', stateCode: '24' },
  '395009': { city: 'Surat', state: 'Gujarat', stateCode: '24' },
  '395010': { city: 'Surat', state: 'Gujarat', stateCode: '24' },
  '380001': { city: 'Ahmedabad', state: 'Gujarat', stateCode: '24' },
  '380002': { city: 'Ahmedabad', state: 'Gujarat', stateCode: '24' },
  '360001': { city: 'Rajkot', state: 'Gujarat', stateCode: '24' },
  '390001': { city: 'Vadodara', state: 'Gujarat', stateCode: '24' },
  '400001': { city: 'Mumbai', state: 'Maharashtra', stateCode: '27' },
  '400002': { city: 'Mumbai', state: 'Maharashtra', stateCode: '27' },
  '411001': { city: 'Pune', state: 'Maharashtra', stateCode: '27' },
  '421501': { city: 'Bhiwandi', state: 'Maharashtra', stateCode: '27' },
  '110001': { city: 'New Delhi', state: 'Delhi', stateCode: '07' },
  '110006': { city: 'Delhi', state: 'Delhi', stateCode: '07' },
  '302001': { city: 'Jaipur', state: 'Rajasthan', stateCode: '08' },
  '342001': { city: 'Jodhpur', state: 'Rajasthan', stateCode: '08' },
  '560001': { city: 'Bengaluru', state: 'Karnataka', stateCode: '29' },
  '600001': { city: 'Chennai', state: 'Tamil Nadu', stateCode: '33' },
  '641601': { city: 'Tirupur', state: 'Tamil Nadu', stateCode: '33' },
  '500001': { city: 'Hyderabad', state: 'Telangana', stateCode: '36' },
  '700001': { city: 'Kolkata', state: 'West Bengal', stateCode: '19' },
  '141001': { city: 'Ludhiana', state: 'Punjab', stateCode: '03' },
  '452001': { city: 'Indore', state: 'Madhya Pradesh', stateCode: '23' }
};

const clientPincodeCache = new Map();

/**
 * Free Instant Pincode Lookup
 * Priority: 1. In-memory cache -> 2. Backend `/billing/lookup-pincode` -> 3. Direct free Postal API -> 4. Offline Map
 */
export async function lookupPincode(pincode) {
  if (!pincode) return null;
  const cleanPin = String(pincode).trim().replace(/\D/g, '');
  if (cleanPin.length !== 6) return null;

  if (clientPincodeCache.has(cleanPin)) {
    return clientPincodeCache.get(cleanPin);
  }

  // 1. Try Backend Proxy endpoint
  try {
    const res = await fetch(`/v1/billing/lookup-pincode/${cleanPin}`, {
      headers: {
        'Accept': 'application/json'
      }
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.success && data.data) {
        clientPincodeCache.set(cleanPin, data.data);
        return data.data;
      }
    }
  } catch (backendErr) {
    // Continue to direct public API fallback
  }

  // 2. Direct Fallback to Free Indian Postal API (CORS enabled)
  try {
    const directRes = await fetch(`https://api.postalpincode.in/pincode/${cleanPin}`);
    if (directRes.ok) {
      const json = await directRes.json();
      if (Array.isArray(json) && json[0] && json[0].Status === 'Success') {
        const poList = json[0].PostOffice || [];
        const primary = poList[0] || {};
        const stateName = primary.State || 'Gujarat';
        const districtName = primary.District || primary.Division || primary.Block || '';
        const stateCode = getStateCode(stateName);

        const result = {
          pincode: cleanPin,
          city: districtName || OFFLINE_PINCODE_MAP[cleanPin]?.city || 'Surat',
          district: districtName,
          state: stateName,
          stateCode,
          country: primary.Country || 'India',
          postOffices: poList.map(p => p.Name).filter(Boolean)
        };
        clientPincodeCache.set(cleanPin, result);
        return result;
      }
    }
  } catch (directErr) {
    // Continue to offline map
  }

  // 3. Offline Hub Fallback
  if (OFFLINE_PINCODE_MAP[cleanPin]) {
    const off = OFFLINE_PINCODE_MAP[cleanPin];
    const result = {
      pincode: cleanPin,
      city: off.city,
      district: off.city,
      state: off.state,
      stateCode: off.stateCode,
      country: 'India',
      postOffices: [off.city]
    };
    clientPincodeCache.set(cleanPin, result);
    return result;
  }

  return null;
}

