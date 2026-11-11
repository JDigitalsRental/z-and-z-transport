// Z & Z Transport Services — Customer V5 enhancement.
// Additive only: existing app.js and Firebase booking submission stay unchanged.
import { db } from './firebase.js';
import { collection, onSnapshot } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';

const el = id => document.getElementById(id);
const pesos = n => '₱' + Number(n).toLocaleString('en-PH', {maximumFractionDigits:2});
let catalog = [];
const calculator = document.createElement('section');
calculator.id = 'zzV5Calculator';
calculator.setAttribute('aria-live','polite');
calculator.style.cssText = 'padding:18px;margin:16px 0;border:1px solid #8b6b35;border-radius:12px;background:#15161a;color:#f8f5ed';
calculator.innerHTML = '<h3 style="margin:0 0 8px;color:#e7bd65">Estimated Rental Price</h3><p id="zzV5Estimate" style="margin:0 0 8px">Choose a vehicle, service and rental dates to see an estimate.</p><p style="font-size:12px;opacity:.8;margin:0">Estimate only, not a confirmed quotation. Fuel, tolls, deposits, driver overtime, location charges and other fees may apply. Final pricing and availability require confirmation.</p>';
const form = el('bookingForm');
if (form) {
  const summary = el('bookingSummary');
  if (summary && summary.parentNode === form) form.insertBefore(calculator, summary);
  else form.append(calculator);
}
function validDate(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s || '')) return null;
  const [y,m,d] = s.split('-').map(Number);
  const utc = Date.UTC(y,m-1,d);
  const dt = new Date(utc);
  return dt.getUTCFullYear()===y && dt.getUTCMonth()===m-1 && dt.getUTCDate()===d ? utc : null;
}
function calculate() {
  const output = el('zzV5Estimate');
  if (!output) return;
  const vehicle = catalog.find(v => v.id === el('vehicle')?.value);
  const start = validDate(el('pickupDate')?.value);
  const end = validDate(el('returnDate')?.value);
  if (!vehicle || start === null || end === null) {
    output.textContent = 'Choose a vehicle, service and rental dates to see an estimate.';
    return;
  }
  if (end < start) { output.textContent = 'Return date must not be earlier than pickup date.'; return; }
  const days = Math.max(1, Math.round((end - start)/86400000));
  const service = (el('service')?.value || '').toLowerCase();
  if (!service.includes('self-drive') && !service.includes('with driver')) { output.textContent = 'Special trips and transfers require a custom quotation. Please submit your inquiry.'; return; }
  const driver = service.includes('with driver');
  const daily = Number(driver ? vehicle.driver : vehicle.self);
  if (!Number.isFinite(daily) || daily < 0) { output.textContent = 'Pricing is not available for this vehicle. Please request a quotation.'; return; }
  output.textContent = `${vehicle.name || 'Vehicle'} · ${driver ? 'With driver' : 'Self-drive'} · ${days} rental day${days===1?'':'s'} × ${pesos(daily)} = ${pesos(days*daily)} estimated base price.`;
}
for (const id of ['vehicle','service','pickupDate','returnDate']) {
  const field = el(id);
  if (field) { field.addEventListener('change',calculate); field.addEventListener('input',calculate); }
}
if (form) form.addEventListener('reset', () => setTimeout(calculate,0));

// Optional public gallery data: vehicles.gallery = [https://...].
// No private uploads or Firebase Storage required.
const modal = document.createElement('dialog');
modal.id = 'zzV5Gallery';
modal.setAttribute('aria-label','Vehicle photo gallery');
modal.style.cssText = 'max-width:min(90vw,850px);width:100%;padding:18px;border:1px solid #b9904b;border-radius:14px;background:#111216;color:#fff';
modal.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center;gap:10px"><h3 id="zzV5GalleryTitle" style="color:#e7bd65;margin:0"></h3><button id="zzV5GalleryClose" type="button" style="padding:8px 14px">Close ✕</button></div><div id="zzV5GalleryPhotos" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,230px),1fr));gap:12px;margin-top:14px"></div>';
document.body.append(modal);
el('zzV5GalleryClose').addEventListener('click', () => modal.close());
function safePhotos(vehicle) {
  const entries = [vehicle.image, ...(Array.isArray(vehicle.gallery) ? vehicle.gallery : [])];
  return [...new Set(entries.filter(url => typeof url === 'string' && /^https:\/\//i.test(url)))].slice(0,12);
}
function openGallery(vehicle) {
  const images = safePhotos(vehicle);
  el('zzV5GalleryTitle').textContent = `${vehicle.name || 'Vehicle'} — Photos`;
  const container = el('zzV5GalleryPhotos'); container.replaceChildren();
  for (const src of images) {
    const img = document.createElement('img');
    img.src=src; img.alt=`${vehicle.name || 'Vehicle'} photo`; img.loading='lazy';
    img.style.cssText='width:100%;max-height:340px;object-fit:contain;border-radius:9px;background:#202024';
    container.append(img);
  }
  if (!images.length) container.textContent = 'No gallery photos available yet.';
  if (typeof modal.showModal === 'function') modal.showModal();
}
function decorateFleet() {
  const cards = [...document.querySelectorAll('#fleetGrid .vehicle')];
  for (const card of cards) {
    if (card.querySelector('.zz-v5-photos')) continue;
    const name = card.querySelector('h3')?.textContent?.trim();
    const vehicle = catalog.find(v => v.name === name);
    if (!vehicle || !safePhotos(vehicle).length) continue;
    const button = document.createElement('button');
    button.type='button'; button.className='btn zz-v5-photos';
    button.textContent = `VIEW PHOTOS (${safePhotos(vehicle).length})`;
    button.style.marginTop='8px';
    button.addEventListener('click', () => openGallery(vehicle));
    const body = card.querySelector('.vehicle-body');
    if (body) body.append(button);
  }
}
const fleetGrid = el('fleetGrid');
if (fleetGrid) new MutationObserver(decorateFleet).observe(fleetGrid,{childList:true});
onSnapshot(collection(db,'vehicles'), snap => {
  catalog = snap.docs.map(d => ({...d.data(),id:d.id})).filter(v => v.visible !== false);
  calculate(); decorateFleet();
}, err => { console.warn('V5 calculator/gallery vehicle sync unavailable:',err); });
