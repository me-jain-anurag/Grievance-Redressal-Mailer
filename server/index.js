require('dotenv').config();
const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = Number(process.env.PORT) || 5000;
const clientDistPath = path.join(__dirname, '..', 'client', 'dist');
const clientIndexPath = path.join(clientDistPath, 'index.html');

app.use(cors());
app.use(express.json());

if (fs.existsSync(clientIndexPath)) {
  app.use(express.static(clientDistPath));
}

function parseEmailList(raw) {
  if (!raw) return [];
  return raw
    .split(',')
    .map((email) => email.trim())
    .filter(Boolean);
}

function toBoolean(value) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    return ['true', '1', 'yes', 'on'].includes(value.trim().toLowerCase());
  }
  return Boolean(value);
}

function normalizeStatus(status) {
  const normalized = String(status || 'Submitted').trim().toLowerCase();

  if (['resolved', 'solved', 'closed'].includes(normalized)) {
    return 'Solved';
  }

  if (['processing', 'in progress', 'under review'].includes(normalized)) {
    return 'Processing';
  }

  return 'Submitted';
}

function getProgressValue(status) {
  const normalized = normalizeStatus(status);

  if (normalized === 'Solved') return 100;
  if (normalized === 'Processing') return 66;
  return 25;
}

function createTrackingToken() {
  return crypto.randomBytes(5).toString('hex').toUpperCase();
}

function getAdminKey() {
  return String(process.env.ADMIN_PORTAL_KEY || 'admin123').trim();
}

function readAdminKey(req) {
  return String(req.headers['x-admin-key'] || req.query.key || '').trim();
}

function requireAdmin(req, res, next) {
  if (readAdminKey(req) !== getAdminKey()) {
    return res.status(401).json({ error: 'Unauthorized admin access.' });
  }

  return next();
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
      is_anonymous INTEGER DEFAULT 0,
      tracking_token TEXT,
      remarks TEXT DEFAULT '',
      status TEXT DEFAULT 'Submitted',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const columns = await db.all('PRAGMA table_info(grievances)');
  const hasAnonymousColumn = columns.some((column) => column.name === 'is_anonymous');
  const hasTrackingTokenColumn = columns.some((column) => column.name === 'tracking_token');
  const hasRemarksColumn = columns.some((column) => column.name === 'remarks');

  if (!hasAnonymousColumn) {
    await db.exec('ALTER TABLE grievances ADD COLUMN is_anonymous INTEGER DEFAULT 0');
  }

  if (!hasTrackingTokenColumn) {
    await db.exec('ALTER TABLE grievances ADD COLUMN tracking_token TEXT');
  }

  if (!hasRemarksColumn) {
    await db.exec("ALTER TABLE grievances ADD COLUMN remarks TEXT DEFAULT ''");
  }

  const rowsMissingToken = await db.all('SELECT id FROM grievances WHERE tracking_token IS NULL OR tracking_token = ""');
  for (const row of rowsMissingToken) {
    await db.run('UPDATE grievances SET tracking_token = ? WHERE id = ?', createTrackingToken(), row.id);
  }

  return db;
}

function validatePayload(payload) {
  const isAnonymous = toBoolean(payload.anonymous);
  const requiredFields = ['department', 'category', 'subject', 'message'];

  if (!isAnonymous) {
    requiredFields.unshift('email');
    requiredFields.unshift('name');
  }

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
    `Name: ${grievance.isAnonymous ? 'Anonymous Reporter' : grievance.name}`,
    `Email: ${grievance.isAnonymous ? 'Hidden by reporter' : grievance.email}`,
    `Phone: ${grievance.phone || 'N/A'}`,
    `Department: ${grievance.department}`,
    `Category: ${grievance.category}`,
    `Anonymous: ${grievance.isAnonymous ? 'Yes' : 'No'}`,
    `Subject: ${grievance.subject}`,
    '',
    'Message:',
    grievance.message,
  ].join('\n');
}

function formatGrievanceRow(row) {
  const status = normalizeStatus(row.status);

  return {
    id: row.id,
    name: row.is_anonymous ? 'Anonymous Reporter' : row.name,
    department: row.department,
    category: row.category,
    subject: row.subject,
    status,
    progress: getProgressValue(status),
    anonymous: Boolean(row.is_anonymous),
    createdAt: row.created_at,
    remarks: row.remarks || '',
  };
}

function formatAdminGrievanceRow(row) {
  const status = normalizeStatus(row.status);

  return {
    id: row.id,
    name: row.is_anonymous ? 'Anonymous Reporter' : row.name,
    email: row.is_anonymous ? 'Hidden by reporter' : row.email,
    phone: row.phone || 'N/A',
    department: row.department,
    category: row.category,
    subject: row.subject,
    message: row.message,
    status,
    progress: getProgressValue(status),
    anonymous: Boolean(row.is_anonymous),
    createdAt: row.created_at,
    remarks: row.remarks || '',
  };
}

function buildDashboardPayload(rows) {
  const normalizedRows = rows.map(formatGrievanceRow);
  const summary = normalizedRows.reduce(
    (acc, item) => {
      acc.total += 1;
      acc.anonymous += item.anonymous ? 1 : 0;
      acc.solved += item.status === 'Solved' ? 1 : 0;
      acc.processing += item.status === 'Processing' ? 1 : 0;
      acc.submitted += item.status === 'Submitted' ? 1 : 0;
      return acc;
    },
    { total: 0, anonymous: 0, solved: 0, processing: 0, submitted: 0 }
  );

  const progressAverage = normalizedRows.length > 0
    ? Math.round(
      normalizedRows.reduce((total, item) => total + item.progress, 0) / normalizedRows.length
    )
    : 0;

  const resolutionRate = summary.total > 0
    ? Math.round((summary.solved / summary.total) * 100)
    : 0;

  return {
    summary: {
      ...summary,
      progressAverage,
      resolutionRate,
    },
  };
}

function formatTrackedTicket(row) {
  const status = normalizeStatus(row.status);

  return {
    id: row.id,
    subject: row.subject,
    category: row.category,
    department: row.department,
    status,
    progress: getProgressValue(status),
    anonymous: Boolean(row.is_anonymous),
    createdAt: row.created_at,
    remarks: row.remarks || '',
  };
}

async function bootstrap() {
  const db = await initDb();
  const transporter = await createTransporter();

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'grievance-backend' });
  });

  app.get('/api/grievances', requireAdmin, async (_req, res) => {
    const rows = await db.all(
      `SELECT id, name, email, phone, department, category, subject, message, remarks, status, is_anonymous, created_at
       FROM grievances
       ORDER BY id DESC`
    );
    res.json(rows.map(formatAdminGrievanceRow));
  });

  app.get('/api/dashboard', async (_req, res) => {
    const rows = await db.all(
      `SELECT id, name, department, category, subject, remarks, status, is_anonymous, created_at
       FROM grievances
       ORDER BY id DESC`
    );

    res.json(buildDashboardPayload(rows));
  });

  app.get('/api/track/:id', async (req, res) => {
    const ticketId = Number(req.params.id);
    const token = String(req.query.token || '').trim().toUpperCase();

    if (!ticketId || !token) {
      return res.status(400).json({ error: 'Ticket id and tracking token are required.' });
    }

    const row = await db.get(
      `SELECT id, subject, category, department, remarks, status, is_anonymous, created_at
       FROM grievances
       WHERE id = ? AND tracking_token = ?`,
      ticketId,
      token
    );

    if (!row) {
      return res.status(404).json({ error: 'Ticket not found. Check the ticket id and tracking token.' });
    }

    return res.json(formatTrackedTicket(row));
  });

  app.get('/api/admin/grievances', requireAdmin, async (_req, res) => {
    const rows = await db.all(
      `SELECT id, name, email, phone, department, category, subject, message, remarks, status, is_anonymous, created_at
       FROM grievances
       ORDER BY id DESC`
    );

    return res.json(rows.map(formatAdminGrievanceRow));
  });

  app.patch('/api/admin/grievances/:id', requireAdmin, async (req, res) => {
    const ticketId = Number(req.params.id);
    const nextStatus = req.body.status ? normalizeStatus(req.body.status) : null;
    const nextRemarks = typeof req.body.remarks === 'string' ? req.body.remarks.trim() : null;

    if (!ticketId) {
      return res.status(400).json({ error: 'Valid ticket id is required.' });
    }

    const existing = await db.get('SELECT id FROM grievances WHERE id = ?', ticketId);
    if (!existing) {
      return res.status(404).json({ error: 'Ticket not found.' });
    }

    const updates = [];
    const values = [];

    if (nextStatus) {
      updates.push('status = ?');
      values.push(nextStatus);
    }

    if (nextRemarks !== null) {
      updates.push('remarks = ?');
      values.push(nextRemarks);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'At least one of status or remarks is required.' });
    }

    values.push(ticketId);
    await db.run(`UPDATE grievances SET ${updates.join(', ')} WHERE id = ?`, values);

    const updated = await db.get(
      `SELECT id, name, email, phone, department, category, subject, message, remarks, status, is_anonymous, created_at
       FROM grievances
       WHERE id = ?`,
      ticketId
    );

    return res.json(formatAdminGrievanceRow(updated));
  });

  app.post('/api/grievances', async (req, res) => {
    try {
      const error = validatePayload(req.body);
      if (error) {
        return res.status(400).json({ error });
      }

      const isAnonymous = toBoolean(req.body.anonymous);
      const grievance = {
        name: isAnonymous ? 'Anonymous Reporter' : String(req.body.name).trim(),
        email: isAnonymous ? 'anonymous@hidden.local' : String(req.body.email).trim(),
        phone: String(req.body.phone || '').trim(),
        department: String(req.body.department).trim(),
        category: String(req.body.category).trim().toLowerCase(),
        subject: String(req.body.subject).trim(),
        message: String(req.body.message).trim(),
        isAnonymous,
        trackingToken: createTrackingToken(),
      };

      const result = await db.run(
        `INSERT INTO grievances (name, email, phone, department, category, subject, message, is_anonymous, tracking_token)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        grievance.name,
        grievance.email,
        grievance.phone,
        grievance.department,
        grievance.category,
        grievance.subject,
        grievance.message,
        grievance.isAnonymous ? 1 : 0,
        grievance.trackingToken
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
        anonymous: grievance.isAnonymous,
        status: 'Submitted',
        progress: getProgressValue('Submitted'),
        trackingToken: grievance.trackingToken,
      });
    } catch (err) {
      console.error('Failed to process grievance:', err);
      return res.status(500).json({
        error: 'Failed to process grievance',
        detail: err.message,
      });
    }
  });

  if (fs.existsSync(clientIndexPath)) {
    app.use((req, res, next) => {
      if (req.path.startsWith('/api')) {
        return next();
      }

      return res.sendFile(clientIndexPath);
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Grievance backend running and listening on 0.0.0.0:${PORT}`);
  });
}

bootstrap().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
