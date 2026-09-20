import React, { useState } from 'react'

const API_BASE = import.meta.env.VITE_API_URL;

export default function LoginPage({ onLogin }) {
  const [mode,     setMode]     = useState('login')   // 'login' | 'signup'
  const [form,     setForm]     = useState({
    name: '', email: '', password: '', employmentType: 'FULL_TIME', department: ''
  })
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)

  function handleChange(e) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
    setError('')
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const endpoint = mode === 'login' ? '/auth/login' : '/auth/signup'
      const body     = mode === 'login'
        ? { email: form.email, password: form.password }
        : { name: form.name, email: form.email, password: form.password,
            employmentType: form.employmentType, department: form.department }

      const res  = await fetch(`${API_BASE}${endpoint}`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body)
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Something went wrong.')
        return
      }

      // Save to sessionStorage and notify parent
      sessionStorage.setItem('veridian_employee', JSON.stringify(data.employee))
      onLogin(data.employee)

    } catch (err) {
      setError('Could not reach the backend. Is the server running on port 3001?')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        {/* Logo */}
        <div className="auth-logo">
          <div className="auth-logo-icon">🛡️</div>
          <div>
            <div className="auth-logo-title">VERIDIAN CORP</div>
            <div className="auth-logo-subtitle">IT Support Portal</div>
          </div>
        </div>

        {/* Tabs */}
        <div className="auth-tabs">
          <button
            className={`auth-tab ${mode === 'login' ? 'active' : ''}`}
            onClick={() => { setMode('login'); setError('') }}
            id="tab-login"
          >
            Sign In
          </button>
          <button
            className={`auth-tab ${mode === 'signup' ? 'active' : ''}`}
            onClick={() => { setMode('signup'); setError('') }}
            id="tab-signup"
          >
            Sign Up
          </button>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          {/* Name — signup only */}
          {mode === 'signup' && (
            <div className="auth-field">
              <label className="auth-label" htmlFor="auth-name">Full Name</label>
              <input
                id="auth-name"
                className="auth-input"
                name="name"
                type="text"
                placeholder="Your full name"
                value={form.name}
                onChange={handleChange}
                required
                autoComplete="name"
              />
            </div>
          )}

          {/* Email */}
          <div className="auth-field">
            <label className="auth-label" htmlFor="auth-email">Work Email</label>
            <input
              id="auth-email"
              className="auth-input"
              name="email"
              type="email"
              placeholder="you@veridian-corp.example"
              value={form.email}
              onChange={handleChange}
              required
              autoComplete="email"
            />
          </div>

          {/* Password */}
          <div className="auth-field">
            <label className="auth-label" htmlFor="auth-password">Password</label>
            <input
              id="auth-password"
              className="auth-input"
              name="password"
              type="password"
              placeholder="••••••••"
              value={form.password}
              onChange={handleChange}
              required
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            />
          </div>

          {/* Employment Type — signup only */}
          {mode === 'signup' && (
            <>
              <div className="auth-field">
                <label className="auth-label" htmlFor="auth-employment">Employment Type</label>
                <select
                  id="auth-employment"
                  className="auth-input auth-select"
                  name="employmentType"
                  value={form.employmentType}
                  onChange={handleChange}
                  required
                >
                  <option value="FULL_TIME">Full-Time Employee</option>
                  <option value="CONTRACTOR">Contractor</option>
                </select>
              </div>
              <div className="auth-field">
                <label className="auth-label" htmlFor="auth-dept">Department (optional)</label>
                <input
                  id="auth-dept"
                  className="auth-input"
                  name="department"
                  type="text"
                  placeholder="e.g. Engineering, Finance"
                  value={form.department}
                  onChange={handleChange}
                />
              </div>
            </>
          )}

          {/* Error */}
          {error && <div className="auth-error">{error}</div>}

          {/* Submit */}
          <button
            className="auth-submit"
            type="submit"
            disabled={loading}
            id="auth-submit-btn"
          >
            {loading
              ? (mode === 'login' ? 'Signing in…' : 'Creating account…')
              : (mode === 'login' ? 'Sign In'      : 'Create Account')}
          </button>
        </form>

        {/* Demo hint */}
        {mode === 'login' && (
          <div className="auth-hint">
            <span>Demo:</span> <code>aditi.sharma@veridian-corp.example</code> / <code>password123</code>
          </div>
        )}
      </div>
    </div>
  )
}
