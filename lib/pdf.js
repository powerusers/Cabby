'use strict';

const path = require('path');
const PDFDocument = require('pdfkit');
const { formatMoney, formatDistance, formatWhen, splitFare } = require('../public/format');

const FONT_DIR = path.join(__dirname, '..', 'fonts');
const PAGE_W = 420;
const PAD = 28;
const INNER = PAGE_W - PAD * 2;
const INK = '#171717';
const MUTED = '#6d675e';
const LABEL = '#8a8378';
const RULE = '#ece7de';
const LIME = '#e2f56a';

function registerFonts(doc) {
  doc.registerFont('Regular', path.join(FONT_DIR, 'Inter-Regular.ttf'));
  doc.registerFont('Medium', path.join(FONT_DIR, 'Inter-Medium.ttf'));
  doc.registerFont('Bold', path.join(FONT_DIR, 'Inter-Bold.ttf'));
}

function textAt(doc, value, x, y, options = {}) {
  const font = options.font || 'Regular';
  const size = options.size || 12;
  const color = options.color || INK;
  const width = options.width ?? INNER;
  const align = options.align || 'left';
  const lineGap = options.lineGap ?? 2;
  doc.font(font).fontSize(size).fillColor(color);
  const height = doc.heightOfString(String(value), { width, align, lineGap });
  doc.text(String(value), x, y, { width, align, lineGap });
  return y + height;
}

function rule(doc, y) {
  doc.save();
  doc.moveTo(PAD, y).lineTo(PAD + INNER, y).strokeColor(RULE).lineWidth(1).stroke();
  doc.restore();
  return y;
}

function row(doc, label, value, y, options = {}) {
  const font = options.font || 'Regular';
  const size = options.size || 12;
  const color = options.color || INK;
  doc.font(font).fontSize(size);
  const height = doc.heightOfString(label, { width: INNER * 0.6, lineGap: 1 });
  textAt(doc, label, PAD, y, { font, size, color, width: INNER * 0.62, lineGap: 1 });
  textAt(doc, value, PAD, y, { font, size, color, width: INNER, align: 'right', lineGap: 1 });
  return y + height;
}

function vehicleLine(operator) {
  return [operator.vehicleModel, operator.vehicleNumber].filter(Boolean).join(' · ');
}

function taxLine(operator) {
  if (!operator.gstin) return '';
  const label = operator.currency === 'INR' ? 'GSTIN' : 'Tax ID';
  return `${label} ${operator.gstin}`;
}

function drawRoute(doc, trip, y) {
  const textWidth = INNER - 24;
  const textX = PAD + 24;
  const dotX = PAD + 5;
  doc.font('Medium').fontSize(13);
  const srcH = doc.heightOfString(trip.source, { width: textWidth, lineGap: 2 });
  const dstH = doc.heightOfString(trip.destination, { width: textWidth, lineGap: 2 });
  const srcTextY = y + 12;
  const dstLabelY = srcTextY + srcH + 14;
  const dstTextY = dstLabelY + 12;
  const srcDotY = srcTextY + 6;
  const dstDotY = dstTextY + 6;

  doc.save();
  doc.moveTo(dotX, srcDotY + 8).lineTo(dotX, dstDotY - 8).strokeColor('#ddd6c8').lineWidth(1).stroke();
  doc.restore();

  doc.circle(dotX, srcDotY, 4.3).fill('#111111');
  doc.circle(dotX, srcDotY, 2.15).fill(LIME);
  doc.circle(dotX, dstDotY, 4.3).fill('#111111');

  textAt(doc, 'PICKUP', textX, y, { font: 'Medium', size: 8, color: LABEL, width: textWidth, lineGap: 0 });
  textAt(doc, trip.source, textX, srcTextY, { font: 'Medium', size: 13, width: textWidth });
  textAt(doc, 'DROP', textX, dstLabelY, { font: 'Medium', size: 8, color: LABEL, width: textWidth, lineGap: 0 });
  textAt(doc, trip.destination, textX, dstTextY, { font: 'Medium', size: 13, width: textWidth });
  return dstTextY + dstH;
}

function drawDistance(doc, trip, y) {
  const label = formatDistance(trip.distanceKm);
  doc.font('Medium').fontSize(11);
  const width = doc.widthOfString(label) + 24;
  doc.roundedRect(PAD, y, width, 24, 12).fill('#f4f0e7');
  doc.font('Medium').fontSize(11).fillColor(INK);
  doc.text(label, PAD, y + 6, { width, align: 'center', lineBreak: false });
  return y + 24;
}

function drawFare(doc, operator, trip, y) {
  const parts = splitFare(trip.amount);
  const money = (value) => formatMoney(value, operator.currency);
  y = rule(doc, y) + 12;
  y = row(doc, 'Trip fare', money(parts.tripFare), y) + 8;
  y = row(doc, 'GST 5%', money(parts.gst), y) + 10;
  y = rule(doc, y) + 12;
  y = row(doc, 'Total', money(parts.total), y, { font: 'Bold', size: 16 }) + 8;
  return textAt(doc, `Paid via ${trip.paymentMethod}`, PAD, y, { size: 11, color: MUTED, width: INNER });
}

function drawRider(doc, trip, y) {
  if (!trip.customerName) return y;
  y = rule(doc, y + 16) + 12;
  y = textAt(doc, 'RIDER', PAD, y, { font: 'Medium', size: 8, color: LABEL, width: INNER, lineGap: 0 }) + 6;
  return textAt(doc, trip.customerName, PAD, y, { font: 'Medium', size: 13, width: INNER });
}

function drawDriver(doc, operator, y) {
  const vehicle = vehicleLine(operator);
  if (!operator.driverName && !vehicle) return y;
  y = rule(doc, y + 16) + 12;
  y = textAt(doc, 'DRIVER', PAD, y, { font: 'Medium', size: 8, color: LABEL, width: INNER, lineGap: 0 }) + 6;
  if (operator.driverName) {
    y = textAt(doc, operator.driverName, PAD, y, { font: 'Medium', size: 13, width: INNER }) + 2;
  }
  if (vehicle) {
    y = textAt(doc, vehicle, PAD, y, { size: 11, color: MUTED, width: INNER });
  }
  return y;
}

function drawIssuer(doc, operator, y) {
  y = rule(doc, y + 16) + 12;
  y = textAt(doc, 'BILLED BY', PAD, y, { font: 'Medium', size: 8, color: LABEL, width: INNER, lineGap: 0 }) + 6;
  y = textAt(doc, operator.businessName, PAD, y, { font: 'Medium', size: 13, width: INNER }) + 3;
  const lines = [];
  if (operator.address) lines.push(operator.address);
  if (operator.city) lines.push(operator.city);
  const contact = [operator.phone, operator.email].filter(Boolean).join(' · ');
  if (contact) lines.push(contact);
  const tax = taxLine(operator);
  if (tax) lines.push(tax);
  if (lines.length) {
    y = textAt(doc, lines.join('\n'), PAD, y, { size: 11, color: MUTED, width: INNER, lineGap: 3 });
  }
  return y;
}

function drawFine(doc, y) {
  y = textAt(doc, 'Computer-generated receipt. Signature not required.', PAD, y + 18, {
    size: 9,
    color: '#9a9388',
    width: INNER,
    lineGap: 1,
  });
  return y + 4;
}

function drawReceipt(doc, operator, trip) {
  const when = formatWhen(trip.tripAt, trip.timeZone);
  const idWidth = 118;
  const nameWidth = INNER - idWidth - 8;
  doc.font('Bold').fontSize(22);
  const nameH = doc.heightOfString(operator.businessName, { width: nameWidth, lineGap: 1 });
  const headerH = Math.max(96, 22 + nameH + 34);

  doc.rect(0, 0, PAGE_W, headerH).fill('#111111');
  textAt(doc, operator.businessName, PAD, 22, {
    font: 'Bold',
    size: 22,
    color: '#ffffff',
    width: nameWidth,
    lineGap: 1,
  });
  textAt(doc, 'TRIP RECEIPT', PAD, 22 + nameH + 8, {
    font: 'Medium',
    size: 9,
    color: LIME,
    width: nameWidth,
    lineGap: 0,
  });
  textAt(doc, trip.receiptId, PAD, 26, {
    font: 'Medium',
    size: 10,
    color: '#f3f3f3',
    width: INNER,
    align: 'right',
    lineGap: 0,
  });
  doc.rect(0, headerH, PAGE_W, 6).fill(LIME);

  let y = headerH + 28;
  y = textAt(doc, when.line, PAD, y, { size: 11, color: MUTED, width: INNER }) + 18;
  y = drawRoute(doc, trip, y) + 16;
  y = drawDistance(doc, trip, y) + 18;
  y = drawFare(doc, operator, trip, y);
  y = drawRider(doc, trip, y);
  y = drawDriver(doc, operator, y);
  y = drawIssuer(doc, operator, y);
  return drawFine(doc, y);
}

function paint(doc, operator, trip) {
  return drawReceipt(doc, operator, trip);
}

function measureHeight(operator, trip) {
  const doc = new PDFDocument({ size: [PAGE_W, 4000], margin: 0 });
  doc.on('data', () => {});
  doc.on('error', () => {});
  registerFonts(doc);
  const y = paint(doc, operator, trip);
  doc.end();
  return Math.max(520, Math.ceil(y + 32));
}

function buildReceiptPdf(operator, trip) {
  const height = measureHeight(operator, trip);
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: [PAGE_W, height],
      margin: 0,
      info: {
        Title: `Trip receipt ${trip.receiptId}`,
        Author: operator.businessName,
        Creator: 'Cabby',
      },
    });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    registerFonts(doc);
    paint(doc, operator, trip);
    doc.end();
  });
}

module.exports = { buildReceiptPdf };
