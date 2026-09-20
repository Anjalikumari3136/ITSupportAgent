import React, { useEffect, useRef } from 'react'

const SCENARIOS = [
  "Can I get Wi-Fi access for a guest visiting tomorrow?",
  "I'm locked out of my account, tried my password 6 times.",
  "I think I got a phishing email asking for my login.",
  "hey can you help, its not working",
  "My VPN says my credentials expired.",
  "I can't log into the expense management tool.",
  "A contractor needs VPN access.",
  "My laptop won't turn on. I've had it about 3.5 years.",
]

const DECISION_ICONS = {
  RESOLVED:          '✅',
  NEEDS_INFORMATION: '❓',
  ESCALATE:          '🚨',
  ROUTE_TO_TEAM:     '↪️',
}

function formatMarkdown(text) {
  if (!text) return ''
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g,     '<em>$1</em>')
    .replace(/`(.+?)`/g,       '<code>$1</code>')
    .replace(/\n/g,            '<br/>')
}

export default function ChatPanel({
  messages,
  loading,
  input,
  setInput,
  employee,      // full employee object from auth
  onSend,
  onScenarioClick
}) {
  const bottomRef   = useRef(null)
  const textareaRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      onSend()
    }
  }

  const initials = employee
    ? employee.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : 'U'

  return (
    <div className="chat-panel">
      {/* Messages */}
      <div className="chat-messages">
        {messages.length === 0 ? (
          <div className="chat-empty">
            <div className="chat-empty-icon">🛡️</div>
            <h3>Veridian IT Support Agent</h3>
            {employee && (
              <p style={{ color: 'var(--accent)', fontSize: '12px', marginBottom: '4px' }}>
                Signed in as <strong>{employee.name}</strong>
                {' '}·{' '}
                <span className={`emp-type-inline ${employee.employmentType === 'CONTRACTOR' ? 'contractor' : 'fulltime'}`}>
                  {employee.employmentType === 'CONTRACTOR' ? '🔗 Contractor' : '👤 Full-Time'}
                </span>
              </p>
            )}
            <p>Describe your IT issue and I'll help you resolve it, route it, or escalate it.</p>
            <div className="chat-empty-scenarios">
              {SCENARIOS.map((s, i) => (
                <button
                  key={i}
                  className="scenario-chip"
                  onClick={() => onScenarioClick(s)}
                  title={s}
                >
                  {s.length > 40 ? s.slice(0, 40) + '…' : s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg, i) => (
            <div key={i} className={`message ${msg.role}`}>
              <div className="message-avatar">
                {msg.role === 'user' ? initials : '🛡️'}
              </div>
              <div className="message-body">
                {msg.role === 'agent' && msg.decision && (
                  <div className={`message-decision decision-${msg.decision}`}>
                    {DECISION_ICONS[msg.decision]} {msg.decision.replace(/_/g,' ')}
                  </div>
                )}
                <div
                  className="message-bubble"
                  dangerouslySetInnerHTML={{ __html: formatMarkdown(msg.content) }}
                />
                <div className="message-time">{msg.time}</div>
              </div>
            </div>
          ))
        )}

        {/* Typing indicator */}
        {loading && (
          <div className="message agent">
            <div className="message-avatar">🛡️</div>
            <div className="message-body">
              <div className="typing-indicator">
                <div className="typing-dot" />
                <div className="typing-dot" />
                <div className="typing-dot" />
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div className="chat-input-area">
        <div className="chat-form">
          <textarea
            ref={textareaRef}
            className="chat-textarea"
            placeholder="Describe your IT issue… (Enter to send, Shift+Enter for new line)"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            rows={1}
            id="chat-input"
            disabled={loading}
          />
          <button
            className="send-btn"
            onClick={onSend}
            disabled={loading || !input.trim()}
            id="send-btn"
          >
            {loading ? '…' : '↑ Send'}
          </button>
        </div>
      </div>
    </div>
  )
}
