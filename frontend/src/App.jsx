import React, { useState, useEffect } from 'react'
import ChatPanel    from './components/ChatPanel'
import AnalysisPanel from './components/AnalysisPanel'
import TicketPanel   from './components/TicketPanel'
import AuditTrail    from './components/AuditTrail'
import LoginPage     from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'

const API_BASE = '/api'

function now() {
  return new Date().toLocaleTimeString('en-GB', { hour12: false })
}

const SESSION_KEY  = 'veridian_employee'
const CHAT_KEY     = 'veridian_chat'

export default function App() {
  // ── Page state ──────────────────────────────────────────────────────────────
  // 'login' | 'dashboard' | 'chat'
  const [page,         setPage]         = useState('login')
  const [employee,     setEmployee]     = useState(null)   // full profile object

  // ── Chat state ───────────────────────────────────────────────────────────────
  const [messages,     setMessages]     = useState([])
  const [input,        setInput]        = useState('')
  const [loading,      setLoading]      = useState(false)
  const [caseAnalysis, setCaseAnalysis] = useState(null)
  const [sources,      setSources]      = useState([])
  const [ticket,       setTicket]       = useState(null)
  const [auditTrail,   setAuditTrail]   = useState([])
  const [activeTab,    setActiveTab]    = useState('audit')

  // ── On mount: restore session ────────────────────────────────────────────────
  useEffect(() => {
    const stored = sessionStorage.getItem(SESSION_KEY)
    if (stored) {
      try {
        const emp = JSON.parse(stored)
        setEmployee(emp)
        setPage('dashboard')
      } catch {
        sessionStorage.removeItem(SESSION_KEY)
      }
    }

    // Restore chat from sessionStorage
    const storedChat = sessionStorage.getItem(CHAT_KEY)
    if (storedChat) {
      try { setMessages(JSON.parse(storedChat)) } catch {}
    }
  }, [])

  // ── Persist chat to sessionStorage ───────────────────────────────────────────
  useEffect(() => {
    if (messages.length > 0) {
      sessionStorage.setItem(CHAT_KEY, JSON.stringify(messages))
    }
  }, [messages])

  // ── Auth handlers ─────────────────────────────────────────────────────────────
  function handleLogin(emp) {
    setEmployee(emp)
    setPage('dashboard')
  }

  function handleLogout() {
    sessionStorage.removeItem(SESSION_KEY)
    sessionStorage.removeItem(CHAT_KEY)
    setEmployee(null)
    setMessages([])
    setCaseAnalysis(null)
    setSources([])
    setTicket(null)
    setAuditTrail([])
    setPage('login')
  }

  // ── Chat ───────────────────────────────────────────────────────────────────
  async function sendMessage(text) {
    const msg = text?.trim() || input.trim()
    if (!msg || !employee) return

    setInput('')
    setLoading(true)

    setMessages(prev => [...prev, { role: 'user', content: msg, time: now() }])

    try {
      const res = await fetch(`${API_BASE}/chat`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          message:        msg,
          employee:       employee.name,
          email:          employee.email,
          employeeId:     employee.employeeId,
          employmentType: employee.employmentType
        })
      })

      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()

      setMessages(prev => [...prev, {
        role:     'agent',
        content:  data.response,
        decision: data.decision,
        time:     now()
      }])

      setCaseAnalysis(data.caseAnalysis)
      setSources(data.sources || [])
      if (data.ticket) {
        setTicket(data.ticket)
        setActiveTab('ticket')
      }
      if (data.auditTrail?.length) {
        setAuditTrail(prev => [...prev, ...data.auditTrail])
      }

    } catch (err) {
      setMessages(prev => [...prev, {
        role:    'agent',
        content: '⚠️ Could not reach the backend. Please ensure the backend server is running on port 3001.',
        time:    now()
      }])
    } finally {
      setLoading(false)
    }
  }

  function handleScenarioClick(scenario) {
    setInput(scenario)
    setTimeout(() => sendMessage(scenario), 50)
  }

  // ── Routing ────────────────────────────────────────────────────────────────
  if (page === 'login') {
    return <LoginPage onLogin={handleLogin} />
  }

  if (page === 'dashboard') {
    return (
      <DashboardPage
        employee={employee}
        onOpenChat={() => setPage('chat')}
        onLogout={handleLogout}
      />
    )
  }

  // page === 'chat'
  return (
    <div className="app-shell">
      {/* Header */}
      <header className="app-header">
        <div className="header-left">
          <div className="header-logo">🛡️</div>
          <div>
            <div className="header-title">VERIDIAN IT SUPPORT AGENT</div>
            <div className="header-subtitle">Internal IT Helpdesk — Veridian Corp</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* Logged-in employee pill */}
          <div className="header-employee-pill">
            <span className="header-emp-avatar">
              {employee.name.split(' ').map(n => n[0]).join('').slice(0,2)}
            </span>
            <div>
              <div className="header-emp-name">{employee.name}</div>
              <div className="header-emp-type">
                {employee.employmentType === 'CONTRACTOR' ? '🔗 Contractor' : '👤 Full-Time'}
              </div>
            </div>
          </div>
          <div className="header-badge">
            <span className="status-dot" />
            Agent Online
          </div>
          <button className="logout-btn" onClick={() => setPage('dashboard')} id="back-dashboard-btn">
            ← Dashboard
          </button>
          <button className="logout-btn" onClick={handleLogout} id="chat-logout-btn">
            Sign Out
          </button>
        </div>
      </header>

      {/* Main */}
      <div className="app-content">
        <ChatPanel
          messages={messages}
          loading={loading}
          input={input}
          setInput={setInput}
          employee={employee}
          onSend={() => sendMessage()}
          onScenarioClick={handleScenarioClick}
        />

        <aside className="right-panel">
          <AnalysisPanel caseAnalysis={caseAnalysis} sources={sources} />
        </aside>
      </div>

      {/* Bottom — Ticket + Audit Trail */}
      <div className="bottom-section">
        <div className="bottom-tabs">
          <button
            className={`bottom-tab ${activeTab === 'audit' ? 'active' : ''}`}
            onClick={() => setActiveTab('audit')}
            id="tab-audit"
          >
            📋 Audit Trail
            {auditTrail.length > 0 && (
              <span className="tab-badge">{auditTrail.length}</span>
            )}
          </button>
          <button
            className={`bottom-tab ${activeTab === 'ticket' ? 'active' : ''}`}
            onClick={() => setActiveTab('ticket')}
            id="tab-ticket"
          >
            🎫 Simulated Ticket
            {ticket && <span className="tab-badge">1</span>}
          </button>
        </div>

        <div className="bottom-content">
          {activeTab === 'audit' ? (
            <AuditTrail entries={auditTrail} />
          ) : (
            ticket
              ? <TicketPanel ticket={ticket} />
              : <div style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
                  No simulated ticket yet. Tickets are created when a request is escalated.
                </div>
          )}
        </div>
      </div>
    </div>
  )
}
