// API Base URL management
const DEFAULT_URL = '/v1';

export const getBaseUrl = () => {
  const stored = localStorage.getItem('elite_api_base_url');
  if (stored) {
    return stored;
  }
  // Fallback to default URL
  return DEFAULT_URL;
};

export const setBaseUrl = (url) => {
  let cleaned = url.trim();
  if (cleaned.endsWith('/')) {
    cleaned = cleaned.slice(0, -1);
  }
  if (!cleaned.endsWith('/v1')) {
    cleaned = `${cleaned}/v1`;
  }
  localStorage.setItem('elite_api_base_url', cleaned);
};

// Generic request wrapper
const request = async (path, options = {}) => {
  const baseUrl = getBaseUrl();
  const token = localStorage.getItem('elite_auth_token');
  
  const headers = {
    ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
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

export const api = {
  // Auth
  async login(email, password) {
    const data = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    if (data.tokens && data.tokens.access) {
      localStorage.setItem('elite_auth_token', data.tokens.access.token);
      localStorage.setItem('elite_user', JSON.stringify(data.user));
    }
    return data;
  },

  async register(name, email, password) {
    return request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password, role: 'admin' }),
    });
  },

  logout() {
    localStorage.removeItem('elite_auth_token');
    localStorage.removeItem('elite_user');
  },

  getCurrentUser() {
    try {
      const userStr = localStorage.getItem('elite_user');
      return userStr ? JSON.parse(userStr) : null;
    } catch (e) {
      return null;
    }
  },

  isAuthenticated() {
    return !!localStorage.getItem('elite_auth_token');
  },

  // Users Management
  async getUsers(params = {}) {
    const queryParams = new URLSearchParams();
    Object.entries(params).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== '') {
        queryParams.append(key, val);
      }
    });
    const queryString = queryParams.toString() ? `?${queryParams.toString()}` : '';
    return request(`/users${queryString}`);
  },

  async createUser(userData) {
    return request('/users', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  },

  async updateUser(id, updates) {
    return request(`/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  },

  async deleteUser(id) {
    return request(`/users/${id}`, {
      method: 'DELETE',
    });
  },

  async getInventory(search = '') {
    const params = [];
    if (search) params.push(`search=${encodeURIComponent(search)}`);
    params.push('excludeUniware=true');
    const query = '?' + params.join('&');
    return request(`/inventory${query}`);
  },

  async createInventory(item) {
    return request('/inventory', {
      method: 'POST',
      body: JSON.stringify(item),
    });
  },

  async bulkInward(items) {
    return request('/inventory/bulk-inward', {
      method: 'POST',
      body: JSON.stringify(items),
    });
  },

  async updateInventory(id, updates) {
    return request(`/inventory/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  },

  async deleteInventory(id) {
    return request(`/inventory/${id}`, {
      method: 'DELETE',
    });
  },

  // Sales Orders
  async getSales(params = {}) {
    const queryParams = new URLSearchParams();
    Object.entries(params).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== '') {
        queryParams.append(key, val);
      }
    });
    const queryString = queryParams.toString() ? `?${queryParams.toString()}` : '';
    return request(`/products/get_orders${queryString}`);
  },

  // Stock Outward
  async createStockOut(data) {
    return request('/stockOut', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async getParties() {
    return request('/party');
  },

  // Get party by SKU for Returns UI
  async getPartyBySku(sku) {
    return request(`/inventory/party/${sku}`);
  },

  async createParty(data) {
    return request('/party', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateParty(id, data) {
    return request(`/party/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async deleteParty(id) {
    return request(`/party/${id}`, {
      method: 'DELETE',
    });
  },

  // Vendors
  async getVendors() {
    return request('/vendor');
  },

  async createVendor(data) {
    return request('/vendor', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateVendor(id, data) {
    return request(`/vendor/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async deleteVendor(id) {
    return request(`/vendor/${id}`, {
      method: 'DELETE',
    });
  },

  // Fabric Vendors
  async getFabricVendors() {
    return request('/fabric-vendors');
  },

  async createFabricVendor(data) {
    return request('/fabric-vendors', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateFabricVendor(id, data) {
    return request(`/fabric-vendors/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async deleteFabricVendor(id) {
    return request(`/fabric-vendors/${id}`, {
      method: 'DELETE',
    });
  },

  // Products Catalog
  async getProductsCatalog() {
    return request('/products/list?limit=2000');
  },

  async createProductCatalog(data) {
    return request('/products', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateProductCatalog(id, data) {
    return request(`/products/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async deleteProductCatalog(id) {
    return request(`/products/${id}`, {
      method: 'DELETE',
    });
  },

  async syncMissingProducts() {
    return request('/products/fetchMissingProduct');
  },

  // Stock Out Logs
  async getStockOuts() {
    return request('/stockOut');
  },

  // Reports
  async downloadReport(reportPath, fileName) {
    const baseUrl = getBaseUrl();
    const token = localStorage.getItem('elite_auth_token');
    const headers = {
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    };

    const response = await fetch(`${baseUrl}/${reportPath}`, {
      headers,
    });

    if (!response.ok) {
      throw new Error('Failed to generate report PDF');
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    link.parentNode.removeChild(link);
    window.URL.revokeObjectURL(url);
  },

  async downloadInventoryReport(reportPath, dateStart, dateEnd, fileName) {
    const baseUrl = getBaseUrl();
    const token = localStorage.getItem('elite_auth_token');
    const headers = {
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    };
    const query = new URLSearchParams();
    if (dateStart) query.append('dateStart', dateStart);
    if (dateEnd) query.append('dateEnd', dateEnd);
    const queryString = query.toString() ? `?${query.toString()}` : '';

    const response = await fetch(`${baseUrl}/inventory/report/${reportPath}${queryString}`, {
      headers,
    });

    if (!response.ok) {
      throw new Error('Failed to generate inventory report PDF');
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    link.parentNode.removeChild(link);
    window.URL.revokeObjectURL(url);
  },

  async downloadSalesReport(dateStart, dateEnd, searchCode, fileName) {
    const baseUrl = getBaseUrl();
    const token = localStorage.getItem('elite_auth_token');
    const headers = {
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    };
    const query = new URLSearchParams({ dateStart, dateEnd });
    if (searchCode) query.append('searchCode', searchCode);

    const response = await fetch(`${baseUrl}/salesList/report/pdf?${query.toString()}`, {
      headers,
    });

    if (!response.ok) {
      throw new Error('Failed to generate sales report PDF');
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    link.parentNode.removeChild(link);
    window.URL.revokeObjectURL(url);
  },

  async downloadBrandReport(dateStart, dateEnd, searchCode, fileName) {
    const baseUrl = getBaseUrl();
    const token = localStorage.getItem('elite_auth_token');
    const headers = {
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    };
    const query = new URLSearchParams({ type: 'brand', dateStart, dateEnd });
    if (searchCode) query.append('searchCode', searchCode);

    const response = await fetch(`${baseUrl}/salesList/report/pdf?${query.toString()}`, {
      headers,
    });

    if (!response.ok) {
      throw new Error('Failed to generate brand report PDF');
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    link.parentNode.removeChild(link);
    window.URL.revokeObjectURL(url);
  },

  async downloadBrandReportHourWise(dateStart, dateEnd, searchCode, fileName) {
    const baseUrl = getBaseUrl();
    const token = localStorage.getItem('elite_auth_token');
    const headers = {
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    };
    const query = new URLSearchParams({ type: 'brand-hourly', dateStart, dateEnd });
    if (searchCode) query.append('searchCode', searchCode);

    const response = await fetch(`${baseUrl}/salesList/report/pdf?${query.toString()}`, {
      headers,
    });

    if (!response.ok) {
      throw new Error('Failed to generate hourly brand report PDF');
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    link.parentNode.removeChild(link);
    window.URL.revokeObjectURL(url);
  },

  async downloadReturnsBrandReport(dateStart, dateEnd, subType, fileName) {
    const baseUrl = getBaseUrl();
    const token = localStorage.getItem('elite_auth_token');
    const headers = {
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    };
    const query = new URLSearchParams({ type: 'returns-analysis', subType, dateStart, dateEnd });

    const response = await fetch(`${baseUrl}/salesList/report/pdf?${query.toString()}`, {
      headers,
    });

    if (!response.ok) {
      throw new Error('Failed to generate returns brand report PDF');
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    link.parentNode.removeChild(link);
    window.URL.revokeObjectURL(url);
  },

  // Raw Report Data
  async getStockValueReportData() {
    return request('/inventory/report/stock-value-data');
  },

  async getStockInwardReportData(dateStart, dateEnd) {
    return request(`/inventory/report/stock-inward-data?dateStart=${dateStart}&dateEnd=${dateEnd}`);
  },

  async getStockOutwardReportData(dateStart, dateEnd) {
    return request(`/inventory/report/stock-outward-data?dateStart=${dateStart}&dateEnd=${dateEnd}`);
  },

  async getSalesReportData(dateStart, dateEnd, searchCode = '') {
    const query = new URLSearchParams({ dateStart, dateEnd });
    if (searchCode) query.append('searchCode', searchCode);
    return request(`/products/report?${query.toString()}`);
  },

  async getElitePrintReports(dateStart, dateEnd) {
    let url = '/department-reports/elite-print?';
    if (dateStart) url += `dateStart=${dateStart}&`;
    if (dateEnd) url += `dateEnd=${dateEnd}&`;
    return request(url);
  },

  async getBrandReportData(dateStart, dateEnd, searchCode = '') {
    const query = new URLSearchParams({ dateStart, dateEnd });
    if (searchCode) query.append('searchCode', searchCode);
    return request(`/products/brandReport?${query.toString()}`);
  },

  async getBrandReportHourWiseData(dateStart, dateEnd, searchCode = '') {
    const query = new URLSearchParams({ dateStart, dateEnd });
    if (searchCode) query.append('searchCode', searchCode);
    return request(`/products/brandReportHourWise?${query.toString()}`);
  },

  // ─── Job Cards ─────────────────────────────────────────────────────────────
  async getJobCards(params = {}) {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v) query.append(k, v); });
    const qs = query.toString() ? `?${query.toString()}` : '';
    return request(`/jobCards${qs}`);
  },
  async createJobCard(data) {
    return request('/jobCards', { method: 'POST', body: JSON.stringify(data) });
  },
  async updateJobCard(id, data) {
    return request(`/jobCards/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  },
  async deleteJobCard(id) {
    return request(`/jobCards/${id}`, { method: 'DELETE' });
  },
  async getNextJobCardNo() {
    return request('/jobCards/next-number');
  },
  async calcExpTime(panna, pass, totalMtr, machineName) {
    const q = new URLSearchParams({ panna, pass, totalMtr, machineName });
    return request(`/jobCards/calc-exp-time?${q.toString()}`);
  },

  // ─── Design Catalogue ──────────────────────────────────────────────────────
  async uploadImage(file) {
    const formData = new FormData();
    formData.append('image', file);
    
    const response = await fetch(`${getBaseUrl()}/upload`, {
      method: 'POST',
      body: formData
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response.json();
  },

  async getDesigns(params = {}) {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') query.append(k, v); });
    const qs = query.toString() ? `?${query.toString()}` : '';
    return request(`/designs${qs}`);
  },
  async createDesign(data) {
    return request('/designs', { method: 'POST', body: JSON.stringify(data) });
  },
  async updateDesign(id, data) {
    return request(`/designs/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  },
  async deleteDesign(id) {
    return request(`/designs/${id}`, { method: 'DELETE' });
  },
  async getDesignCategories() {
    return request('/designs/categories');
  },

  // ─── Analytics ──────────────────────────────────────────────────────────────
  async getVariantAnalytics(params = {}) {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v) query.append(k, v); });
    const qs = query.toString() ? `?${query.toString()}` : '';
    return request(`/analytics/variant${qs}`);
  },
  async getDemographicsAnalytics(params = {}) {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v) query.append(k, v); });
    const qs = query.toString() ? `?${query.toString()}` : '';
    return request(`/analytics/demographics${qs}`);
  },
  async getTimeHeatmapData(params = {}) {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v) query.append(k, v); });
    const qs = query.toString() ? `?${query.toString()}` : '';
    return request(`/analytics/heatmap${qs}`);
  },
  async getDeadStockReport(params = {}) {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v) query.append(k, v); });
    const qs = query.toString() ? `?${query.toString()}` : '';
    return request(`/analytics/dead-stock${qs}`);
  },
  async getLostRevenueEstimate(params = {}) {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v) query.append(k, v); });
    const qs = query.toString() ? `?${query.toString()}` : '';
    return request(`/analytics/lost-revenue${qs}`);
  },
  async getReturnsBrandReport(params = {}) {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v) query.append(k, v); });
    const qs = query.toString() ? `?${query.toString()}` : '';
    return request(`/analytics/returns-brand${qs}`);
  },
  // MYNTRA API HELPERS
  async getMyntraConfig() {
    return request('/myntra/config');
  },

  async saveMyntraConfig(merchantId, secretKey) {
    return request('/myntra/config', {
      method: 'POST',
      body: JSON.stringify({ merchantId, secretKey })
    });
  },

  async getMyntraOrders() {
    return request('/myntra/orders');
  },

  async syncMyntraInventory() {
    return request('/myntra/sync-inventory', {
      method: 'POST',
    });
  },

  async applyMyntraDiscount(data) {
    return request('/myntra/discount', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  async dispatchMyntraOrder(orderId) {
    return request(`/myntra/order/${orderId}/dispatch`, {
      method: 'POST',
    });
  },

  // --- Returns Engine ---
  async processReturn(data) {
    return request('/returns/process', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async getReturns(status) {
    const query = status ? `?status=${status}` : '';
    return request(`/returns${query}`);
  },

  async markRefinished(returnId) {
    return request(`/returns/${returnId}/refinish`, {
      method: 'POST',
    });
  },

  // --- Print Settings Engine ---
  async getPrintConfig() {
    return request('/print-config');
  },

  async updatePrintConfig(data) {
    return request('/print-config/update', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // --- Workspace (Chat & Task) ---
  async getRooms(userId) {
    const url = userId ? `/workspace/rooms?userId=${userId}` : '/workspace/rooms';
    return request(url);
  },
  
  async createRoom(data) {
    return request('/workspace/rooms', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async getRoomMessages(roomId, before = '') {
    const query = before ? `?before=${before}` : '';
    return request(`/workspace/rooms/${roomId}/messages${query}`);
  },

  async sendRoomMessage(roomId, data) {
    return request(`/workspace/rooms/${roomId}/messages`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async getTasks() {
    return request('/workspace/tasks');
  },

  async getPresignedUrl(fileType) {
    return request('/workspace/presign', {
      method: 'POST',
      body: JSON.stringify({ fileType }),
    });
  },

  async uploadChatFile(file) {
    const formData = new FormData();
    formData.append('file', file);
    return request('/workspace/upload', {
      method: 'POST',
      body: formData,
    }, true);
  },

  async uploadChatImage(file) {
    return this.uploadChatFile(file);
  },

  // Fabric Inventory
  async getFabricTransactions() {
    return request('/fabric/transactions');
  },
  
  async getFabricStock() {
    return request('/fabric/stock');
  },
  
  async createFabricInward(payload) {
    return request('/fabric/inward', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },
  
  async createFabricOutward(payload) {
    return request('/fabric/outward', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },
  
  async getFabricLotStock(params = {}) {
    const { fabricQuality } = params;
    const qs = fabricQuality ? `?fabricQuality=${encodeURIComponent(fabricQuality)}` : '';
    return request(`/fabric/lot-stock${qs}`);
  },

  async getFabricStockByPanna() {
    return request('/fabric/stock-panna');
  },

  async getFabricRequirement() {
    return request('/fabric/requirement');
  },

  async deleteFabricTransaction(id) {
    return request(`/fabric/${id}`, { method: 'DELETE' });
  },

  async updateFabricTransaction(id, payload) {
    return request(`/fabric/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload)
    });
  },

  async downloadFabricLedgerPdf(params = {}) {
    const baseUrl = getBaseUrl();
    const token = localStorage.getItem('elite_auth_token');
    const query = new URLSearchParams();
    if (params.dateStart) query.append('dateStart', params.dateStart);
    if (params.dateEnd) query.append('dateEnd', params.dateEnd);
    if (params.fabricQuality) query.append('fabricQuality', params.fabricQuality);
    const qs = query.toString() ? `?${query.toString()}` : '';
    const response = await fetch(`${baseUrl}/fabric/report/pdf${qs}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!response.ok) throw new Error('Failed to generate fabric ledger PDF');
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `fabric-ledger${params.dateStart ? '-' + params.dateStart : ''}.pdf`);
    document.body.appendChild(link);
    link.click();
    link.parentNode.removeChild(link);
    window.URL.revokeObjectURL(url);
  },

  // Raw Materials Inventory
  async getRawMaterialTransactions() {
    return request('/raw-materials/transactions');
  },

  async getRawMaterialStock() {
    return request('/raw-materials/stock');
  },

  async createRawMaterialInward(payload) {
    return request('/raw-materials/inward', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async createRawMaterialOutward(payload) {
    return request('/raw-materials/outward', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async deleteRawMaterialTransaction(id) {
    return request(`/raw-materials/${id}`, { method: 'DELETE' });
  },

  async updateRawMaterialTransaction(id, payload) {
    return request(`/raw-materials/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload)
    });
  },

  async downloadRawMaterialLedgerPdf(params = {}) {
    const baseUrl = getBaseUrl();
    const token = localStorage.getItem('elite_auth_token');
    const query = new URLSearchParams();
    if (params.dateStart) query.append('dateStart', params.dateStart);
    if (params.dateEnd) query.append('dateEnd', params.dateEnd);
    if (params.materialName) query.append('materialName', params.materialName);
    const qs = query.toString() ? `?${query.toString()}` : '';
    const response = await fetch(`${baseUrl}/raw-materials/report/pdf${qs}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!response.ok) throw new Error('Failed to generate raw materials ledger PDF');
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `raw-materials-ledger${params.dateStart ? '-' + params.dateStart : ''}.pdf`);
    document.body.appendChild(link);
    link.click();
    link.parentNode.removeChild(link);
    window.URL.revokeObjectURL(url);
  },

  async importRawMaterialStock(rows) {
    return request('/raw-materials/import-stock', {
      method: 'POST',
      body: JSON.stringify(rows),
    });
  },

  async importFabricStock(rows) {
    return request('/fabric/import-stock', {
      method: 'POST',
      body: JSON.stringify(rows),
    });
  },

  async getInfraBills() {
    return request('/infra-bills', { method: 'GET' });
  },

  async createInfraBill(payload) {
    return request('/infra-bills', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async updateInfraBill(id, payload) {
    return request(`/infra-bills/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  async deleteInfraBill(id) {
    return request(`/infra-bills/${id}`, { method: 'DELETE' });
  },

  // ── Fabric Challan ─────────────────────────────────────────────────────
  async getFabricChallans(params = {}) {
    const q = new URLSearchParams();
    if (params.dateStart) q.append('dateStart', params.dateStart);
    if (params.dateEnd) q.append('dateEnd', params.dateEnd);
    if (params.search) q.append('search', params.search);
    const qs = q.toString() ? `?${q.toString()}` : '';
    return request(`/fabric-challan${qs}`);
  },

  async createFabricChallan(data) {
    return request('/fabric-challan', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateFabricChallan(id, data) {
    return request(`/fabric-challan/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async deleteFabricChallan(id) {
    return request(`/fabric-challan/${id}`, { method: 'DELETE' });
  },

  async downloadFabricChallanPdf(id, challanNo) {
    const baseUrl = getBaseUrl();
    const token = localStorage.getItem('elite_auth_token');
    const response = await fetch(`${baseUrl}/fabric-challan/${id}/pdf`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!response.ok) throw new Error('Failed to generate challan PDF');
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Challan_${challanNo || 'preview'}.pdf`);
    document.body.appendChild(link);
    link.click();
    link.parentNode.removeChild(link);
  },

  async getNextChallanNo() {
    return request('/fabric-challan/next-no');
  },

  async getFabricLotInfo(lotNo) {
    return request(`/fabric-challan/lot-info/${lotNo}`);
  },
};
