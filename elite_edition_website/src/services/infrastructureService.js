import axios from 'axios';
import { getBaseUrl, getCsrfTokenFromCookie, getAccessToken } from './api';

const apiClient = axios.create({
  timeout: 30000,
  withCredentials: true,
});

apiClient.interceptors.request.use((config) => {
  config.withCredentials = true;
  const token = getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  const csrf = getCsrfTokenFromCookie();
  if (csrf) {
    config.headers['X-CSRF-Token'] = csrf;
  }
  return config;
});

const getEndpoint = (path) => `${getBaseUrl()}/infrastructure${path}`;

/**
 * Fetch live AWS spend and CloudWatch CPU utilization
 */
export async function fetchAwsMetrics(exchangeRate = 86.5) {
  const res = await apiClient.get(getEndpoint('/metrics/aws'), {
    params: { exchangeRate },
  });
  return res.data;
}

/**
 * Fetch live MongoDB Atlas cluster metadata, PITR backup status & connections
 */
export async function fetchMongoMetrics() {
  const res = await apiClient.get(getEndpoint('/metrics/mongodb'));
  return res.data;
}

/**
 * Fetch live Cloudflare R2 object storage usage and zero egress verification
 */
export async function fetchCloudflareMetrics() {
  const res = await apiClient.get(getEndpoint('/metrics/cloudflare-r2'));
  return res.data;
}

/**
 * Fetch complete monthly billing history across all providers
 */
export async function fetchBillingHistory(params = {}) {
  const res = await apiClient.get(getEndpoint('/billing/history'), { params });
  return res.data;
}

/**
 * Settle a pending infrastructure bill in-app (eliminates external consoles)
 */
export async function settleBill(billId, paymentData = {}) {
  const res = await apiClient.post(getEndpoint(`/billing/${billId}/settle`), paymentData);
  return res.data;
}

/**
 * Download official Tax Invoice PDF directly in browser
 */
export async function downloadInvoicePdf(billId, month = 'Month') {
  const res = await apiClient.get(getEndpoint(`/billing/${billId}/invoice`), {
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

/**
 * Synchronize live usage and costs across all cloud providers (AWS, Atlas, R2)
 */
export async function syncAllProviders(exchangeRate = 86.5) {
  const res = await apiClient.post(getEndpoint('/sync/all'), { exchangeRate });
  return res.data;
}

/**
 * Fetch live system health, process uptime, memory usage, and connection statuses
 */
export async function fetchSystemHealth() {
  const res = await apiClient.get(getEndpoint('/health'));
  return res.data;
}

export default {
  fetchAwsMetrics,
  fetchMongoMetrics,
  fetchCloudflareMetrics,
  fetchBillingHistory,
  settleBill,
  downloadInvoicePdf,
  syncAllProviders,
  fetchSystemHealth,
};
