// API Base URL management
const DEFAULT_URL = '/v1';

export const getBaseUrl = () => {
  const stored = localStorage.getItem('elite_api_base_url');
  if (stored) {
    if (stored.includes('3.7.174.180')) {
      localStorage.removeItem('elite_api_base_url');
      return DEFAULT_URL;
    }
    return stored;
  }
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

// Generic request wrapper with Timeout & Safe Error Parser
const request = async (path, options = {}) => {
  const baseUrl = getBaseUrl();
  const token = localStorage.getItem('elite_auth_token');

  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    throw new Error('Network offline. Please check your internet connection.');
  }
  
  const userStr = localStorage.getItem('elite_user');
  let currUser = null;
  if (userStr) {
    try { currUser = JSON.parse(userStr); } catch (e) {}
  }
  const uId = currUser?.id || currUser?._id || '';
  const uName = currUser?.name || currUser?.fullName || currUser?.username || '';

  const headers = {
    ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...(uId ? { 'X-User-Id': uId } : {}),
    ...(uName ? { 'X-User-Name': uName } : {}),
    ...options.headers,
  };
  
  const timeoutMs = options.timeout || 30000;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  let response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      ...options,
      headers,
      signal: options.signal || controller.signal,
    });
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error(`Request timed out after ${Math.round(timeoutMs / 1000)}s.`);
    }
    throw new Error(err.message || 'Server connection failed. Please check network.');
  } finally {
    clearTimeout(timeoutId);
  }
  
  if (!response.ok) {
    let errMsg = `Server returned status ${response.status}`;
    try {
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const data = await response.json();
        errMsg = data.message || data.error || data.err || errMsg;
        if (typeof errMsg === 'object') {
          errMsg = JSON.stringify(errMsg);
        }
      } else {
        const text = await response.text();
        if (text && text.length < 150) {
          errMsg = text.replace(/<[^>]*>/g, '').trim() || errMsg;
        }
      }
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

  async refreshCurrentUser() {
    const user = this.getCurrentUser();
    if (!user) return null;
    const userId = user.id || user._id;
    if (!userId) return user;
    try {
      const res = await request(`/users/${userId}`);
      if (res && res.user) {
        localStorage.setItem('elite_user', JSON.stringify(res.user));
        return res.user;
      }
    } catch (e) {
      console.warn('Failed to refresh current user profile:', e);
    }
    return user;
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

  async downloadSalesReturnsRatioReport(dateStart, dateEnd, fileName) {
    const baseUrl = getBaseUrl();
    const token = localStorage.getItem('elite_auth_token');
    const headers = {
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    };
    const query = new URLSearchParams({ type: 'sales-returns-ratio', dateStart, dateEnd });

    const response = await fetch(`${baseUrl}/salesList/report/pdf?${query.toString()}`, {
      headers,
    });

    if (!response.ok) {
      throw new Error('Failed to generate sales & returns ratio report PDF');
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

  async getSalesReturnsRatioReport(dateStart, dateEnd) {
    const query = new URLSearchParams();
    if (dateStart) query.append('dateStart', dateStart);
    if (dateEnd) query.append('dateEnd', dateEnd);
    return request(`/analytics/sales-returns-ratio?${query.toString()}`);
  },

  async downloadElitePrintReport(dateStart, dateEnd, fileName) {
    const baseUrl = getBaseUrl();
    const token = localStorage.getItem('elite_auth_token');
    const headers = {
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    };
    const query = new URLSearchParams();
    if (dateStart) query.append('dateStart', dateStart);
    if (dateEnd) query.append('dateEnd', dateEnd);
    const queryString = query.toString() ? `?${query.toString()}` : '';

    const response = await fetch(`${baseUrl}/department-reports/elite-print/pdf${queryString}`, {
      headers,
    });

    if (!response.ok) {
      throw new Error('Failed to generate Elite Print report PDF');
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
  async downloadJobCardPdf(id, jobNo = '') {
    const baseUrl = getBaseUrl();
    const token = localStorage.getItem('elite_auth_token') || localStorage.getItem('token');
    const response = await fetch(`${baseUrl}/jobCards/pdf/${id}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!response.ok) throw new Error('Failed to download Job Card PDF');
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `JobCard_${jobNo || 'preview'}.pdf`);
    document.body.appendChild(link);
    link.click();
    if (link.parentNode) link.parentNode.removeChild(link);
    window.URL.revokeObjectURL(url);
  },
  async downloadBulkJobCardPdf(ids = [], fileName = 'Combined_Job_Cards.pdf') {
    if (!ids || ids.length === 0) return;
    const baseUrl = getBaseUrl();
    const token = localStorage.getItem('elite_auth_token') || localStorage.getItem('token');
    const response = await fetch(`${baseUrl}/jobCards/bulk-pdf?ids=${ids.join(',')}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!response.ok) throw new Error('Failed to generate combined Job Cards PDF');
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    if (link.parentNode) link.parentNode.removeChild(link);
    window.URL.revokeObjectURL(url);
  },
  async getNextJobCardNo() {
    return request('/jobCards/next-number');
  },
  async calcExpTime(panna, pass, totalMtr, machineName) {
    const q = new URLSearchParams({ panna, pass, totalMtr, machineName });
    return request(`/jobCards/calc-exp-time?${q.toString()}`);
  },
  async calculatePrintCost(data) {
    return request('/jobCards/calc-cost', { method: 'POST', body: JSON.stringify(data) });
  },
  async updateJobStage(id, data) {
    return request(`/jobCards/${id}/stage`, { method: 'PATCH', body: JSON.stringify(data) });
  },
  async updateJobProofing(id, data) {
    return request(`/jobCards/${id}/proofing`, { method: 'PATCH', body: JSON.stringify(data) });
  },

  // ─── Garment Manufacturing ERP (Elite Stitching) ─────────────────────────
  async getGarmentJobCards(params = {}) {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') query.append(k, v); });
    const qs = query.toString() ? `?${query.toString()}` : '';
    return request(`/garment-jobcards${qs}`);
  },
  async getGarmentJobCardById(id) {
    return request(`/garment-jobcards/${id}`);
  },
  async createGarmentJobCard(payload) {
    return request('/garment-jobcards', { method: 'POST', body: JSON.stringify(payload) });
  },
  async updateGarmentJobCard(id, payload) {
    return request(`/garment-jobcards/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
  },
  async advanceGarmentJobCardStage(id, payload = {}) {
    return request(`/garment-jobcards/${id}/advance-stage`, { method: 'PUT', body: JSON.stringify(payload) });
  },
  async deleteGarmentJobCard(id) {
    return request(`/garment-jobcards/${id}`, { method: 'DELETE' });
  },
  async getNextGarmentJobNumber() {
    return request('/garment-jobcards/next-number');
  },
  async getGarmentJobCardAnalytics(params = {}) {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') query.append(k, v); });
    const qs = query.toString() ? `?${query.toString()}` : '';
    return request(`/garment-jobcards/analytics${qs}`);
  },

  // ─── Machine Print Logs ──────────────────────────────────────────────────
  async createJobPrintLog(data) {
    return request('/jobPrintLogs', { method: 'POST', body: JSON.stringify(data) });
  },
  async getJobPrintLogs(params = {}) {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') query.append(k, v); });
    const qs = query.toString() ? `?${query.toString()}` : '';
    return request(`/jobPrintLogs${qs}`);
  },
  async getJobCardPrintLogs(jobNoOrId) {
    return request(`/jobPrintLogs/job/${jobNoOrId}`);
  },
  async updateJobPrintLog(id, data) {
    return request(`/jobPrintLogs/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  },
  async deleteJobPrintLog(id) {
    return request(`/jobPrintLogs/${id}`, { method: 'DELETE' });
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
  async getNextDesignNumber(params = {}) {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') query.append(k, v); });
    const qs = query.toString() ? `?${query.toString()}` : '';
    return request(`/designs/next-number${qs}`);
  },
  async importPKDOrders(items) {
    return request('/designs/import-pkd-orders', { method: 'POST', body: JSON.stringify({ items }) });
  },

  // ─── Complaints Module ──────────────────────────────────────────────────────
  async getComplaints(params = {}) {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') query.append(k, v); });
    const qs = query.toString() ? `?${query.toString()}` : '';
    return request(`/complaints${qs}`);
  },
  async getNextComplaintNumber() {
    return request('/complaints/next-number');
  },
  async getComplaintAnalytics(params = {}) {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') query.append(k, v); });
    const qs = query.toString() ? `?${query.toString()}` : '';
    return request(`/complaints/analytics${qs}`);
  },
  async createComplaint(payload) {
    return request('/complaints', { method: 'POST', body: JSON.stringify(payload) });
  },
  async updateComplaint(id, payload) {
    return request(`/complaints/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
  },
  async deleteComplaint(id) {
    return request(`/complaints/${id}`, { method: 'DELETE' });
  },
  async clearAllComplaints() {
    return request('/complaints/clear-all', { method: 'DELETE' });
  },
  async getComplaintById(id) {
    return request(`/complaints/${id}`);
  },
  async lookupOrderDetails(searchTerm) {
    return request(`/complaints/lookup-order?query=${encodeURIComponent(searchTerm)}`);
  },
  async addComplaintComment(id, payload) {
    return request(`/complaints/${id}/comments`, { method: 'POST', body: JSON.stringify(payload) });
  },

  // ─── Department Expense Module ──────────────────────────────────────────────
  async getExpenses(params = {}) {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') query.append(k, v); });
    const qs = query.toString() ? `?${query.toString()}` : '';
    return request(`/expenses${qs}`);
  },
  async getExpenseAnalytics(params = {}) {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') query.append(k, v); });
    const qs = query.toString() ? `?${query.toString()}` : '';
    return request(`/expenses/analytics${qs}`);
  },
  async getNextExpenseVoucherNo() {
    return request('/expenses/next-number');
  },
  async createExpense(payload) {
    return request('/expenses', { method: 'POST', body: JSON.stringify(payload) });
  },
  async updateExpense(id, payload) {
    return request(`/expenses/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
  },
  async deleteExpense(id) {
    return request(`/expenses/${id}`, { method: 'DELETE' });
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

  // --- Stitching Settings Engine ---
  async getStitchingConfig() {
    return request('/stitching-config');
  },

  async updateStitchingConfig(data) {
    return request('/stitching-config/update', {
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

  async broadcastTodayData() {
    return request('/workspace/broadcast-today-data', {
      method: 'POST'
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
  async getFabricTransactions(params = {}) {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v) query.append(k, v); });
    const qs = query.toString() ? `?${query.toString()}` : '';
    return request(`/fabric/transactions${qs}`);
  },
  
  async getFabricStock(params = {}) {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v) query.append(k, v); });
    const qs = query.toString() ? `?${query.toString()}` : '';
    return request(`/fabric/stock${qs}`);
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
    const query = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v) query.append(k, v); });
    const qs = query.toString() ? `?${query.toString()}` : '';
    return request(`/fabric/lot-stock${qs}`);
  },

  async getFabricStockByPanna(params = {}) {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v) query.append(k, v); });
    const qs = query.toString() ? `?${query.toString()}` : '';
    return request(`/fabric/stock-panna${qs}`);
  },

  async downloadFabricLotWisePdf(dateStart = '', dateEnd = '', fileName = 'Fabric_LotWise_Stock_Report.pdf') {
    const baseUrl = getBaseUrl();
    const token = localStorage.getItem('elite_auth_token');
    const query = new URLSearchParams();
    if (dateStart) query.append('dateStart', dateStart);
    if (dateEnd) query.append('dateEnd', dateEnd);
    const qs = query.toString() ? `?${query.toString()}` : '';
    const response = await fetch(`${baseUrl}/fabric/report/lotwise-pdf${qs}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!response.ok) throw new Error('Failed to generate lot-wise fabric PDF');
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

  async getFabricInwardReportData(dateStart, dateEnd) {
    const q = new URLSearchParams();
    if (dateStart) q.append('dateStart', dateStart);
    if (dateEnd) q.append('dateEnd', dateEnd);
    const qs = q.toString() ? `?${q.toString()}` : '';
    return request(`/fabric/report/inward-data${qs}`);
  },

  async getFabricOutwardReportData(dateStart, dateEnd) {
    const q = new URLSearchParams();
    if (dateStart) q.append('dateStart', dateStart);
    if (dateEnd) q.append('dateEnd', dateEnd);
    const qs = q.toString() ? `?${q.toString()}` : '';
    return request(`/fabric/report/outward-data${qs}`);
  },

  async getFabricLotWiseReportData(dateStart, dateEnd) {
    const q = new URLSearchParams();
    if (dateStart) q.append('dateStart', dateStart);
    if (dateEnd) q.append('dateEnd', dateEnd);
    const qs = q.toString() ? `?${q.toString()}` : '';
    return request(`/fabric/report/lotwise-data${qs}`);
  },

  async downloadFabricInwardReportPdf(dateStart, dateEnd, fileName) {
    const baseUrl = getBaseUrl();
    const token = localStorage.getItem('elite_auth_token');
    const query = new URLSearchParams();
    if (dateStart) query.append('dateStart', dateStart);
    if (dateEnd) query.append('dateEnd', dateEnd);
    const qs = query.toString() ? `?${query.toString()}` : '';
    const response = await fetch(`${baseUrl}/fabric/report/inward-pdf${qs}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!response.ok) throw new Error('Failed to generate Fabric Inward PDF');
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

  async downloadFabricOutwardReportPdf(dateStart, dateEnd, fileName) {
    const baseUrl = getBaseUrl();
    const token = localStorage.getItem('elite_auth_token');
    const query = new URLSearchParams();
    if (dateStart) query.append('dateStart', dateStart);
    if (dateEnd) query.append('dateEnd', dateEnd);
    const qs = query.toString() ? `?${query.toString()}` : '';
    const response = await fetch(`${baseUrl}/fabric/report/outward-pdf${qs}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!response.ok) throw new Error('Failed to generate Fabric Outward PDF');
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

  async downloadFabricLotWiseReportPdf(dateStart, dateEnd, fileName) {
    const baseUrl = getBaseUrl();
    const token = localStorage.getItem('elite_auth_token');
    const query = new URLSearchParams();
    if (dateStart) query.append('dateStart', dateStart);
    if (dateEnd) query.append('dateEnd', dateEnd);
    const qs = query.toString() ? `?${query.toString()}` : '';
    const response = await fetch(`${baseUrl}/fabric/report/lotwise-pdf${qs}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!response.ok) throw new Error('Failed to generate Lot-Wise Fabric PDF');
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

  async downloadFabricCombinedReportPdf(dateStart, dateEnd, reportsArray, fileName, filters = {}) {
    const baseUrl = getBaseUrl();
    const token = localStorage.getItem('elite_auth_token');
    const query = new URLSearchParams();
    if (dateStart) query.append('dateStart', dateStart);
    if (dateEnd) query.append('dateEnd', dateEnd);
    if (reportsArray && reportsArray.length > 0) query.append('reports', reportsArray.join(','));
    if (filters.machineName) query.append('machineName', filters.machineName);
    if (filters.shift) query.append('shift', filters.shift);
    if (filters.operatorName || filters.operator) query.append('operator', filters.operatorName || filters.operator);
    if (filters.pass) query.append('pass', filters.pass);
    if (filters.startTime) query.append('startTime', filters.startTime);
    if (filters.stopTime) query.append('stopTime', filters.stopTime);

    const qs = query.toString() ? `?${query.toString()}` : '';
    const response = await fetch(`${baseUrl}/fabric/report/combined-pdf${qs}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!response.ok) {
      let errText = 'Failed to generate Combined Multi-Report PDF';
      try {
        const errJson = await response.json();
        if (errJson && (errJson.message || errJson.error)) errText = errJson.message || errJson.error;
      } catch (e) {}
      throw new Error(errText);
    }
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', fileName || 'Elite_Digital_Prints_Combined_Report.pdf');
    document.body.appendChild(link);
    link.click();
    link.parentNode.removeChild(link);
    window.URL.revokeObjectURL(url);
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
    if (params.status && params.status !== 'All') q.append('status', params.status);
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

  async downloadBulkFabricChallanPdf(ids = [], fileName = 'Combined_Fabric_Challans.pdf') {
    if (!ids || ids.length === 0) return;
    const baseUrl = getBaseUrl();
    const token = localStorage.getItem('elite_auth_token');
    const response = await fetch(`${baseUrl}/fabric-challan/bulk-pdf?ids=${ids.join(',')}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!response.ok) throw new Error('Failed to generate combined Fabric Challans PDF');
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

  async downloadChallanReportPdf(dateStart, dateEnd, search, fileName) {
    const baseUrl = getBaseUrl();
    const token = localStorage.getItem('elite_auth_token');
    const query = new URLSearchParams();
    if (dateStart) query.append('dateStart', dateStart);
    if (dateEnd) query.append('dateEnd', dateEnd);
    if (search) query.append('search', search);
    const qs = query.toString() ? `?${query.toString()}` : '';
    const response = await fetch(`${baseUrl}/fabric-challan/report/pdf${qs}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!response.ok) throw new Error('Failed to generate Fabric Challan report PDF');
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

  async getNextChallanNo() {
    return request('/fabric-challan/next-no');
  },

  async getFabricLotInfo(lotNo) {
    return request(`/fabric-challan/lot-info/${lotNo}`);
  },

  // ── Stitching Challan (PCH-1) ──────────────────────────────────────────────
  async getStitchingChallans(params = {}) {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') query.append(k, v); });
    const qs = query.toString() ? `?${query.toString()}` : '';
    return request(`/stitching-challan${qs}`);
  },
  async createStitchingChallan(data) {
    return request('/stitching-challan', { method: 'POST', body: JSON.stringify(data) });
  },
  async updateStitchingChallan(id, data) {
    return request(`/stitching-challan/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  },
  async deleteStitchingChallan(id) {
    return request(`/stitching-challan/${id}`, { method: 'DELETE' });
  },
  async getNextStitchingChallanNo() {
    return request('/stitching-challan/next-no');
  },
  async downloadStitchingChallanPdf(id, challanNo) {
    const baseUrl = getBaseUrl();
    const token = localStorage.getItem('elite_auth_token');
    const response = await fetch(`${baseUrl}/stitching-challan/${id}/pdf`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!response.ok) throw new Error('Failed to generate Stitching Challan PDF');
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Stitching_Challan_${challanNo || 'PCH'}.pdf`);
    document.body.appendChild(link);
    link.click();
    link.parentNode.removeChild(link);
    window.URL.revokeObjectURL(url);
  },

  async downloadBulkStitchingChallanPdf(ids = [], fileName = 'Combined_Stitching_Challans.pdf') {
    if (!ids || ids.length === 0) return;
    const baseUrl = getBaseUrl();
    const token = localStorage.getItem('elite_auth_token');
    const response = await fetch(`${baseUrl}/stitching-challan/bulk-pdf?ids=${ids.join(',')}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!response.ok) throw new Error('Failed to generate combined Stitching Challans PDF');
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

  // ── Stock Adjustment (SA) ──────────────────────────────────────────────
  async getStockAdjustments() {
    return request('/fabric/stock-adjustment');
  },

  async createStockAdjustment(data) {
    return request('/fabric/stock-adjustment', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateStockAdjustment(id, data) {
    return request(`/fabric/stock-adjustment/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async deleteStockAdjustment(id) {
    return request(`/fabric/stock-adjustment/${id}`, { method: 'DELETE' });
  },

  async downloadStockAdjustmentPdf(id, saNo) {
    const baseUrl = getBaseUrl();
    const token = localStorage.getItem('elite_auth_token');
    const response = await fetch(`${baseUrl}/fabric/stock-adjustment/${id}/pdf`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!response.ok) throw new Error('Failed to generate Stock Adjustment PDF');
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Stock_Adjustment_${saNo || 'Voucher'}.pdf`);
    document.body.appendChild(link);
    link.click();
    link.parentNode.removeChild(link);
  },

  // ── Lot Transfer ───────────────────────────────────────────────────────
  async getLotTransfers() {
    return request('/fabric/lot-transfer');
  },

  async createLotTransfer(data) {
    return request('/fabric/lot-transfer', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async autoLotTransfer() {
    return request('/fabric/auto-lot-transfer', {
      method: 'POST',
    });
  },

  // ── Billing & Invoicing Department ───────────────────────────────────────
  async getBillingDashboardStats() {
    return request('/billing/dashboard-stats');
  },

  async getBillingInvoices(params = {}) {
    const query = new URLSearchParams(params);
    return request(`/billing/invoices?${query.toString()}`);
  },

  async getNextInvoiceNo() {
    return request('/billing/invoices/next-no');
  },

  async getBillingInvoiceById(id) {
    return request(`/billing/invoices/${id}`);
  },

  async createBillingInvoice(data) {
    return request('/billing/invoices', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async mergeChallansToInvoice(challanIds) {
    return request('/billing/merge-challans', {
      method: 'POST',
      body: JSON.stringify({ challanIds }),
    });
  },

  async updateBillingInvoice(id, data) {
    return request(`/billing/invoices/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async deleteBillingInvoice(id) {
    return request(`/billing/invoices/${id}`, { method: 'DELETE' });
  },

  async recordInvoicePayment(id, data) {
    return request(`/billing/invoices/${id}/payment`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async downloadInvoicePdf(id, invoiceNo, duplicate = false) {
    const t0 = performance.now();
    const baseUrl = getBaseUrl();
    const token = localStorage.getItem('elite_auth_token');
    const url = `${baseUrl}/billing/invoices/${id}/pdf${duplicate ? '?duplicate=true' : ''}`;
    const response = await fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!response.ok) throw new Error('Failed to generate Invoice PDF');
    const blob = await response.blob();
    const objUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objUrl;
    link.setAttribute('download', `Tax_Invoice_${invoiceNo || 'Draft'}${duplicate ? '_with_Duplicate' : ''}.pdf`);
    document.body.appendChild(link);
    link.click();
    link.parentNode.removeChild(link);
    window.URL.revokeObjectURL(objUrl);
    console.log(`[PDF Download] Generated & downloaded in ${(performance.now() - t0).toFixed(0)}ms`);
  },

  async downloadBulkInvoicesPdf(ids = [], fileName = 'Combined_Invoices.pdf') {
    if (!ids || ids.length === 0) return;
    const t0 = performance.now();
    const baseUrl = getBaseUrl();
    const token = localStorage.getItem('elite_auth_token');
    const url = `${baseUrl}/billing/invoices-bulk-pdf?ids=${ids.join(',')}`;
    const response = await fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!response.ok) throw new Error('Failed to generate combined Invoices PDF');
    const blob = await response.blob();
    const objUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objUrl;
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    link.parentNode.removeChild(link);
    window.URL.revokeObjectURL(objUrl);
    console.log(`[Bulk PDF Download] Generated & downloaded combined PDF in ${(performance.now() - t0).toFixed(0)}ms`);
  },

  // Billing Customers
  async getBillingCustomers() {
    return request('/billing/customers');
  },

  async createBillingCustomer(data) {
    return request('/billing/customers', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateBillingCustomer(id, data) {
    return request(`/billing/customers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async deleteBillingCustomer(id) {
    return request(`/billing/customers/${id}`, { method: 'DELETE' });
  },

  // Billing Items
  async getBillingItems() {
    return request('/billing/items');
  },

  async createBillingItem(data) {
    return request('/billing/items', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateBillingItem(id, data) {
    return request(`/billing/items/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async deleteBillingItem(id) {
    return request(`/billing/items/${id}`, { method: 'DELETE' });
  },

  // Data Backup
  async downloadDataBackup({ startDate, endDate, department, format = 'json' }) {
    const baseUrl = getBaseUrl();
    const token = localStorage.getItem('elite_auth_token');
    const params = new URLSearchParams({
      ...(startDate ? { startDate } : {}),
      ...(endDate ? { endDate } : {}),
      ...(department ? { department } : {}),
      format
    });
    const res = await fetch(`${baseUrl}/backup/download?${params.toString()}`, {
      headers: {
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      }
    });
    if (!res.ok) {
      throw new Error('Failed to generate data backup');
    }
    const blob = await res.blob();
    const filename = `Elite_Edition_Backup_${department || 'All'}_${startDate || 'Start'}_to_${endDate || 'End'}.${format === 'csv' ? 'csv' : 'json'}`;
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  },

  // ── Authority-Based Inter-Department Communication ───────────────────────
  async getCommunicationGroups() {
    const user = this.getCurrentUser();
    const uId = user ? (user._id || user.id) : '';
    const qs = uId ? `?userId=${uId}` : '';
    return request(`/communication/groups${qs}`);
  },

  async getCommunicationMessages(groupId, params = {}) {
    const queryParams = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') queryParams.append(k, v); });
    const qs = queryParams.toString() ? `?${queryParams.toString()}` : '';
    return request(`/communication/groups/${groupId}/messages${qs}`);
  },

  async getCommunicationMembers(groupId) {
    return request(`/communication/groups/${groupId}/members`);
  },

  async syncCommunicationGroups() {
    return request('/communication/groups/sync', { method: 'POST' });
  },

  async postActivityEvent(data) {
    return request('/communication/activity', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async acknowledgeCommunicationMessage(messageId, action = 'acknowledged', userData = {}) {
    return request(`/communication/messages/${messageId}/acknowledge`, {
      method: 'POST',
      body: JSON.stringify({ action, ...userData }),
    });
  },

  async getCommunicationUsers() {
    const user = this.getCurrentUser();
    const uId = user ? (user._id || user.id) : '';
    const qs = uId ? `?userId=${uId}` : '';
    return request(`/communication/users${qs}`);
  },

  async createOrGetDirectRoom(targetUserId, currentUserId) {
    const user = this.getCurrentUser();
    const uId = currentUserId || (user ? (user._id || user.id) : '');
    return request('/communication/direct', {
      method: 'POST',
      body: JSON.stringify({ targetUserId, userId: uId }),
    });
  },

  async createCommunicationGroup(data) {
    return request('/communication/groups', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async deleteCommunicationGroup(groupId) {
    return request(`/communication/groups/${groupId}`, {
      method: 'DELETE',
    });
  },

  async forceReloadAllUsers() {
    return request('/communication/force-reload-all', {
      method: 'POST',
    });
  },
};




