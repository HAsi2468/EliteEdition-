import { downloadOrPreviewPdf } from '../utils/pdfDownloadService';
import { silentAuth } from './authInterceptor';

// API Base URL management
const DEFAULT_URL = '/v1';

export const getBaseUrl = () => {
  localStorage.removeItem('elite_api_base_url');
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

// CSRF Token Resolver & Injector for State-Changing Requests (Phase 3)
let inMemoryCsrfToken = null;
let csrfRefreshPromise = null;

export const getCsrfTokenFromCookie = () => {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(/(?:^|;\s*)(?:XSRF-TOKEN|csrf_token)=([^;]+)/);
  if (match && match[1]) {
    try {
      return decodeURIComponent(match[1]);
    } catch (e) {
      return match[1];
    }
  }
  return null;
};

export const fetchCsrfToken = async () => {
  if (csrfRefreshPromise) return csrfRefreshPromise;
  csrfRefreshPromise = (async () => {
    try {
      const baseUrl = getBaseUrl();
      const res = await fetch(`${baseUrl}/auth/csrf-token`, {
        method: 'GET',
        credentials: 'include',
        headers: { 'Cache-Control': 'no-cache' },
      });
      if (res.ok) {
        const data = await res.json();
        const token = data.csrfToken || data.token || getCsrfTokenFromCookie();
        if (token) {
          inMemoryCsrfToken = token;
          return token;
        }
      }
    } catch (e) {
      console.warn('[CSRF] Failed to fetch fresh CSRF token:', e?.message || e);
    } finally {
      csrfRefreshPromise = null;
    }
    return inMemoryCsrfToken || getCsrfTokenFromCookie();
  })();
  return csrfRefreshPromise;
};

/**
 * Generates a cryptographically strong UUIDv4 for Idempotency-Key headers
 */
export const generateIdempotencyKey = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'idem_' + Math.random().toString(36).substring(2, 15) + '_' + Date.now();
};

/**
 * Calculates exponential backoff with full randomized jitter
 * Fast Exponential Backoff with Jitter for Transient Network/Server Reloads:
 * Attempt 1: 250ms, Attempt 2: 750ms, Attempt 3: 2000ms
 */
const getBackoffDelay = (attempt) => {
  const baseDelays = [250, 750, 2000];
  const base = baseDelays[attempt - 1] || 2000;
  const jitter = Math.floor(Math.random() * (base * 0.2)); // 20% random jitter
  return base + jitter;
};

// Generic request wrapper with Auto-Retry, Timeout & Safe Error Parser
const request = async (path, options = {}) => {
  const method = (options.method || 'GET').toUpperCase();
  const isMutating = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);
  
  // Resolve or generate Idempotency-Key for mutating requests
  let idempotencyKey =
    options.headers?.['Idempotency-Key'] ||
    options.headers?.['idempotency-key'] ||
    options.idempotencyKey ||
    null;

  if (isMutating && !idempotencyKey) {
    idempotencyKey = generateIdempotencyKey();
  }

  // Idempotent requests (GET, HEAD, OPTIONS) or mutations backed by an Idempotency-Key may be retried
  const canRetry = !isMutating || Boolean(idempotencyKey);
  const maxRetries = options.maxRetries ?? (canRetry ? 3 : 0);
  let attempt = 0;

  while (attempt <= maxRetries) {
    attempt++;
    const baseUrl = getBaseUrl();
    const token = localStorage.getItem('elite_auth_token');

    // Note: Do not prematurely block on navigator.onLine if retrying; browsers frequently report
    // false negatives on wake-from-sleep or WiFi reconnect handoffs. Let fetch attempt or retry handle it.
    
    const userStr = localStorage.getItem('elite_user');
    let currUser = null;
    if (userStr) {
      try { currUser = JSON.parse(userStr); } catch (e) {}
    }
    const uId = currUser?.id || currUser?._id || '';
    const uName = currUser?.name || currUser?.fullName || currUser?.username || '';
    const uRole = currUser?.role || (currUser?.isAdmin || currUser?.isMainAdmin ? 'admin' : '');

    const activeCompanyId = localStorage.getItem('elite_active_department') || '';

    let csrfToken = null;
    if (isMutating) {
      csrfToken = inMemoryCsrfToken || getCsrfTokenFromCookie();
      if (!csrfToken && typeof window !== 'undefined') {
        csrfToken = await fetchCsrfToken();
      }
    }

    const headers = {
      ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      ...(uId ? { 'X-User-Id': uId } : {}),
      ...(uName ? { 'X-User-Name': uName } : {}),
      ...(uRole ? { 'X-User-Role': uRole } : {}),
      ...(uRole === 'admin' || currUser?.isAdmin || currUser?.isMainAdmin ? { 'X-Operator-Override': 'true', 'X-Is-Admin': 'true' } : {}),
      ...(activeCompanyId ? { 'X-Company-Id': activeCompanyId } : {}),
      ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
      ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Pragma': 'no-cache',
      ...options.headers,
    };
    
    const timeoutMs = options.timeout || 120000;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    let response;
    try {
      response = await fetch(`${baseUrl}${path}`, {
        ...options,
        credentials: options.credentials || 'include',
        cache: 'no-store',
        headers,
        signal: options.signal || controller.signal,
      });
    } catch (err) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        if (options.signal?.aborted) {
          const cancelErr = new Error('Request canceled by navigation or search filter change');
          cancelErr.name = 'AbortError';
          cancelErr.isCanceled = true;
          throw cancelErr;
        }
        throw new Error(`Request timed out after ${Math.round(timeoutMs / 1000)}s.`);
      }

      // Check if transient network error during server reload or internet glitch
      const isTransient = err.message && (
        err.message.includes('Failed to fetch') ||
        err.message.includes('NetworkError') ||
        err.message.includes('Load failed') ||
        err.message.includes('offline') ||
        err.message.includes('fetch failed') ||
        err.message.includes('Network request failed')
      );

      if (isTransient && attempt <= maxRetries && canRetry) {
        const delay = getBackoffDelay(attempt);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      throw new Error(err.message || 'Server connection failed. Please check network.');
    } finally {
      clearTimeout(timeoutId);
    }

    // Auto-refresh CSRF token if rejected due to expiration or missing token
    if (response.status === 403 && isMutating && !options._csrfRetried) {
      try {
        const cloned = response.clone();
        const errJson = await cloned.json();
        if (errJson?.error && typeof errJson.error === 'string' && errJson.error.startsWith('CSRF_TOKEN_')) {
          inMemoryCsrfToken = null;
          await fetchCsrfToken();
          return request(path, { ...options, _csrfRetried: true, headers: { ...options.headers, 'Idempotency-Key': idempotencyKey } });
        }
      } catch (e) {}
    }

    // Auto-refresh expired JWT via SilentAuthInterceptor on 401 Unauthorized
    const isAuthRoute = path.includes('/auth/login') || path.includes('/auth/refresh') || path.includes('/auth/register');
    if (response.status === 401 && !options._authRetried && !isAuthRoute) {
      try {
        const freshAccessToken = await silentAuth.getFreshAccessToken();
        return request(path, {
          ...options,
          _authRetried: true,
          headers: {
            ...options.headers,
            'Authorization': `Bearer ${freshAccessToken}`,
            ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {})
          }
        });
      } catch (refreshErr) {
        throw new Error('Your session has expired. Please log in again.');
      }
    }
    
    // If server is reloading during deployment, status code is 502, 503, or 504
    if ((response.status === 502 || response.status === 503 || response.status === 504) && attempt <= maxRetries && canRetry) {
      const delay = getBackoffDelay(attempt);
      await new Promise(r => setTimeout(r, delay));
      continue;
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
    
    const json = await response.json();
    if (json && json.requiresApproval) {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('elite-approval-submitted', { detail: json }));
        window.dispatchEvent(new CustomEvent('elite-data-refresh'));
      }
      import('../components/NotificationToast').then(({ triggerPushNotification }) => {
        triggerPushNotification(
          '🛡️ Submitted for Admin Approval',
          json.message || 'Your changes have been submitted to the Admin Review & Approvals Queue.',
          'info'
        );
      }).catch(() => {});
    }
    return json;
  }
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
    localStorage.removeItem('elite_is_client');
    localStorage.removeItem('elite_client_data');
    try {
      import('../utils/crossTabSync').then(m => m.broadcastCrossTab('AUTH_LOGOUT'));
    } catch (_) {}
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

    if (this.isClientUser()) {
      try {
        let clientData = null;

        // 1. Prioritize lookup by mobile number to auto-heal stale IDs
        if (user.mobile) {
          const cRes = await this.getClients({ search: user.mobile }).catch(() => null);
          const list = cRes?.data || [];
          clientData = list.find((c) => c.mobile === user.mobile) || list[0];
        }

        // 2. Lookup by username if still not found
        if (!clientData && (user.username || user.name)) {
          const query = user.username || user.name;
          const cRes = await this.getClients({ search: query }).catch(() => null);
          const list = cRes?.data || [];
          clientData = list.find((c) => c.username === query) || list[0];
        }

        // 3. Fallback to getClientById if id exists and no clientData found
        if (!clientData && userId) {
          const res = await this.getClientById(userId).catch(() => null);
          if (res && (res.data || res.client)) {
            clientData = res.data || res.client;
          }
        }

        if (clientData) {
          const updated = {
            ...user,
            ...clientData,
            id: clientData._id || userId,
            role: 'Client',
            isClient: true
          };
          localStorage.setItem('elite_user', JSON.stringify(updated));
          localStorage.setItem('elite_client_data', JSON.stringify(clientData));
          return updated;
        }
      } catch (e) {
        console.warn('Failed to refresh client user profile:', e);
      }
      return user;
    }

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

  async getInventory(search = '', facility = '') {
    const params = [];
    if (search) params.push(`search=${encodeURIComponent(search)}`);
    if (facility && facility !== 'All') params.push(`facility=${encodeURIComponent(facility)}`);
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

  // Storage Facilities
  async getFacilities() {
    return request('/facilities');
  },

  async createFacility(data) {
    return request('/facilities', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateFacility(id, data) {
    return request(`/facilities/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async deleteFacility(id) {
    return request(`/facilities/${id}`, {
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
    return request('/products/list?limit=10000');
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

  async resetAndSyncUniwareSkus() {
    return request('/products/reset-and-sync-uniware-skus', {
      method: 'POST',
    });
  },

  // Stock Out Logs
  async getStockOuts(facility = '') {
    const params = new URLSearchParams();
    if (facility && facility !== 'All') params.append('facility', facility);
    const query = params.toString() ? `?${params.toString()}` : '';
    return request(`/stockOut${query}`);
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
    downloadOrPreviewPdf(blob, fileName);
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
    downloadOrPreviewPdf(blob, fileName);
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
    downloadOrPreviewPdf(blob, fileName);
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
    downloadOrPreviewPdf(blob, fileName);
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
    downloadOrPreviewPdf(blob, fileName);
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
    downloadOrPreviewPdf(blob, fileName);
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
    downloadOrPreviewPdf(blob, fileName);
  },

  // Raw Report Data
  async getStockValueReportData() {
    return request('/inventory/report/stock-value-data');
  },

  async getStockInwardReportData(dateStart, dateEnd, facility = '') {
    const params = new URLSearchParams();
    if (dateStart) params.append('dateStart', dateStart);
    if (dateEnd) params.append('dateEnd', dateEnd);
    if (facility && facility !== 'All') params.append('facility', facility);
    return request(`/inventory/report/stock-inward-data?${params.toString()}`);
  },

  async getStockOutwardReportData(dateStart, dateEnd, facility = '') {
    const params = new URLSearchParams();
    if (dateStart) params.append('dateStart', dateStart);
    if (dateEnd) params.append('dateEnd', dateEnd);
    if (facility && facility !== 'All') params.append('facility', facility);
    return request(`/inventory/report/stock-outward-data?${params.toString()}`);
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
    downloadOrPreviewPdf(blob, fileName, { title: 'Elite Print Report' });
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
  async getJobCard(id) {
    return request(`/jobCards/${id}`);
  },
  async createJobCard(data) {
    return request('/jobCards', { method: 'POST', body: JSON.stringify(data) });
  },
  async placeClientBulkOrder(data) {
    return request('/jobCards/client-bulk-order', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },
  async updateJobCard(id, data) {
    return request(`/jobCards/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  },
  async deleteJobCard(id) {
    return request(`/jobCards/${id}`, { method: 'DELETE' });
  },
  async syncFusingFromDelivery(cardId = null) {
    return request('/jobCards/sync-fusing-from-delivery', {
      method: 'POST',
      body: JSON.stringify(cardId ? { cardId } : {})
    });
  },
  async downloadJobCardPdf(id, jobNo = '') {
    const baseUrl = getBaseUrl();
    const token = localStorage.getItem('elite_auth_token') || localStorage.getItem('token');
    const response = await fetch(`${baseUrl}/jobCards/pdf/${id}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!response.ok) throw new Error('Failed to download Job Card PDF');
    const blob = await response.blob();
    downloadOrPreviewPdf(blob, `JobCard_${jobNo || 'preview'}.pdf`, { title: `Job Card #${jobNo || id}` });
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
    downloadOrPreviewPdf(blob, fileName, { title: 'Combined Job Cards' });
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

  // ─── Machine Fusing Logs ──────────────────────────────────────────────────
  async createJobFusingLog(data) {
    return request('/jobFusingLogs', { method: 'POST', body: JSON.stringify(data) });
  },
  async getJobFusingLogs(params = {}) {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') query.append(k, v); });
    const qs = query.toString() ? `?${query.toString()}` : '';
    return request(`/jobFusingLogs${qs}`);
  },
  async getJobCardFusingLogs(jobNoOrId) {
    return request(`/jobFusingLogs/job/${jobNoOrId}`);
  },
  async updateJobFusingLog(id, data) {
    return request(`/jobFusingLogs/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  },
  async deleteJobFusingLog(id) {
    return request(`/jobFusingLogs/${id}`, { method: 'DELETE' });
  },

  // ─── Design Catalogue & Cloudflare R2 Uploads ──────────────────────────────────────
  async uploadImage(file, folder = 'designs') {
    if (file) {
      const name = file.name || '';
      const type = (file.type || '').toLowerCase();
      if (/\.tiff?$/i.test(name) || type === 'image/tiff' || type === 'image/tif') {
        throw new Error('TIFF files (.tif, .tiff) are not allowed. Please upload JPG, PNG, WEBP, or standard image formats.');
      }
    }

    let fileName = file?.name || 'upload.jpg';
    if (!/\.[a-zA-Z0-9]+$/.test(fileName) || fileName === 'blob') {
      const type = (file?.type || '').toLowerCase();
      let ext = '.jpg';
      if (type.includes('png')) ext = '.png';
      else if (type.includes('webp')) ext = '.webp';
      else if (type.includes('gif')) ext = '.gif';
      else if (type.includes('pdf')) ext = '.pdf';
      fileName = `${fileName === 'blob' ? 'upload' : fileName}${ext}`;
    }

    const formData = new FormData();
    formData.append('image', file, fileName);
    if (folder) formData.append('folder', folder);

    return request('/upload', {
      method: 'POST',
      body: formData
    });
  },

  async uploadDesignerImage(file, folder = 'sample_reference') {
    return this.uploadImage(file, folder);
  },

  async uploadComplaintAttachment(file, department = 'Digital_Print') {
    const cleanDept = String(department || 'General')
      .trim()
      .replace(/[^a-zA-Z0-9_\-\s]/g, '')
      .replace(/\s+/g, '_');
    const folder = `Complaints/${cleanDept}`;
    return this.uploadImage(file, folder);
  },

  async uploadChatAttachment(file, roomName = 'General') {
    const cleanRoom = String(roomName || 'General')
      .trim()
      .replace(/[^a-zA-Z0-9_\-\s]/g, '')
      .replace(/\s+/g, '_');
    const folder = `Chat/${cleanRoom}`;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('folder', folder);

    return request('/workspace/upload', {
      method: 'POST',
      body: formData
    });
  },



  async getDesigns(params = {}) {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') query.append(k, v); });
    const qs = query.toString() ? `?${query.toString()}` : '';
    return request(`/designs${qs}`);
  },
  async getDesignCatalogue(params = {}) {
    return this.getDesigns(params);
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
  async getNextComplaintNumber(companyEntity) {
    const qs = companyEntity ? `?companyEntity=${encodeURIComponent(companyEntity)}` : '';
    return request(`/complaints/next-number${qs}`);
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
  async getLedgerSummary(params = {}) {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') query.append(k, v); });
    const qs = query.toString() ? `?${query.toString()}` : '';
    return request(`/expenses/ledger-summary${qs}`);
  },
  async getLedgerSettings(params = {}) {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') query.append(k, v); });
    const qs = query.toString() ? `?${query.toString()}` : '';
    return request(`/expenses/ledger-settings${qs}`);
  },
  async saveLedgerSettings(payload) {
    return request('/expenses/ledger-settings', { method: 'POST', body: JSON.stringify(payload) });
  },
  async getNextExpenseVoucherNo(companyEntity) {
    const qs = companyEntity ? `?companyEntity=${encodeURIComponent(companyEntity)}` : '';
    return request(`/expenses/next-number${qs}`);
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

  // ─── Monthly Costing & P&L Module ───────────────────────────────────────────
  async getMonthlyCostingReport(params = {}) {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') query.append(k, v); });
    const qs = query.toString() ? `?${query.toString()}` : '';
    return request(`/costing/monthly-report${qs}`);
  },
  async saveMonthlyCostingOverheads(payload) {
    return request('/costing/monthly-overheads', { method: 'POST', body: JSON.stringify(payload) });
  },

  // ─── Elite Digital Prints Master Operations Dashboard ────────────────────────
  async getDigitalPrintDashboard(params = {}) {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') query.append(k, v); });
    const qs = query.toString() ? `?${query.toString()}` : '';
    return request(`/digital-print/dashboard${qs}`);
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
  async lookupUniwareOrder(data) {
    return request('/returns/lookup-order', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

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

  async getSystemLockStatus() {
    return request('/print-config/system-lock');
  },

  async setSystemLockStatus(isSystemLocked, message = '') {
    return request('/print-config/system-lock', {
      method: 'POST',
      body: JSON.stringify({ isSystemLocked, message }),
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

  // --- Workspace (Chat & Task) backwards compatibility with communication groups ---
  async getRooms(userId) {
    return this.getCommunicationGroups();
  },
  
  async createRoom(data) {
    return this.createCommunicationGroup(data);
  },

  async broadcastTodayData() {
    return request('/workspace/broadcast-today-data', {
      method: 'POST'
    });
  },

  async getRoomMessages(roomId, before = '') {
    return this.getCommunicationMessages(roomId);
  },

  async sendRoomMessage(roomId, data) {
    return this.sendCommunicationMessage(roomId, data);
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

  // White Fabric QA Inspection Logs
  async getWhiteFabricLogs(params = {}) {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v) query.append(k, v); });
    const qs = query.toString() ? `?${query.toString()}` : '';
    return request(`/fabric/white-qa-logs${qs}`);
  },
  async createWhiteFabricLog(data) {
    return request('/fabric/white-qa-logs', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },
  async deleteWhiteFabricLog(id) {
    return request(`/fabric/white-qa-logs/${id}`, {
      method: 'DELETE'
    });
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
    downloadOrPreviewPdf(blob, fileName, { title: 'Fabric Lot-Wise Stock Report' });
  },

  async downloadSingleLotPdf(lotNo, fileName) {
    const baseUrl = getBaseUrl();
    const token = localStorage.getItem('elite_auth_token');
    const safeLotNo = encodeURIComponent(String(lotNo || '').trim());
    const response = await fetch(`${baseUrl}/fabric/report/lot-statement-pdf/${safeLotNo}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!response.ok) throw new Error('Failed to generate lot statement PDF');
    const blob = await response.blob();
    downloadOrPreviewPdf(blob, fileName || `Fabric_Lot_${lotNo}_Statement.pdf`, { title: `Fabric Lot ${lotNo} Statement` });
  },

  async getFabricRequirement(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return request(`/fabric/requirement${qs ? `?${qs}` : ''}`);
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
    const token = localStorage.getItem('elite_auth_token') || localStorage.getItem('token');
    const query = new URLSearchParams();
    if (params.dateStart) query.append('dateStart', params.dateStart);
    if (params.dateEnd) query.append('dateEnd', params.dateEnd);
    if (params.fabricQuality && params.fabricQuality !== 'All') query.append('fabricQuality', params.fabricQuality);
    const qs = query.toString() ? `?${query.toString()}` : '';

    const response = await fetch(`${baseUrl}/fabric/report/pdf${qs}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!response.ok) {
      let errText = 'Failed to generate Fabric Ledger PDF';
      try {
        const errJson = await response.json();
        if (errJson && (errJson.message || errJson.error)) errText = errJson.message || errJson.error;
      } catch (e) {}
      throw new Error(errText);
    }
    const blob = await response.blob();
    downloadOrPreviewPdf(blob, `fabric-ledger${params.dateStart ? '-' + params.dateStart : ''}.pdf`, { title: 'Fabric Ledger' });
  },

  // Raw Materials Inventory
  async getRawMaterialTransactions() {
    return request('/raw-materials/transactions');
  },

  async getRawMaterialStock(params = {}) {
    const query = new URLSearchParams(params).toString();
    return request(`/raw-materials/stock${query ? `?${query}` : ''}`);
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
    const token = localStorage.getItem('elite_auth_token') || localStorage.getItem('token');
    const query = new URLSearchParams();
    if (params.dateStart) query.append('dateStart', params.dateStart);
    if (params.dateEnd) query.append('dateEnd', params.dateEnd);
    if (params.materialName && params.materialName !== 'All') query.append('materialName', params.materialName);
    if (params.type && params.type !== 'All') query.append('type', params.type);
    if (params.search) query.append('search', params.search);
    if (params.companyEntity) query.append('companyEntity', params.companyEntity);
    const qs = query.toString() ? `?${query.toString()}` : '';

    const response = await fetch(`${baseUrl}/raw-materials/report/pdf${qs}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!response.ok) {
      let errText = 'Failed to generate Raw Materials Ledger PDF';
      try {
        const errJson = await response.json();
        if (errJson && (errJson.message || errJson.error)) errText = errJson.message || errJson.error;
      } catch (e) {}
      throw new Error(errText);
    }
    const blob = await response.blob();
    const typeTag = params.type && params.type !== 'All' ? `-${params.type.toLowerCase()}` : '';
    const fileName = `raw-materials${typeTag}-ledger${params.dateStart ? '-' + params.dateStart : ''}.pdf`;
    downloadOrPreviewPdf(blob, fileName, { title: 'Raw Materials Ledger' });
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
    downloadOrPreviewPdf(blob, fileName, { title: 'Fabric Inward Report' });
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
    downloadOrPreviewPdf(blob, fileName, { title: 'Fabric Outward Report' });
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
    downloadOrPreviewPdf(blob, fileName, { title: 'Fabric Lot-Wise Report' });
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
    downloadOrPreviewPdf(blob, fileName || 'Elite_Digital_Prints_Combined_Report.pdf', { title: 'Digital Prints Combined Report' });
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

  async getAwsLiveCost(params = {}) {
    const q = new URLSearchParams();
    if (params.startDate) q.append('startDate', params.startDate);
    if (params.endDate) q.append('endDate', params.endDate);
    if (params.exchangeRate) q.append('exchangeRate', params.exchangeRate);
    const qs = q.toString() ? `?${q.toString()}` : '';
    return request(`/infra-bills/aws-live${qs}`, { method: 'GET' });
  },

  async syncAwsCosts(payload = {}) {
    return request('/infra-bills/aws-sync', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async downloadInfraBillInvoicePdf(id, month) {
    const baseUrl = getBaseUrl();
    const token = localStorage.getItem('elite_auth_token');
    const url = `${baseUrl}/infra-bills/${id}/invoice-pdf`;
    const response = await fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!response.ok) throw new Error('Failed to download Infrastructure Invoice PDF');
    const blob = await response.blob();
    const safeMonth = (month || 'Bill').replace(/\s+/g, '_');
    const fileName = `Infrastructure_Invoice_${safeMonth}.pdf`;
    downloadOrPreviewPdf(blob, fileName, { title: `Infrastructure Invoice - ${month || ''}` });
  },

  async recordInfraBillPayment(id, payload) {
    return request(`/infra-bills/${id}/pay`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
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
    downloadOrPreviewPdf(blob, `Challan_${challanNo || 'preview'}.pdf`, { title: `Fabric Challan #${challanNo || id}` });
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
    downloadOrPreviewPdf(blob, fileName, { title: 'Combined Fabric Challans' });
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
    downloadOrPreviewPdf(blob, fileName, { title: 'Fabric Challan Report' });
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
    downloadOrPreviewPdf(blob, `Stitching_Challan_${challanNo || 'PCH'}.pdf`, { title: `Stitching Challan #${challanNo || 'PCH'}` });
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
    downloadOrPreviewPdf(blob, fileName, { title: 'Combined Stitching Challans' });
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

  async deleteLotTransfer(refId) {
    return request(`/fabric/lot-transfer/${encodeURIComponent(refId)}`, {
      method: 'DELETE',
    });
  },

  // ── Billing & Invoicing Department ───────────────────────────────────────
  async getBillingDashboardStats(companyEntity = 'Elite Online') {
    return request(`/billing/dashboard-stats?companyEntity=${encodeURIComponent(companyEntity)}`);
  },

  async getBillingInvoices(params = {}) {
    const query = new URLSearchParams(params);
    return request(`/billing/invoices?${query.toString()}`);
  },

  async getNextInvoiceNo(companyEntity = 'Elite Online') {
    return request(`/billing/invoices/next-no?companyEntity=${encodeURIComponent(companyEntity)}`);
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
    const pdfName = `Tax_Invoice_${invoiceNo || 'Draft'}${duplicate ? '_with_Duplicate' : ''}.pdf`;
    downloadOrPreviewPdf(blob, pdfName, { title: `Tax Invoice #${invoiceNo || 'Draft'}` });
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
    downloadOrPreviewPdf(blob, fileName, { title: 'Combined Invoices' });
    console.log(`[Bulk PDF Download] Generated & downloaded combined PDF in ${(performance.now() - t0).toFixed(0)}ms`);
  },

  // Billing Customers
  async getBillingCustomers(companyEntity = 'Elite Online') {
    return request(`/billing/customers?companyEntity=${encodeURIComponent(companyEntity)}`);
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

  // Billing Vendors
  async getBillingVendors(companyEntity = 'Elite Digital Prints') {
    return request(`/billing/vendors?companyEntity=${encodeURIComponent(companyEntity)}`);
  },

  async createBillingVendor(data) {
    return request('/billing/vendors', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateBillingVendor(id, data) {
    return request(`/billing/vendors/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async deleteBillingVendor(id) {
    return request(`/billing/vendors/${id}`, { method: 'DELETE' });
  },

  // Billing Items
  async getBillingItems(companyEntity = 'Elite Online') {
    return request(`/billing/items?companyEntity=${encodeURIComponent(companyEntity)}`);
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

  // Company Settings
  async getCompanySettings(companyEntity = 'Elite Online') {
    return request(`/billing/company-settings?companyEntity=${encodeURIComponent(companyEntity)}`);
  },

  async updateCompanySettings(data) {
    return request('/billing/company-settings', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  // Purchases CRUD
  async getBillingPurchases(companyEntity = '', search = '') {
    const query = new URLSearchParams();
    if (companyEntity) query.append('companyEntity', companyEntity);
    if (search) query.append('search', search);
    return request(`/billing/purchases?${query.toString()}`);
  },

  async createBillingPurchase(data) {
    return request('/billing/purchases', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async bulkSyncBillingPurchases(purchases) {
    return request('/billing/purchases/bulk-sync', {
      method: 'POST',
      body: JSON.stringify({ purchases }),
    });
  },

  async updateBillingPurchase(id, data) {
    return request(`/billing/purchases/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async deleteBillingPurchase(id, params = {}) {
    const q = new URLSearchParams();
    if (params.purchaseNo) q.append('purchaseNo', params.purchaseNo);
    if (params.vendorName) q.append('vendorName', params.vendorName);
    const qs = q.toString() ? `?${q.toString()}` : '';
    return request(`/billing/purchases/${id}${qs}`, { method: 'DELETE' });
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
    setTimeout(() => {
      window.URL.revokeObjectURL(url);
    }, 2000);
  },

  async getDailyBackupHistory() {
    return request('/backup/history');
  },

  async downloadDailyBackupArchive(fileName) {
    const baseUrl = getBaseUrl();
    const token = localStorage.getItem('elite_auth_token');
    const res = await fetch(`${baseUrl}/backup/download-archive/${encodeURIComponent(fileName)}`, {
      headers: {
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      }
    });
    if (!res.ok) {
      throw new Error(`Failed to download backup archive: ${res.statusText}`);
    }
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => {
      window.URL.revokeObjectURL(url);
    }, 2000);
  },

  async sendBackupEmail({ fileName, recipients } = {}) {
    return request('/backup/send-email', {
      method: 'POST',
      body: JSON.stringify({ fileName, recipients }),
    });
  },

  async getImagesBackupHistory() {
    return request('/backup/images-history');
  },

  async downloadImagesBackupArchive(fileName) {
    const baseUrl = getBaseUrl();
    const token = localStorage.getItem('elite_auth_token');
    const res = await fetch(`${baseUrl}/backup/download-images-archive/${encodeURIComponent(fileName)}`, {
      headers: {
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      }
    });
    if (!res.ok) {
      throw new Error(`Failed to download images archive: ${res.statusText}`);
    }
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => {
      window.URL.revokeObjectURL(url);
    }, 2000);
  },

  async triggerR2Backup() {
    return request('/backup/trigger-r2', { method: 'POST' });
  },

  async listR2Backups() {
    return request('/backup/list-r2');
  },

  // ── Authority-Based Inter-Department Communication ───────────────────────

  async getCommunicationGroups(userId) {
    const user = this.getCurrentUser();
    const uId = userId || (user ? (user._id || user.id) : '');
    const qs = uId ? `?userId=${uId}` : '';
    return request(`/communication/groups${qs}`);
  },

  async getCommunicationMessages(groupId, params = {}) {
    const queryParams = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') queryParams.append(k, v); });
    const qs = queryParams.toString() ? `?${queryParams.toString()}` : '';
    return request(`/communication/groups/${groupId}/messages${qs}`);
  },

  async sendCommunicationMessage(groupId, data) {
    return request(`/communication/groups/${groupId}/messages`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async votePollMessage(messageId, optionId) {
    return request(`/communication/messages/${messageId}/poll-vote`, {
      method: 'POST',
      body: JSON.stringify({ optionId }),
    });
  },

  async forwardMessage(messageId, targetRoomId) {
    return request(`/communication/messages/${messageId}/forward`, {
      method: 'POST',
      body: JSON.stringify({ targetRoomId }),
    });
  },

  async getCommunicationMembers(groupId) {
    return request(`/communication/groups/${groupId}/members`);
  },

  async updateGroupMembers(groupId, memberIds) {
    return request(`/communication/groups/${groupId}/members`, {
      method: 'POST',
      body: JSON.stringify({ memberIds }),
    });
  },

  async syncCommunicationGroups() {
    return request('/communication/groups/sync', { method: 'POST' });
  },

  async clearAllCommunicationData() {
    return request('/communication/clear-all', { method: 'POST' });
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

  async getCommunicationUsers(userId) {
    const user = this.getCurrentUser();
    const uId = userId || (user ? (user._id || user.id) : '');
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

  // CRM Lead Management
  async getLeads(params = {}) {
    const query = new URLSearchParams(params).toString();
    return request(`/leads${query ? `?${query}` : ''}`);
  },

  async createLead(payload) {
    return request('/leads', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  async updateLead(id, payload) {
    return request(`/leads/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload)
    });
  },

  async deleteLead(id) {
    return request(`/leads/${id}`, { method: 'DELETE' });
  },

  // Customer Profiles Management (CRM Person & Business Directory)
  async getCustomerProfiles(params = {}) {
    const query = new URLSearchParams(params).toString();
    return request(`/customer-profiles${query ? `?${query}` : ''}`);
  },

  async getCustomerProfileById(id) {
    return request(`/customer-profiles/${id}`);
  },

  async createCustomerProfile(payload) {
    return request('/customer-profiles', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  async updateCustomerProfile(id, payload) {
    return request(`/customer-profiles/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload)
    });
  },

  async addCustomerProfileInteraction(id, payload) {
    return request(`/customer-profiles/${id}/interactions`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  async deleteCustomerProfile(id) {
    return request(`/customer-profiles/${id}`, { method: 'DELETE' });
  },

  async syncAllCustomerProfiles() {
    return request('/customer-profiles/sync-all', { method: 'POST' });
  },

  // Business Connections (Master AI Agent & Directory)
  async parseBusinessConnectionAI(rawText) {
    return request('/business-connections/parse-ai', {
      method: 'POST',
      body: JSON.stringify({ raw_text: rawText })
    });
  },

  async getBusinessConnections(params = {}) {
    const query = new URLSearchParams(params).toString();
    return request(`/business-connections${query ? `?${query}` : ''}`);
  },

  async createBusinessConnection(payload) {
    return request('/business-connections', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  async updateBusinessConnection(id, payload) {
    return request(`/business-connections/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload)
    });
  },

  async deleteBusinessConnection(id) {
    return request(`/business-connections/${id}`, { method: 'DELETE' });
  },

  async addBusinessConnectionNote(id, noteData) {
    return request(`/business-connections/${id}/notes`, {
      method: 'POST',
      body: JSON.stringify(noteData)
    });
  },

  // Centralized Master AI Processing Agent
  async processMasterAiInput(payload) {
    return request('/ai/master-agent', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  async upsertMasterAiRecord(recordData) {
    return request('/ai/upsert-record', {
      method: 'POST',
      body: JSON.stringify(recordData)
    });
  },

  // AI Production Measurement Calculation Agent
  async calculateAiMeasurement(payload) {
    return request('/ai/calculate-measurement', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  // ── Task Management Module (TaskOPad) Endpoints ──
  async getTasks(params = {}) {
    const queryParams = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') queryParams.append(k, v);
    });
    const qs = queryParams.toString() ? `?${queryParams.toString()}` : '';
    return request(`/tasks${qs}`);
  },

  async getTaskById(id) {
    return request(`/tasks/${id}`);
  },

  async createTask(taskData) {
    return request('/tasks', {
      method: 'POST',
      body: JSON.stringify(taskData)
    });
  },

  async updateTask(id, taskData) {
    return request(`/tasks/${id}`, {
      method: 'PUT',
      body: JSON.stringify(taskData)
    });
  },

  async deleteTask(id) {
    return request(`/tasks/${id}`, {
      method: 'DELETE'
    });
  },

  async startTaskTimer(id, userId) {
    return request(`/tasks/${id}/timer/start`, {
      method: 'POST',
      body: JSON.stringify({ userId })
    });
  },

  async stopTaskTimer(id, payload = {}) {
    return request(`/tasks/${id}/timer/stop`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  async addTaskTimeLog(id, logData) {
    return request(`/tasks/${id}/timelogs`, {
      method: 'POST',
      body: JSON.stringify(logData)
    });
  },

  async addTaskChecklistItem(id, itemData) {
    return request(`/tasks/${id}/checklist`, {
      method: 'POST',
      body: JSON.stringify(itemData)
    });
  },

  async toggleTaskChecklistItem(id, itemId, completed) {
    return request(`/tasks/${id}/checklist/${itemId}`, {
      method: 'PUT',
      body: JSON.stringify({ completed })
    });
  },

  async addTaskComment(id, commentData) {
    return request(`/tasks/${id}/comments`, {
      method: 'POST',
      body: JSON.stringify(commentData)
    });
  },

  async uploadTaskAttachment(file) {
    return this.uploadImage(file, 'tasks/attachments');
  },

  async addTaskAttachment(id, attachmentData) {
    return request(`/tasks/${id}/attachments`, {
      method: 'POST',
      body: JSON.stringify(attachmentData)
    });
  },

  async deleteTaskAttachment(id, attachmentId) {
    return request(`/tasks/${id}/attachments/${attachmentId}`, {
      method: 'DELETE'
    });
  },


  // ─── Signed Documents (Challan & Invoice) Verification & Approval ───
  async uploadSignedDocumentImage(file, docType = 'challan') {
    const folder = `signed_documents/${docType}s`;
    return this.uploadImage(file, folder);
  },

  async uploadSignedDocument({ docType, docId, images }) {
    return request('/signed-documents/upload', {
      method: 'POST',
      body: JSON.stringify({ docType, docId, images })
    });
  },

  async getSignedDocumentApprovals(params = {}) {
    const qs = new URLSearchParams();
    if (params.status) qs.set('status', params.status);
    if (params.docType) qs.set('docType', params.docType);
    if (params.search) qs.set('search', params.search);
    const query = qs.toString() ? `?${qs.toString()}` : '';
    return request(`/signed-documents/approvals${query}`);
  },

  async updateSignedDocumentApproval(docType, id, { action, rejectionReason = '' }) {
    return request(`/signed-documents/${docType}/${id}/approval`, {
      method: 'PATCH',
      body: JSON.stringify({ action, rejectionReason })
    });
  },

  async bulkUpdateSignedDocumentApprovals({ items, action, rejectionReason = '' }) {
    return request('/signed-documents/bulk-approval', {
      method: 'PATCH',
      body: JSON.stringify({ items, action, rejectionReason })
    });
  },

  // ── White Fabric QA Inspection Logs ──
  async getWhiteFabricLogs(params = {}) {
    const qs = new URLSearchParams();
    if (params.department) qs.set('department', params.department);
    const query = qs.toString() ? `?${qs.toString()}` : '';
    return request(`/fabric/white-qa-logs${query}`);
  },

  async createWhiteFabricLog(payload) {
    return request('/fabric/white-qa-logs', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  async deleteWhiteFabricLog(id) {
    return request(`/fabric/white-qa-logs/${id}`, {
      method: 'DELETE'
    });
  },

  // ── Client Details & Accounts Management ──
  async getClients(params = {}) {
    const qs = new URLSearchParams();
    if (params.search) qs.set('search', params.search);
    if (params.companyCode) qs.set('companyCode', params.companyCode);
    if (params.status) qs.set('status', params.status);
    if (params.page) qs.set('page', params.page);
    if (params.limit) qs.set('limit', params.limit);
    const query = qs.toString() ? `?${qs.toString()}` : '';
    return request(`/clients${query}`);
  },

  async getClientById(id) {
    return request(`/clients/${id}`);
  },

  async createClient(data) {
    return request('/clients', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  async updateClient(id, data) {
    return request(`/clients/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },

  async deleteClient(id) {
    return request(`/clients/${id}`, {
      method: 'DELETE'
    });
  },

  async uploadClientImage(file) {
    return this.uploadImage(file, 'clients/avatars');
  },

  async clientLogin({ mobile, password }) {
    const res = await request('/clients/login', {
      method: 'POST',
      body: JSON.stringify({ mobile, password }),
    });
    if (res && res.success) {
      const token = res.tokens?.access?.token || res.token;
      if (token) {
        localStorage.setItem('elite_auth_token', token);
      }
      const user = res.user || { ...res.client, role: 'Client', isClient: true };
      localStorage.setItem('elite_user', JSON.stringify(user));
      localStorage.setItem('elite_is_client', 'true');
      localStorage.setItem('elite_client_data', JSON.stringify(res.client || user));
    }
    return res;
  },

  async updateClientProfile(id, data) {
    const res = await request(`/clients/profile/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
    if (res && res.success && res.data) {
      const existingUser = this.getCurrentUser() || {};
      const updatedUser = { ...existingUser, ...res.data, role: 'Client', isClient: true };
      localStorage.setItem('elite_user', JSON.stringify(updatedUser));
      localStorage.setItem('elite_client_data', JSON.stringify(res.data));
    }
    return res;
  },

  isClientUser() {
    try {
      const user = this.getCurrentUser();
      return !!(user?.isClient || user?.role === 'Client' || localStorage.getItem('elite_is_client') === 'true');
    } catch (e) {
      return false;
    }
  },

  getClientData() {
    try {
      const raw = localStorage.getItem('elite_client_data');
      return raw ? JSON.parse(raw) : this.getCurrentUser();
    } catch (e) {
      return this.getCurrentUser();
    }
  },

  // ─── DESIGNER MODULE & TASKS ──────────────────────────────────────────────
  async getDesignerTasks(params = {}) {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '' && v !== 'All') {
        query.append(k, v);
      }
    });
    const qs = query.toString();
    return request(`/designer-tasks${qs ? `?${qs}` : ''}`);
  },

  async getDesignerTask(id) {
    return request(`/designer-tasks/${id}`);
  },

  async createDesignerTask(data) {
    return request('/designer-tasks', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  async updateDesignerTask(id, data) {
    return request(`/designer-tasks/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },

  async addDesignerTaskComment(id, commentData) {
    return request(`/designer-tasks/${id}/comments`, {
      method: 'POST',
      body: JSON.stringify(commentData)
    });
  },

  async updateDesignerTaskStage(id, stageData) {
    return request(`/designer-tasks/${id}/stage`, {
      method: 'PUT',
      body: JSON.stringify(stageData)
    });
  },

  async deleteDesignerTask(id) {
    return request(`/designer-tasks/${id}`, {
      method: 'DELETE'
    });
  },

  async getDesignerStats(params = {}) {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '' && v !== 'All') {
        query.append(k, v);
      }
    });
    const qs = query.toString();
    return request(`/designer-tasks/stats${qs ? `?${qs}` : ''}`);
  },

  async globalSearch(q, companyId) {
    const qs = new URLSearchParams();
    if (q) qs.set('q', q);
    if (companyId) qs.set('companyId', companyId);
    return request(`/search/global?${qs.toString()}`);
  },

  async triggerAsyncExport(type, params = {}) {
    return request('/jobs/export', {
      method: 'POST',
      body: JSON.stringify({ type, params })
    });
  },

  async getJobStatus(jobId) {
    return request(`/jobs/${jobId}`);
  },

  // ── Universal Change Review & Approvals ──
  async getChangeApprovals(params = {}) {
    const qs = new URLSearchParams();
    if (params.status) qs.set('status', params.status);
    if (params.module) qs.set('module', params.module);
    if (params.search) qs.set('search', params.search);
    if (params.page) qs.set('page', params.page);
    if (params.limit) qs.set('limit', params.limit);
    const query = qs.toString() ? `?${qs.toString()}` : '';
    return request(`/change-approvals${query}`);
  },

  async getChangeApprovalStats() {
    return request('/change-approvals/stats');
  },

  async approveChangeRequest(id, notes = '') {
    return request(`/change-approvals/${id}/approve`, {
      method: 'POST',
      body: JSON.stringify({ notes })
    });
  },

  async rejectChangeRequest(id, reason = '') {
    return request(`/change-approvals/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason })
    });
  },

  async bulkApproveChangeRequests(ids, notes = '') {
    return request('/change-approvals/bulk-approve', {
      method: 'POST',
      body: JSON.stringify({ ids, notes })
    });
  },

  async bulkRejectChangeRequests(ids, reason = '') {
    return request('/change-approvals/bulk-reject', {
      method: 'POST',
      body: JSON.stringify({ ids, reason })
    });
  },

  async getChangeApprovalSettings() {
    return request('/change-approvals/settings');
  },

  async updateChangeApprovalSettings(settings) {
    return request('/change-approvals/settings', {
      method: 'PATCH',
      body: JSON.stringify(settings)
    });
  },

  async getUserDataEntries(params = {}) {
    const qs = new URLSearchParams();
    if (params.user) qs.set('user', params.user);
    if (params.module) qs.set('module', params.module);
    if (params.company) qs.set('company', params.company);
    if (params.department) qs.set('department', params.department);
    if (params.startDate) qs.set('startDate', params.startDate);
    if (params.endDate) qs.set('endDate', params.endDate);
    if (params.search) qs.set('search', params.search);
    if (params.page) qs.set('page', params.page);
    if (params.limit) qs.set('limit', params.limit);
    const query = qs.toString() ? `?${qs.toString()}` : '';
    return request(`/change-approvals/user-entries${query}`);
  },

  async getEntryUsersList() {
    return request('/change-approvals/entry-users');
  }
};





