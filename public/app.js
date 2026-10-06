(function () {
  const OPERATOR_FIELDS = [
    'businessName',
    'phone',
    'city',
    'driverName',
    'vehicleModel',
    'vehicleNumber',
    'currency',
    'address',
    'email',
    'gstin',
  ];

  const boot = document.getElementById('boot');
  const pinScreen = document.getElementById('pin-screen');
  const setupScreen = document.getElementById('setup-screen');
  const desk = document.getElementById('desk');
  const dialog = document.getElementById('operator-dialog');
  const operatorPanel = document.getElementById('operator-panel');
  const operatorForm = document.getElementById('operator-form');
  const tripForm = document.getElementById('trip-form');

  let operator = null;
  let receiptId = CabbyFormat.makeReceiptId();

  function show(which) {
    boot.classList.add('hidden');
    pinScreen.classList.toggle('hidden', which !== 'pin');
    setupScreen.classList.toggle('hidden', which !== 'setup');
    desk.classList.toggle('hidden', which !== 'desk');
  }

  function setAlert(id, message) {
    const el = document.getElementById(id);
    el.textContent = message || '';
    el.classList.toggle('hidden', !message);
  }

  function setStatus(message, isError) {
    const el = document.getElementById('trip-status');
    el.textContent = message || '';
    el.classList.toggle('error', Boolean(isError));
  }

  async function api(path, options = {}) {
    const headers = new Headers(options.headers || {});
    const pin = sessionStorage.getItem('cabby.pin');
    if (pin) headers.set('x-app-pin', pin);
    let body;
    if (options.json) {
      headers.set('content-type', 'application/json');
      body = JSON.stringify(options.json);
    }
    const res = await fetch(path, { method: options.method || 'GET', headers, body });
    if (res.status === 401) {
      sessionStorage.removeItem('cabby.pin');
      showPin();
      const error = new Error('Enter the correct PIN.');
      error.status = 401;
      throw error;
    }
    return res;
  }

  async function readError(res) {
    try {
      const data = await res.json();
      return data.error || 'Something went wrong. Try again.';
    } catch {
      return 'Something went wrong. Try again.';
    }
  }

  function showPin() {
    if (dialog.open) dialog.close();
    show('pin');
    document.getElementById('pin').focus();
  }

  function fillOperatorForm(data) {
    const source = data || {};
    OPERATOR_FIELDS.forEach((key) => {
      const el = document.getElementById(key);
      el.value = source[key] || (key === 'currency' ? 'INR' : '');
    });
  }

  function operatorPayload() {
    const payload = {};
    OPERATOR_FIELDS.forEach((key) => {
      payload[key] = document.getElementById(key).value.trim();
    });
    return payload;
  }

  function placeOperator(mode) {
    if (mode === 'setup') {
      setupScreen.querySelector('.gate-stack').appendChild(operatorPanel);
      document.getElementById('close-operator').classList.add('hidden');
      document.getElementById('operator-title').textContent = 'Set up your cab';
      document.getElementById('operator-lede').textContent =
        'Enter these once. They are saved on this server and printed on every receipt.';
      document.getElementById('operator-submit').textContent = 'Save and continue';
    } else {
      dialog.appendChild(operatorPanel);
      document.getElementById('close-operator').classList.remove('hidden');
      document.getElementById('operator-title').textContent = 'Operator details';
      document.getElementById('operator-lede').textContent =
        'Updates apply to every receipt you generate after this.';
      document.getElementById('operator-submit').textContent = 'Save details';
    }
  }

  function setText(id, value, placeholder) {
    const el = document.getElementById(id);
    if (value) {
      el.textContent = value;
      el.classList.remove('is-placeholder');
    } else {
      el.textContent = placeholder;
      el.classList.add('is-placeholder');
    }
  }

  function tripDraft() {
    const distance = document.getElementById('distanceKm').value;
    const amount = document.getElementById('amount').value;
    const whenValue = document.getElementById('tripAt').value;
    const whenDate = whenValue ? new Date(whenValue) : new Date();
    return {
      source: document.getElementById('source').value.trim(),
      destination: document.getElementById('destination').value.trim(),
      distanceKm: distance === '' ? null : Number(distance),
      amount: amount === '' ? null : Number(amount),
      tripAt: Number.isNaN(whenDate.getTime()) ? new Date().toISOString() : whenDate.toISOString(),
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      customerName: document.getElementById('customerName').value.trim(),
      paymentMethod: document.getElementById('paymentMethod').value,
      receiptId,
    };
  }

  function renderPreview() {
    const trip = tripDraft();
    const currency = operator?.currency || 'INR';
    document.getElementById('prev-name').textContent = operator?.businessName || 'Your cab';
    document.getElementById('prev-id').textContent = trip.receiptId;
    const when = CabbyFormat.formatWhen(trip.tripAt, trip.timeZone);
    document.getElementById('prev-when').textContent = when.line;
    setText('prev-source', trip.source, 'Pickup location');
    setText('prev-dest', trip.destination, 'Drop location');
    document.getElementById('prev-distance').textContent =
      trip.distanceKm > 0 ? CabbyFormat.formatDistance(trip.distanceKm) : '—';
    const parts = trip.amount > 0 ? CabbyFormat.splitFare(trip.amount) : null;
    const money = (value) => CabbyFormat.formatMoney(value, currency);
    document.getElementById('prev-fare').textContent = parts ? money(parts.tripFare) : '—';
    document.getElementById('prev-gst').textContent = parts ? money(parts.gst) : '—';
    document.getElementById('prev-total').textContent = parts ? money(parts.total) : '—';
    document.getElementById('prev-paid').textContent = `Paid via ${trip.paymentMethod}`;
    document.getElementById('amount-prefix').textContent = CabbyFormat.currencyPrefix(currency);

    const rider = document.getElementById('rider');
    rider.classList.toggle('hidden', !trip.customerName);
    document.getElementById('prev-rider').textContent = trip.customerName;

    const vehicle = [operator?.vehicleModel, operator?.vehicleNumber].filter(Boolean).join(' · ');
    const driver = document.getElementById('driver');
    driver.classList.toggle('hidden', !(operator?.driverName || vehicle));
    const driverName = document.getElementById('prev-driver');
    driverName.textContent = operator?.driverName || '';
    driverName.classList.toggle('hidden', !operator?.driverName);
    const vehicleEl = document.getElementById('prev-vehicle');
    vehicleEl.textContent = vehicle;
    vehicleEl.classList.toggle('hidden', !vehicle);

    document.getElementById('prev-biz').textContent = operator?.businessName || '';
    const tax = operator?.gstin
      ? `${operator.currency === 'INR' ? 'GSTIN' : 'Tax ID'} ${operator.gstin}`
      : '';
    const contact = [operator?.phone, operator?.email].filter(Boolean).join(' · ');
    document.getElementById('prev-meta').textContent = [operator?.address, operator?.city, contact, tax]
      .filter(Boolean)
      .join('\n');

    const ready = trip.source && trip.destination && trip.distanceKm > 0 && trip.amount > 0 && document.getElementById('tripAt').value;
    document.getElementById('download').disabled = !ready;
  }

  function localInputValue(date = new Date()) {
    const pad = (n) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  function restoreTripPreferences() {
    const payment = localStorage.getItem('cabby.payment');
    if (payment) document.getElementById('paymentMethod').value = payment;
    document.getElementById('tripAt').value = localInputValue();
  }

  function clearTrip() {
    ['source', 'destination', 'distanceKm', 'amount', 'customerName'].forEach((id) => {
      document.getElementById(id).value = '';
    });
    document.getElementById('tripAt').value = localInputValue();
    receiptId = CabbyFormat.makeReceiptId();
    setAlert('trip-error', '');
    setStatus('');
    renderPreview();
    document.getElementById('source').focus();
  }

  async function saveOperator(event) {
    event.preventDefault();
    setAlert('operator-error', '');
    const button = document.getElementById('operator-submit');
    button.disabled = true;
    const previous = button.textContent;
    button.textContent = 'Saving…';
    try {
      const res = await api('/api/operator', { method: 'PUT', json: operatorPayload() });
      if (!res.ok) {
        setAlert('operator-error', await readError(res));
        return;
      }
      const data = await res.json();
      operator = data.operator;
      fillOperatorForm(operator);
      if (dialog.open) dialog.close();
      show('desk');
      renderPreview();
    } catch (err) {
      if (err.status !== 401) setAlert('operator-error', 'Could not reach the server.');
    } finally {
      button.disabled = false;
      button.textContent = previous;
    }
  }

  async function downloadReceipt(event) {
    event.preventDefault();
    setAlert('trip-error', '');
    setStatus('');
    const trip = tripDraft();
    const button = document.getElementById('download');
    button.disabled = true;
    button.textContent = 'Preparing PDF…';
    try {
      localStorage.setItem('cabby.payment', trip.paymentMethod);
      const res = await api('/api/receipts', { method: 'POST', json: trip });
      if (!res.ok) {
        setAlert('trip-error', await readError(res));
        return;
      }
      const blob = await res.blob();
      const header = res.headers.get('Content-Disposition') || '';
      const match = header.match(/filename="([^"]+)"/);
      const filename = match ? match[1] : `Cabby-${trip.receiptId}.pdf`;
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
      setStatus(`Downloaded ${filename}`);
    } catch (err) {
      if (err.status !== 401) setAlert('trip-error', 'Could not reach the server.');
    } finally {
      button.textContent = 'Download PDF';
      renderPreview();
    }
  }

  document.getElementById('pin-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    setAlert('pin-error', '');
    const pin = document.getElementById('pin').value;
    sessionStorage.setItem('cabby.pin', pin);
    try {
      const res = await api('/api/operator');
      if (res.status === 401) return;
      if (!res.ok) {
        setAlert('pin-error', await readError(res));
        return;
      }
      const data = await res.json();
      operator = data.operator;
      openDesk();
    } catch (err) {
      if (err.status !== 401) setAlert('pin-error', 'Could not reach the server.');
    }
  });

  function openDesk() {
    fillOperatorForm(operator);
    if (operator) {
      show('desk');
      renderPreview();
    } else {
      placeOperator('setup');
      show('setup');
      document.getElementById('businessName').focus();
    }
  }

  operatorForm.addEventListener('submit', saveOperator);
  tripForm.addEventListener('submit', downloadReceipt);
  tripForm.addEventListener('input', () => {
    setStatus('');
    renderPreview();
  });
  document.getElementById('clear-trip').addEventListener('click', clearTrip);
  document.getElementById('edit-operator').addEventListener('click', () => {
    setAlert('operator-error', '');
    fillOperatorForm(operator);
    placeOperator('edit');
    dialog.showModal();
    document.getElementById('businessName').focus();
  });
  document.getElementById('close-operator').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => fillOperatorForm(operator));

  document.querySelectorAll('input[type="number"]').forEach((input) => {
    input.addEventListener('wheel', () => input.blur(), { passive: true });
  });

  restoreTripPreferences();

  api('/api/config')
    .then(async (res) => {
      if (!res.ok) throw new Error('config');
      const config = await res.json();
      if (config.pinRequired && !sessionStorage.getItem('cabby.pin')) {
        showPin();
        return;
      }
      const operatorRes = await api('/api/operator');
      if (!operatorRes.ok) throw new Error('operator');
      const data = await operatorRes.json();
      operator = data.operator;
      openDesk();
    })
    .catch((err) => {
      if (err.status === 401) return;
      boot.textContent = 'Cabby could not load. Refresh the page.';
      boot.classList.remove('hidden');
    });
})();
