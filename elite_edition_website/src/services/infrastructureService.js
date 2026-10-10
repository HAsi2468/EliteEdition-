import axios from 'axios';
import { getBaseUrl, getCsrfTokenFromCookie } from './api';

const apiClient = axios.create({
  timeout: 30000,
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('token') || localStorage.getItem('authToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  const csrf = getCsrfTokenFromCookie();
  if (csrf) {
    config.headers['X-CSRF-Token'] = csrf;
  }
  return config;
});

/**
 * Fetch live AWS spend and CloudWatch CPU utilization
 */
export async function fetchAwsMetrics(exchangeRate = 86.5) {
  try {
    const res = await apiClient.get('/api/infrastructure/metrics/aws', {
      params: { exchangeRate },
    });
    return res.data;
  } catch (err) {
    // Fallback to /v1/infrastructure/metrics/aws if /api prefix is redirected
    const res = await apiClient.get('/v1/infrastructure/metrics/aws', {
      params: { exchangeRate },
    });
    return res.data;
  }
}

/**
 * Fetch live MongoDB Atlas cluster metadata, PITR backup status & connections
 */
export async function fetchMongoMetrics() {
  try {
    const res = await apiClient.get('/api/infrastructure/metrics/mongodb');
    return res.data;
  } catch (err) {
    const res = await apiClient.get('/v1/infrastructure/metrics/mongodb');
    return res.data;
  }
}

/**
 * Fetch live Cloudflare R2 object storage usage and zero egress verification
 */
export async function fetchCloudflareMetrics() {
  try {
    const res = await apiClient.get('/api/infrastructure/metrics/cloudflare-r2');
    return res.data;
  } catch (err) {
    const res = await apiClient.get('/v1/infrastructure/metrics/cloudflare-r2');
    return res.data;
  }
}

/**
 * Fetch complete monthly billing history across all providers
 */
export async function fetchBillingHistory(params = {}) {
  try {
    const res = await apiClient.get('/api/infrastructure/billing/history', { params });
    return res.data;
  } catch (err) {
    const res = await apiClient.get('/v1/infrastructure/billing/history', { params });
    return res.data;
  }
}

/**
 * Settle a pending infrastructure bill in-app (eliminates external consoles)
 */
export async function settleBill(billId, paymentData = {}) {
  try {
    const res = await apiClient.post(`/api/infrastructure/billing/${billId}/settle`, paymentData);
    return res.data;
  } catch (err) {
    const res = await apiClient.post(`/v1/infrastructure/billing/${billId}/settle`, paymentData);
    return res.data;
  }
}

/**
 * Download official Tax Invoice PDF directly in browser
 */
export async function downloadInvoicePdf(billId, month = 'Month') {
  try {
    const res = await apiClient.get(`/api/infrastructure/billing/${billId}/invoice`, {
      responseType: 'blob',
    });
    const blob = new Blob([res.data], { type: 'application/pdf' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Invoice-Infrastructure-${month.replace(/\s+/g, '-')}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
    return true;
  } catch (err) {
    const res = await apiClient.get(`/v1/infrastructure/billing/${billId}/invoice`, {
      responseType: 'blob',
    });
    const blob = new Blob([res.data], { type: 'application/pdf' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Invoice-Infrastructure-${month.replace(/\s+/g, '-')}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
    return true;
  }
}

/**
 * Synchronize live usage and costs across all cloud providers (AWS, Atlas, R2)
 */
export async function syncAllProviders(exchangeRate = 86.5) {
  try {
    const res = await apiClient.post('/api/infrastructure/sync/all', { exchangeRate });
    return res.data;
  } catch (err) {
    const res = await apiClient.post('/v1/infrastructure/sync/all', { exchangeRate });
    return res.data;
  }
}

export default {
  fetchAwsMetrics,
  fetchMongoMetrics,
  fetchCloudflareMetrics,
  fetchBillingHistory,
  settleBill,
  downloadInvoicePdf,
  syncAllProviders,
};
