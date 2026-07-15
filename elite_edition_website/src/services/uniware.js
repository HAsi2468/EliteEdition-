import { getBaseUrl } from './api';

// Generic request wrapper
const request = async (path, options = {}) => {
  const baseUrl = getBaseUrl();
  const token = localStorage.getItem('elite_auth_token');
  if (!token) {
    throw new Error('Authentication token missing. Please log in.');
  }
  
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
    ...options.headers,
  };
  
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers,
  });
  
  if (!response.ok) {
    let errMsg = 'API Request Failed';
    try {
      const data = await response.json();
      errMsg = data.message || data.error || errMsg;
    } catch (e) {}
    throw new Error(errMsg);
  }
  
  return response.json();
};

export const uniwareApi = {
  // Unicommerce Sync
  async syncMissingProducts() {
    return request('/products/fetchMissingProduct');
  },

  async runFullUnicommerceSync() {
    return request('/products/fetchFromAPIS');
  },

  async runVariationSync() {
    return request('/products/instantSyncFromSaleOrders');
  },

  // Stock Reconciliation
  async getInventorySnapshot() {
    return request('/inventory/inventorySnapshot/get');
  },

  async syncInventorySnapshot() {
    return request('/inventory/inventorySnapshot/sync', {
      method: 'POST',
    });
  },

  // Returns
  async getReturns(filters = {}) {
    return request('/oms/return/search', {
      method: 'POST',
      body: JSON.stringify(filters),
    });
  },

  // Live Order Status
  async getLiveOrderStatus(orderCode) {
    return request('/oms/saleorder/get', {
      method: 'POST',
      body: JSON.stringify({ code: orderCode }),
    });
  }
};
