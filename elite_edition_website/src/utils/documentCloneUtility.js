/**
 * Enterprise Document Clone Utility
 * 
 * Standardized industrial cloning workflow for commercial ERP documents (Invoices, Purchases, Challans).
 * Duplicates line-item arrays while resetting DB identifiers, timestamps, and payment statuses to draft.
 * Automatically focuses and selects the primary variable quantity input for lightning-fast operator re-entry.
 */

export function cloneDocumentPayload(sourceDoc, docType = 'invoice') {
  if (!sourceDoc) return null;

  const todayStr = new Date().toISOString().split('T')[0];
  const dueDays = 30;
  const dueDateStr = new Date(Date.now() + dueDays * 86400000).toISOString().split('T')[0];

  // Deep clone line items with fresh unique client IDs
  const clonedItems = Array.isArray(sourceDoc.items) 
    ? sourceDoc.items.map((item, index) => {
        const { _id, ...cleanItem } = item;
        return {
          ...cleanItem,
          id: `item_${Date.now()}_${index}_${Math.random().toString(36).substring(2, 6)}`,
          // Ensure valid numbers
          qty: parseFloat(item.qty || item.quantity) || 1,
          quantity: parseFloat(item.quantity || item.qty) || 1,
          unitPrice: parseFloat(item.unitPrice || item.rate) || 0,
          rate: parseFloat(item.rate || item.unitPrice) || 0,
          discountPct: parseFloat(item.discountPct) || 0,
          taxRate: parseFloat(item.taxRate) || 5
        };
      })
    : [];

  const basePayload = {
    ...sourceDoc,
    // Reset DB Identifiers
    _id: undefined,
    id: undefined,
    createdAt: undefined,
    updatedAt: undefined,

    // Reset Timestamps to today
    date: todayStr,
    invoiceDate: todayStr,
    dueDate: dueDateStr,

    // Reset Financial Ledger & Payment States
    status: 'draft',
    paymentStatus: 'UNPAID',
    paidAmount: 0,
    balanceDue: sourceDoc.grandTotal || sourceDoc.totalAmount || 0,
    payments: [],
    history: [],

    // Items array cloned
    items: clonedItems,

    // Notes annotation
    notes: sourceDoc.notes ? `${sourceDoc.notes} (Cloned from #${sourceDoc.invoiceNo || sourceDoc.purchaseNo || 'original'})` : `Cloned on ${todayStr}`
  };

  if (docType === 'invoice') {
    return {
      ...basePayload,
      invoiceNo: '', // Will be assigned next sequence on create
      isCloned: true
    };
  }

  if (docType === 'purchase') {
    return {
      ...basePayload,
      purchaseNo: '',
      isCloned: true
    };
  }

  return basePayload;
}

/**
 * focusPrimaryQuantityInput
 * 
 * Automatically places keyboard focus into the primary variable quantity input upon cloning.
 * Selects all text inside the input so operator can immediately begin typing new values.
 * 
 * @param {string} customSelector - Optional CSS selector override
 * @param {number} delayMs - Delay in ms to await component animation/mount
 */
export function focusPrimaryQuantityInput(customSelector = '[data-primary-qty="true"]', delayMs = 150) {
  if (typeof window === 'undefined') return;

  setTimeout(() => {
    requestAnimationFrame(() => {
      const targetInput = document.querySelector(customSelector) ||
        document.querySelector('#primary-variable-qty-input') ||
        document.querySelector('input[data-field="item-qty-0"]') ||
        document.querySelector('input[name*="qty"]');

      if (targetInput && typeof targetInput.focus === 'function') {
        targetInput.focus();
        if (typeof targetInput.select === 'function') {
          targetInput.select();
        }

        // Add subtle accent animation
        targetInput.classList.add('dock-field-highlight-pulse');
        setTimeout(() => {
          targetInput.classList.remove('dock-field-highlight-pulse');
        }, 2000);
      }
    });
  }, delayMs);
}
