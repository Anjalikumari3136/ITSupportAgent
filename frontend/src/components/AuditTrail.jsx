import React from 'react'

export default function AuditTrail({ entries }) {
  if (!entries || entries.length === 0) {
    return <div style={{ color: 'var(--text-muted)', fontSize: '12px' }}>No audit events yet.</div>
  }

  return (
    <div className="audit-list">
      {entries.map((entry, i) => (
        <div key={i} className="audit-entry">
          <span className="audit-time">{entry.timestamp}</span>
          <div className="audit-content">
            <span className="audit-event">{entry.event}</span>
            {entry.detail && <span className="audit-detail">{entry.detail}</span>}
          </div>
        </div>
      ))}
    </div>
  )
}
