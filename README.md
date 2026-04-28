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
Use Node 22 for both services.

1) Install dependencies

```bash
cd server
npm install
cd ../client
npm install
```

2) Prepare environment

- Copy the example env files if you haven't already:

```bash
cp server/.env.example server/.env
cp client/.env.example client/.env
```

- Edit `server/.env` and set at minimum: `ADMIN_PORTAL_KEY` and one `MAIL_*` recipient (or `MAIL_DEFAULT`).

3) Start backend (Terminal 1)

```bash
export NVM_DIR="$HOME/.nvm" && . "$NVM_DIR/nvm.sh" && nvm use 22 >/dev/null
cd server
PORT=5000 ADMIN_PORTAL_KEY=test npm run dev
```

Backend API runs on `http://localhost:5000`.

4) Verify backend health

```bash
curl http://localhost:5000/api/health
```

Expected response:

```json
{"ok":true,"service":"grievance-backend"}
```

5) Start frontend (Terminal 2)

```bash
export NVM_DIR="$HOME/.nvm" && . "$NVM_DIR/nvm.sh" && nvm use 22 >/dev/null
cd client
npm run dev
```

Frontend dev server runs on `http://localhost:5173`. Vite proxies `/api` requests from `5173` to backend `5000`.

Optional: production-like local run

Build the client and let the server serve the built files:

```bash
cd client
VITE_API_BASE_URL=/api npm run build

cd ../server
PORT=5000 ADMIN_PORTAL_KEY=test npm start
```

## Deploy on Render
This repo includes `render.yaml` for one web service deployment.

1. Connect this repository in Render and create a Blueprint service.
2. Keep Node version set to 22.
3. Add backend env vars from `server/.env.example` in the Render dashboard.
4. Ensure at least one recipient list is configured (`MAIL_DEFAULT` or category-specific `MAIL_*`).
5. Deploy and verify:

```bash
curl https://<your-render-domain>/api/health
```

If you use Gmail SMTP/OAuth and mail fails, inspect logs for SMTP auth/network errors.

## API Endpoints
- `GET /api/health` Health check.
- `POST /api/grievances` Create grievance and trigger email routing.
- `GET /api/dashboard` Public summary counts.
- `GET /api/track/:id?token=...` Track one ticket.
- `GET /api/admin/grievances` Admin ticket list.
- `PATCH /api/admin/grievances/:id` Admin status update.
