# Grievance Redressal Web Application

A full-stack grievance redressal portal built using:
- HTML, CSS, JavaScript
- React (frontend)
- Node.js + Express (backend)
- SQLite (database)
- Nodemailer (email routing)

## Features
- Public grievance submission form with optional anonymous mode.
- Ticket tracking using ticket id and tracking token.
- Simple admin panel for moving tickets from Submitted to Processing to Solved.
- Category-based routing to respective mailing lists.
- Complaint records stored in SQLite database.

## Project Structure
- `client/` React frontend
- `server/` Express backend + SQLite DB

## Backend Configuration
1. Go to `server/`.
2. Create `.env` from `.env.example`.
3. Update OAuth/SMTP and mailing-list variables.

See [server/.env.example](server/.env.example) for the full backend variable list and defaults.

## Frontend Configuration
1. Go to `client/`.
2. Create `.env` from `.env.example`.

See [client/.env.example](client/.env.example) for the frontend variable list.

## Run Locally
### Backend
```bash
cd server
npm install
npm run dev
```

### Frontend
```bash
cd client
npm install
npm run dev
```

Then open the frontend URL shown by Vite (default: `http://localhost:5173`).

## API Endpoints
- `GET /api/health` Health check.
- `POST /api/grievances` Create grievance and trigger email routing.
- `GET /api/dashboard` Public summary counts.
- `GET /api/track/:id?token=...` Track one ticket.
- `GET /api/admin/grievances` Admin ticket list.
- `PATCH /api/admin/grievances/:id` Admin status update.
