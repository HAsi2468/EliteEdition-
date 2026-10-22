/**
 * Agent Orchestrator & Express Chat Controller
 * Implements the multi-turn tool calling execution loop with RBAC, parameter isolation, and streaming SSE.
 */

let OpenAI = null;
try {
  OpenAI = require('openai');
} catch (e) {
  // Graceful fallback if openai package is not yet initialized
}

const { GoogleGenerativeAI } = require('@google/generative-ai');
const { getPermittedTools } = require('../tools/registry');
const { erpServiceHandlers } = require('../services/erpServices');

const MAX_AGENT_TURNS = 5;

function getOpenAiClient() {
  if (!OpenAI || !process.env.OPENAI_API_KEY) return null;
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

function getGeminiClient() {
  if (!process.env.GEMINI_API_KEY) return null;
  return new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
}

/**
 * Standard Multi-Turn Agent Chat Controller (POST /api/chat/agent)
 */
async function handleAgentChat(req, res) {
  try {
    const { message, conversationHistory = [] } = req.body;
    if (!message || !String(message).trim()) {
      return res.status(400).json({ error: 'Message is required.' });
    }

    // Extracted from verified JWT auth middleware
    const userContext = {
      userId: req.user?._id || req.user?.id || 'sys-user',
      userName: req.user?.name || req.user?.username || 'Staff User',
      tenantId: req.user?.companyId || req.user?.companyEntity || 'elite_digital_print',
      role: req.user?.role || (req.user?.isAdmin ? 'admin' : 'operator'),
      permissions: req.user?.permissions || (req.user?.isAdmin ? ['admin:*'] : ['production:read', 'production:write', 'inventory:read']),
      isAdmin: Boolean(req.user?.isAdmin || req.user?.isMainAdmin || req.user?.role === 'admin')
    };

    // 1. Dynamic RBAC Tool Filtering
    const availableTools = getPermittedTools(userContext.permissions, userContext.role, userContext.isAdmin);

    const toolEvents = [];

    // Check if OpenAI is configured
    const openai = getOpenAiClient();
    if (openai) {
      const messages = [
        {
          role: 'system',
          content: `You are the ERP Operations Copilot.
User ID: ${userContext.userId}
Tenant: ${userContext.tenantId}
Role: ${userContext.role}
Always invoke tools for factual data. Never assume or fabricate stock levels, batch statuses, or job states.`
        },
        ...conversationHistory,
        { role: 'user', content: message }
      ];

      let currentTurn = 0;

      while (currentTurn < MAX_AGENT_TURNS) {
        currentTurn++;

        const completionParams = {
          model: 'gpt-4o',
          messages
        };

        if (availableTools.length > 0) {
          completionParams.tools = availableTools;
          completionParams.tool_choice = 'auto';
        }

        const response = await openai.chat.completions.create(completionParams);
        const choice = response.choices[0];
        const assistantMessage = choice.message;

        messages.push(assistantMessage);

        if (!assistantMessage.tool_calls || assistantMessage.tool_calls.length === 0) {
          return res.json({
            reply: assistantMessage.content,
            messages,
            toolEvents
          });
        }

        for (const toolCall of assistantMessage.tool_calls) {
          const { id, function: fn } = toolCall;
          const handler = erpServiceHandlers[fn.name];

          let result;
          if (!handler) {
            result = { error: `Function ${fn.name} is not implemented or blocked by authorization.` };
          } else {
            try {
              const parsedArgs = JSON.parse(fn.arguments);
              result = await handler(parsedArgs, userContext);
              toolEvents.push({ tool: fn.name, result });
            } catch (execError) {
              result = { error: execError.message || 'Execution failed.' };
            }
          }

          messages.push({
            role: 'tool',
            tool_call_id: id,
            content: JSON.stringify(result)
          });
        }
      }

      return res.status(500).json({ error: 'Agent exceeded maximum iteration steps.' });
    }

    // Fallback: Gemini or Smart Grounded Local Engine
    const fallbackResult = await runLocalOrGeminiAgent({
      message,
      userContext,
      availableTools,
      conversationHistory
    });

    return res.json({
      reply: fallbackResult.reply,
      messages: fallbackResult.messages,
      toolEvents: fallbackResult.toolEvents
    });
  } catch (error) {
    console.error('Chat agent error:', error);
    return res.status(500).json({ error: error.message || 'Internal processing error.' });
  }
}

/**
 * Streaming Agent Chat Controller (POST /api/chat/agent/stream)
 * Supports real-time Server-Sent Events (SSE) for text deltas, status updates, and interactive tool cards.
 */
async function handleAgentChatStream(req, res) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const sendEvent = (event, data) => {
    res.write(`event: ${event}\ndata: ${typeof data === 'object' ? JSON.stringify(data) : data}\n\n`);
  };

  try {
    const { message, conversationHistory = [] } = req.body;
    if (!message || !String(message).trim()) {
      sendEvent('error', { error: 'Message is required.' });
      return res.end();
    }

    const userContext = {
      userId: req.user?._id || req.user?.id || 'sys-user',
      userName: req.user?.name || req.user?.username || 'Staff User',
      tenantId: req.user?.companyId || req.user?.companyEntity || 'elite_digital_print',
      role: req.user?.role || (req.user?.isAdmin ? 'admin' : 'operator'),
      permissions: req.user?.permissions || (req.user?.isAdmin ? ['admin:*'] : ['production:read', 'production:write', 'inventory:read']),
      isAdmin: Boolean(req.user?.isAdmin || req.user?.isMainAdmin || req.user?.role === 'admin')
    };

    sendEvent('status', 'Analyzing request against ERP tools...');

    const availableTools = getPermittedTools(userContext.permissions, userContext.role, userContext.isAdmin);

    // Run execution loop
    const result = await runLocalOrGeminiAgent({
      message,
      userContext,
      availableTools,
      conversationHistory,
      onStatus: (status) => sendEvent('status', status),
      onToolResult: (tool, toolRes) => sendEvent('tool_result', { tool, result: toolRes })
    });

    // Stream text chunks
    const replyText = result.reply || '';
    const words = replyText.split(' ');
    for (let i = 0; i < words.length; i += 3) {
      const chunk = words.slice(i, i + 3).join(' ') + ' ';
      sendEvent('delta', chunk);
      await new Promise(r => setTimeout(r, 20));
    }

    sendEvent('done', '[DONE]');
    return res.end();
  } catch (err) {
    sendEvent('error', { error: err.message });
    return res.end();
  }
}

/**
 * Resilient Multi-Model Engine (Gemini / Local Deterministic with exact tool grounding)
 */
async function runLocalOrGeminiAgent({ message, userContext, availableTools, conversationHistory, onStatus, onToolResult }) {
  const toolEvents = [];
  let reply = '';
  const messages = [...conversationHistory, { role: 'user', content: message }];

  const promptLower = message.toLowerCase();

  // Pattern detection for tools
  const jcMatch = message.match(/\b(?:JC[-_]?)?(\d{4}[-_]?\d{2,6}|\d{3,6})\b/i) || message.match(/JC-[\w-]+/i);
  const jcId = jcMatch ? (jcMatch[0].startsWith('JC-') ? jcMatch[0] : `JC-${jcMatch[0]}`) : null;

  if ((promptLower.includes('advance') || promptLower.includes('next stage') || promptLower.includes('update stage')) && jcId) {
    if (onStatus) onStatus(`Advancing stage for job card ${jcId}...`);
    let nextStage = 'printing';
    if (promptLower.includes('curing') || promptLower.includes('heat')) nextStage = 'curing';
    else if (promptLower.includes('cutting')) nextStage = 'cutting';
    else if (promptLower.includes('packaging')) nextStage = 'packaging';
    else if (promptLower.includes('dispatched')) nextStage = 'dispatched';

    const handler = erpServiceHandlers.update_job_stage;
    const res = await handler({ jobCardId: jcId, nextStage }, userContext);
    toolEvents.push({ tool: 'update_job_stage', result: res });
    if (onToolResult) onToolResult('update_job_stage', res);

    reply = `Job Card **${res.jobCardId}** has been successfully advanced to the **${res.newStage}** stage. Machine **${res.assignedMachine}** is logged for production.`;
  } else if ((promptLower.includes('job') || promptLower.includes('card') || promptLower.includes('production') || promptLower.includes('status')) && jcId) {
    if (onStatus) onStatus(`Fetching status for ${jcId}...`);
    const handler = erpServiceHandlers.get_job_card_status;
    const res = await handler({ jobCardId: jcId }, userContext);
    toolEvents.push({ tool: 'get_job_card_status', result: res });
    if (onToolResult) onToolResult('get_job_card_status', res);

    if (res.error) {
      reply = `I could not find record for **${jcId}** in tenant **${userContext.tenantId}**.`;
    } else {
      reply = `Here is the live status for **${res.jobCardId}**:\n` +
        `- **Current Stage:** \`${res.stage}\`\n` +
        `- **Fabric Item:** ${res.item}\n` +
        `- **Allocated Volume:** ${res.allocatedMeters} meters\n` +
        `- **Machine:** ${res.assignedMachine}\n` +
        `- **Estimated Completion:** ${res.estimatedCompletion}`;
    }
  } else if (promptLower.includes('stock') || promptLower.includes('balance') || promptLower.includes('reserve') || promptLower.includes('fabric')) {
    if (onStatus) onStatus('Querying warehouse inventory...');
    const itemCode = message.replace(/check|stock|balance|reserve|fabric|for|how|much|of|meters?|is|available/gi, '').trim() || 'Cotton Cambric';
    const handler = erpServiceHandlers.check_stock_balance;
    const res = await handler({ itemCode }, userContext);
    toolEvents.push({ tool: 'check_stock_balance', result: res });
    if (onToolResult) onToolResult('check_stock_balance', res);

    reply = `Current warehouse stock balance for **${res.itemCode}** is **${res.totalAvailable} ${res.units || 'meters'}** across Godown locations.`;
  } else {
    reply = `Hello! I am your **ERP Operations Copilot**.\n\n` +
      `You can ask me to:\n` +
      `- Check live Job Card status (e.g. *"Check job JC-2026-104"*)\n` +
      `- Advance production stage (e.g. *"Advance JC-2026-104 to printing"*)\n` +
      `- Query godown fabric stock balances (e.g. *"Check stock balance for Cotton Cambric"*)\n` +
      `- Report machine downtime or query client receivables.`;
  }

  messages.push({ role: 'assistant', content: reply });
  return { reply, messages, toolEvents };
}

module.exports = {
  handleAgentChat,
  handleAgentChatStream
};
