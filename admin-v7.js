// Z & Z Transport Services — V7 Fleet Units (Phase 1)
// Inventory only. Does NOT change bookings, confirmations, or maintenance.
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
const msg = text => { $('v7Message').textContent = text; };
function render() {
  const root = $('v7Units'); root.replaceChildren();
  for (const u of units) {
    const saved = current.find(x => x.id === u.id);
    const card = document.createElement('article'); card.className = 'v5-item';
    const title = document.createElement('h3'); title.textContent = `${u.name} · ${u.type}`;
    const statusLabel = document.createElement('label'); statusLabel.textContent = 'Unit status: ';
    const status = document.createElement('select');
    for (const s of ['available','booked','maintenance']) {
      const o = document.createElement('option'); o.value = s; o.textContent = s[0].toUpperCase()+s.slice(1); status.append(o);
    }
    status.value = saved?.status || 'available';
    const noteLabel = document.createElement('label'); noteLabel.textContent = 'Internal notes (no plate numbers): ';
    const note = document.createElement('textarea'); note.rows = 2; note.maxLength = 500;
    note.value = saved?.notes || '';
    const save = document.createElement('button'); save.type = 'button'; save.textContent = saved ? 'Save unit' : 'Create unit';
    save.addEventListener('click', async () => {
      if (!authorized) return;
      save.disabled = true; msg(`Saving ${u.name}…`);
      try {
        const payload = { name:u.name, vehicleType:u.type, status:status.value, notes:note.value.trim(), updatedAt:serverTimestamp() };
        if (saved) await updateDoc(doc(db,'fleetUnits',u.id),payload);
        else await setDoc(doc(db,'fleetUnits',u.id),{...payload,createdAt:serverTimestamp()});
        msg(`${u.name} saved successfully.`);
      } catch(e) { msg(`Save failed: ${e.message}`); }
      finally { save.disabled = false; }
    });
    statusLabel.append(status); noteLabel.append(note);
    card.append(title,statusLabel,document.createElement('br'),noteLabel,document.createElement('br'),save);
    root.append(card);
  }
  $('v7Count').textContent = `${current.length} of 6 unit records created`;
}
onAuthStateChanged(auth, user => {
  if (stop) { stop(); stop = null; }
  authorized = !!user && ADMINS.has(user.uid);
  current = []; render();
  if (!authorized) { msg('Sign in as an authorized admin to manage units.'); return; }
  msg('Live fleet unit sync connected.');
  stop = onSnapshot(collection(db,'fleetUnits'), snapshot => {
    current = snapshot.docs.map(d => ({id:d.id,...d.data()})); render();
  }, error => msg('Fleet sync error: '+error.message));
});
