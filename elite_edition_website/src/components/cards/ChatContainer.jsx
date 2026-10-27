import React, { useState, useRef, useEffect } from "react";
import { Mic, MicOff, Globe, Sparkles, Volume2, AlertCircle, X } from "lucide-react";
import { ToolResultDispatcher } from "./ToolResultDispatcher";
import { streamAgentChat } from "./streamService";
import { useVoiceRecognition, SUPPORTED_VOICE_LANGUAGES } from "./useVoiceRecognition";

function renderMarkdownContent(text) {
  if (!text || typeof text !== 'string') return text;
  const lines = text.split('\n');
  return lines.map((line, lIdx) => {
    const isBullet = line.trim().startsWith('- ') || line.trim().startsWith('* ');
    const lineText = isBullet ? line.trim().slice(2) : line;

    const parts = [];
    const regex = /(\*\*[^*]+\*\*|\*[^*]+\*)/g;
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(lineText)) !== null) {
      if (match.index > lastIndex) {
        parts.push(lineText.substring(lastIndex, match.index));
      }
      const token = match[0];
      if (token.startsWith('**') && token.endsWith('**')) {
        parts.push(<strong key={match.index}>{token.slice(2, -2)}</strong>);
      } else if (token.startsWith('*') && token.endsWith('*')) {
        parts.push(<em key={match.index}>{token.slice(1, -1)}</em>);
      }
      lastIndex = regex.lastIndex;
    }
    if (lastIndex < lineText.length) {
      parts.push(lineText.substring(lastIndex));
    }

    if (isBullet) {
      return (
        <div key={lIdx} style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', marginLeft: '6px', marginY: '2px' }}>
          <span style={{ color: '#2563eb', fontWeight: 900 }}>•</span>
          <span>{parts}</span>
        </div>
      );
    }

    return (
      <div key={lIdx} style={{ minHeight: lineText.trim() === '' ? '0.6em' : 'auto' }}>
        {parts.length > 0 ? parts : ' '}
      </div>
    );
  });
}

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
  const [showLangMenu, setShowLangMenu] = useState(false);
  const messagesEndRef = useRef(null);

  // Hook for floor operator voice input
  const {
    isListening,
    isSupported,
    selectedLang,
    setSelectedLang,
    interimText,
    errorMsg,
    toggleListening,
    stopListening
  } = useVoiceRecognition({
    onTranscript: (spokenText, isFinal) => {
      setInput(spokenText);
    },
    onFinalSpeech: (finalText) => {
      setInput(finalText);
    }
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, currentStatus]);

  // Close modal when Escape key is pressed
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        onClose?.();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

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
              aria-label="Close Copilot"
              title="Close Copilot"
              style={{
                background: 'none',
                border: 'none',
                fontSize: '1.1rem',
                cursor: 'pointer',
                color: '#64748b'
              }}
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
                {typeof msg.content === 'string' ? renderMarkdownContent(msg.content) : msg.content}
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

      {/* Quick Floor Chips */}
      <div
        style={{
          display: 'flex',
          gap: '6px',
          overflowX: 'auto',
          padding: '8px 16px',
          background: '#f1f5f9',
          borderTop: '1px solid #e2e8f0',
          scrollbarWidth: 'none'
        }}
      >
        {[
          { label: "⚡ Check Job JC-2026-104", prompt: "Check job JC-2026-104" },
          { label: "📦 Cotton Cambric Stock", prompt: "Check stock balance for Cotton Cambric" },
          { label: "⚙️ Machine Downtime", prompt: "Report machine downtime for Digital Printer #1 with print head clogging" },
          { label: "💰 Overdue Receivables", prompt: "Show client receivables and pending balances" }
        ].map((chip, idx) => (
          <button
            key={idx}
            type="button"
            disabled={isSending}
            onClick={() => handleSend(chip.prompt)}
            style={{
              whiteSpace: 'nowrap',
              fontSize: '0.72rem',
              fontWeight: 600,
              padding: '4px 10px',
              borderRadius: '20px',
              background: '#ffffff',
              color: '#334155',
              border: '1px solid #cbd5e1',
              cursor: isSending ? 'not-allowed' : 'pointer',
              boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
              transition: 'all 0.15s ease'
            }}
            onMouseOver={(e) => (e.currentTarget.style.background = '#e2e8f0')}
            onMouseOut={(e) => (e.currentTarget.style.background = '#ffffff')}
          >
            {chip.label}
          </button>
        ))}
      </div>

      {/* Active Voice Listening Banner */}
      {isListening && (
        <div
          style={{
            padding: '8px 16px',
            background: 'linear-gradient(90deg, #fee2e2 0%, #fef2f2 100%)',
            borderTop: '1px solid #fca5a5',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '24px',
                height: '24px',
                borderRadius: '50%',
                background: '#ef4444',
                color: '#ffffff',
                boxShadow: '0 0 10px rgba(239, 68, 68, 0.6)'
              }}
            >
              <Mic size={14} className="animate-pulse" />
            </span>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#991b1b' }}>
                Listening in {SUPPORTED_VOICE_LANGUAGES.find(l => l.code === selectedLang)?.label}...
              </span>
              <span style={{ fontSize: '0.70rem', color: '#b91c1c' }}>
                {interimText ? `"${interimText}"` : "Speak clearly into your microphone..."}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={stopListening}
            style={{
              padding: '4px 10px',
              borderRadius: '6px',
              background: '#ef4444',
              color: '#ffffff',
              border: 'none',
              fontSize: '0.72rem',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            Done
          </button>
        </div>
      )}

      {/* Voice Error Banner */}
      {errorMsg && (
        <div
          style={{
            padding: '6px 14px',
            background: '#fff1f2',
            borderTop: '1px solid #fecdd3',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.74rem',
            color: '#be123c'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <AlertCircle size={14} />
            <span>{errorMsg}</span>
          </div>
        </div>
      )}

      {/* Input area */}
      <div
        className="p-3 bg-white border-t border-slate-200"
        style={{
          padding: '10px 16px',
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
          style={{ display: 'flex', gap: '8px', alignItems: 'center' }}
        >
          {/* Language Selection Pill */}
          <div style={{ position: 'relative' }}>
            <button
              type="button"
              onClick={() => setShowLangMenu(!showLangMenu)}
              title="Change Voice Input Language"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '8px 10px',
                fontSize: '0.76rem',
                fontWeight: 700,
                color: '#475569',
                background: '#f1f5f9',
                border: '1px solid #cbd5e1',
                borderRadius: '10px',
                cursor: 'pointer',
                whiteSpace: 'nowrap'
              }}
            >
              <Globe size={13} />
              <span>
                {selectedLang === 'hi-IN' ? 'Hindi' : selectedLang === 'gu-IN' ? 'Gujarati' : 'EN'}
              </span>
            </button>

            {showLangMenu && (
              <div
                style={{
                  position: 'absolute',
                  bottom: '100%',
                  left: 0,
                  marginBottom: '6px',
                  background: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: '10px',
                  boxShadow: '0 8px 20px rgba(0,0,0,0.12)',
                  zIndex: 50,
                  minWidth: '150px',
                  padding: '4px'
                }}
              >
                {SUPPORTED_VOICE_LANGUAGES.map((lang) => (
                  <button
                    key={lang.code}
                    type="button"
                    onClick={() => {
                      setSelectedLang(lang.code);
                      setShowLangMenu(false);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      width: '100%',
                      padding: '6px 10px',
                      fontSize: '0.78rem',
                      fontWeight: selectedLang === lang.code ? 700 : 500,
                      color: selectedLang === lang.code ? '#2563eb' : '#334155',
                      background: selectedLang === lang.code ? '#eff6ff' : 'transparent',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      textAlign: 'left'
                    }}
                  >
                    <span>{lang.flag} {lang.label}</span>
                    {selectedLang === lang.code && <span>✓</span>}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Text Input */}
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isSending}
            placeholder={
              isListening
                ? "Listening... Speak your command..."
                : selectedLang === 'hi-IN'
                ? "Speak or type in Hindi (e.g. Show status of JC-2026-104)"
                : selectedLang === 'gu-IN'
                ? "Speak or type in Gujarati (e.g. Show status of JC-2026-104)"
                : "Ask stock, check job card, or tap mic to speak..."
            }
            className="flex-1 px-4 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-slate-50"
            style={{
              flex: 1,
              padding: '9px 14px',
              fontSize: '0.86rem',
              border: isListening ? '1.5px solid #ef4444' : '1px solid #cbd5e1',
              borderRadius: '10px',
              background: isListening ? '#fef2f2' : '#f8fafc',
              outline: 'none',
              boxSizing: 'border-box'
            }}
          />

          {/* Voice Input Mic Button */}
          <button
            type="button"
            disabled={isSending}
            onClick={toggleListening}
            title={isListening ? "Stop Listening" : `Voice Input (${selectedLang === 'hi-IN' ? 'Hindi' : selectedLang === 'gu-IN' ? 'Gujarati' : 'English'})`}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '38px',
              height: '38px',
              borderRadius: '10px',
              border: isListening ? '2px solid #ef4444' : '1px solid #cbd5e1',
              background: isListening ? '#ef4444' : '#ffffff',
              color: isListening ? '#ffffff' : '#475569',
              cursor: isSending ? 'not-allowed' : 'pointer',
              boxShadow: isListening ? '0 0 12px rgba(239, 68, 68, 0.5)' : '0 1px 2px rgba(0,0,0,0.05)',
              transition: 'all 0.2s ease',
              flexShrink: 0
            }}
          >
            {isListening ? (
              <MicOff size={18} className="animate-bounce" />
            ) : (
              <Mic size={18} />
            )}
          </button>

          {/* Send Button */}
          <button
            type="submit"
            disabled={isSending || !input.trim()}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-xl transition"
            style={{
              padding: '9px 18px',
              background: isSending || !input.trim() ? '#94a3b8' : '#2563eb',
              color: '#ffffff',
              fontSize: '0.84rem',
              fontWeight: 700,
              borderRadius: '10px',
              border: 'none',
              cursor: isSending || !input.trim() ? 'not-allowed' : 'pointer',
              transition: 'background 0.2s ease',
              flexShrink: 0
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
