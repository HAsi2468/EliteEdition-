const { default: axios } = require('axios');
const http = require('http');
const https = require('https');

// Force IPv4 for all axios requests to bypass EHOSTUNREACH IPv6 routing errors
axios.defaults.httpAgent = new http.Agent({ family: 4 });
axios.defaults.httpsAgent = new https.Agent({ family: 4 });

const { convertKeysToModelFields } = require('../utils/dataParser');
const { csvExportedValue } = require('../utils/constant');
const csvParser = require('csv-parser');

async function fetchProductData(skuCode, token) {
  console.log('[fetchProductData] Start - skuCode:', skuCode);
  try {
    const response = await axios.post(
      'https://eliteedition.unicommerce.com/services/rest/v1/product/itemType/search',
      {
        productCode: skuCode,
      },
      {
        headers: {
          Authorization: `bearer ${token}`,
          'Content-Type': 'application/json',
          Cookie: 'unicommerce=app3',
        },
      }
    );
    console.log('[fetchProductData] Success');
    return response.data;
  } catch (error) {
    console.error('[fetchProductData] Error fetching data for SKU:', skuCode, error.message);
    throw error;
  }
}

async function getAccessToken() {
  const tokenUrl = 'https://eliteedition.unicommerce.com/oauth/token';
  const payload = new URLSearchParams({
    grant_type: 'password',
    client_id: 'my-trusted-client',
    username: 'ecom.eliteedt@gmail.com',
    password: 'Elite@6070',
  });
  try {
    const response = await axios.post(tokenUrl, payload.toString(), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Cookie: 'unicommerce=app1',
      },
    });
    return response.data.access_token;
  } catch (error) {
    console.error(
      'Error fetching access token:',
      error.response ? error.response.data : error.message
    );
    // Fallback: use token from environment if provided (useful for local testing)
    const fallback = process.env.UNICOMMERCE_TOKEN;
    if (fallback) {
      console.warn('Using fallback token from UNICOMMERCE_TOKEN env variable');
      return fallback;
    }
    return null;
  }
}

async function createExportJob(accessToken) {
  const createJobUrl =
    'https://eliteedition.unicommerce.com/services/rest/v1/export/job/create';

  // Rotate/shuffle the columns array to make the configuration unique and bypass Unicommerce's 100014 collision error.
  // The CSV parser uses column names as keys, so the order of columns in the generated CSV does not affect parsing.
  const reorderedColumns = [...csvExportedValue];
  const rotateIndex = Math.floor(Math.random() * reorderedColumns.length);
  const rotatedColumns = [...reorderedColumns.slice(rotateIndex), ...reorderedColumns.slice(0, rotateIndex)];

  // Primary request body (includes exportFilters)
  const primaryBody = {
    exportJobTypeName: 'Sale Orders',
    exportColums: rotatedColumns,
    exportFilters: [{ id: 'addedOn', dateRange: { textRange: 'TODAY' } }],
    /*TODAY, YESTERDAY, LAST_WEEK, LAST_MONTH, THIS_MONTH, LAST_7_DAYS, 
    LAST_30_DAYS,LAST_60_DAYS, LAST_90_DAYS, LAST_QUARTER, THIS_QUARTER*/
    frequency: 'ONETIME',
  };

  // Fallback body (minimal required fields)
  const fallbackBody = {
    exportJobTypeName: 'Sale Orders',
    exportColums: rotatedColumns,
    frequency: 'ONETIME',
  };

  const config = {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      // Facility header removed as it may cause validation errors
      Cookie: 'unicommerce=app1',
    },
  };

  // Log request details for debugging
  console.log('Creating export job:');
  console.log('URL:', createJobUrl);
  console.log('Headers:', config.headers);
  console.log('Primary payload (columns rotated):', primaryBody.exportColums.slice(0, 3));

  try {
    const response = await axios.post(createJobUrl, primaryBody, config);
    console.log('Export job response status:', response.status);
    console.log('Export job response data:', response.data);
    if (response.data && response.data.successful === false) {
      throw new Error(response.data.errors && response.data.errors.length > 0 ? response.data.errors[0].description : 'Unicommerce returned unsuccessful job creation response.');
    }
    return response.data.jobCode;
  } catch (error) {
    console.error('Primary export job creation failed:', error.response ? error.response.data : error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Headers:', error.response.headers);
    }
    // Attempt fallback without exportFilters
    console.log('Attempting fallback export job payload:', fallbackBody.exportColums.slice(0, 3));
    try {
      const response = await axios.post(createJobUrl, fallbackBody, config);
      console.log('Fallback export job response status:', response.status);
      console.log('Fallback export job response data:', response.data);
      if (response.data && response.data.successful === false) {
        return { error: response.data.errors && response.data.errors.length > 0 ? response.data.errors[0].description : 'Unicommerce returned unsuccessful job creation fallback response.' };
      }
      return response.data.jobCode;
    } catch (fallbackError) {
      console.error('Fallback export job creation failed:', fallbackError.response ? fallbackError.response.data : fallbackError.message);
      if (fallbackError.response) {
        console.error('Fallback status:', fallbackError.response.status);
        console.error('Fallback headers:', fallbackError.response.headers);
      }
      // Return a structured error object for the caller
      return { error: fallbackError.response ? fallbackError.response.data : fallbackError.message };
    }
  }
}

async function checkJobStatus(accessToken, jobCode) {
  const jobStatusUrl =
    'https://eliteedition.unicommerce.com/services/rest/v1/export/job/status';

  const requestBody = {
    jobCode,
  };

  try {
    const response = await axios.post(jobStatusUrl, requestBody, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        Cookie: 'unicommerce=app1',
      },
    });

    return response.data;
  } catch (error) {
    console.error(
      'Error checking job status:',
      error.response ? error.response.data : error.message
    );
  }
}
const readFileFromUrl = async (url, accesstoken) => {
  return new Promise(async (resolve, reject) => {
    try {
      const response = await axios.get(url, { responseType: 'stream' });
      const csvData = [];
      response.data
        .pipe(csvParser())
        .on('data', (row) => {
          csvData.push(row);
        })
        .on('end', async () => {
          resolve(convertKeysToModelFields(csvData));
        });
    } catch (error) {
      reject(error);
    }
  });
};
async function getInventorySnapshot(accessToken, skuCodes = []) {
  const url = 'https://eliteedition.unicommerce.com/services/rest/v1/inventory/inventorySnapshot/get';
  const body = {};
  if (skuCodes && skuCodes.length > 0) {
    body.itemTypeSKUs = skuCodes;
  } else {
    body.updatedSinceInMinutes = 1440; // 24 hours
  }
  try {
    const response = await axios.post(url, body, {
      headers: {
        Authorization: `bearer ${accessToken}`,
        'Content-Type': 'application/json',
        Facility: 'Oequal',
        Cookie: 'unicommerce=app1',
      },
    });
    return response.data;
  } catch (error) {
    console.error('Error in getInventorySnapshot API call:', error.response ? error.response.data : error.message);
    throw error;
  }
}

async function searchReturns(accessToken, filters = {}) {
  const url = 'https://eliteedition.unicommerce.com/services/rest/v1/oms/return/search';
  const now = new Date();
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  
  const formatUniDate = (d) => d.toISOString().slice(0, 19);

  const body = {
    returnType: filters.returnType || 'RTO',
    updatedFrom: filters.updatedFrom || formatUniDate(weekAgo),
    updatedTo: filters.updatedTo || formatUniDate(now),
  };

  try {
    const response = await axios.post(url, body, {
      headers: {
        Authorization: `bearer ${accessToken}`,
        'Content-Type': 'application/json',
        Facility: 'Oequal',
        Cookie: 'unicommerce=app1',
      },
    });
    return response.data;
  } catch (error) {
    console.error('Error in searchReturns API call:', error.response ? error.response.data : error.message);
    throw error;
  }
}

async function getSaleOrderLive(accessToken, orderCode) {
  const url = 'https://eliteedition.unicommerce.com/services/rest/v1/oms/saleorder/get';
  const body = {
    code: orderCode,
    paymentDetailRequired: true,
  };
  try {
    const response = await axios.post(url, body, {
      headers: {
        Authorization: `bearer ${accessToken}`,
        'Content-Type': 'application/json',
        Cookie: 'unicommerce=app1',
      },
    });
    return response.data;
  } catch (error) {
    console.error('Error in getSaleOrderLive API call:', error.response ? error.response.data : error.message);
    throw error;
  }
}

module.exports = {
  fetchProductData,
  getAccessToken,
  createExportJob,
  checkJobStatus,
  readFileFromUrl,
  getInventorySnapshot,
  searchReturns,
  getSaleOrderLive,
};

