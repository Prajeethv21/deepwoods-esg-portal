import { useEffect, useState } from 'react'
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useNavigate,
} from 'react-router-dom'
import './App.css'

const TAB_CONFIG = [
  { key: 'energy', label: 'Energy', sheet: 'Energy' },
  { key: 'renewable', label: 'Renewable Energy', sheet: 'Renewable Energy' },
  { key: 'ghg', label: 'GHG Emissions', sheet: 'GHG Emissions' },
]

const INDUSTRIES = [
  'Manufacturing',
  'Information Technology',
  'FMCG',
  'Pharma',
  'Automobile',
  'Textiles',
  'Infrastructure',
  'Other',
]

const LOGIN_EMAIL = 'client@deepwoods.in'
const LOGIN_PASSWORD = 'password123'
const AUTH_STORAGE_KEY = 'esg_auth_token'

function createTabState() {
  return {
    fileName: '',
    url: '',
    uploadState: 'idle',
    submitState: 'idle',
    warning: '',
  }
}

async function parseJson(response) {
  const contentType = response.headers.get('content-type') || ''
  if (!contentType.includes('application/json')) {
    return {}
  }

  return response.json()
}

async function postJson(url, payload, token) {
  const headers = { 'Content-Type': 'application/json' }
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  })

  const data = await parseJson(response)
  if (!response.ok) {
    throw new Error(data.error || 'Request failed')
  }
  return data
}

async function uploadFile(file, companyName, tabKey, token) {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('companyName', companyName)
  formData.append('tabKey', tabKey)

  const headers = {}
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  const response = await fetch('/api/upload', {
    method: 'POST',
    headers,
    body: formData,
  })

  const data = await parseJson(response)
  if (!response.ok) {
    throw new Error(data.error || 'Upload failed')
  }
  return data
}

async function validateToken(token) {
  if (!token) {
    return false
  }

  const response = await fetch('/api/auth/validate', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  return response.ok
}

function PrivateRoute({ isAuthenticated, isReady, children }) {
  if (!isReady) {
    return (
      <main className="page-shell">
        <section className="panel auth-panel">
          <p className="lead">Validating session...</p>
        </section>
      </main>
    )
  }

  return isAuthenticated ? children : <Navigate to="/login" replace />
}

function WorkspaceLayout({ currentStep, companyDetails, uploads, onLogout, breadcrumbs, children }) {
  const isEnergyDone = Boolean(uploads?.energy?.url)
  const isRenewableDone = Boolean(uploads?.renewable?.url)
  const isGhgDone = Boolean(uploads?.ghg?.url)

  return (
    <div className="split-layout">
      <aside className="sidebar">
        <div>
          <div className="brand-section" style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '32px' }}>
            <div style={{ background: '#ffffff', borderRadius: '8px', padding: '6px 8px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1.5px solid var(--line)' }}>
              <img src="/logo.jpg" alt="Deepwoods Logo" style={{ height: '28px', objectFit: 'contain' }} />
            </div>
            <div>
              <h2 style={{ fontSize: '16px', color: 'var(--brand)', margin: 0, fontWeight: 800, letterSpacing: '0.5px' }}>Deepwoods</h2>
              <span style={{ fontSize: '11px', color: 'var(--brand-accent)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px' }}>Green Portal</span>
            </div>
          </div>

          <nav className="sidebar-stepper">
            <div className={`step-item ${currentStep === 1 ? 'active' : ''} ${currentStep > 1 ? 'completed' : ''}`}>
              <div className="step-badge">{currentStep > 1 ? '✓' : '1'}</div>
              <div className="step-info">
                <p className="step-title">Welcome Workspace</p>
                <p className="step-desc">ESG workflow dashboard overview</p>
              </div>
            </div>

            <div className={`step-item ${currentStep === 2 ? 'active' : ''} ${currentStep > 2 ? 'completed' : ''}`}>
              <div className="step-badge">{currentStep > 2 ? '✓' : '2'}</div>
              <div className="step-info">
                <p className="step-title">Company Profile</p>
                <p className="step-desc">Identify organization reporting details</p>
              </div>
            </div>

            <div className={`step-item ${currentStep === 3 ? 'active' : ''}`}>
              <div className="step-badge">3</div>
              <div className="step-info">
                <p className="step-title">Environmental KPI Uploads</p>
                <p className="step-desc">Submit 3 mandatory templates</p>
                {currentStep === 3 && (
                  <div className="step-subitems">
                    <div className={`subitem-check ${isEnergyDone ? 'done' : ''}`}>
                      <span className="dot"></span>
                      <span>Energy {isEnergyDone ? '✓' : ''}</span>
                    </div>
                    <div className={`subitem-check ${isRenewableDone ? 'done' : ''}`}>
                      <span className="dot"></span>
                      <span>Renewable Energy {isRenewableDone ? '✓' : ''}</span>
                    </div>
                    <div className={`subitem-check ${isGhgDone ? 'done' : ''}`}>
                      <span className="dot"></span>
                      <span>GHG Emissions {isGhgDone ? '✓' : ''}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </nav>
        </div>

        <div className="sidebar-footer" style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.4)', marginTop: 'auto', fontWeight: 600 }}>
          © {new Date().getFullYear()} Deepwoods Green Initiatives
        </div>
      </aside>

      <main className="main-content">
        <header className="workspace-header">
          <div className="workspace-breadcrumbs">
            {breadcrumbs.map((bc, idx) => (
              <span key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {idx > 0 && <span className="separator">/</span>}
                <span className={idx === breadcrumbs.length - 1 ? 'active' : ''}>{bc}</span>
              </span>
            ))}
          </div>

          <div className="user-profile">
            <div className="user-details">
              <span className="user-email">client@deepwoods.in</span>
              <button onClick={onLogout} className="logout-btn">Logout</button>
            </div>
            <div className="user-avatar">C</div>
          </div>
        </header>

        <div className="workspace-body">
          {children}
        </div>
      </main>
    </div>
  )
}

function LoginPage({ onLogin, isAuthenticated }) {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (isAuthenticated) {
    return <Navigate to="/home" replace />
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    const normalizedEmail = email.trim().toLowerCase()
    const normalizedPassword = password.trim()

    setIsSubmitting(true)

    try {
      if (
        normalizedEmail !== LOGIN_EMAIL.toLowerCase() ||
        normalizedPassword !== LOGIN_PASSWORD
      ) {
        throw new Error('Invalid credentials. Use the assignment credential to continue.')
      }

      const response = await postJson('/api/auth/login', {
        email: normalizedEmail,
        password: normalizedPassword,
      })

      setError('')
      onLogin(response.token)
      navigate('/home')
    } catch (authError) {
      setError(authError.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="login-split-container" id="login-page">
      <main className="login-form-side">
        <div style={{ width: '100%', maxWidth: '380px' }}>
          <header style={{ marginBottom: '32px', textAlign: 'left' }}>
            <div style={{ background: '#ffffff', borderRadius: '12px', padding: '10px 14px', display: 'inline-flex', border: '1.5px solid var(--line)', marginBottom: '20px' }}>
              <img src="/logo.jpg" alt="Deepwoods Green Logo" style={{ height: '36px', objectFit: 'contain' }} />
            </div>
            <h1 style={{ fontSize: '26px', fontWeight: 800, color: 'var(--brand)', margin: '0 0 8px 0', letterSpacing: '-0.03em' }}>
              Welcome to Deepwoods Green
            </h1>
            <p style={{ color: 'var(--ink-soft)', fontSize: '14px', margin: 0, fontWeight: 500 }}>
              Sign in by entering your information below
            </p>
          </header>

          <form onSubmit={handleSubmit} className="stack-gap" style={{ gap: '18px' }}>
            <label>
              Email address
              <div className="input-with-icon">
                <span className="input-icon">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
                </span>
                <input
                  type="email"
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value)
                    if (error) {
                      setError('')
                    }
                  }}
                  placeholder="Email address"
                  required
                />
              </div>
            </label>
            
            <label>
              Password
              <div className="input-with-icon">
                <span className="input-icon">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                </span>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(event) => {
                    setPassword(event.target.value)
                    if (error) {
                      setError('')
                    }
                  }}
                  placeholder="Password"
                  required
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                  )}
                </button>
              </div>
            </label>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px', margin: '2px 0' }}>
              <label style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '8px', cursor: 'pointer', margin: 0, textTransform: 'none', letterSpacing: 0, fontWeight: 500, color: 'var(--ink-soft)' }}>
                <input type="checkbox" style={{ margin: 0, width: '16px', height: '16px', cursor: 'pointer' }} />
                Remember me
              </label>
              <a href="#forgot" onClick={(e) => e.preventDefault()} style={{ fontSize: '13px', color: 'var(--brand-accent)', fontWeight: 700 }}>Forgot password?</a>
            </div>

            {error && <p className="status error">{error}</p>}

            <button type="submit" disabled={isSubmitting} style={{ width: '100%', borderRadius: '24px', padding: '14px', background: 'var(--brand-accent)', color: '#ffffff', border: 'none', fontSize: '15px', fontWeight: 700, marginTop: '8px' }}>
              {isSubmitting ? 'Logging in...' : 'Sign in'}
            </button>
          </form>

          <div style={{ textAlign: 'center', marginTop: '20px', fontSize: '14px', color: 'var(--ink-soft)', fontWeight: 500 }}>
            Don't have an account? <a href="#signup" onClick={(e) => e.preventDefault()} style={{ color: 'var(--brand-accent)', fontWeight: 700 }}>Sign up</a>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '24px 0 16px 0' }}>
            <div style={{ flex: 1, height: '1px', background: 'var(--line)' }}></div>
            <span style={{ fontSize: '11px', color: 'var(--ink-soft)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px' }}>Or</span>
            <div style={{ flex: 1, height: '1px', background: 'var(--line)' }}></div>
          </div>

          <div style={{ textAlign: 'center', marginBottom: '16px' }}>
            <span style={{ fontSize: '13px', color: 'var(--ink-soft)', fontWeight: 700 }}>Sign in with</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', gap: '16px' }}>
            <button type="button" className="social-login-btn">
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335" />
              </svg>
            </button>
            <button type="button" className="social-login-btn">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 4.17c.66-.81 1.11-1.93.99-3.06-.96.04-2.13.64-2.82 1.45-.6.69-1.12 1.83-.98 2.94 1.07.08 2.15-.52 2.81-1.33z" />
              </svg>
            </button>
            <button type="button" className="social-login-btn">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.779-1.75-1.75s.784-1.75 1.75-1.75 1.75.779 1.75 1.75-.784 1.75-1.75 1.75zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
              </svg>
            </button>
          </div>
        </div>
      </main>

      <aside className="login-promo-side">
        <svg className="circular-grids" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0.08, color: 'var(--brand)', pointerEvents: 'none' }} viewBox="0 0 800 800">
          <circle cx="600" cy="200" r="100" fill="none" stroke="currentColor" strokeWidth="1" />
          <circle cx="600" cy="200" r="200" fill="none" stroke="currentColor" strokeWidth="1" />
          <circle cx="600" cy="200" r="300" fill="none" stroke="currentColor" strokeWidth="1" />
          <circle cx="600" cy="200" r="400" fill="none" stroke="currentColor" strokeWidth="1" />
          <circle cx="600" cy="200" r="500" fill="none" stroke="currentColor" strokeWidth="1" />
          <circle cx="600" cy="200" r="600" fill="none" stroke="currentColor" strokeWidth="1" />
          <circle cx="600" cy="200" r="700" fill="none" stroke="currentColor" strokeWidth="1" />
        </svg>

        <div style={{ position: 'relative', zIndex: 2, maxWidth: '480px', textAlign: 'center' }}>
          <p className="eyebrow" style={{ color: 'var(--brand-accent)', letterSpacing: '2px', fontWeight: 800, marginBottom: '12px' }}>
            A Better Turn For Climate Action
          </p>
          <h2 style={{ fontSize: '38px', fontWeight: 800, color: 'var(--brand)', lineHeight: 1.25, marginBottom: '24px', letterSpacing: '-0.03em' }}>
            Simplifying Sustainability for India's MSMEs
          </h2>
          <p style={{ color: 'var(--ink-soft)', fontSize: '15px', lineHeight: 1.6, fontWeight: 500 }}>
            Turning sustainability action into credible narratives. Turning climate ideas into action. Turning net zero goals into progress.
          </p>
        </div>

        <div style={{ position: 'relative', width: '320px', height: '240px', marginTop: '32px', zIndex: 2 }}>
          <svg width="100%" height="100%" viewBox="0 0 320 240" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ overflow: 'visible' }}>
            <path d="M 90,120 A 45,45 0 1,1 180,120 A 45,45 0 1,1 270,120 A 45,45 0 1,1 180,120 A 45,45 0 1,1 90,120 Z" fill="none" stroke="rgba(133, 196, 65, 0.1)" strokeWidth="8" strokeLinecap="round" />
            <path d="M 90,120 A 45,45 0 1,1 180,120 A 45,45 0 1,1 270,120 A 45,45 0 1,1 180,120 A 45,45 0 1,1 90,120 Z" fill="none" stroke="var(--brand-accent)" strokeWidth="4" strokeLinecap="round" strokeDasharray="10 200" style={{ animation: 'dashOffset 10s linear infinite' }} />

            <line x1="100" y1="75" x2="100" y2="200" stroke="#b0c8bb" strokeWidth="4" strokeLinecap="round" />
            <g className="turbine-blade">
              <circle cx="100" cy="75" r="4" fill="var(--brand-accent)" />
              <path d="M 100,75 L 100,25" stroke="#b0c8bb" strokeWidth="4" strokeLinecap="round" />
              <path d="M 100,75 L 143,100" stroke="#b0c8bb" strokeWidth="4" strokeLinecap="round" />
              <path d="M 100,75 L 57,100" stroke="#b0c8bb" strokeWidth="4" strokeLinecap="round" />
            </g>

            <line x1="220" y1="105" x2="220" y2="200" stroke="#b0c8bb" strokeWidth="3" />
            <g className="turbine-blade-2">
              <circle cx="220" cy="105" r="3" fill="var(--brand-accent)" />
              <path d="M 220,105 L 220,65" stroke="#b0c8bb" strokeWidth="3" strokeLinecap="round" />
              <path d="M 220,105 L 254,125" stroke="#b0c8bb" strokeWidth="3" strokeLinecap="round" />
              <path d="M 220,105 L 186,125" stroke="#b0c8bb" strokeWidth="3" strokeLinecap="round" />
            </g>

            <path d="M150,140 L170,80 L140,80 L170,30 L150,90 L180,90 Z" fill="var(--brand-accent)" filter="drop-shadow(0 4px 10px rgba(133, 196, 65, 0.4))" />
          </svg>
        </div>
      </aside>
    </div>
  )
}

function HomePage({ companyDetails, uploads, onLogout }) {
  const navigate = useNavigate()

  return (
    <WorkspaceLayout
      currentStep={1}
      companyDetails={companyDetails}
      uploads={uploads}
      onLogout={onLogout}
      breadcrumbs={['Workspace', 'Dashboard']}
    >
      <div id="home-page">
        <div style={{ marginBottom: '32px' }}>
          <p className="eyebrow">ESG Workflow Overview</p>
          <h1 style={{ marginTop: '4px' }}>Sustainability Data Bank</h1>
          <p className="lead" style={{ margin: '8px 0 0 0' }}>
            Deepwoods Green initiatives help companies collect, validate, and report critical ESG parameters.
            Follow the guided step-by-step workspace to complete your profile and upload environmental metrics.
          </p>
        </div>

        <div className="card-grid">
          <div className="domain-card" onClick={() => navigate('/company')} style={{ borderBottom: '4px solid var(--brand-accent)' }}>
            <div>
              <span className="tag active" style={{ marginBottom: '16px' }}>Open</span>
              <h3>Environment</h3>
              <p style={{ marginTop: '8px' }}>
                Provide company information and upload templates for Energy, Renewable Energy, and Greenhouse Gas emissions.
              </p>
            </div>
            <button className="outline" style={{ width: 'fit-content', padding: '10px 16px', fontSize: '13px', marginTop: '16px' }}>
              Begin Uploads →
            </button>
          </div>
          
          <div className="domain-card muted" aria-disabled style={{ borderBottom: '4px solid #ccd5d1' }}>
            <div>
              <span className="tag" style={{ marginBottom: '16px' }}>Coming Soon</span>
              <h3>Social</h3>
              <p style={{ marginTop: '8px' }}>
                Track labor relations, employee welfare, diversity, community engagement, and human rights indicators.
              </p>
            </div>
          </div>
          
          <div className="domain-card muted" aria-disabled style={{ borderBottom: '4px solid #ccd5d1' }}>
            <div>
              <span className="tag" style={{ marginBottom: '16px' }}>Coming Soon</span>
              <h3>Governance</h3>
              <p style={{ marginTop: '8px' }}>
                Monitor board composition, executive compensation, shareholder rights, business ethics, and compliance code.
              </p>
            </div>
          </div>
        </div>
      </div>
    </WorkspaceLayout>
  )
}

function CompanyPage({ companyDetails, onSaveCompany, uploads, onLogout }) {
  const navigate = useNavigate()
  const [form, setForm] = useState(companyDetails)

  const handleChange = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }))
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    onSaveCompany({
      name: form.name.trim(),
      employees: Number(form.employees),
      industry: form.industry,
    })
    navigate('/environment')
  }

  return (
    <WorkspaceLayout
      currentStep={2}
      companyDetails={companyDetails}
      uploads={uploads}
      onLogout={onLogout}
      breadcrumbs={['Workspace', 'Company Profile']}
    >
      <div id="company-page">
        <div style={{ marginBottom: '32px' }}>
          <p className="eyebrow">Step 1 of 2</p>
          <h1 style={{ marginTop: '4px' }}>Company Information</h1>
          <p className="lead" style={{ margin: '8px 0 0 0' }}>
            Please fill in your company details. This profile information will be used to automatically format and name your uploaded spreadsheets.
          </p>
        </div>

        <section className="upload-box" style={{ maxWidth: '640px' }}>
          <form onSubmit={handleSubmit} className="stack-gap">
            <label>
              Company Name
              <input
                type="text"
                value={form.name}
                onChange={(event) => handleChange('name', event.target.value)}
                placeholder="e.g. Acme Corp"
                required
              />
            </label>

            <label>
              Number of Employees
              <input
                type="number"
                min="1"
                value={form.employees}
                onChange={(event) =>
                  handleChange('employees', event.target.value || 0)
                }
                placeholder="e.g. 250"
                required
              />
            </label>

            <label>
              Industry Vertical
              <select
                value={form.industry}
                onChange={(event) => handleChange('industry', event.target.value)}
                required
              >
                <option value="">Select industry</option>
                {INDUSTRIES.map((industry) => (
                  <option key={industry} value={industry}>
                    {industry}
                  </option>
                ))}
              </select>
            </label>

            <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
              <button type="button" className="outline" onClick={() => navigate('/home')}>
                Cancel
              </button>
              <button type="submit" style={{ flex: 1 }}>
                Save & Continue
              </button>
            </div>
          </form>
        </section>
      </div>
    </WorkspaceLayout>
  )
}

function EnvironmentPage({
  companyDetails,
  uploads,
  onUploadComplete,
  authToken,
  onUnauthorized,
  onLogout,
}) {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('energy')
  const [localError, setLocalError] = useState('')
  const [submitAllState, setSubmitAllState] = useState('idle')
  const [submitAllSuccess, setSubmitAllSuccess] = useState('')
  const [submitAllWarning, setSubmitAllWarning] = useState('')

  const isAllUploaded = Boolean(
    uploads.energy?.url &&
    uploads.renewable?.url &&
    uploads.ghg?.url
  )

  const submitAll = async () => {
    if (!isAllUploaded || submitAllState === 'submitting') {
      return
    }
    setSubmitAllState('submitting')
    setSubmitAllSuccess('')
    setSubmitAllWarning('')
    setLocalError('')

    try {
      // 1. Submit Energy
      const resEnergy = await postJson('/api/submit', {
        companyName: companyDetails.name,
        employees: companyDetails.employees,
        industry: companyDetails.industry,
        tabKey: 'energy',
        fileName: uploads.energy.fileName,
        fileUrl: uploads.energy.url,
      }, authToken)

      // 2. Submit Renewable
      const resRenewable = await postJson('/api/submit', {
        companyName: companyDetails.name,
        employees: companyDetails.employees,
        industry: companyDetails.industry,
        tabKey: 'renewable',
        fileName: uploads.renewable.fileName,
        fileUrl: uploads.renewable.url,
      }, authToken)

      // 3. Submit GHG
      const resGhg = await postJson('/api/submit', {
        companyName: companyDetails.name,
        employees: companyDetails.employees,
        industry: companyDetails.industry,
        tabKey: 'ghg',
        fileName: uploads.ghg.fileName,
        fileUrl: uploads.ghg.url,
      }, authToken)

      setSubmitAllState('submitted')
      setSubmitAllSuccess('All ESG files submitted successfully')
      
      // Update each tab submitState to 'submitted'
      onUploadComplete('energy', { submitState: 'submitted' })
      onUploadComplete('renewable', { submitState: 'submitted' })
      onUploadComplete('ghg', { submitState: 'submitted' })

      const warnings = [resEnergy.warning, resRenewable.warning, resGhg.warning]
        .filter(Boolean)
        .join(' | ')
      if (warnings) {
        setSubmitAllWarning(warnings)
      }
    } catch (err) {
      if (err.message.toLowerCase().includes('auth token')) {
        onUnauthorized()
      }
      setSubmitAllState('failed')
      setLocalError(`Submit All failed: ${err.message}`)
    }
  }

  if (!companyDetails.name || !companyDetails.industry || !companyDetails.employees) {
    return <Navigate to="/company" replace />
  }

  const activeConfig = TAB_CONFIG.find((tab) => tab.key === activeTab)
  const activeUpload = uploads[activeTab] || createTabState()

  const setActiveUpload = (updater) => {
    onUploadComplete(activeTab, updater)
  }

  const onSelectFile = async (event) => {
    const selectedFile = event.target.files?.[0]
    if (!selectedFile) {
      return
    }
    if (!selectedFile.name.toLowerCase().endsWith('.xlsx')) {
      setLocalError('Only .xlsx files are allowed for this assignment.')
      return
    }

    setLocalError('')
    setActiveUpload({
      uploadState: 'uploading',
      submitState: 'idle',
      warning: '',
    })

    try {
      const uploadResponse = await uploadFile(
        selectedFile,
        companyDetails.name,
        activeTab,
        authToken,
      )

      setActiveUpload({
        fileName: uploadResponse.fileName || uploadResponse.storageFileName || selectedFile.name,
        url: uploadResponse.fileUrl,
        provider: uploadResponse.provider,
        uploadState: 'uploaded',
        submitState: 'idle',
        warning: '',
      })
    } catch (error) {
      if (error.message.toLowerCase().includes('auth token')) {
        onUnauthorized()
      }
      setActiveUpload({
        uploadState: 'failed',
        submitState: 'idle',
      })
      setLocalError(error.message)
    }
  }

  const submitTab = async () => {
    if (!activeUpload.url || activeUpload.uploadState === 'uploading') {
      return
    }

    setLocalError('')

    setActiveUpload({
      submitState: 'submitting',
      warning: '',
    })

    try {
      const response = await postJson('/api/submit', {
        companyName: companyDetails.name,
        employees: companyDetails.employees,
        industry: companyDetails.industry,
        tabKey: activeTab,
        fileName: activeUpload.fileName,
        fileUrl: activeUpload.url,
      }, authToken)

      setActiveUpload({
        submitState: 'submitted',
        warning: response.warning || '',
      })
    } catch (error) {
      if (error.message.toLowerCase().includes('auth token')) {
        onUnauthorized()
      }
      setActiveUpload({
        submitState: 'failed',
      })
      setLocalError(error.message)
    }
  }

  return (
    <WorkspaceLayout
      currentStep={3}
      companyDetails={companyDetails}
      uploads={uploads}
      onLogout={onLogout}
      breadcrumbs={['Workspace', 'Environment Uploads']}
    >
      <div id="environment-page">
        <div style={{ marginBottom: '24px' }}>
          <p className="eyebrow">Step 2 of 2</p>
          <h1 style={{ marginTop: '4px' }}>Environmental KPI Uploads</h1>
          <p className="lead compact">
            Company Profile: <strong>{companyDetails.name}</strong> | Industry:{' '}
            <strong>{companyDetails.industry}</strong>
          </p>
        </div>

        <div className="tab-list">
          {TAB_CONFIG.map((tab) => (
            <button
              key={tab.key}
              className={`tab ${activeTab === tab.key ? 'active' : ''}`}
              type="button"
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label} {uploads[tab.key]?.url ? '✓' : ''}
            </button>
          ))}
        </div>

        <article className="upload-box">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '24px' }}>
            <h2 style={{ margin: 0 }}>{activeConfig.label} KPI Template</h2>
            <span className={`tag ${activeUpload.url ? 'active' : ''}`}>
              {activeUpload.url ? 'File Ready' : 'Pending Upload'}
            </span>
          </div>
          
          <p className="hint" style={{ marginBottom: '24px', fontSize: '14px' }}>
            Download the structured {activeConfig.label} spreadsheet, populate it with your organization's data, and upload the finalized `.xlsx` spreadsheet here.
          </p>

          <div className="actions-row" style={{ marginBottom: '24px' }}>
            <a
              className="button-link outline"
              href={`/api/template?sheet=${encodeURIComponent(activeConfig.sheet)}`}
              style={{ padding: '12px 20px', fontSize: '14px' }}
            >
              Download Template
            </a>

            <label className="file-picker" style={{ padding: '12px 20px', fontSize: '14px' }}>
              Upload .xlsx
              <input
                type="file"
                accept=".xlsx"
                onChange={onSelectFile}
                aria-label={`Upload ${activeConfig.label} file`}
              />
            </label>
          </div>

          {activeUpload.uploadState === 'uploading' && (
            <p className="status info" style={{ marginBottom: '16px' }}><span className="status-icon">⟳</span> Uploading document to secure storage...</p>
          )}
          {activeUpload.uploadState === 'uploaded' && (
            <p className="status ok" style={{ marginBottom: '16px' }}><span className="status-icon">✓</span> Document uploaded successfully</p>
          )}
          {activeUpload.submitState === 'submitting' && (
            <p className="status info" style={{ marginBottom: '16px' }}><span className="status-icon">⟳</span> Logging data to central registry...</p>
          )}
          {activeUpload.submitState === 'submitted' && (
            <p className="status ok" style={{ marginBottom: '16px' }}><span className="status-icon">✓</span> Data registry submission successful</p>
          )}
          {activeUpload.submitState === 'failed' && (
            <p className="status error" style={{ marginBottom: '16px' }}><span className="status-icon">✗</span> Registry submission failed</p>
          )}
          {activeUpload.warning && (
            <p className="status warning" style={{ marginBottom: '16px' }}><span className="status-icon">⚠</span> {activeUpload.warning}</p>
          )}

          {activeUpload.fileName && (
            <div className="file-info-box" style={{ margin: '16px 0 0' }}>
              <span className="file-success-badge">✓ Active Excel Document</span>
              <div className="file-details">
                <span className="file-label">Name:</span>
                <span className="file-name">{activeUpload.fileName}</span>
              </div>
              {activeUpload.url && (
                <div style={{ marginTop: '12px', fontSize: '13px' }}>
                  <a href={activeUpload.url} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    View Uploaded File ↗
                  </a>
                </div>
              )}
            </div>
          )}
        </article>

        {localError && <p className="status error" style={{ marginBottom: '24px' }}>{localError}</p>}

        {/* Submit All Section */}
        <div style={{
          marginTop: '32px',
          paddingTop: '28px',
          borderTop: '2px solid var(--line)',
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '24px',
            flexWrap: 'wrap',
            background: isAllUploaded ? '#f0f9f4' : '#fafafa',
            border: `1px solid ${isAllUploaded ? '#c2e7d0' : 'var(--line)'}`,
            borderRadius: '16px',
            padding: '24px',
            transition: 'all 0.3s ease',
            boxShadow: 'var(--shadow-sm)',
          }}>
            <div style={{ flex: '1 1 320px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '6px', color: 'var(--brand)' }}>
                Final Submission Checklist
              </h3>
              <p style={{ margin: 0, fontSize: '14px', color: 'var(--ink-soft)', lineHeight: 1.5 }}>
                {isAllUploaded 
                  ? '🎉 Excellent! All 3 templates (Energy, Renewable Energy, GHG Emissions) are uploaded. Submit all files together for expert review.' 
                  : '⚠️ Upload all 3 templates (Energy, Renewable Energy, and GHG Emissions) to enable the final review submission.'}
              </p>
              <div style={{ display: 'flex', gap: '16px', marginTop: '12px', fontSize: '13px', fontWeight: 700 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: uploads.energy?.url ? 'var(--ok)' : '#c0c0c0' }}>
                  {uploads.energy?.url ? '●' : '○'} Energy
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: uploads.renewable?.url ? 'var(--ok)' : '#c0c0c0' }}>
                  {uploads.renewable?.url ? '●' : '○'} Renewable
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: uploads.ghg?.url ? 'var(--ok)' : '#c0c0c0' }}>
                  {uploads.ghg?.url ? '●' : '○'} GHG Emissions
                </span>
              </div>
            </div>

            <button
              type="button"
              id="submit-all-btn"
              onClick={submitAll}
              disabled={!isAllUploaded || submitAllState === 'submitting'}
              style={{
                background: isAllUploaded ? 'linear-gradient(135deg, var(--brand) 0%, var(--brand-strong) 100%)' : '#cdd6d1',
                borderColor: isAllUploaded ? 'var(--brand)' : '#cdd6d1',
                padding: '14px 28px',
                fontSize: '15px',
                minWidth: '160px',
                boxShadow: isAllUploaded ? '0 4px 12px rgba(31, 78, 55, 0.2)' : 'none',
              }}
            >
              {submitAllState === 'submitting' ? 'Submitting All...' : 'Submit All'}
            </button>
          </div>
          {submitAllSuccess && <p className="status ok" style={{ marginTop: '16px' }}>{submitAllSuccess}</p>}
          {submitAllWarning && <p className="status warning" style={{ marginTop: '16px' }}>{submitAllWarning}</p>}
        </div>

        <div className="actions-row" style={{ marginTop: '32px', borderTop: '1px solid var(--line)', paddingTop: '24px', justifyContent: 'space-between' }}>
          <button className="outline" onClick={() => navigate('/company')} style={{ padding: '12px 24px' }}>
            Back to Profile
          </button>
          <button
            type="button"
            onClick={submitTab}
            disabled={!activeUpload.url || activeUpload.uploadState === 'uploading' || activeUpload.submitState === 'submitting'}
            style={{ padding: '12px 24px' }}
          >
            {activeUpload.submitState === 'submitting'
              ? 'Submitting Single...'
              : 'Submit Current Tab'}
          </button>
        </div>
      </div>
    </WorkspaceLayout>
  )
}

function AppRoutes() {
  const [authToken, setAuthToken] = useState(
    () => localStorage.getItem(AUTH_STORAGE_KEY) || '',
  )
  const [isReady, setIsReady] = useState(false)
  const [companyDetails, setCompanyDetails] = useState({
    name: '',
    employees: '',
    industry: '',
  })
  const [uploads, setUploads] = useState({
    energy: createTabState(),
    renewable: createTabState(),
    ghg: createTabState(),
  })

  useEffect(() => {
    let active = true

    const check = async () => {
      if (!authToken) {
        if (active) {
          setIsReady(true)
        }
        return
      }

      const valid = await validateToken(authToken)
      if (!valid) {
        localStorage.removeItem(AUTH_STORAGE_KEY)
        if (active) {
          setAuthToken('')
        }
      }

      if (active) {
        setIsReady(true)
      }
    }

    setIsReady(false)
    check()

    return () => {
      active = false
    }
  }, [authToken])

  const onLogin = (token) => {
    localStorage.setItem(AUTH_STORAGE_KEY, token)
    setAuthToken(token)
  }

  const onUnauthorized = () => {
    localStorage.removeItem(AUTH_STORAGE_KEY)
    setAuthToken('')
  }

  const isAuthenticated = Boolean(authToken)

  const onUploadComplete = (tabKey, fileData) => {
    setUploads((current) => ({
      ...current,
      [tabKey]: {
        ...createTabState(),
        ...current[tabKey],
        ...(typeof fileData === 'function' ? fileData(current[tabKey] || createTabState()) : fileData),
      },
    }))
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={
          <LoginPage
            isAuthenticated={isAuthenticated}
            onLogin={onLogin}
          />
        }
      />
      <Route
        path="/home"
        element={
          <PrivateRoute isAuthenticated={isAuthenticated} isReady={isReady}>
            <HomePage
              companyDetails={companyDetails}
              uploads={uploads}
              onLogout={onUnauthorized}
            />
          </PrivateRoute>
        }
      />
      <Route
        path="/company"
        element={
          <PrivateRoute isAuthenticated={isAuthenticated} isReady={isReady}>
            <CompanyPage
              companyDetails={companyDetails}
              onSaveCompany={setCompanyDetails}
              uploads={uploads}
              onLogout={onUnauthorized}
            />
          </PrivateRoute>
        }
      />
      <Route
        path="/environment"
        element={
          <PrivateRoute isAuthenticated={isAuthenticated} isReady={isReady}>
            <EnvironmentPage
              companyDetails={companyDetails}
              uploads={uploads}
              onUploadComplete={onUploadComplete}
              authToken={authToken}
              onUnauthorized={onUnauthorized}
              onLogout={onUnauthorized}
            />
          </PrivateRoute>
        }
      />
      <Route
        path="*"
        element={<Navigate to={isAuthenticated ? '/home' : '/login'} replace />}
      />
    </Routes>
  )
}

function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  )
}

export default App
