import React, { useState, useEffect } from 'react'

const API_BASE = '/api'

export default function DashboardPage({ employee, onOpenChat, onLogout }) {
  const [requests, setRequests] = useState([])
  const [loadingReq, setLoadingReq] = useState(true)

  useEffect(() => {
    fetchMyRequests()
  }, [employee.employeeId])

  async function fetchMyRequests() {
    setLoadingReq(true)
    try {
      const res  = await fetch(`${API_BASE}/requests/my/${employee.employeeId}`)
      const data = await res.json()
      setRequests(Array.isArray(data) ? data : [])
    } catch {
      setRequests([])
    } finally {
      setLoadingReq(false)
    }
  }

  const initials = employee.name
    .split(' ')
    .map(n => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  const isContractor = employee.employmentType === 'CONTRACTOR'

  return (
    <div className="dashboard-page">
      {/* Header */}
      <header className="app-header">
        <div className="header-left">
          <div className="header-logo">🛡️</div>
          <div>
            <div className="header-title">VERIDIAN IT SUPPORT PORTAL</div>
            <div className="header-subtitle">Employee Dashboard</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div className="header-badge">
            <span className="status-dot" />
            Agent Online
          </div>
          <button className="logout-btn" onClick={onLogout} id="logout-btn">
            Sign Out
          </button>
        </div>
      </header>

      <div className="dashboard-content">
        {/* Left — Profile card */}
        <div className="dashboard-sidebar">
          <div className="profile-card">
            <div className="profile-avatar">{initials}</div>
            <div className="profile-name">{employee.name}</div>
            <div className="profile-email">{employee.email}</div>
            <div className="profile-meta">
              <div className="profile-row">
                <span className="profile-label">Employee ID</span>
                <span className="profile-value mono">{employee.employeeId}</span>
              </div>
              <div className="profile-row">
                <span className="profile-label">Type</span>
                <span className={`emp-type-badge ${isContractor ? 'contractor' : 'fulltime'}`}>
                  {isContractor ? '🔗 Contractor' : '👤 Full-Time'}
                </span>
              </div>
              {employee.department && (
                <div className="profile-row">
                  <span className="profile-label">Department</span>
                  <span className="profile-value">{employee.department}</span>
                </div>
              )}
            </div>

            <button
              className="open-chat-btn"
              onClick={onOpenChat}
              id="open-chat-btn"
            >
              🛡️ Open IT Support Chat
            </button>
          </div>

          {/* Quick tips */}
          <div className="dash-tips">
            <div className="dash-tips-title">💡 Quick Actions</div>
            {[
              'Ask about password reset',
              'Check VPN access',
              'Report a security issue',
              'Request laptop replacement',
            ].map((tip, i) => (
              <button
                key={i}
                className="dash-tip-chip"
                onClick={onOpenChat}
              >
                {tip}
              </button>
            ))}
          </div>
        </div>

        {/* Right — Requests */}
        <div className="dashboard-main">
          <div className="dash-section-header">
            <span className="dash-section-title">📋 My IT Requests</span>
            <button className="refresh-btn" onClick={fetchMyRequests} id="refresh-requests-btn">
              ↻ Refresh
            </button>
          </div>

          {loadingReq ? (
            <div className="dash-loading">Loading your requests…</div>
          ) : requests.length === 0 ? (
            <div className="dash-empty">
              <div className="dash-empty-icon">📭</div>
              <div>No IT requests yet.</div>
              <div style={{ fontSize: '12px', marginTop: '4px' }}>
                Open the IT Support Chat to get help — any tickets or requests created will appear here.
              </div>
            </div>
          ) : (
            <div className="request-list">
              {requests.map((req, i) => (
                <div key={req.id || i} className="request-card">
                  <div className="request-card-header">
                    <span className="request-id">{req.id}</span>
                    <span className={`request-status status-${(req.status || req.initialAction || 'Unknown').replace(/\s+/g,'_').toLowerCase().slice(0,12)}`}>
                      {req.status || req.initialAction || 'Unknown'}
                    </span>
                    <span className="request-date">{req.date}</span>
                  </div>
                  <div className="request-category">{req.category}</div>
                  <div className="request-text">"{req.request}"</div>
                  {req.note && <div className="request-note">📝 {req.note}</div>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
