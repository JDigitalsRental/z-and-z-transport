// Z & Z Transport Services — V7 Fleet Units (Phase 2A)
// Admin-only plate number and vehicle color. Existing units and bookings preserved.
import { auth, db } from './firebase.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js';
import { collection, doc, onSnapshot, setDoc, updateDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';

const ADMINS = new Set(['cNsIX5hzu6bbKOZDUsXVrQmdgvy1','8JlxtbBhsDOnop9elLVDDI4zpTg1']);
const $ = id => document.getElementById(id);
const units = [
  {id:'vios-1',name:'Vios #1',type:'Toyota Vios'},
  {id:'innova-1',name:'Innova #1',type:'Toyota Innova'},
  {id:'innova-2',name:'Innova #2',type:'Toyota Innova'},
  {id:'innova-3',name:'Innova #3',type:'Toyota Innova'},
  {id:'grandia-1',name:'Grandia #1',type:'Toyota GL Grandia'},
  {id:'grandia-2',name:'Grandia #2',type:'Toyota GL Grandia'}
];
let current = [], stop = null, authorized = false;
const msg = text => { if ($('v7Message')) $('v7Message').textContent = text; };

function field(labelText, value, maxLength, type = 'text') {
  const label = document.createElement('label');
  label.style.cssText = 'display:grid;gap:6px;margin:12px 0;color:#e4bd69;font-weight:600';
  label.textContent = labelText;
  const input = document.createElement('input');
  input.type = type;
  input.value = value || '';
  input.maxLength = maxLength;
  input.autocomplete = 'off';
  input.style.cssText = 'width:100%;box-sizing:border-box;padding:11px;border:1px solid #655332;border-radius:8px;background:#111216;color:#fff';
  label.append(input);
  return {label,input};
}

function render() {
  const root = $('v7Units');
  if (!root) return;
  root.replaceChildren();
  for (const u of units) {
    const saved = current.find(x => x.id === u.id);
    const card = document.createElement('article'); card.className = 'v5-item';
    const title = document.createElement('h3'); title.textContent = `${u.name} · ${u.type}`;
    const statusLabel = document.createElement('label');
    statusLabel.style.cssText = 'display:grid;gap:6px;margin-top:12px';
    statusLabel.textContent = 'Unit status:';
    const status = document.createElement('select');
    status.style.cssText = 'width:100%;padding:11px;border:1px solid #655332;border-radius:8px;background:#111216;color:#fff';
    for (const s of ['available','booked','maintenance']) {
      const o = document.createElement('option'); o.value = s;
      o.textContent = s[0].toUpperCase()+s.slice(1); status.append(o);
    }
    status.value = saved?.status || 'available';
    statusLabel.append(status);

    const plate = field('🔒 Plate number (admin only)', saved?.plateNumber, 30);
    const color = field('🔒 Vehicle color (admin only)', saved?.vehicleColor, 60);
    const noteLabel = document.createElement('label');
    noteLabel.style.cssText = 'display:grid;gap:6px;margin:12px 0';
    noteLabel.textContent = 'Internal notes:';
    const note = document.createElement('textarea'); note.rows = 2; note.maxLength = 500;
    note.style.cssText = 'width:100%;box-sizing:border-box;padding:11px;border:1px solid #655332;border-radius:8px;background:#111216;color:#fff';
    note.value = saved?.notes || '';
    noteLabel.append(note);

    const save = document.createElement('button');
    save.type = 'button'; save.textContent = saved ? 'Save unit' : 'Create unit';
    save.addEventListener('click', async () => {
      if (!authorized) return;
      save.disabled = true; msg(`Saving ${u.name}…`);
      try {
        const payload = {
          name:u.name, vehicleType:u.type, status:status.value,
          plateNumber:plate.input.value.trim().toUpperCase(),
          vehicleColor:color.input.value.trim(),
          notes:note.value.trim(), updatedAt:serverTimestamp()
        };
        if (saved) await updateDoc(doc(db,'fleetUnits',u.id),payload);
        else await setDoc(doc(db,'fleetUnits',u.id),{...payload,createdAt:serverTimestamp()});
        msg(`${u.name} saved successfully. Private details remain admin-only.`);
      } catch(e) { msg(`Save failed: ${e.message}`); }
      finally { save.disabled = false; }
    });
    card.append(title,statusLabel,plate.label,color.label,noteLabel,save);
    root.append(card);
  }
  if ($('v7Count')) $('v7Count').textContent = `${current.filter(x => units.some(u => u.id === x.id)).length} of 6 unit records created`;
}

onAuthStateChanged(auth, user => {
  if (stop) { stop(); stop = null; }
  authorized = !!user && ADMINS.has(user.uid);
  current = []; render();
  if (!authorized) { msg('Sign in as an authorized admin to manage units.'); return; }
  msg('Live fleet unit sync connected. Private vehicle details are admin-only.');
  stop = onSnapshot(collection(db,'fleetUnits'), snapshot => {
    current = snapshot.docs.map(d => ({id:d.id,...d.data()})); render();
  }, error => msg('Fleet sync error: '+error.message));
});
