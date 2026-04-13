import { useEffect, useState } from 'react'
import './App.css'

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000'

const defaultDashboard = {
  summary: {
    total: 0,
    solved: 0,
    processing: 0,
    submitted: 0,
    anonymous: 0,
    progressAverage: 0,
    resolutionRate: 0,
  },
}

const initialFormData = {
  name: '',
  email: '',
  phone: '',
  department: '',
  category: '',
  subject: '',
  message: '',
  anonymous: false,
}

const initialTrackForm = {
  ticketId: '',
  trackingToken: '',
}

const categories = [
  { value: 'academic', label: 'Academic Issue' },
  { value: 'finance', label: 'Fees / Finance' },
  { value: 'infrastructure', label: 'Infrastructure / Facility' },
  { value: 'hostel', label: 'Hostel / Accommodation' },
  { value: 'harassment', label: 'Harassment / Safety' },
  { value: 'other', label: 'Other' },
]

const departments = [
  'Computer Science',
  'Electrical Engineering',
  'Mechanical Engineering',
  'Civil Engineering',
  'Administration',
  'Hostel Office',
  'Other',
]

const adminStatuses = ['Submitted', 'Processing', 'Solved']

function formatDate(value) {
  if (!value) return 'Just now'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

function App() {
  const [dashboard, setDashboard] = useState(defaultDashboard)
  const [dashboardError, setDashboardError] = useState('')
  const [isLoadingDashboard, setIsLoadingDashboard] = useState(true)

  const [formData, setFormData] = useState(initialFormData)
  const [submitStatus, setSubmitStatus] = useState({ type: '', text: '' })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [lastSubmittedTicket, setLastSubmittedTicket] = useState(null)

  const [trackForm, setTrackForm] = useState(initialTrackForm)
  const [trackedTicket, setTrackedTicket] = useState(null)
  const [trackStatus, setTrackStatus] = useState({ type: '', text: '' })
  const [isTracking, setIsTracking] = useState(false)

  const [adminKey, setAdminKey] = useState('')
  const [adminTickets, setAdminTickets] = useState([])
  const [adminStatus, setAdminStatus] = useState({ type: '', text: '' })
  const [isLoadingAdmin, setIsLoadingAdmin] = useState(false)
  const [updatingTicketId, setUpdatingTicketId] = useState(null)

  async function loadDashboard() {
    try {
      setDashboardError('')
      const response = await fetch(`${apiBaseUrl}/api/dashboard`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to load dashboard.')
      }

      setDashboard({
        summary: { ...defaultDashboard.summary, ...(data.summary || {}) },
      })
    } catch (error) {
      setDashboardError(error.message)
    } finally {
      setIsLoadingDashboard(false)
    }
  }

  useEffect(() => {
    loadDashboard()
  }, [])

  function handleFormChange(event) {
    const { name, value, type, checked } = event.target
    const nextValue = type === 'checkbox' ? checked : value

    setFormData((prev) => {
      if (name !== 'anonymous') {
        return { ...prev, [name]: nextValue }
      }

      return {
        ...prev,
        anonymous: checked,
        name: checked ? '' : prev.name,
        email: checked ? '' : prev.email,
        phone: checked ? '' : prev.phone,
      }
    })
  }

  function handleTrackFormChange(event) {
    const { name, value } = event.target
    setTrackForm((prev) => ({ ...prev, [name]: value }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setSubmitStatus({ type: '', text: '' })
    setLastSubmittedTicket(null)
    setIsSubmitting(true)

    try {
      const response = await fetch(`${apiBaseUrl}/api/grievances`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to submit grievance.')
      }

      setSubmitStatus({
        type: 'success',
        text: `Ticket #${data.id} raised successfully. Save the tracking token shown below.`,
      })
      setLastSubmittedTicket({
        id: data.id,
        trackingToken: data.trackingToken,
        status: data.status,
      })
      setTrackForm({
        ticketId: String(data.id),
        trackingToken: data.trackingToken,
      })
      setFormData(initialFormData)
      await loadDashboard()
    } catch (error) {
      setSubmitStatus({ type: 'error', text: error.message })
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleTrackSubmit(event) {
    event.preventDefault()
    setTrackStatus({ type: '', text: '' })
    setTrackedTicket(null)
    setIsTracking(true)

    try {
      const response = await fetch(
        `${apiBaseUrl}/api/track/${trackForm.ticketId}?token=${encodeURIComponent(trackForm.trackingToken)}`
      )
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Unable to track ticket.')
      }

      setTrackedTicket(data)
      setTrackStatus({ type: 'success', text: 'Ticket found.' })
    } catch (error) {
      setTrackStatus({ type: 'error', text: error.message })
    } finally {
      setIsTracking(false)
    }
  }

  async function loadAdminTickets() {
    setAdminStatus({ type: '', text: '' })
    setIsLoadingAdmin(true)

    try {
      const response = await fetch(`${apiBaseUrl}/api/admin/grievances`, {
        headers: {
          'x-admin-key': adminKey,
        },
      })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to load admin tickets.')
      }

      setAdminTickets(data)
      setAdminStatus({ type: 'success', text: 'Admin tickets loaded.' })
    } catch (error) {
      setAdminTickets([])
      setAdminStatus({ type: 'error', text: error.message })
    } finally {
      setIsLoadingAdmin(false)
    }
  }

  function handleAdminTicketStatusChange(ticketId, value) {
    setAdminTickets((prev) =>
      prev.map((ticket) => (ticket.id === ticketId ? { ...ticket, status: value } : ticket))
    )
  }

  async function handleAdminUpdate(ticketId, status) {
    setUpdatingTicketId(ticketId)
    setAdminStatus({ type: '', text: '' })

    try {
      const response = await fetch(`${apiBaseUrl}/api/admin/grievances/${ticketId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': adminKey,
        },
        body: JSON.stringify({ status }),
      })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update ticket.')
      }

      setAdminTickets((prev) =>
        prev.map((ticket) => (ticket.id === ticketId ? data : ticket))
      )
      setAdminStatus({ type: 'success', text: `Ticket #${ticketId} updated to ${data.status}.` })
      await loadDashboard()
    } catch (error) {
      setAdminStatus({ type: 'error', text: error.message })
    } finally {
      setUpdatingTicketId(null)
    }
  }

  const statCards = [
    { label: 'Total Tickets', value: dashboard.summary.total, detail: 'All grievances raised' },
    { label: 'Submitted', value: dashboard.summary.submitted, detail: 'Waiting for staff action' },
    { label: 'Processing', value: dashboard.summary.processing, detail: 'Under review by staff' },
    { label: 'Solved', value: dashboard.summary.solved, detail: 'Marked as resolved' },
  ]

  return (
    <div className="page-shell">
      <header className="hero">
        <div className="hero-copy">
          <p className="kicker">Grievance Portal</p>
          <h1>Submit, track, and manage grievance tickets</h1>
          <p className="subtitle">
            Students raise tickets here, students track tickets with an id and tracking token,
            and staff move tickets from submitted to processing to solved.
          </p>
        </div>

        <div className="hero-panel">
          <p className="hero-panel-label">Overall Progress</p>
          <strong>
            {isLoadingDashboard ? '...' : `${dashboard.summary.progressAverage}%`}
          </strong>
          <div className="hero-progress" aria-hidden="true">
            <span style={{ width: `${dashboard.summary.progressAverage}%` }} />
          </div>
          <p className="hero-panel-meta">
            Resolution rate: {dashboard.summary.resolutionRate}%
          </p>
          {dashboardError && (
            <p className="inline-error">{dashboardError}</p>
          )}
        </div>
      </header>

      <section className="stats-grid" aria-label="Ticket summary">
        {statCards.map((card) => (
          <article key={card.label} className="stat-card">
            <p>{card.label}</p>
            <strong>{card.value}</strong>
            <span>{card.detail}</span>
          </article>
        ))}
      </section>

      <main className="content-grid">
        <section className="main-column">
          <article className="card">
            <div className="section-head">
              <div>
                <p className="section-kicker">Student Action</p>
                <h2>Raise a ticket</h2>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="grievance-form">
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  name="anonymous"
                  checked={formData.anonymous}
                  onChange={handleFormChange}
                />
                <span>Submit this grievance anonymously</span>
              </label>

              {formData.anonymous ? (
                <div className="anonymous-note">
                  Personal details are hidden for anonymous tickets. Use the ticket id and tracking token
                  to check status later.
                </div>
              ) : (
                <>
                  <label>
                    Full Name*
                    <input
                      name="name"
                      value={formData.name}
                      onChange={handleFormChange}
                      required={!formData.anonymous}
                    />
                  </label>

                  <label>
                    Email Address*
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleFormChange}
                      required={!formData.anonymous}
                    />
                  </label>

                  <label>
                    Phone Number
                    <input
                      name="phone"
                      value={formData.phone}
                      onChange={handleFormChange}
                    />
                  </label>
                </>
              )}

              <label>
                Department*
                <select
                  name="department"
                  value={formData.department}
                  onChange={handleFormChange}
                  required
                >
                  <option value="">Select department</option>
                  {departments.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Ticket Type*
                <select
                  name="category"
                  value={formData.category}
                  onChange={handleFormChange}
                  required
                >
                  <option value="">Select ticket type</option>
                  {categories.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Subject*
                <input
                  name="subject"
                  value={formData.subject}
                  onChange={handleFormChange}
                  required
                />
              </label>

              <label>
                Detailed Description*
                <textarea
                  name="message"
                  value={formData.message}
                  onChange={handleFormChange}
                  required
                  rows="6"
                />
              </label>

              <button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Submitting...' : 'Raise Ticket'}
              </button>
            </form>

            {submitStatus.text && (
              <p className={`status ${submitStatus.type}`} role="status">
                {submitStatus.text}
              </p>
            )}

            {lastSubmittedTicket && (
              <div className="tracking-box">
                <h3>Save these details</h3>
                <p>Ticket ID: <strong>{lastSubmittedTicket.id}</strong></p>
                <p>Tracking Token: <strong>{lastSubmittedTicket.trackingToken}</strong></p>
                <p>Current Status: <strong>{lastSubmittedTicket.status}</strong></p>
              </div>
            )}
          </article>

          <article className="card">
            <div className="section-head">
              <div>
                <p className="section-kicker">Student Action</p>
                <h2>Track a ticket</h2>
              </div>
            </div>

            <form onSubmit={handleTrackSubmit} className="track-form">
              <label>
                Ticket ID
                <input
                  name="ticketId"
                  value={trackForm.ticketId}
                  onChange={handleTrackFormChange}
                  required
                />
              </label>

              <label>
                Tracking Token
                <input
                  name="trackingToken"
                  value={trackForm.trackingToken}
                  onChange={handleTrackFormChange}
                  required
                />
              </label>

              <button type="submit" disabled={isTracking}>
                {isTracking ? 'Checking...' : 'Track Ticket'}
              </button>
            </form>

            {trackStatus.text && (
              <p className={`status ${trackStatus.type}`} role="status">
                {trackStatus.text}
              </p>
            )}

            {trackedTicket && (
              <div className="tracked-ticket">
                <h3>Ticket #{trackedTicket.id}</h3>
                <p><strong>Subject:</strong> {trackedTicket.subject}</p>
                <p><strong>Department:</strong> {trackedTicket.department}</p>
                <p><strong>Type:</strong> {trackedTicket.category}</p>
                <p><strong>Status:</strong> {trackedTicket.status}</p>
                <p><strong>Progress:</strong> {trackedTicket.progress}%</p>
                <p><strong>Raised On:</strong> {formatDate(trackedTicket.createdAt)}</p>
                <div className="progress-track" aria-hidden="true">
                  <span style={{ width: `${trackedTicket.progress}%` }} />
                </div>
              </div>
            )}
          </article>
        </section>

        <aside className="side-column">
          <section className="card">
            <div className="section-head">
              <div>
                <p className="section-kicker">Portal Flow</p>
                <h2>How the website works</h2>
              </div>
            </div>

            <ol className="flow-list">
              <li>A student submits a grievance and gets a ticket id plus tracking token.</li>
              <li>The backend stores the grievance and routes the email by ticket type.</li>
              <li>The student uses ticket id plus token to check the current status later.</li>
              <li>Staff opens the admin panel and moves the ticket to Processing or Solved.</li>
              <li>The public dashboard shows only safe summary counts, not private ticket details.</li>
            </ol>
          </section>

          <section className="card">
            <div className="section-head">
              <div>
                <p className="section-kicker">Admin Access</p>
                <h2>Staff status update</h2>
              </div>
            </div>

            <div className="admin-login">
              <label>
                Admin Key
                <input
                  type="password"
                  value={adminKey}
                  onChange={(event) => setAdminKey(event.target.value)}
                  placeholder="Enter admin key"
                />
              </label>

              <button type="button" onClick={loadAdminTickets} disabled={isLoadingAdmin || !adminKey.trim()}>
                {isLoadingAdmin ? 'Loading...' : 'Open Admin Panel'}
              </button>
            </div>

            {adminStatus.text && (
              <p className={`status ${adminStatus.type}`} role="status">
                {adminStatus.text}
              </p>
            )}

            {adminTickets.length > 0 && (
              <div className="admin-ticket-list">
                {adminTickets.map((ticket) => (
                  <article key={ticket.id} className="admin-ticket">
                    <h3>#{ticket.id} {ticket.subject}</h3>
                    <p><strong>Reporter:</strong> {ticket.anonymous ? 'Anonymous' : ticket.name}</p>
                    <p><strong>Department:</strong> {ticket.department}</p>
                    <p><strong>Type:</strong> {ticket.category}</p>
                    <p><strong>Current Status:</strong> {ticket.status}</p>
                    <p><strong>Message:</strong> {ticket.message}</p>
                    <div className="admin-actions">
                      <select
                        value={ticket.status}
                        onChange={(event) => handleAdminTicketStatusChange(ticket.id, event.target.value)}
                      >
                        {adminStatuses.map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>

                      <button
                        type="button"
                        onClick={() => handleAdminUpdate(ticket.id, ticket.status)}
                        disabled={updatingTicketId === ticket.id}
                      >
                        {updatingTicketId === ticket.id ? 'Saving...' : 'Update'}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </aside>
      </main>
    </div>
  )
}

export default App
