import { auth, db } from './firebase.js';

import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
  sendPasswordResetEmail
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js';

import {
  collection,
  onSnapshot,
  doc,
  updateDoc,
  addDoc,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';

const ADMIN_UIDS = new Set(['cNsIX5hzu6bbKOZDUsXVrQmdgvy1', '8JlxtbBhsDOnop9elLVDDI4zpTg1']);
const isAdmin = user => !!user && ADMIN_UIDS.has(user.uid);
const $ = id => document.getElementById(id);

let unsubscribe = null;
let unsubscribeVehicles = null;
let records = [];
let vehicles = [];

const statuses = ['pending', 'confirmed', 'declined', 'completed'];
const fmtDate = value => {
  if (!value) return '—';
  if (value.toDate) return value.toDate().toLocaleString('en-PH');
  return String(value);
};
const peso = value => '₱' + Number(value || 0).toLocaleString('en-PH');

function cell(parent, label, value) {
  const el = document.createElement('div');
  const b = document.createElement('b');
  b.textContent = label + ': ';
  el.append(
    b,
    document.createTextNode(
      value === null || value === undefined || value === '' ? '—' : String(value)
    )
  );
  parent.append(el);
}

function visible() {
  const q = $('search').value.trim().toLowerCase();
  const f = $('filter').value;
  return records.filter(r =>
    (f === 'all' || r.status === f) &&
    [r.fullName, r.phone, r.vehicleName, r.service, r.pickupLocation, r.destination, r.pickupDate]
      .some(v => String(v || '').toLowerCase().includes(q))
  );
}

function render() {
  for (const s of ['pending', 'confirmed', 'completed']) {
    $(s).textContent = records.filter(r => r.status === s).length;
  }
  $('total').textContent = records.length;
  const area = $('bookings');
  area.replaceChildren();
  const items = visible();

  if (!items.length) {
    const p = document.createElement('p');
    p.className = 'note';
    p.textContent = 'No matching inquiries.';
    area.append(p);
    return;
  }

  for (const r of items) {
    const card = document.createElement('article');
    card.className = 'booking';
    const head = document.createElement('div');
    head.className = 'booking-head';
    const title = document.createElement('div');
    const h = document.createElement('h3');
    h.textContent = r.fullName || 'Unnamed customer';
    const meta = document.createElement('small');
    meta.textContent = 'Submitted: ' + fmtDate(r.createdAt);
    title.append(h, meta);
    const pill = document.createElement('span');
    pill.className = 'pill';
    pill.textContent = r.status || 'unknown';
    head.append(title, pill);
    const details = document.createElement('div');
    details.className = 'details';

    for (const [label, value] of [
      ['Phone', r.phone],
      ['Vehicle', r.vehicleName],
      ['Service', r.service],
      ['Pickup date', r.pickupDate],
      ['Return date', r.returnDate],
      ['Pickup location', r.pickupLocation],
      ['Destination', r.destination],
      ['Passengers', r.passengers],
      ['Notes', r.notes]
    ]) {
      cell(details, label, value);
    }

    const actions = document.createElement('div');
    actions.className = 'actions';
    const sel = document.createElement('select');
    sel.setAttribute('aria-label', 'Status for ' + (r.fullName || 'booking'));
    for (const s of statuses) {
      const opt = document.createElement('option');
      opt.value = s;
      opt.textContent = s[0].toUpperCase() + s.slice(1);
      sel.append(opt);
    }
    sel.value = statuses.includes(r.status) ? r.status : 'pending';
    const save = document.createElement('button');
    save.className = 'primary';
    save.textContent = 'Save status';
    save.onclick = async () => {
      save.disabled = true;
      save.textContent = 'Saving…';
      try {
        await updateDoc(doc(db, 'bookingInquiries', r.id), { status: sel.value });
        $('dashboardMsg').textContent = 'Booking status updated.';
      } catch (err) {
        $('dashboardMsg').textContent = 'Update failed: ' + err.message;
      } finally {
        save.disabled = false;
        save.textContent = 'Save status';
      }
    };
    actions.append(sel, save);

    if (r.phone) {
      const copy = document.createElement('button');
      copy.textContent = 'Copy phone';
      copy.onclick = async () => {
        try {
          await navigator.clipboard.writeText(String(r.phone));
          copy.textContent = 'Copied!';
        } catch {
          copy.textContent = 'Copy unavailable';
        }
      };
      actions.append(copy);
    }
    card.append(head, details, actions);
    area.append(card);
  }
}

function subscribe() {
  if (unsubscribe) unsubscribe();
  $('dashboardMsg').textContent = 'Loading bookings…';
  unsubscribe = onSnapshot(
    collection(db, 'bookingInquiries'),
    snapshot => {
      records = snapshot.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      $('dashboardMsg').textContent = 'Live sync connected • ' + records.length + ' inquiries';
      render();
    },
    err => { $('dashboardMsg').textContent = 'Unable to read bookings: ' + err.message; }
  );
}

function resetVehicleForm() {
  $('vehicleForm').reset();
  $('editingVehicleId').value = '';
  $('vehicleSaveBtn').textContent = 'Add vehicle';
  $('vehicleMsg').textContent = '';
}

function fillVehicleForm(v) {
  $('editingVehicleId').value = v.id;
  $('vehicleName').value = v.name || '';
  $('vehicleCategory').value = v.category || 'other';
  $('vehicleSeats').value = v.seats ?? 4;
  $('vehicleSelfPrice').value = v.self ?? 0;
  $('vehicleDriverPrice').value = v.driver ?? 0;
  $('vehicleStatus').value = v.status || 'available';
  $('vehicleImage').value = v.image || '';
  $('vehicleDescription').value = v.description || '';
  $('vehicleVisible').checked = v.visible !== false;
  $('vehicleSaveBtn').textContent = 'Save vehicle changes';
  $('vehicleForm').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderVehicles() {
  const list = $('vehicleList');
  list.replaceChildren();
  if (!vehicles.length) {
    const p = document.createElement('p');
    p.className = 'note';
    p.textContent = 'No vehicles in Firestore yet. Add your first vehicle above.';
    list.append(p);
    return;
  }
  for (const v of vehicles) {
    const card = document.createElement('article');
    card.className = 'vehicle-admin-card';
    if (v.image && /^https:\/\//i.test(v.image)) {
      const img = document.createElement('img');
      img.src = v.image;
      img.alt = v.name || 'Vehicle';
      img.loading = 'lazy';
      img.referrerPolicy = 'no-referrer';
      img.onerror = () => img.remove();
      card.append(img);
    }
    const info = document.createElement('div');
    info.className = 'info';
    const h = document.createElement('h3');
    h.textContent = v.name || 'Unnamed vehicle';
    const details = document.createElement('p');
    details.textContent = `${v.category || 'other'} • ${v.seats || '—'} seats • ${v.status || 'available'} • ${v.visible === false ? 'Hidden' : 'Visible'}`;
    const prices = document.createElement('p');
    prices.textContent = `Self-drive ${peso(v.self)} / With driver ${peso(v.driver)} per day`;
    info.append(h, details, prices);
    if (v.description) {
      const desc = document.createElement('p');
      desc.textContent = v.description;
      info.append(desc);
    }
    const buttons = document.createElement('div');
    buttons.className = 'buttons';
    const edit = document.createElement('button');
    edit.textContent = 'Edit';
    edit.onclick = () => fillVehicleForm(v);
    const toggle = document.createElement('button');
    toggle.textContent = v.visible === false ? 'Show' : 'Hide';
    toggle.onclick = async () => {
      toggle.disabled = true;
      try {
        await updateDoc(doc(db, 'vehicles', v.id), {
          visible: v.visible === false,
          updatedAt: serverTimestamp()
        });
        $('vehicleMsg').textContent = 'Vehicle visibility updated.';
      } catch (err) {
        $('vehicleMsg').textContent = 'Update failed: ' + err.message;
      } finally {
        toggle.disabled = false;
      }
    };
    buttons.append(edit, toggle);
    card.append(info, buttons);
    list.append(card);
  }
}

function subscribeVehicles() {
  if (unsubscribeVehicles) unsubscribeVehicles();
  $('vehicleMsg').textContent = 'Loading vehicles…';
  unsubscribeVehicles = onSnapshot(
    collection(db, 'vehicles'),
    snapshot => {
      vehicles = snapshot.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      $('vehicleMsg').textContent = 'Vehicle management connected • ' + vehicles.length + ' vehicles';
      renderVehicles();
    },
    err => {
      $('vehicleMsg').textContent = 'Unable to read vehicles: ' + err.message + '. Firestore rules may need updating.';
    }
  );
}

$('vehicleForm').addEventListener('submit', async event => {
  event.preventDefault();
  const image = $('vehicleImage').value.trim();
  if (image && !/^https:\/\//i.test(image)) {
    $('vehicleMsg').textContent = 'Photo URL must begin with https://';
    return;
  }
  const payload = {
    name: $('vehicleName').value.trim(),
    category: $('vehicleCategory').value,
    seats: Number($('vehicleSeats').value),
    self: Number($('vehicleSelfPrice').value),
    driver: Number($('vehicleDriverPrice').value),
    status: $('vehicleStatus').value,
    image,
    description: $('vehicleDescription').value.trim(),
    visible: $('vehicleVisible').checked,
    updatedAt: serverTimestamp()
  };
  if (!payload.name || !Number.isInteger(payload.seats) || payload.seats < 1 ||
      !Number.isFinite(payload.self) || payload.self < 0 ||
      !Number.isFinite(payload.driver) || payload.driver < 0) {
    $('vehicleMsg').textContent = 'Please enter valid vehicle details and prices.';
    return;
  }
  const save = $('vehicleSaveBtn');
  save.disabled = true;
  $('vehicleMsg').textContent = 'Saving vehicle…';
  try {
    const id = $('editingVehicleId').value;
    if (id) {
      await updateDoc(doc(db, 'vehicles', id), payload);
    } else {
      await addDoc(collection(db, 'vehicles'), { ...payload, createdAt: serverTimestamp() });
    }
    resetVehicleForm();
    $('vehicleMsg').textContent = id ? 'Vehicle updated successfully.' : 'Vehicle added successfully.';
  } catch (err) {
    $('vehicleMsg').textContent = 'Could not save vehicle: ' + err.message;
  } finally {
    save.disabled = false;
  }
});

$('vehicleCancelBtn').onclick = resetVehicleForm;

onAuthStateChanged(auth, user => {
  const admin = !!user && isAdmin(user);
  $('loginSection').classList.toggle('hide', admin);
  $('dashboard').classList.toggle('hide', !admin);
  $('logout').classList.toggle('hide', !user);
  $('adminEmail').textContent = user?.email || '';

  if (!admin) {
    if (unsubscribe) { unsubscribe(); unsubscribe = null; }
    if (unsubscribeVehicles) { unsubscribeVehicles(); unsubscribeVehicles = null; }
    records = [];
    vehicles = [];
    if (user) {
      $('loginMsg').textContent = 'This account is not authorized as the Z & Z admin. Please sign out.';
    }
  } else {
    subscribe();
    subscribeVehicles();
  }
});

$('loginForm').addEventListener('submit', async e => {
  e.preventDefault();
  $('loginBtn').disabled = true;
  $('loginMsg').textContent = 'Signing in…';
  try {
    const result = await signInWithEmailAndPassword(auth, $('email').value.trim(), $('password').value);
    if (!isAdmin(result.user)) {
      $('loginMsg').textContent = 'Account is not authorized as admin.';
      await signOut(auth);
    } else {
      $('loginMsg').textContent = '';
    }
  } catch (err) {
    $('loginMsg').textContent = 'Login failed: ' + err.message;
  } finally {
    $('loginBtn').disabled = false;
  }
});

$('logout').onclick = () => signOut(auth);
$('search').oninput = render;
$('filter').onchange = render;
$('refresh').onclick = subscribe;

$('exportBtn').onclick = () => {
  const fields = [
    'fullName', 'phone', 'vehicleName', 'service', 'pickupDate', 'returnDate',
    'pickupLocation', 'destination', 'passengers', 'notes', 'status'
  ];
  const csv = [
    fields.join(','),
    ...visible().map(r => fields.map(k =>
      '"' + String(r[k] ?? '').replaceAll('"', '""') + '"'
    ).join(','))
  ].join('\r\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'ZandZ-bookings.csv';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

// V6 password controls: each admin can change only their own password.
// Passwords never enter Firestore or localStorage.
(function setupPasswordControls() {
  const login = $('loginSection');
  const dash = $('dashboard');
  if (!login || !dash) return;
  const resetBox = document.createElement('div');
  resetBox.style.marginTop = '16px';
  const resetBtn = document.createElement('button');
  resetBtn.type = 'button'; resetBtn.textContent = 'Forgot password?';
  const resetMsg = document.createElement('p');
  resetMsg.setAttribute('role', 'status');
  resetBtn.onclick = async () => {
    const email = $('email')?.value.trim();
    if (!email) { resetMsg.textContent = 'Enter your registered email first.'; return; }
    resetBtn.disabled = true;
    try {
      await sendPasswordResetEmail(auth, email);
      resetMsg.textContent = 'If this email is registered, a password reset message will be sent. Check your inbox and spam folder.';
    } catch (err) {
      resetMsg.textContent = 'Could not request reset: ' + err.message;
    } finally { resetBtn.disabled = false; }
  };
  resetBox.append(resetBtn, resetMsg);
  login.append(resetBox);

  const box = document.createElement('section');
  box.style.cssText = 'margin:24px auto;padding:20px;max-width:620px;border:1px solid #66502d;border-radius:12px;background:#151518;color:#f6e8c8';
  const heading = document.createElement('h3'); heading.textContent = '🔐 Change My Password';
  const info = document.createElement('p'); info.textContent = 'Change the password for your currently signed-in admin account only.';
  const form = document.createElement('form');
  form.style.cssText = 'display:grid;gap:12px';
  function field(labelText, autocomplete) {
    const label = document.createElement('label'); label.textContent = labelText;
    label.style.cssText = 'display:grid;gap:5px';
    const input = document.createElement('input');
    input.type = 'password'; input.required = true; input.minLength = autocomplete === 'new-password' ? 8 : 1;
    input.autocomplete = autocomplete;
    input.style.cssText = 'width:100%;padding:12px;border:1px solid #77603a;border-radius:7px;background:#0e0e11;color:white;box-sizing:border-box';
    label.append(input); form.append(label); return input;
  }
  const current = field('Current password', 'current-password');
  const next = field('New password (minimum 8 characters)', 'new-password');
  const confirm = field('Confirm new password', 'new-password');
  const submit = document.createElement('button'); submit.type = 'submit';
  submit.textContent = 'Change My Password'; submit.style.cssText = 'padding:12px;background:#dfb45e;color:#16120a;border:0;border-radius:7px;font-weight:bold;cursor:pointer';
  const message = document.createElement('p'); message.setAttribute('role', 'status');
  form.append(submit, message);
  form.onsubmit = async event => {
    event.preventDefault();
    const user = auth.currentUser;
    if (!isAdmin(user) || !user.email) { message.textContent = 'Sign in as an authorized admin first.'; return; }
    if (next.value !== confirm.value) { message.textContent = 'New passwords do not match.'; return; }
    if (next.value.length < 8) { message.textContent = 'Use at least 8 characters.'; return; }
    if (current.value === next.value) { message.textContent = 'Choose a different new password.'; return; }
    submit.disabled = true; message.textContent = 'Updating password…';
    try {
      const credential = EmailAuthProvider.credential(user.email, current.value);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, next.value);
      form.reset(); message.textContent = 'Password updated successfully.';
    } catch (err) {
      message.textContent = 'Password update failed: ' + err.message;
    } finally { submit.disabled = false; }
  };
  box.append(heading, info, form);
  dash.append(box);
})();
