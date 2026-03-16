# Grievance Redressal Web Application

![Demo Video](.github/assets/demo.webp)

A full-stack grievance redressal portal built using:
- HTML, CSS, JavaScript
- React (frontend)
- Node.js + Express (backend)
- SQLite (database)
- Nodemailer (email routing)

## Features
- Grievance submission form with validation.
- Category-based routing to respective mailing lists.
- Complaint records stored in SQLite database.
- API health check and grievance listing endpoints.

## Project Structure
- `client/` React frontend
- `server/` Express backend + SQLite DB

## Backend Configuration
1. Go to `server/`.
2. Create `.env` from `.env.example`.
3. Update OAuth/SMTP and mailing-list variables.

Recommended (Gmail OAuth2) example:
```env
PORT=5000
SMTP_OAUTH_PROVIDER=gmail
SMTP_USER=your_gmail@gmail.com
GOOGLE_CLIENT_ID=your_google_oauth_client_id
GOOGLE_CLIENT_SECRET=your_google_oauth_client_secret
GOOGLE_REFRESH_TOKEN=your_google_oauth_refresh_token
MAIL_FROM="Grievance Cell <your_gmail@gmail.com>"
MAIL_ACADEMIC=academic.cell@example.com
MAIL_FINANCE=accounts@example.com
MAIL_INFRASTRUCTURE=maintenance@example.com
MAIL_HOSTEL=hostel.wardens@example.com
MAIL_HARASSMENT=icc@example.com
MAIL_OTHER=helpdesk@example.com
MAIL_DEFAULT=grievance.committee@example.com
```

Optional SMTP password fallback (Easiest for testing):
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your_gmail@gmail.com
SMTP_PASS=your_16_letter_app_password
```
*Note: To use a Gmail App Password, go to your Google Account -> Security -> 2-Step Verification -> App Passwords. Generate a new password and paste it as `SMTP_PASS`.*

If OAuth2 and SMTP fallback variables are not set, the app uses a JSON transport fallback and logs email payloads instead of sending real emails.

## Frontend Configuration
1. Go to `client/`.
2. Create `.env` from `.env.example`.

```env
VITE_API_BASE_URL=http://localhost:5000
```

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
- `GET /api/grievances` List grievances.
- `POST /api/grievances` Create grievance and trigger email routing.
