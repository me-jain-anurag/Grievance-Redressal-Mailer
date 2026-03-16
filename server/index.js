require('dotenv').config();
const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');

const app = express();
const PORT = Number(process.env.PORT) || 5000;

app.use(cors());
app.use(express.json());

function parseEmailList(raw) {
  if (!raw) return [];
  return raw
    .split(',')
    .map((email) => email.trim())
    .filter(Boolean);
}

const categoryMailingLists = {
  academic: parseEmailList(process.env.MAIL_ACADEMIC),
  finance: parseEmailList(process.env.MAIL_FINANCE),
  infrastructure: parseEmailList(process.env.MAIL_INFRASTRUCTURE),
  hostel: parseEmailList(process.env.MAIL_HOSTEL),
  harassment: parseEmailList(process.env.MAIL_HARASSMENT),
  other: parseEmailList(process.env.MAIL_OTHER),
};

const defaultMailingList = parseEmailList(process.env.MAIL_DEFAULT);

async function createTransporter() {
  const wantsGmailOAuth = String(process.env.SMTP_OAUTH_PROVIDER || '').toLowerCase() === 'gmail';

  if (wantsGmailOAuth) {
    const missing = [];
    if (!process.env.SMTP_USER) missing.push('SMTP_USER');
    if (!process.env.GOOGLE_CLIENT_ID) missing.push('GOOGLE_CLIENT_ID');
    if (!process.env.GOOGLE_CLIENT_SECRET) missing.push('GOOGLE_CLIENT_SECRET');
    if (!process.env.GOOGLE_REFRESH_TOKEN) missing.push('GOOGLE_REFRESH_TOKEN');

    if (missing.length > 0) {
      throw new Error(`Gmail OAuth2 is enabled but missing env var(s): ${missing.join(', ')}`);
    }

    return nodemailer.createTransport({
      service: 'gmail',
      auth: {
        type: 'OAuth2',
        user: process.env.SMTP_USER,
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        refreshToken: process.env.GOOGLE_REFRESH_TOKEN,
      },
    });
  }

  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: String(process.env.SMTP_SECURE).toLowerCase() === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  // Development-safe fallback: captures email payload in server logs.
  return nodemailer.createTransport({ jsonTransport: true });
}

async function initDb() {
  const db = await open({
    filename: './grievances.db',
    driver: sqlite3.Database,
  });

  await db.exec(`
    CREATE TABLE IF NOT EXISTS grievances (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT,
      department TEXT NOT NULL,
      category TEXT NOT NULL,
      subject TEXT NOT NULL,
      message TEXT NOT NULL,
      status TEXT DEFAULT 'Submitted',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  return db;
}

function validatePayload(payload) {
  const requiredFields = ['name', 'email', 'department', 'category', 'subject', 'message'];
  const missing = requiredFields.filter((key) => !String(payload[key] || '').trim());

  if (missing.length > 0) {
    return `Missing required field(s): ${missing.join(', ')}`;
  }

  return null;
}

function resolveRecipients(category) {
  const list = categoryMailingLists[category] || [];
  if (list.length > 0) return list;
  return defaultMailingList;
}

function buildMailBody(grievance, id) {
  return [
    `New grievance submitted (#${id})`,
    '',
    `Name: ${grievance.name}`,
    `Email: ${grievance.email}`,
    `Phone: ${grievance.phone || 'N/A'}`,
    `Department: ${grievance.department}`,
    `Category: ${grievance.category}`,
    `Subject: ${grievance.subject}`,
    '',
    'Message:',
    grievance.message,
  ].join('\n');
}

async function bootstrap() {
  const db = await initDb();
  const transporter = await createTransporter();

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'grievance-backend' });
  });

  app.get('/api/grievances', async (_req, res) => {
    const rows = await db.all(
      'SELECT id, name, email, department, category, subject, status, created_at FROM grievances ORDER BY id DESC'
    );
    res.json(rows);
  });

  app.post('/api/grievances', async (req, res) => {
    try {
      const error = validatePayload(req.body);
      if (error) {
        return res.status(400).json({ error });
      }

      const grievance = {
        name: String(req.body.name).trim(),
        email: String(req.body.email).trim(),
        phone: String(req.body.phone || '').trim(),
        department: String(req.body.department).trim(),
        category: String(req.body.category).trim().toLowerCase(),
        subject: String(req.body.subject).trim(),
        message: String(req.body.message).trim(),
      };

      const result = await db.run(
        `INSERT INTO grievances (name, email, phone, department, category, subject, message)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        grievance.name,
        grievance.email,
        grievance.phone,
        grievance.department,
        grievance.category,
        grievance.subject,
        grievance.message
      );

      const grievanceId = result.lastID;
      const recipients = resolveRecipients(grievance.category);

      if (recipients.length > 0) {
        const fromAddress = process.env.MAIL_FROM || process.env.SMTP_USER || 'no-reply@grievance.local';
        const info = await transporter.sendMail({
          from: fromAddress,
          to: recipients.join(','),
          subject: `[Grievance #${grievanceId}] ${grievance.subject}`,
          text: buildMailBody(grievance, grievanceId),
        });

        if (info && info.message) {
          console.log('Mail payload:', info.message);
        }
      } else {
        console.warn(`No recipients configured for category "${grievance.category}" and MAIL_DEFAULT is empty.`);
      }

      return res.status(201).json({
        id: grievanceId,
        message: 'Grievance submitted successfully.',
        recipients,
      });
    } catch (err) {
      console.error('Failed to process grievance:', err);
      return res.status(500).json({
        error: 'Failed to process grievance',
        detail: err.message,
      });
    }
  });

  app.listen(PORT, () => {
    console.log(`Grievance backend running on http://localhost:${PORT}`);
  });
}

bootstrap().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
