'use strict';

const crypto = require('crypto');
const path = require('path');
const express = require('express');
const { normalizeOperator, normalizeTrip } = require('./lib/validate');
const { readOperator, saveOperator } = require('./lib/store');
const { buildReceiptPdf } = require('./lib/pdf');

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  next();
});

app.get('/health', (req, res) => {
  res.json({ ok: true });
});

app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/config', (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.json({ pinRequired: Boolean(process.env.APP_PIN) });
});

function safeEqual(given, expected) {
  const a = Buffer.from(String(given));
  const b = Buffer.from(String(expected));
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

app.use('/api', (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  const expected = process.env.APP_PIN;
  if (!expected) return next();
  const given = String(req.get('x-app-pin') || '').slice(0, 200);
  if (safeEqual(given, expected)) return next();
  res.status(401).json({ error: 'Enter the correct PIN.' });
});

app.use('/api', express.json({ limit: '20kb' }));

const hits = new Map();
function rateLimit(req, res, next) {
  const now = Date.now();
  const recent = (hits.get(req.ip) || []).filter((stamp) => now - stamp < 60_000);
  if (recent.length >= 30) {
    res.status(429).json({ error: 'Too many receipts. Wait a minute and try again.' });
    return;
  }
  recent.push(now);
  hits.set(req.ip, recent);
  if (hits.size > 5000) hits.clear();
  next();
}

app.get('/api/operator', (req, res, next) => {
  try {
    res.json({ operator: readOperator() });
  } catch (err) {
    next(err);
  }
});

app.put('/api/operator', (req, res, next) => {
  try {
    const operator = normalizeOperator(req.body || {});
    saveOperator(operator);
    res.json({ operator });
  } catch (err) {
    next(err);
  }
});

app.post('/api/receipts', rateLimit, async (req, res, next) => {
  try {
    const operator = readOperator();
    if (!operator) {
      const err = new Error('Save your operator details first.');
      err.status = 400;
      throw err;
    }
    const trip = normalizeTrip(req.body || {});
    const pdf = await buildReceiptPdf(operator, trip);
    const filename = `Cabby-${trip.receiptId}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', String(pdf.length));
    res.send(pdf);
  } catch (err) {
    next(err);
  }
});

app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Not found.' });
});

app.use((req, res) => {
  res.status(404).type('text/plain').send('Not found');
});

app.use((err, req, res, next) => {
  if (res.headersSent) {
    next(err);
    return;
  }
  if (err.type === 'entity.parse.failed') {
    res.status(400).json({ error: 'Request body must be JSON.' });
    return;
  }
  const status = Number(err.status) || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({
    error: err.status ? err.message : 'Something went wrong. Try again.',
  });
});

if (require.main === module) {
  const port = Number(process.env.PORT) || 3000;
  app.listen(port, '0.0.0.0', () => {
    console.log(`Cabby listening on ${port}`);
  });
}

module.exports = { app };
