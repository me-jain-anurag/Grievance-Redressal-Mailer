import { useMemo, useState } from 'react'
import './App.css'

function App() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    department: '',
    category: '',
    subject: '',
    message: '',
  })

  const [status, setStatus] = useState({ type: '', text: '' })
  const [isSubmitting, setIsSubmitting] = useState(false)

  const apiBaseUrl = useMemo(() => {
    return import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000'
  }, [])

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

  function handleChange(event) {
    const { name, value } = event.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setStatus({ type: '', text: '' })
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

      const routedTo = Array.isArray(data.recipients) && data.recipients.length > 0
        ? ` Routed to: ${data.recipients.join(', ')}`
        : ''

      setStatus({
        type: 'success',
        text: `Grievance submitted successfully. Ticket #${data.id}.${routedTo}`,
      })

      setFormData({
        name: '',
        email: '',
        phone: '',
        department: '',
        category: '',
        subject: '',
        message: '',
      })
    } catch (error) {
      setStatus({ type: 'error', text: error.message })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="page-shell">
      <header className="hero">
        <p className="kicker">Student Welfare Portal</p>
        <h1>Grievance Redressal Mechanism</h1>
        <p className="subtitle">
          Submit your concern through this form. The request is recorded and
          automatically routed to the responsible email group.
        </p>
      </header>

      <main className="content-grid">
        <section className="card">
          <h2>Submit Grievance</h2>
          <form onSubmit={handleSubmit} className="grievance-form">
            <label>
              Full Name*
              <input
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
                placeholder="Enter your full name"
              />
            </label>

            <label>
              Email Address*
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
                placeholder="you@example.com"
              />
            </label>

            <label>
              Phone Number
              <input
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                placeholder="Optional"
              />
            </label>

            <label>
              Department*
              <select
                name="department"
                value={formData.department}
                onChange={handleChange}
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
              Category*
              <select
                name="category"
                value={formData.category}
                onChange={handleChange}
                required
              >
                <option value="">Select grievance category</option>
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
                onChange={handleChange}
                required
                placeholder="Short summary of the issue"
              />
            </label>

            <label>
              Detailed Description*
              <textarea
                name="message"
                value={formData.message}
                onChange={handleChange}
                required
                rows="6"
                placeholder="Provide full details so the concerned team can respond quickly"
              />
            </label>

            <button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Submitting...' : 'Submit Grievance'}
            </button>
          </form>

          {status.text && (
            <p className={`status ${status.type}`} role="status">
              {status.text}
            </p>
          )}
        </section>

        <section className="card info-card">
          <h2>How It Works</h2>
          <ol>
            <li>You submit a grievance using the form.</li>
            <li>The issue is saved in the grievance database.</li>
            <li>The complaint is emailed to the relevant committee list.</li>
            <li>You can follow up with your ticket number.</li>
          </ol>
          <p className="api-note">
            API endpoint in use: <code>{apiBaseUrl}/api/grievances</code>
          </p>
        </section>
      </main>
    </div>
  )
}

export default App
