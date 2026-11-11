import { auth, db } from './firebase.js';

import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js';

import {
  collection,
  onSnapshot,
  doc,
  updateDoc
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';

// Firebase Authentication UID for the Z & Z admin account.
const ADMIN_UID = 'cNsIX5hzu6bbKOZDUsXVrQmdgvy1';

const $ = id => document.getElementById(id);
let unsubscribe = null;
let records = [];

const statuses = ['pending', 'confirmed', 'declined', 'completed'];

const fmtDate = value => {
  if (!value) return '—';
  if (value.toDate) return value.toDate().toLocaleString('en-PH');
  return String(value);
};

const cell = (parent, label, value) => {
  const el = document.createElement('div');
  const b = document.createElement('b');
  b.textContent = label + ': ';
  el.append(
    b,
    document.createTextNode(
      value === null || value === undefined || value === ''
        ? '—'
        : String(value)
    )
  );
  parent.append(el);
};

function visible() {
  const q = $('search').value.trim().toLowerCase();
  const f = $('filter').value;

  return records.filter(r =>
    (f === 'all' || r.status === f) &&
    [
      r.fullName,
      r.phone,
      r.vehicleName,
      r.service,
      r.pickupLocation,
      r.destination,
      r.pickupDate
    ].some(v => String(v || '').toLowerCase().includes(q))
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
        await updateDoc(doc(db, 'bookingInquiries', r.id), {
          status: sel.value
        });
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
        .sort((a, b) =>
          (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)
        );

      $('dashboardMsg').textContent =
        'Live sync connected • ' + records.length + ' inquiries';
      render();
    },
    err => {
      $('dashboardMsg').textContent =
        'Unable to read bookings: ' + err.message;
    }
  );
}

onAuthStateChanged(auth, user => {
  const admin = !!user && user.uid === ADMIN_UID;

  $('loginSection').classList.toggle('hide', admin);
  $('dashboard').classList.toggle('hide', !admin);
  $('logout').classList.toggle('hide', !user);
  $('adminEmail').textContent = user?.email || '';

  if (!admin) {
    if (unsubscribe) {
      unsubscribe();
      unsubscribe = null;
    }

    records = [];
    if (user) {
      $('loginMsg').textContent =
        'This account is not authorized as the Z & Z admin. Please sign out.';
    }
  } else {
    subscribe();
  }
});

$('loginForm').addEventListener('submit', async e => {
  e.preventDefault();
  $('loginBtn').disabled = true;
  $('loginMsg').textContent = 'Signing in…';

  try {
    const result = await signInWithEmailAndPassword(
      auth,
      $('email').value.trim(),
      $('password').value
    );

    if (result.user.uid !== ADMIN_UID) {
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
    'fullName',
    'phone',
    'vehicleName',
    'service',
    'pickupDate',
    'returnDate',
    'pickupLocation',
    'destination',
    'passengers',
    'notes',
    'status'
  ];

  const csv = [
    fields.join(','),
    ...visible().map(r =>
      fields.map(k =>
        '"' + String(r[k] ?? '').replaceAll('"', '""') + '"'
      ).join(',')
    )
  ].join('\r\n');

  const blob = new Blob(['\ufeff' + csv], {
    type: 'text/csv;charset=utf-8'
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'ZandZ-bookings.csv';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
