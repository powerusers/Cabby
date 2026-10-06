'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { once } = require('node:events');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { normalizeOperator, normalizeTrip } = require('../lib/validate');
const { formatMoney, formatDistance } = require('../public/format');

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'cabby-'));
delete process.env.APP_PIN;

const { app } = require('../server');

const operatorInput = {
  businessName: 'Harbour Line Cabs',
  phone: '+91 98200 11111',
  city: 'Mumbai',
  driverName: 'Ravi Menon',
  vehicleModel: 'WagonR',
  vehicleNumber: 'mh02ab1234',
  address: '12 Dock Road, Mazgaon',
  email: 'desk@harbourline.example',
  gstin: '27aaaaa0000a1z5',
  currency: 'INR',
};

function tripInput(overrides = {}) {
  return {
    style: 'ola',
    source: 'Dadar West, Mumbai',
    destination: 'Bandra West, Mumbai',
    distanceKm: 11.5,
    amount: 486,
    tripAt: '2026-10-06T18:40:00.000Z',
    timeZone: 'Asia/Kolkata',
    customerName: 'Anjali Shah',
    paymentMethod: 'UPI',
    receiptId: 'CB261006-123456',
    ...overrides,
  };
}

let base;
let server;

test.before(async () => {
  server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  base = `http://127.0.0.1:${server.address().port}`;
});

test.after(async () => {
  server.close();
  await once(server, 'close');
});

async function request(pathname, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (options.json) headers['content-type'] = 'application/json';
  const res = await fetch(`${base}${pathname}`, {
    method: options.method || 'GET',
    headers,
    body: options.json ? JSON.stringify(options.json) : undefined,
  });
  return res;
}

function pdfText(buffer) {
  return execFileSync('pdftotext', ['-', '-'], { input: buffer }).toString('utf8');
}

function pdfPages(buffer) {
  const info = execFileSync('pdfinfo', ['-'], { input: buffer }).toString('utf8');
  const match = info.match(/Pages:\s+(\d+)/);
  return match ? Number(match[1]) : 0;
}

test('formats money and distance', () => {
  assert.match(formatMoney(486, 'INR'), /486\.00/);
  assert.equal(formatDistance(11.5, 'ola'), '11.5 km');
  assert.equal(formatDistance(1, 'uber'), '1 kilometer');
  assert.equal(formatDistance(11.5, 'uber'), '11.5 kilometers');
});

test('rejects incomplete operator and trip details', () => {
  assert.throws(() => normalizeOperator({ businessName: 'Cab', phone: '12', city: 'Pune' }), /7 to 15 digits/);
  assert.throws(() => normalizeTrip({ source: '', destination: 'X', distanceKm: 1, amount: 10 }), /Pickup/);
  assert.throws(() => normalizeTrip(tripInput({ distanceKm: 0 })), /distance/);
  const parsed = normalizeTrip(tripInput({ amount: '1,250.50', distanceKm: '11.54' }));
  assert.equal(parsed.amount, 1250.5);
  assert.equal(parsed.distanceKm, 11.5);
  const saved = normalizeOperator(operatorInput);
  assert.equal(saved.gstin, '27AAAAA0000A1Z5');
  assert.equal(saved.vehicleNumber, 'MH02AB1234');
});

test('serves the desk and health check', async () => {
  const health = await request('/health');
  assert.equal(health.status, 200);
  assert.deepEqual(await health.json(), { ok: true });
  const home = await request('/');
  assert.equal(home.status, 200);
  const html = await home.text();
  assert.match(html, /New receipt/);
  assert.match(html, /Download PDF/);
  const config = await request('/api/config');
  assert.deepEqual(await config.json(), { pinRequired: false });
});

test('saves operator details once and downloads both receipt styles', async () => {
  const empty = await request('/api/receipts', { method: 'POST', json: tripInput() });
  assert.equal(empty.status, 400);

  const saved = await request('/api/operator', { method: 'PUT', json: operatorInput });
  assert.equal(saved.status, 200);
  const body = await saved.json();
  assert.equal(body.operator.businessName, 'Harbour Line Cabs');

  const again = await request('/api/operator');
  assert.equal((await again.json()).operator.city, 'Mumbai');

  for (const style of ['ola', 'uber']) {
    const res = await request('/api/receipts', { method: 'POST', json: tripInput({ style }) });
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type'), /application\/pdf/);
    assert.match(res.headers.get('content-disposition'), /Cabby-CB261006-123456\.pdf/);
    const pdf = Buffer.from(await res.arrayBuffer());
    assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
    assert.equal(pdfPages(pdf), 1);
    const text = pdfText(pdf);
    assert.match(text, /Harbour Line Cabs/);
    assert.match(text, /Dadar West, Mumbai/);
    assert.match(text, /Bandra West, Mumbai/);
    assert.match(text, /Ravi Menon/);
    assert.match(text, /MH02AB1234/);
    assert.match(text, /27AAAAA0000A1Z5/);
    assert.match(text, /486\.00/);
    if (style === 'uber') assert.match(text, /Thanks for riding, Anjali Shah/);
    if (style === 'ola') {
      assert.match(text, /TRIP RECEIPT/);
      assert.match(text, /Anjali Shah/);
      assert.match(text, /Paid via UPI/);
    }
  }
});

test('requires the server PIN when APP_PIN is set', async () => {
  process.env.APP_PIN = 'desk-pin';
  try {
    const blocked = await request('/api/operator');
    assert.equal(blocked.status, 401);
    const allowed = await request('/api/operator', { headers: { 'x-app-pin': 'desk-pin' } });
    assert.equal(allowed.status, 200);
    const config = await request('/api/config');
    assert.deepEqual(await config.json(), { pinRequired: true });
  } finally {
    delete process.env.APP_PIN;
  }
});
