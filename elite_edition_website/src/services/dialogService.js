/**
 * Centralized Dialog & Toast Service
 * 
 * Replaces native browser alert(), confirm(), and prompt() with:
 * - Enterprise Modal Dialogs (EliteModalDialog)
 * - Push Toasts (NotificationToastContainer)
 * - Safe global error and promise rejection catchers
 */

import { triggerPushNotification } from '../components/NotificationToast';

/**
 * Dispatches an enterprise alert modal.
 * @param {string} title 
 * @param {string} message 
 * @param {'info'|'warning'|'error'|'success'|'danger'} type 
 * @returns {Promise<boolean>}
 */
export const triggerEliteAlert = (title, message = '', type = 'info') => {
  return new Promise((resolve) => {
    // If only one argument is provided, treat it as message with a standard title
    let resolvedTitle = title;
    let resolvedMessage = message;
    if (!message && title) {
      if (type === 'error' || type === 'danger') resolvedTitle = 'Error';
      else if (type === 'warning') resolvedTitle = 'Warning';
      else if (type === 'success') resolvedTitle = 'Success';
      else resolvedTitle = 'Notification';
      resolvedMessage = title;
    }

    const event = new CustomEvent('elite-modal-dialog', {
      detail: {
        mode: 'alert',
        title: typeof resolvedTitle === 'object' ? JSON.stringify(resolvedTitle) : String(resolvedTitle || 'Alert'),
        message: typeof resolvedMessage === 'object' ? JSON.stringify(resolvedMessage) : String(resolvedMessage || ''),
        type: type === 'danger' ? 'error' : type,
        resolve
      }
    });
    window.dispatchEvent(event);
  });
};

/**
 * Dispatches an enterprise confirmation modal.
 * @param {object} options
 * @param {string} options.title
 * @param {string} options.message
 * @param {string} [options.confirmText='Confirm']
 * @param {string} [options.cancelText='Cancel']
 * @param {'info'|'warning'|'error'|'success'|'danger'} [options.type='warning']
 * @returns {Promise<boolean>}
 */
export const triggerEliteConfirm = ({
  title = 'Confirmation Required',
  message = '',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  type = 'warning'
}) => {
  return new Promise((resolve) => {
    const event = new CustomEvent('elite-modal-dialog', {
      detail: {
        mode: 'confirm',
        title: typeof title === 'object' ? JSON.stringify(title) : String(title),
        message: typeof message === 'object' ? JSON.stringify(message) : String(message),
        confirmText,
        cancelText,
        type: type === 'danger' ? 'error' : type,
        resolve
      }
    });
    window.dispatchEvent(event);
  });
};

/**
 * Dispatches an enterprise prompt modal with a text input.
 * @param {object} options
 * @param {string} options.title
 * @param {string} [options.message='']
 * @param {string} [options.placeholder='']
 * @param {string} [options.defaultValue='']
 * @param {string} [options.confirmText='Submit']
 * @param {string} [options.cancelText='Cancel']
 * @returns {Promise<string|null>}
 */
export const triggerElitePrompt = ({
  title = 'Input Required',
  message = '',
  placeholder = '',
  defaultValue = '',
  confirmText = 'Submit',
  cancelText = 'Cancel'
}) => {
  return new Promise((resolve) => {
    const event = new CustomEvent('elite-modal-dialog', {
      detail: {
        mode: 'prompt',
        title: String(title),
        message: String(message),
        placeholder: String(placeholder),
        defaultValue: String(defaultValue),
        confirmText,
        cancelText,
        type: 'info',
        resolve
      }
    });
    window.dispatchEvent(event);
  });
};

/**
 * Helper to show in-app toast notification.
 */
export const showToast = (title, message = '', type = 'info', actionTab = null) => {
  triggerPushNotification(title, message, type, actionTab);
};

/**
 * Installs global overrides on `window` to intercept native alert and unhandled exceptions.
 */
export const installGlobalDialogInterceptors = () => {
  if (typeof window === 'undefined') return;

  // Intercept window.alert
  window.alert = function (message) {
    console.warn('[Global Interceptor] Intercepted native alert():', message);
    triggerPushNotification('System Alert', String(message || ''), 'warning');
  };

  // Intercept window.confirm fallback warning
  window.confirm = function (message) {
    console.warn('[Global Interceptor] Native synchronous window.confirm() was called. Please migrate to triggerEliteConfirm()! Message:', message);
    triggerPushNotification('Confirm Action', String(message || ''), 'warning');
    // Default safe fallback to false to avoid unintended deletions/actions
    return false;
  };

  // Catch unhandled Promise rejections (API errors, network failures)
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    const msg = reason?.message || (typeof reason === 'string' ? reason : '');
    const stack = reason?.stack || '';
    
    // Ignore harmless browser/network abort cancellations and third-party extension chatter
    if (
      !msg ||
      msg.includes('AbortError') ||
      msg.includes('cancelled') ||
      msg.includes('canceled') ||
      msg.includes('runtime.sendMessage') ||
      msg.includes('Extension context') ||
      msg.includes('Receiving end does not exist') ||
      msg.includes('Tab not found') ||
      msg.includes('chrome-extension://') ||
      msg.includes('moz-extension://') ||
      stack.includes('chrome-extension://') ||
      stack.includes('moz-extension://')
    ) {
      return;
    }

    console.error('[Global Unhandled Rejection]', reason);
    triggerPushNotification(
      'Operation Notice',
      msg.length > 200 ? msg.substring(0, 200) + '...' : msg,
      'error'
    );
  });

  // Catch global runtime errors
  window.addEventListener('error', (event) => {
    const msg = event.message || '';
    const filename = event.filename || '';
    // Filter non-actionable browser noise and browser extension errors
    if (
      msg.includes('ResizeObserver loop') ||
      msg.includes('Script error') ||
      msg.includes('runtime.sendMessage') ||
      msg.includes('Extension context') ||
      msg.includes('Receiving end does not exist') ||
      msg.includes('Tab not found') ||
      filename.includes('chrome-extension://') ||
      filename.includes('moz-extension://')
    ) {
      return;
    }

    console.error('[Global Error]', event.error || event.message);
  });
};
