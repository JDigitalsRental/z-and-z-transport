// Z & Z Transport Services — Admin Dashboard V5 extension.
// Keep existing admin.js and firebase.js unchanged.
import { auth, db } from './firebase.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js';
import { collection, addDoc, deleteDoc, doc, onSnapshot, serverTimestamp } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';

const ADMIN_UID = 'cNsIX5hzu6bbKOZDUsXVrQmdgvy1';
const $ = id => document.getElementById(id);
const money = n => '₱' + Number(n || 0).toLocaleString('en-PH', { maximumFractionDigits: 2 });
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
let bookings = [], vehicles = [], maintenance = [];
let unsubscribers = [];
let month = new Date(); month.setDate(1);

// Tabs are available only inside the authenticated dashboard.
for (const button of document.querySelectorAll('[data-v5-tab]')) {
  button.addEventListener('click', () => {
    const tab = button.dataset.v5Tab;
    for (const b of document.querySelectorAll('[data-v5-tab]')) b.setAttribute('aria-selected', String(b === button));
    for (const view of document.querySelectorAll('[data-v5-view]')) view.hidden = view.dataset.v5View !== tab;
  });
}

function make(tag, className, value) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (value !== undefined) el.textContent = value;
  return el;
}
function dateKey(d) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
function dateFromKey(s) { if (!/^\d{4}-\d{2}-\d{2}$/.test(String(s || ''))) return null; const [y,m,d] = s.split('-').map(Number); const v = new Date(y,m-1,d); return v.getFullYear() === y && v.getMonth() === m-1 && v.getDate() === d ? v : null; }
function overlaps(a,b) { return a.pickupDate < b.returnDate && b.pickupDate < a.returnDate; }
function bookingEvents(day) {
  return bookings.filter(b => ['confirmed','completed'].includes(b.status) && b.pickupDate && b.returnDate && b.pickupDate <= day && day < b.returnDate);
}
function drawCalendar() {
  const grid = $('v5Calendar'); grid.replaceChildren();
  $('v5MonthTitle').textContent = month.toLocaleDateString('en-PH', {month:'long', year:'numeric'});
  for (const label of ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']) grid.append(make('div','v5-day',label));
  const offset = new Date(month.getFullYear(), month.getMonth(), 1).getDay();
  for (let i=0;i<offset;i++) grid.append(make('div','v5-day',''));
  const days = new Date(month.getFullYear(),month.getMonth()+1,0).getDate();
  for (let d=1;d<=days;d++) {
    const key = dateKey(new Date(month.getFullYear(),month.getMonth(),d));
    const cell = make('div','v5-day'); cell.append(make('div','date',String(d)));
    for (const b of bookingEvents(key)) {
      const event = make('span','v5-event',(b.vehicleName || 'Vehicle')+' · '+(b.fullName || 'Booking'));
      event.title = `Confirmed/completed booking: ${b.pickupDate} to ${b.returnDate}`;
      cell.append(event);
    }
    grid.append(cell);
  }
  const conflicts = bookings.filter(a => a.status === 'confirmed' && bookings.some(b => b !== a && b.status === 'confirmed' && a.vehicleId && a.vehicleId === b.vehicleId && overlaps(a,b)));
  $('v5CalendarMessage').textContent = conflicts.length ? `⚠ ${conflicts.length} confirmed booking(s) may overlap. Check dates before approving new requests.` : 'No overlapping confirmed bookings detected.';
}
$('v5PrevMonth').onclick = () => { month.setMonth(month.getMonth()-1); drawCalendar(); };
$('v5NextMonth').onclick = () => { month.setMonth(month.getMonth()+1); drawCalendar(); };

function drawAnalytics() {
  $('v5Total').textContent = bookings.length;
  $('v5Completed').textContent = bookings.filter(b => b.status === 'completed').length;
  $('v5Upcoming').textContent = bookings.filter(b => b.status === 'confirmed' && b.pickupDate >= today()).length;
  // finalAmount is an optional admin-maintained value, not a calculated quote.
  $('v5Revenue').textContent = money(bookings.filter(b => ['confirmed','completed'].includes(b.status)).reduce((sum,b) => sum + (Number(b.finalAmount) || 0),0));
  const counts = new Map();
  for (const b of bookings) counts.set(b.vehicleName || 'Unknown vehicle',(counts.get(b.vehicleName || 'Unknown vehicle')||0)+1);
  const popular = $('v5Popular'); popular.replaceChildren();
  for (const [name,count] of [...counts].sort((a,b)=>b[1]-a[1]).slice(0,6)) popular.append(make('div','v5-item',`${name} — ${count} inquiries`));
  if (!counts.size) popular.append(make('p','v5-muted','No inquiries yet.'));
  const reminders = $('v5Reminders'); reminders.replaceChildren();
  const now = dateFromKey(today()); const cutoff = new Date(now); cutoff.setDate(cutoff.getDate()+7);
  const cutoffKey = dateKey(cutoff);
  for (const b of bookings.filter(b => b.status === 'confirmed')) {
    for (const [label,date] of [['Pickup',b.pickupDate],['Return',b.returnDate]]) {
      if (date >= today() && date <= cutoffKey) reminders.append(make('div','v5-item',`${label} · ${date} · ${b.vehicleName || 'Vehicle'} · ${b.fullName || 'Customer'}`));
    }
  }
  if (!reminders.children.length) reminders.append(make('p','v5-muted','No pickups or returns in the next 7 days.'));
}

function drawVehicleOptions() {
  const select = $('v5MaintenanceVehicle'); const prev = select.value; select.replaceChildren();
  for (const v of vehicles) { const o = make('option','',v.name || 'Vehicle'); o.value = v.id; select.append(o); }
  if (vehicles.some(v => v.id === prev)) select.value = prev;
}
function drawMaintenance() {
  const list = $('v5MaintenanceList'); list.replaceChildren();
  for (const m of maintenance.slice().sort((a,b)=>String(b.serviceDate||'').localeCompare(String(a.serviceDate||'')))) {
    const v = vehicles.find(v=>v.id===m.vehicleId);
    const item = make('div','v5-item');
    item.append(make('strong','',`${v?.name || m.vehicleName || 'Vehicle'} — ${m.type || 'Service'}`));
    item.append(make('p','v5-muted',`Service: ${m.serviceDate || '—'} · Next due: ${m.nextDue || '—'} · Cost: ${money(m.cost)}`));
    if (m.notes) item.append(make('p','',m.notes));
    const del = make('button','','Delete record');
    del.onclick = async () => { if (!confirm('Delete this maintenance record?')) return; del.disabled=true; try { await deleteDoc(doc(db,'vehicleMaintenance',m.id)); } catch(e) { $('v5MaintenanceMessage').textContent='Delete failed: '+e.message; del.disabled=false; } };
    item.append(del); list.append(item);
  }
  if (!maintenance.length) list.append(make('p','v5-muted','No maintenance records yet.'));
}
$('v5MaintenanceDate').value = today();
$('v5MaintenanceForm').addEventListener('submit', async e => {
  e.preventDefault(); const btn=$('v5MaintenanceSave'); const v=vehicles.find(x=>x.id===$('v5MaintenanceVehicle').value);
  const cost=Number($('v5MaintenanceCost').value);
  if (!v || !Number.isFinite(cost) || cost<0) { $('v5MaintenanceMessage').textContent='Select a vehicle and enter a valid cost.'; return; }
  btn.disabled=true; $('v5MaintenanceMessage').textContent='Saving…';
  try {
    await addDoc(collection(db,'vehicleMaintenance'),{
      vehicleId:v.id, vehicleName:v.name, type:$('v5MaintenanceType').value.trim(),
      serviceDate:$('v5MaintenanceDate').value, nextDue:$('v5MaintenanceDue').value,
      cost, notes:$('v5MaintenanceNotes').value.trim(), createdAt:serverTimestamp()
    });
    $('v5MaintenanceForm').reset(); $('v5MaintenanceDate').value=today();
    $('v5MaintenanceMessage').textContent='Maintenance record saved.';
  } catch(err) { $('v5MaintenanceMessage').textContent='Save failed: '+err.message; }
  finally { btn.disabled=false; }
});

onAuthStateChanged(auth,user => {
  for (const unsubscribe of unsubscribers) unsubscribe(); unsubscribers=[];
  bookings=[]; vehicles=[]; maintenance=[];
  if (!user || user.uid !== ADMIN_UID) return;
  unsubscribers.push(onSnapshot(collection(db,'bookingInquiries'), snap => {
    bookings=snap.docs.map(d=>({id:d.id,...d.data()})); drawCalendar(); drawAnalytics();
  }, e => { $('v5CalendarMessage').textContent='Booking sync error: '+e.message; }));
  unsubscribers.push(onSnapshot(collection(db,'vehicles'), snap => {
    vehicles=snap.docs.map(d=>({id:d.id,...d.data()})); drawVehicleOptions(); drawMaintenance();
  }, e => { $('v5MaintenanceMessage').textContent='Vehicle sync error: '+e.message; }));
  unsubscribers.push(onSnapshot(collection(db,'vehicleMaintenance'), snap => {
    maintenance=snap.docs.map(d=>({id:d.id,...d.data()})); drawMaintenance();
  }, e => { $('v5MaintenanceMessage').textContent='Maintenance sync error: '+e.message; }));
});
