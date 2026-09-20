import React from 'react'

const DECISION_ICONS = {
  RESOLVED:          '✅',
  NEEDS_INFORMATION: '❓',
  ESCALATE:          '🚨',
  ROUTE_TO_TEAM:     '↪️',
}

export default function AnalysisPanel({ caseAnalysis, sources }) {
  return (
    <>
      {/* Case Analysis */}
      <div className="panel-section">
        <div className="panel-section-header">
          <span className="panel-section-icon">🔍</span>
          <span className="panel-section-title">Case Analysis</span>
        </div>
        {!caseAnalysis ? (
          <div className="analysis-empty">No analysis yet — send a message to begin.</div>
        ) : (
          <div className="analysis-grid">
            <div className="analysis-row">
              <span className="analysis-label">Intent</span>
              <span className="analysis-value">{caseAnalysis.intent}</span>
            </div>
            <div className="analysis-row">
              <span className="analysis-label">Category</span>
              <span className="analysis-value">{caseAnalysis.category}</span>
            </div>
            <div className="analysis-row">
              <span className="analysis-label">Decision</span>
              <span className={`decision-badge decision-${caseAnalysis.decision}`}>
                {DECISION_ICONS[caseAnalysis.decision]} {caseAnalysis.decision?.replace(/_/g,' ')}
              </span>
            </div>
            <div className="analysis-row">
              <span className="analysis-label">Risk</span>
              <span className={`analysis-value risk-${caseAnalysis.risk}`}>{caseAnalysis.risk}</span>
            </div>
            <div className="analysis-row">
              <span className="analysis-label">Status</span>
              <span className="analysis-value" style={{ fontSize: '11px' }}>{caseAnalysis.status}</span>
            </div>
          </div>
        )}
      </div>

      {/* Source Panel */}
      <div className="panel-section">
        <div className="panel-section-header">
          <span className="panel-section-icon">📋</span>
          <span className="panel-section-title">Source Used</span>
        </div>
        {!sources || sources.length === 0 ? (
          <div className="sources-empty">No source cited yet.</div>
        ) : (
          <div>
            {sources.map((src, i) => (
              <div key={i} className="source-tag">
                <span className="source-id">{src.id}</span>
                <span className="source-title">{src.title}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
