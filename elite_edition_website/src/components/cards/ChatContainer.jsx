import React, { useState, useRef, useEffect } from "react";
import { ToolResultDispatcher } from "./ToolResultDispatcher";
import { streamAgentChat } from "./streamService";

export function ChatContainer({ onClose }) {
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content: "Hello! I am your **ERP Operations Copilot**.\nI can query live batch states, advance production stages, and check Godown roll balances.\n\nTry asking:\n- *\"Check job JC-2026-104\"*\n- *\"Check stock balance for Cotton Cambric\"*",
      toolEvents: []
    }
  ]);
  const [input, setInput] = useState("");
  const [currentStatus, setCurrentStatus] = useState(null);
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, currentStatus]);

  const handleSend = async (messageText) => {
    const textToSend = messageText || input;
    if (!textToSend.trim() || isSending) return;

    setIsSending(true);
    const userMsg = { role: "user", content: textToSend };
    const assistantMsgIndex = messages.length + 1;

    // Append user message and placeholder assistant message
    setMessages((prev) => [
      ...prev,
      userMsg,
      { role: "assistant", content: "", toolEvents: [] }
    ]);
    if (!messageText) setInput("");

    try {
      await streamAgentChat({
        message: textToSend,
        history: messages,
        onStatus: (statusText) => setCurrentStatus(statusText),
        onDelta: (textChunk) => {
          setMessages((prev) => {
            const updated = [...prev];
            const target = updated[assistantMsgIndex];
            if (target) {
              target.content = (target.content || "") + textChunk;
            }
            return updated;
          });
        },
        onToolResult: (tool, result) => {
          setCurrentStatus(null);
          setMessages((prev) => {
            const updated = [...prev];
            const target = updated[assistantMsgIndex];
            if (target) {
              target.toolEvents = [...(target.toolEvents || []), { tool, result }];
            }
            return updated;
          });
        }
      });
    } finally {
      setCurrentStatus(null);
      setIsSending(false);
    }
  };

  // Card button click handler: triggers conversational agent action
  const handleCardAction = (actionType, payload) => {
    if (actionType === "advance_stage") {
      handleSend(`Advance job card ${payload.jobCardId} to the next stage`);
    } else if (actionType === "reserve_stock") {
      handleSend(`Reserve 500 meters of item ${payload.itemCode} for our next job`);
    } else if (actionType === "view_details") {
      window.open(`/job-cards?search=${encodeURIComponent(payload.jobCardId)}`, "_blank");
    }
  };

  return (
    <div
      className="flex flex-col h-[650px] w-full max-w-2xl border border-slate-300 rounded-2xl bg-slate-50 overflow-hidden shadow-lg"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '650px',
        maxHeight: '90vh',
        width: '100%',
        maxWidth: '680px',
        border: '1px solid #cbd5e1',
        borderRadius: '16px',
        background: '#f8fafc',
        overflow: 'hidden',
        boxShadow: '0 20px 45px rgba(0, 0, 0, 0.15)',
        boxSizing: 'border-box'
      }}
    >
      {/* Header */}
      <div
        className="px-5 py-3.5 bg-white border-b border-slate-200 flex items-center justify-between"
        style={{
          padding: '12px 20px',
          background: '#ffffff',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}
      >
        <div>
          <h2
            className="text-sm font-bold text-slate-800 m-0"
            style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <span>⚡ ERP Copilot</span>
          </h2>
          <p
            className="text-xs text-slate-400 m-0"
            style={{ margin: 0, fontSize: '0.74rem', color: '#64748b' }}
          >
            Live Operational Assistant • Real-Time Agent
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            className="flex items-center gap-1.5 text-xs text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full font-medium"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.74rem',
              color: '#059669',
              background: '#ecfdf5',
              padding: '2px 8px',
              borderRadius: '9999px',
              fontWeight: 600,
              border: '1px solid #a7f3d0'
            }}
          >
            <span
              className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: '#10b981',
                boxShadow: '0 0 6px rgba(16, 185, 129, 0.6)'
              }}
            ></span>
            Connected
          </div>
          {onClose && (
            <button
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                fontSize: '1.1rem',
                cursor: 'pointer',
                color: '#64748b'
              }}
              title="Close Copilot"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Messages Feed */}
      <div
        className="flex-1 overflow-y-auto p-4 space-y-4"
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px'
        }}
      >
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start'
            }}
          >
            {/* Plain text bubble */}
            {msg.content && (
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
                  msg.role === "user"
                    ? "bg-blue-600 text-white rounded-br-none"
                    : "bg-white text-slate-800 border border-slate-200 shadow-sm rounded-bl-none whitespace-pre-wrap"
                }`}
                style={{
                  maxWidth: '85%',
                  borderRadius: '14px',
                  padding: '10px 14px',
                  fontSize: '0.86rem',
                  lineHeight: '1.45',
                  wordBreak: 'break-word',
                  whiteSpace: 'pre-wrap',
                  background: msg.role === 'user' ? '#2563eb' : '#ffffff',
                  color: msg.role === 'user' ? '#ffffff' : '#1e293b',
                  border: msg.role === 'user' ? 'none' : '1px solid #e2e8f0',
                  boxShadow: msg.role === 'user' ? '0 2px 8px rgba(37,99,235,0.25)' : '0 1px 3px rgba(0,0,0,0.03)',
                  borderBottomRightRadius: msg.role === 'user' ? '3px' : '14px',
                  borderBottomLeftRadius: msg.role === 'user' ? '14px' : '3px'
                }}
              >
                {msg.content}
              </div>
            )}

            {/* Embedded interactive tool widgets */}
            {msg.toolEvents?.map((evt, toolIdx) => (
              <ToolResultDispatcher
                key={toolIdx}
                toolName={evt.tool}
                result={evt.result}
                onCardAction={handleCardAction}
              />
            ))}
          </div>
        ))}

        {/* Live status badge during tool execution */}
        {currentStatus && (
          <div
            className="flex items-center gap-2 text-xs text-slate-500 italic py-1"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '0.78rem',
              color: '#64748b',
              fontStyle: 'italic',
              padding: '4px 0'
            }}
          >
            <span
              className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"
              style={{
                width: '12px',
                height: '12px',
                borderRadius: '50%',
                border: '2px solid #2563eb',
                borderTopColor: 'transparent',
                display: 'inline-block'
              }}
            ></span>
            {currentStatus}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div
        className="p-3 bg-white border-t border-slate-200"
        style={{
          padding: '12px 16px',
          background: '#ffffff',
          borderTop: '1px solid #e2e8f0'
        }}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex gap-2"
          style={{ display: 'flex', gap: '8px' }}
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isSending}
            placeholder="Check job JC-2026-104 or ask for stock..."
            className="flex-1 px-4 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-slate-50"
            style={{
              flex: 1,
              padding: '8px 14px',
              fontSize: '0.86rem',
              border: '1px solid #cbd5e1',
              borderRadius: '10px',
              background: '#f8fafc',
              outline: 'none',
              boxSizing: 'border-box'
            }}
          />
          <button
            type="submit"
            disabled={isSending || !input.trim()}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-xl transition"
            style={{
              padding: '8px 18px',
              background: isSending || !input.trim() ? '#94a3b8' : '#2563eb',
              color: '#ffffff',
              fontSize: '0.84rem',
              fontWeight: 700,
              borderRadius: '10px',
              border: 'none',
              cursor: isSending || !input.trim() ? 'not-allowed' : 'pointer',
              transition: 'background 0.2s ease'
            }}
          >
            {isSending ? '...' : 'Send'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default ChatContainer;
