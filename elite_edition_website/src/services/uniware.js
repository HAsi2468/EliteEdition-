import { api } from './api';

// Route all requests through standardized api.request (enforcing withCredentials: true and HttpOnly cookies)
const request = async (path, options = {}) => {
  return api.request(path, options);
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
