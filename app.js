import { db } from './firebase.js';

import {
  collection,
  addDoc,
  onSnapshot,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';

'use strict';

// Vehicle records are managed in the admin dashboard and stored in Firestore.
// There are no demo vehicles or demo prices in this customer catalog.
let vehicles = [];
let catalogReady = false;
let catalogError = false;
let message = '';
let saving = false;

const $ = id => document.getElementById(id);
const peso = value => '₱' + Number(value || 0).toLocaleString('en-PH');

function categoryLabel(category) {
  return {
    sedan: 'Sedan / Car',
    suv: 'SUV',
    van: 'Van / MPV'
  }[category] || category || 'Vehicle';
}

function vehicleEmoji(category) {
  return { sedan: '🚘', suv: '🚙', van: '🚐' }[category] || '🚗';
}

function publicVehicles() {
  return vehicles.filter(vehicle => vehicle.visible !== false);
}

function makeNotice(text) {
  const notice = document.createElement('p');
  notice.className = 'empty';
  notice.textContent = text;
  return notice;
}

function renderFleet() {
  const grid = $('fleetGrid');
  const query = $('vehicleSearch').value.trim().toLowerCase();
  const filter = $('vehicleFilter').value;
  grid.replaceChildren();

  if (catalogError) {
    grid.append(makeNotice('Vehicle listings are temporarily unavailable. Please try again later.'));
    return;
  }
  if (!catalogReady) {
    grid.append(makeNotice('Loading available vehicles…'));
    return;
  }

  const list = publicVehicles().filter(vehicle =>
    (vehicle.name || '').toLowerCase().includes(query) &&
    (filter === 'all' || vehicle.status === filter)
  );

  if (!list.length) {
    grid.append(makeNotice('No matching vehicles found. Please check back soon.'));
    return;
  }

  for (const vehicle of list) {
    const card = document.createElement('article');
    card.className = 'card vehicle';

    const visual = document.createElement('div');
    visual.className = 'vehicle-visual';

    const fallback = () => {
      visual.replaceChildren();
      visual.textContent = vehicleEmoji(vehicle.category);
      visual.style.fontSize = '75px';
      visual.style.display = 'grid';
      visual.style.placeItems = 'center';
    };

    if (typeof vehicle.image === 'string' && /^https:\/\//i.test(vehicle.image)) {
      const photo = document.createElement('img');
      photo.src = vehicle.image;
      photo.alt = vehicle.name + ' vehicle photo';
      photo.loading = 'lazy';
      photo.decoding = 'async';
      photo.onerror = fallback;
      visual.append(photo);
    } else {
      fallback();
    }

    const body = document.createElement('div');
    body.className = 'vehicle-body';

    const tag = document.createElement('span');
    tag.className = 'tag';
    tag.textContent = categoryLabel(vehicle.category).toUpperCase();

    const status = document.createElement('span');
    status.className = 'status ' + (vehicle.status || 'available');
    status.textContent = vehicle.status === 'booked'
      ? '● CURRENTLY BOOKED'
      : vehicle.status === 'maintenance'
        ? '● MAINTENANCE'
        : '● AVAILABLE';

    const title = document.createElement('h3');
    title.textContent = vehicle.name || 'Vehicle';

    const seats = document.createElement('p');
    seats.textContent = 'Up to ' + Number(vehicle.seats || 0) + ' passengers';

    const price = document.createElement('div');
    price.className = 'price';
    price.textContent = 'From ' + peso(vehicle.self) + '/day';

    const sub = document.createElement('div');
    sub.className = 'subprice';
    sub.textContent = 'Self-drive ' + peso(vehicle.self) +
      ' / With driver ' + peso(vehicle.driver) + ' per day';

    body.append(tag, status, title, seats, price, sub);

    if (vehicle.description) {
      const description = document.createElement('p');
      description.textContent = vehicle.description;
      body.append(description);
    }

    const button = document.createElement('button');
    button.className = 'btn primary';
    button.textContent = 'INQUIRE ABOUT THIS VEHICLE ↗';
    button.onclick = () => {
      $('vehicle').value = vehicle.id;
      location.hash = 'booking';
    };
    body.append(button);

    card.append(visual, body);
    grid.append(card);
  }
}

function populateVehicles() {
  const select = $('vehicle');
  const previous = select.value;
  select.replaceChildren();

  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = catalogError
    ? 'Vehicles temporarily unavailable'
    : catalogReady
      ? 'Select a vehicle'
      : 'Loading vehicles…';
  placeholder.disabled = true;
  select.append(placeholder);

  for (const vehicle of publicVehicles()) {
    const option = document.createElement('option');
    option.value = vehicle.id;
    option.textContent = vehicle.name +
      (vehicle.status === 'booked' ? ' (Currently booked)' :
        vehicle.status === 'maintenance' ? ' (Maintenance)' : '');
    select.append(option);
  }

  if (publicVehicles().some(vehicle => vehicle.id === previous)) {
    select.value = previous;
  } else {
    select.value = '';
  }
  select.disabled = catalogError || !catalogReady || publicVehicles().length === 0;
}

$('vehicleSearch').addEventListener('input', renderFleet);
$('vehicleFilter').addEventListener('change', renderFleet);
renderFleet();
populateVehicles();

// Live Firestore listener: admin updates automatically reach the customer page.
onSnapshot(
  collection(db, 'vehicles'),
  snapshot => {
    vehicles = snapshot.docs.map(item => ({ ...item.data(), id: item.id }))
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    catalogReady = true;
    catalogError = false;
    renderFleet();
    populateVehicles();
  },
  error => {
    console.error('Unable to load vehicle catalog:', error);
    catalogReady = false;
    catalogError = true;
    vehicles = [];
    renderFleet();
    populateVehicles();
  }
);

$('year').textContent = new Date().getFullYear();

const today = new Date();
const localToday = new Date(today.getTime() - today.getTimezoneOffset() * 60000)
  .toISOString().slice(0, 10);
$('pickupDate').min = localToday;
$('returnDate').min = localToday;

for (const id of ['pickupDate', 'returnDate']) {
  const element = $(id);
  element.addEventListener('click', () => {
    if (typeof element.showPicker === 'function') {
      try {
        element.showPicker();
      } catch (error) {
        // Some browsers do not allow showPicker; the normal date input still works.
      }
    }
  });
}

$('pickupDate').addEventListener('change', () => {
  $('returnDate').min = $('pickupDate').value || localToday;
  if ($('returnDate').value && $('returnDate').value < $('pickupDate').value) {
    $('returnDate').value = $('pickupDate').value;
  }
});

$('bookingForm').addEventListener('submit', event => {
  event.preventDefault();

  const pickup = $('pickupDate').value;
  const returnDate = $('returnDate').value;
  if (!pickup || !returnDate || returnDate < pickup) {
    alert('Please select valid pickup and return dates.');
    return;
  }

  const vehicle = publicVehicles().find(item => item.id === $('vehicle').value);
  if (!vehicle) {
    alert('Please select a vehicle currently listed on the website.');
    return;
  }

  message = `Hi Z & Z Transport Services! 🚗\n\nI would like to request a rental quotation.\n\nFull Name: ${$('fullName').value.trim()}\nContact Number: ${$('phone').value.trim()}\nVehicle Category: ${vehicle.name}\nService Type: ${$('service').value}\nPickup Date: ${pickup}\nReturn Date: ${returnDate}\nPickup Location: ${$('pickupLocation').value.trim()}\nDestination / Route: ${$('destination').value.trim() || 'Not specified'}\nPassengers: ${$('passengers').value || 'Not specified'}\nAdditional Notes: ${$('notes').value.trim() || 'None'}\n\nPlease confirm vehicle availability, final pricing, and rental requirements. Thank you!`;

  $('bookingMessage').textContent = message;
  $('bookingSummary').classList.add('show');
  $('copyStatus').textContent = 'Copy the message, then paste and send it through Messenger.';
  $('bookingSummary').scrollIntoView({ behavior: 'smooth', block: 'nearest' });

  window.dispatchEvent(new CustomEvent('zz-inquiry-ready', {
    detail: {
      fullName: $('fullName').value.trim(),
      phone: $('phone').value.trim(),
      vehicleId: vehicle.id,
      vehicleName: vehicle.name,
      service: $('service').value,
      pickupDate: pickup,
      returnDate,
      pickupLocation: $('pickupLocation').value.trim(),
      destination: $('destination').value.trim(),
      passengers: Number($('passengers').value) || null,
      notes: $('notes').value.trim()
    }
  }));
});

$('bookingForm').addEventListener('reset', () => {
  message = '';
  $('bookingSummary').classList.remove('show');
  $('firebaseStatus').textContent = '';
  setTimeout(() => {
    $('returnDate').min = $('pickupDate').value || localToday;
  }, 0);
});

$('copyMessage').addEventListener('click', async () => {
  if (!message) return;
  try {
    await navigator.clipboard.writeText(message);
    $('copyStatus').textContent =
      'Copied! Open Facebook and paste the message into Messenger.';
  } catch (error) {
    $('copyStatus').textContent =
      'Automatic copy unavailable. Please select and copy the message above manually.';
  }
});

window.addEventListener('zz-inquiry-ready', async ({ detail }) => {
  const status = $('firebaseStatus');
  if (saving) {
    status.textContent = 'An inquiry is already being saved. Please wait.';
    return;
  }

  saving = true;
  status.textContent = 'Saving your inquiry securely…';
  try {
    await addDoc(collection(db, 'bookingInquiries'), {
      ...detail,
      status: 'pending',
      createdAt: serverTimestamp()
    });
    status.textContent =
      '✓ Inquiry saved successfully! You may also send the message through Messenger. This is not yet a confirmed booking.';
  } catch (error) {
    console.error('Inquiry save failed:', error);
    status.textContent =
      '⚠ Could not save the inquiry online. Please copy the message and send it through Facebook Messenger instead.';
  } finally {
    saving = false;
  }
});

// =============================================================
// V8 EXECUTIVE POPUP BOOKING — presentation only.
// Preserves the original booking form, Firebase and calculator.
// =============================================================
(function initPremiumBookingPopup() {
  const section = document.getElementById('booking');
  const form = document.getElementById('bookingForm');
  if (!section || !form || document.getElementById('zzBookingDialog')) return;

  const style = document.createElement('style');
  style.id = 'zzBookingPopupStyles';
  style.textContent = `
    #zzBookingDialog{position:fixed;inset:0;margin:auto;width:min(1160px,calc(100vw - 28px));max-width:1160px;max-height:min(92dvh,960px);padding:0;overflow:auto;overscroll-behavior:contain;color:var(--text,#f8f5ed);background:#101114;border:1px solid rgba(231,189,101,.6);border-radius:22px;box-shadow:0 30px 110px #000c}
    #zzBookingDialog::backdrop{background:rgba(0,0,0,.83);backdrop-filter:blur(7px)}
    #zzBookingDialog:not([open]){display:none}
    #zzBookingDialog .zz-popup-top{position:sticky;top:0;z-index:3;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 20px;background:rgba(12,13,15,.97);border-bottom:1px solid rgba(231,189,101,.28)}
    #zzBookingDialog .zz-popup-top strong{font:700 15px/1.4 Georgia,serif;color:#f4d58e;letter-spacing:.05em}
    #zzBookingDialog .zz-popup-close{width:38px;height:38px;display:grid;place-items:center;border:1px solid #8a6a37;border-radius:10px;background:#171717;color:#f4d58e;font-size:23px;line-height:1;cursor:pointer}
    #zzBookingDialog .zz-popup-close:hover{background:#332716}
    #zzBookingDialog #booking{padding:34px 0 40px;background:radial-gradient(circle at 10% 10%,rgba(160,111,40,.12),transparent 45%),#101114}
    #zzBookingDialog #booking .wrap{max-width:1100px}
    #zzBookingDialog #booking .booking-layout{grid-template-columns:minmax(0,.76fr) minmax(0,1.24fr);gap:26px}
    #zzBookingDialog #booking .form-card{box-shadow:none}
    #zzBookingDialog #booking .lead{font-size:15px}
    @media(max-width:800px){#zzBookingDialog #booking .booking-layout{grid-template-columns:1fr}#zzBookingDialog #booking{padding:22px 0 28px}#zzBookingDialog #booking .wrap{padding:0 16px}}
    @media(max-width:560px){#zzBookingDialog{width:calc(100vw - 12px);max-height:96dvh;border-radius:14px}#zzBookingDialog .zz-popup-top{padding:10px 14px}#zzBookingDialog #booking .form-card{padding:17px}#zzBookingDialog #booking .form-grid{grid-template-columns:1fr}}
  `;
  document.head.append(style);

  const dialog = document.createElement('dialog');
  dialog.id = 'zzBookingDialog';
  dialog.setAttribute('aria-label', 'Request a rental quotation');
  const top = document.createElement('div');
  top.className = 'zz-popup-top';
  const heading = document.createElement('strong');
  heading.textContent = 'Z & Z · RENTAL INQUIRY';
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'zz-popup-close';
  close.setAttribute('aria-label', 'Close booking form');
  close.textContent = '×';
  top.append(heading, close);
  dialog.append(top, section);
  document.body.append(dialog);

  let returnFocus = null;
  function openPopup() {
    if (dialog.open) return;
    returnFocus = document.activeElement;
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
    dialog.scrollTop = 0;
  }
  function closePopup() {
    if (typeof dialog.close === 'function' && dialog.open) dialog.close();
    else dialog.removeAttribute('open');
  }
  close.addEventListener('click', closePopup);
  dialog.addEventListener('click', event => {
    if (event.target === dialog) closePopup();
  });
  dialog.addEventListener('close', () => {
    if (returnFocus && typeof returnFocus.focus === 'function') returnFocus.focus({preventScroll:true});
  });

  // All existing links pointing at #booking now open the popup.
  document.addEventListener('click', event => {
    const link = event.target.closest?.('a[href="#booking"]');
    if (link) {
      event.preventDefault();
      openPopup();
      return;
    }
    // Existing app.js creates fleet inquiry buttons with onclick.
    const fleetButton = event.target.closest?.('#fleetGrid .vehicle button');
    if (fleetButton && fleetButton.textContent.includes('INQUIRE ABOUT THIS VEHICLE')) {
      // The original onclick has already selected the vehicle by the end of this event.
      openPopup();
    }
  });

  // Also supports the existing fleet button's location.hash assignment,
  // direct #booking URLs, and navigation from other scripts.
  window.addEventListener('hashchange', () => {
    if (location.hash === '#booking') openPopup();
  });
  if (location.hash === '#booking') openPopup();
})();
