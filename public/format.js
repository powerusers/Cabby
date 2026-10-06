(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.CabbyFormat = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const CURRENCIES = {
    INR: { locale: 'en-IN', prefix: '₹' },
    USD: { locale: 'en-US', prefix: '$' },
    EUR: { locale: 'de-DE', prefix: '€' },
    GBP: { locale: 'en-GB', prefix: '£' },
    AED: { locale: 'en-AE', prefix: 'AED' },
  };

  function formatMoney(amount, currency) {
    const meta = CURRENCIES[currency] || CURRENCIES.INR;
    return new Intl.NumberFormat(meta.locale, {
      style: 'currency',
      currency: CURRENCIES[currency] ? currency : 'INR',
    }).format(Number(amount) || 0);
  }

  function formatDistance(km, style) {
    const value = Number(km) || 0;
    const text = new Intl.NumberFormat('en-IN', {
      maximumFractionDigits: 1,
    }).format(value);
    if (style === 'uber') {
      const unit = value === 1 ? 'kilometer' : 'kilometers';
      return `${text} ${unit}`;
    }
    return `${text} km`;
  }

  function formatWhen(iso, timeZone, style) {
    const date = new Date(iso);
    const tz = timeZone || 'UTC';
    const time = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(date);
    if (style === 'uber') {
      const day = new Intl.DateTimeFormat('en-GB', {
        timeZone: tz,
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }).format(date);
      return { day, time, line: `${day}\n${time}` };
    }
    const day = new Intl.DateTimeFormat('en-GB', {
      timeZone: tz,
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(date);
    return { day, time, line: `${day} · ${time}` };
  }

  function makeReceiptId(date = new Date()) {
    const y = String(date.getFullYear()).slice(2);
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const n = Math.floor(100000 + Math.random() * 900000);
    return `CB${y}${m}${d}-${n}`;
  }

  function currencyPrefix(code) {
    return (CURRENCIES[code] || CURRENCIES.INR).prefix;
  }

  return {
    CURRENCIES,
    formatMoney,
    formatDistance,
    formatWhen,
    makeReceiptId,
    currencyPrefix,
  };
});
