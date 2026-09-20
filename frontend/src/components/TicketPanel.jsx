import React from 'react'

export default function TicketPanel({ ticket }) {
  if (!ticket) return null

  const fields = [
    { label: 'Employee',         value: ticket.employee },
    { label: 'Email',            value: ticket.employeeEmail },
    { label: 'Category',         value: ticket.category },
    { label: 'Issue Summary',    value: ticket.issueSummary },
    { label: 'Source',           value: ticket.source },
    { label: 'Priority',         value: ticket.priority, className: `priority-${ticket.priority}` },
    { label: 'Reason',           value: ticket.reasonForEscalation },
    { label: 'Recommended Action', value: ticket.recommendedNextAction },
    { label: 'Status',           value: ticket.status },
  ]

  return (
    <div className="ticket-card">
      <div className="ticket-header">
        <span className="ticket-id">{ticket.ticketId}</span>
        <span className="ticket-sim-badge">⚠ SIMULATED</span>
      </div>
      <div className="ticket-body">
        {fields.map((f, i) => f.value ? (
          <div key={i} className="ticket-field">
            <span className="ticket-field-label">{f.label}</span>
            <span className={`ticket-field-value ${f.className || ''}`}>{f.value}</span>
          </div>
        ) : null)}
      </div>
    </div>
  )
}
