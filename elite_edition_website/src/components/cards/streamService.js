/**
 * Agent Chat Streaming Service
 * Connects to the SSE stream or falls back to standard HTTP chat endpoint.
 */

import { getBaseUrl } from '../../services/api';

export async function streamAgentChat({
  message,
  history = [],
  onStatus = () => {},
  onDelta = () => {},
  onToolResult = () => {}
}) {
  const token = typeof localStorage !== 'undefined' ? localStorage.getItem('elite_auth_token') : null;
  const baseUrl = getBaseUrl();

  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };

  const payload = {
    message,
    conversationHistory: history.map(h => ({
      role: h.role === 'assistant' ? 'assistant' : 'user',
      content: h.content || ''
    }))
  };

  try {
    const response = await fetch(`${baseUrl}/chat/agent/stream`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });

    if (!response.ok || !response.body) {
      throw new Error(`Streaming failed with HTTP status ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n\n');
      buffer = lines.pop() || '';

      for (const block of lines) {
        if (!block.trim()) continue;

        let eventType = 'message';
        let dataStr = '';

        const blockLines = block.split('\n');
        for (const line of blockLines) {
          if (line.startsWith('event:')) {
            eventType = line.replace('event:', '').trim();
          } else if (line.startsWith('data:')) {
            dataStr = line.replace('data:', '').trim();
          }
        }

        if (eventType === 'status') {
          onStatus(dataStr);
        } else if (eventType === 'delta') {
          onDelta(dataStr);
        } else if (eventType === 'tool_result') {
          try {
            const parsed = JSON.parse(dataStr);
            onToolResult(parsed.tool, parsed.result);
          } catch (e) {
            console.warn('[streamAgentChat] Failed to parse tool_result event:', e);
          }
        } else if (eventType === 'done' || dataStr === '[DONE]') {
          return;
        }
      }
    }
  } catch (streamErr) {
    console.warn('[streamAgentChat] SSE stream fallback to standard chat:', streamErr.message);
    // Non-streaming fallback
    onStatus('Processing via standard agent pipeline...');
    try {
      const res = await fetch(`${baseUrl}/chat/agent`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();

      if (json.toolEvents && Array.isArray(json.toolEvents)) {
        json.toolEvents.forEach(evt => {
          onToolResult(evt.tool, evt.result);
        });
      }

      if (json.reply) {
        onDelta(json.reply);
      }
    } catch (fallbackErr) {
      console.error('[streamAgentChat Fallback Error]:', fallbackErr);
      onDelta(`⚠️ Error: ${fallbackErr.message || 'Failed to reach ERP Copilot'}`);
    }
  }
}
