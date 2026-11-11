// Z & Z Transport Services — Customer V8 price calculator only.
// Keeps app.js Firebase inquiry handling untouched. No photo gallery.
import { db } from './firebase.js';
import { collection, onSnapshot } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';
const el = id => document.getElementById(id);
const pesos = n => '₱' + Number(n).toLocaleString('en-PH',{maximumFractionDigits:2});
let catalog = [];
const form = el('bookingForm');
const calculator = document.createElement('section');
calculator.id = 'zzV5Calculator';
calculator.setAttribute('aria-live','polite');
calculator.innerHTML = `<h3 style="margin:0 0 8px;color:#e7bd65">Estimated Rental Price</h3><p id="zzV5Estimate" style="margin:0 0 8px">Choose a vehicle, service and rental dates to see an estimate.</p><p style="font-size:12px;opacity:.8;margin:0">Estimate only, not a confirmed quotation. Fuel, tolls, deposits, driver overtime, location charges and other fees may apply. Final pricing and availability require confirmation.</p>`;
calculator.style.cssText = 'padding:18px;margin:16px 0;border:1px solid #8b6b35;border-radius:12px;background:#15161a;color:#f8f5ed';
if(form){const summary=el('bookingSummary');if(summary?.parentNode===form)form.insertBefore(calculator,summary);else form.append(calculator)}
function validDate(s){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(s||''))return null;
 const [y,m,d]=s.split('-').map(Number),utc=Date.UTC(y,m-1,d),dt=new Date(utc);
 return dt.getUTCFullYear()===y&&dt.getUTCMonth()===m-1&&dt.getUTCDate()===d?utc:null;
}
function calculate(){
 const output=el('zzV5Estimate');if(!output)return;
 const vehicle=catalog.find(v=>v.id===el('vehicle')?.value);
 const start=validDate(el('pickupDate')?.value),end=validDate(el('returnDate')?.value);
 if(!vehicle||start===null||end===null){output.textContent='Choose a vehicle, service and rental dates to see an estimate.';return}
 if(end<start){output.textContent='Return date must not be earlier than pickup date.';return}
 const days=Math.max(1,Math.round((end-start)/86400000));
 const service=(el('service')?.value||'').toLowerCase();
 if(!service.includes('self-drive')&&!service.includes('with driver')){output.textContent='Special trips and transfers require a custom quotation. Please submit your inquiry.';return}
 const driver=service.includes('with driver'),daily=Number(driver?vehicle.driver:vehicle.self);
 if(!Number.isFinite(daily)||daily<0){output.textContent='Pricing is not available for this vehicle. Please request a quotation.';return}
 output.textContent=`${vehicle.name||'Vehicle'} · ${driver?'With driver':'Self-drive'} · ${days} rental day${days===1?'':'s'} × ${pesos(daily)} = ${pesos(days*daily)} estimated base price.`;
}
for(const id of ['vehicle','service','pickupDate','returnDate']){const field=el(id);if(field){field.addEventListener('change',calculate);field.addEventListener('input',calculate)}}
if(form)form.addEventListener('reset',()=>setTimeout(calculate,0));
onSnapshot(collection(db,'vehicles'),snap=>{catalog=snap.docs.map(d=>({...d.data(),id:d.id})).filter(v=>v.visible!==false);calculate()},err=>console.warn('V8 calculator vehicle sync unavailable:',err));
