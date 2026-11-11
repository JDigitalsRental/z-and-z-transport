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
