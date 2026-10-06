'use strict';

const { CURRENCIES } = require('../public/format');

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const PAYMENTS = ['Cash', 'UPI', 'Card', 'Wallet'];

function clean(value, max) {
  return String(value ?? '')
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function asNumber(value) {
  if (typeof value === 'number') return value;
  return Number(String(value ?? '').trim().replace(/,/g, ''));
}

function normalizeOperator(body) {
  const source = body && typeof body === 'object' ? body : {};
  const businessName = clean(source.businessName, 80);
  const phone = clean(source.phone, 24);
  const city = clean(source.city, 60);
  const email = clean(source.email, 80);
  const gstin = clean(source.gstin, 20).toUpperCase().replace(/\s+/g, '');

  if (!businessName) throw new HttpError(400, 'Business name is required.');
  const digits = phone.replace(/\D/g, '');
  if (!/^[0-9+\-().\s]+$/.test(phone) || digits.length < 7 || digits.length > 15) {
    throw new HttpError(400, 'Enter a phone number with 7 to 15 digits.');
  }
  if (!city) throw new HttpError(400, 'City is required.');
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new HttpError(400, 'Enter a valid email or leave it blank.');
  }
  if (gstin && !/^[0-9A-Z]{8,20}$/.test(gstin)) {
    throw new HttpError(400, 'Tax ID should be 8–20 letters or numbers.');
  }

  const currency = Object.prototype.hasOwnProperty.call(CURRENCIES, source.currency)
    ? source.currency
    : 'INR';

  return {
    businessName,
    phone,
    city,
    driverName: clean(source.driverName, 80),
    email,
    address: clean(source.address, 160),
    gstin,
    vehicleNumber: clean(source.vehicleNumber, 20).toUpperCase(),
    vehicleModel: clean(source.vehicleModel, 40),
    currency,
    updatedAt: new Date().toISOString(),
  };
}

function normalizeTrip(body) {
  const source = body && typeof body === 'object' ? body : {};
  const style = source.style === 'uber' ? 'uber' : 'ola';
  const pickup = clean(source.source, 160);
  const destination = clean(source.destination, 160);
  if (!pickup) throw new HttpError(400, 'Pickup location is required.');
  if (!destination) throw new HttpError(400, 'Drop location is required.');

  const distanceKm = Math.round(asNumber(source.distanceKm) * 10) / 10;
  const amount = Math.round(asNumber(source.amount) * 100) / 100;
  if (!Number.isFinite(distanceKm) || distanceKm <= 0 || distanceKm > 5000) {
    throw new HttpError(400, 'Enter a distance between 0 and 5,000 km.');
  }
  if (!Number.isFinite(amount) || amount <= 0 || amount > 1000000) {
    throw new HttpError(400, 'Enter a total amount greater than 0.');
  }

  const tripAt = source.tripAt ? new Date(source.tripAt) : new Date();
  if (Number.isNaN(tripAt.getTime())) {
    throw new HttpError(400, 'Enter a valid date and time.');
  }

  let timeZone = 'UTC';
  if (typeof source.timeZone === 'string' && source.timeZone.length > 0 && source.timeZone.length < 80) {
    try {
      Intl.DateTimeFormat('en-US', { timeZone: source.timeZone }).format(tripAt);
      timeZone = source.timeZone;
    } catch {
      timeZone = 'UTC';
    }
  }

  if (source.paymentMethod && !PAYMENTS.includes(source.paymentMethod)) {
    throw new HttpError(400, 'Choose a payment method.');
  }

  let receiptId = clean(source.receiptId, 24).toUpperCase();
  if (!/^[A-Z0-9-]{6,24}$/.test(receiptId)) {
    const { makeReceiptId } = require('../public/format');
    receiptId = makeReceiptId();
  }

  return {
    style,
    source: pickup,
    destination,
    distanceKm,
    amount,
    tripAt: tripAt.toISOString(),
    timeZone,
    customerName: clean(source.customerName, 80),
    paymentMethod: PAYMENTS.includes(source.paymentMethod) ? source.paymentMethod : 'Cash',
    receiptId,
  };
}

module.exports = {
  HttpError,
  PAYMENTS,
  normalizeOperator,
  normalizeTrip,
};
