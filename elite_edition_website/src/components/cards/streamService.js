/**
 * Agent Chat Streaming Service
 * ─────────────────────────────────────────────────────────────────────────────
 * Connects to the SSE stream endpoint or falls back to standard HTTP JSON chat.
 *
 * SSE events consumed:
 *   status      → { message }        — shows live status badge
 *   tool_result → { tool, result }   — fires onToolResult callback
 *   delta       → { text }           — appends text chunk to message bubble
 *   persisted   → { conversationId } — fires onPersisted with the saved conversation ID
 *   done        → "[DONE]"           — resolves the promise
 *   error       → { message }        — rejects or shows error
 */

import { getBaseUrl } from '../../services/api';

function getAuthHeaders() {
  const token = typeof localStorage !== 'undefined'
    ? (localStorage.getItem('elite_auth_token') || localStorage.getItem('token'))
    : null;
  const activeCompanyId = typeof localStorage !== 'undefined'
    ? (localStorage.getItem('elite_active_department') || '')
    : '';

  let csrfToken = '';
  if (typeof document !== 'undefined') {
    const match = document.cookie.match(/(?:^|;\s*)(?:XSRF-TOKEN|csrf_token)=([^;]+)/);
    if (match) csrfToken = decodeURIComponent(match[1]);
  }

  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(activeCompanyId ? { 'X-Company-Id': activeCompanyId } : {}),
    ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {})
  };
}

/**
 * @param {object} opts
 * @param {string}   opts.message          — the user's prompt
 * @param {string}   [opts.conversationId] — null for new conversation, string for existing
 * @param {array}    [opts.history]        — in-memory chat history for context (optional)
 * @param {function} opts.onStatus         — (statusMessage: string) => void
 * @param {function} opts.onDelta          — (textChunk: string) => void
 * @param {function} opts.onToolResult     — (tool: string, result: object) => void
 * @param {function} [opts.onPersisted]    — (conversationId: string) => void
 */
export async function streamAgentChat({
  message,
  conversationId = null,
  history        = [],
  onStatus       = () => {},
  onDelta        = () => {},
  onToolResult   = () => {},
  onPersisted    = () => {}
}) {
  const baseUrl = getBaseUrl();
  const headers = getAuthHeaders();

  const payload = {
    message,
    conversationId: conversationId || null
  };

  try {
    const response = await fetch(`${baseUrl}/ai/chat/agent/stream`, {
      method: 'POST',
      headers,
      credentials: 'include',
      body: JSON.stringify(payload)
    });

    if (!response.ok || !response.body) {
      throw new Error(`Stream request failed with status ${response.status}`);
    }

    const reader  = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer    = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // SSE blocks are separated by double newline
      const blocks = buffer.split('\n\n');
      buffer = blocks.pop() || ''; // keep incomplete last block

      for (const block of blocks) {
        if (!block.trim()) continue;

        let eventType = 'message';
        let dataStr   = '';

        for (const line of block.split('\n')) {
          if (line.startsWith('event:')) {
            eventType = line.replace('event:', '').trim();
          } else if (line.startsWith('data:')) {
            dataStr = line.replace('data:', '').trim();
          }
        }

        if (eventType === 'status') {
          try { onStatus(JSON.parse(dataStr).message || dataStr); } catch (_) { onStatus(dataStr); }
        } else if (eventType === 'delta') {
          try { onDelta(JSON.parse(dataStr).text || dataStr); } catch (_) { onDelta(dataStr); }
        } else if (eventType === 'tool_result') {
          try {
            const parsed = JSON.parse(dataStr);
            onToolResult(parsed.tool, parsed.result);
          } catch (e) {
            console.warn('[streamAgentChat] Failed to parse tool_result:', e);
          }
        } else if (eventType === 'persisted') {
          try {
            const parsed = JSON.parse(dataStr);
            if (parsed.conversationId) onPersisted(parsed.conversationId);
          } catch (_) {}
        } else if (eventType === 'error') {
          let msg = dataStr;
          try { msg = JSON.parse(dataStr).message || dataStr; } catch (_) {}
          onDelta(`\n\n⚠️ Error: ${msg}`);
          return;
        } else if (eventType === 'done' || dataStr === '[DONE]') {
          return;
        }
      }
    }
  } catch (streamErr) {
    console.warn('[streamAgentChat] SSE failed, falling back to standard agent:', streamErr.message);
    onStatus('Connecting via standard channel…');

    try {
      const res = await fetch(`${getBaseUrl()}/ai/chat/agent`, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({ message, conversationId: conversationId || null })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();

      if (Array.isArray(json.toolEvents)) {
        json.toolEvents.forEach(evt => onToolResult(evt.tool, evt.result));
      }
      if (json.reply) onDelta(json.reply);
      if (json.conversationId) onPersisted(json.conversationId);
    } catch (fallbackErr) {
      console.error('[streamAgentChat] Fallback error:', fallbackErr);
      onDelta(`⚠️ Error: ${fallbackErr.message || 'Could not reach ERP Copilot'}`);
    }
  }
}

/**
 * Load a persisted conversation by ID (for page hydration).
 */
export async function fetchConversation(conversationId) {
  const baseUrl = getBaseUrl();
  const headers = getAuthHeaders();

  const res = await fetch(`${baseUrl}/ai/chat/conversations/${conversationId}`, {
    headers,
    credentials: 'include'
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json(); // { conversation }
}

/**
 * List all conversations for the current user.
 */
export async function fetchConversationList() {
  const baseUrl = getBaseUrl();
  const headers = getAuthHeaders();

  const res = await fetch(`${baseUrl}/ai/chat/conversations`, {
    headers,
    credentials: 'include'
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json(); // { conversations }
}

/**
 * Delete a conversation.
 */
export async function deleteConversation(conversationId) {
  const baseUrl = getBaseUrl();
  const headers = getAuthHeaders();

  const res = await fetch(`${baseUrl}/ai/chat/conversations/${conversationId}`, {
    method: 'DELETE',
    headers,
    credentials: 'include'
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/**
 * Submit a HITL ticket confirmation (PENDING_SELF → APPROVED).
 */
export async function executeConfirmedAction(ticketId) {
  const baseUrl = getBaseUrl();
  const headers = getAuthHeaders();

  const res = await fetch(`${baseUrl}/ai/chat/actions/execute`, {
    method:  'POST',
    headers,
    credentials: 'include',
    body:    JSON.stringify({ ticketId })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

/**
 * Manager approves or rejects an escalated ticket (AWAITING_MANAGER).
 */
export async function submitApprovalDecision(ticketId, decision, reason) {
  const baseUrl = getBaseUrl();
  const headers = getAuthHeaders();

  const res = await fetch(`${baseUrl}/ai/chat/approvals/decision`, {
    method:  'POST',
    headers,
    credentials: 'include',
    body:    JSON.stringify({ ticketId, decision, reason })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}
