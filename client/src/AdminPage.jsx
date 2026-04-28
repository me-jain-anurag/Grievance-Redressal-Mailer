import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import './App.css'

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000'
const adminStatuses = ['Submitted', 'Processing', 'Solved']

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

function AdminPage() {
    const [adminKey, setAdminKey] = useState('')
    const [adminTickets, setAdminTickets] = useState([])
    const [adminStatus, setAdminStatus] = useState({ type: '', text: '' })
    const [isLoadingAdmin, setIsLoadingAdmin] = useState(false)
    const [updatingTicketId, setUpdatingTicketId] = useState(null)
    const [dashboard, setDashboard] = useState(defaultDashboard)
    const [dashboardError, setDashboardError] = useState('')
    const [isLoadingDashboard, setIsLoadingDashboard] = useState(true)

    const statCards = [
        { label: 'Total Tickets', value: dashboard.summary.total, detail: 'All grievances raised' },
        { label: 'Submitted', value: dashboard.summary.submitted, detail: 'Waiting for staff action' },
        { label: 'Processing', value: dashboard.summary.processing, detail: 'Under review by staff' },
        { label: 'Solved', value: dashboard.summary.solved, detail: 'Marked as resolved' },
    ]

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

    function handleAdminTicketRemarksChange(ticketId, value) {
        setAdminTickets((prev) =>
            prev.map((ticket) => (ticket.id === ticketId ? { ...ticket, remarks: value } : ticket))
        )
    }

    async function handleAdminUpdate(ticket) {
        const { id: ticketId, status, remarks = '' } = ticket
        setUpdatingTicketId(ticketId)
        setAdminStatus({ type: '', text: '' })

        try {
            const response = await fetch(`${apiBaseUrl}/api/admin/grievances/${ticketId}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'x-admin-key': adminKey,
                },
                body: JSON.stringify({ status, remarks }),
            })
            const data = await response.json()

            if (!response.ok) {
                throw new Error(data.error || 'Failed to update ticket.')
            }

            setAdminTickets((prev) =>
                prev.map((ticket) => (ticket.id === ticketId ? data : ticket))
            )
            setAdminStatus({ type: 'success', text: `Ticket #${ticketId} updated.` })
        } catch (error) {
            setAdminStatus({ type: 'error', text: error.message })
        } finally {
            setUpdatingTicketId(null)
        }
    }

    return (
        <div className="page-shell admin-page-shell">
            <nav className="top-nav" aria-label="Portal navigation">
                <Link to="/" className="nav-link">Student Portal</Link>
                <Link to="/admin" className="nav-link nav-link-active">Admin Login</Link>
            </nav>

            <header className="hero admin-hero">
                <div className="hero-copy">
                    <p className="kicker">Admin Portal</p>
                    <h1>Staff ticket management</h1>
                    <p className="subtitle">
                        Use your admin key to load grievances and update statuses from Submitted to Processing to Solved.
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

            <main className="content-grid admin-content-grid">
                <section className="main-column">
                    <section className="card">
                        <div className="section-head">
                            <div>
                                <p className="section-kicker">Admin Access</p>
                                <h2>Login with admin key</h2>
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
                                        <p><strong>Email:</strong> {ticket.email}</p>
                                        <p><strong>Phone:</strong> {ticket.phone}</p>
                                        <p><strong>Department:</strong> {ticket.department}</p>
                                        <p><strong>Type:</strong> {ticket.category}</p>
                                        <p><strong>Current Status:</strong> {ticket.status}</p>
                                        <p><strong>Raised On:</strong> {formatDate(ticket.createdAt)}</p>
                                        <p><strong>Message:</strong> {ticket.message}</p>
                                        <label className="admin-remarks-field">
                                            Remarks for student
                                            <textarea
                                                rows="4"
                                                value={ticket.remarks || ''}
                                                onChange={(event) => handleAdminTicketRemarksChange(ticket.id, event.target.value)}
                                                placeholder="Add a note the student can see"
                                            />
                                        </label>

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
                                                onClick={() => handleAdminUpdate(ticket)}
                                                disabled={updatingTicketId === ticket.id}
                                            >
                                                {updatingTicketId === ticket.id ? 'Saving...' : 'Save Changes'}
                                            </button>
                                        </div>
                                    </article>
                                ))}
                            </div>
                        )}
                    </section>
                </section>
            </main>
        </div>
    )
}

export default AdminPage
