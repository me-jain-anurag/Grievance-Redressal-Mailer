import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
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

  const statCards = [
    { label: 'Total Tickets', value: dashboard.summary.total, detail: 'All grievances raised' },
    { label: 'Submitted', value: dashboard.summary.submitted, detail: 'Waiting for staff action' },
    { label: 'Processing', value: dashboard.summary.processing, detail: 'Under review by staff' },
    { label: 'Solved', value: dashboard.summary.solved, detail: 'Marked as resolved' },
  ]

  return (
    <div className="page-shell">
      <nav className="top-nav" aria-label="Portal navigation">
        <Link to="/" className="nav-link nav-link-active">Student Portal</Link>
        <Link to="/admin" className="nav-link">Admin Login</Link>
      </nav>

      <header className="hero">
        <div className="hero-copy">
          <p className="kicker">Grievance Portal</p>
          <h1>Submit and track grievance tickets</h1>
          <p className="subtitle">
            Students can raise tickets and track tickets with an id and tracking token here.
          </p>
        </div>

        
      </header>

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
        </section>

        <aside className="side-column">
          <section className="card">
            <div className="section-head">
              <div>
                <p className="section-kicker">Admin Access</p>
                <h2>Separate admin login page</h2>
              </div>
            </div>
            <p className="subtitle">
              Staff tools are separate from student actions. Open the dedicated admin page to log in.
            </p>
            <p>
              <Link to="/admin" className="inline-admin-link">Go to Admin Login</Link>
            </p>
          </section>
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
                {trackedTicket.remarks && (
                  <p><strong>Remarks:</strong> {trackedTicket.remarks}</p>
                )}
                <div className="progress-track" aria-hidden="true">
                  <span style={{ width: `${trackedTicket.progress}%` }} />
                </div>
              </div>
            )}
          </article>
        </aside>
      </main>
    </div>
  )
}

export default App
