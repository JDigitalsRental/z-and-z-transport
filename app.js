import {
  db
}
from './firebase.js';
import {
  collection, addDoc, serverTimestamp
}
from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';
'use strict';
// DEMO ONLY: edit these examples here until Firebase admin management is configured.
const VEHICLES=[
{
  id:'sedan',name:'Sedan / Car',emoji:'🚘',image:'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?auto=format&fit=crop&w=900&q=85',seats:4,self:1800,driver:2800,status:'available'
},
{
  id:'suv',name:'SUV',emoji:'🚙',image:'https://images.unsplash.com/photo-1519641471654-76ce0107ad1b?auto=format&fit=crop&w=900&q=85',seats:7,self:3000,driver:4200,status:'available'
},
{
  id:'van',name:'Van / MPV',emoji:'🚐',image:'https://images.unsplash.com/photo-1566933293069-b55c7f326dd4?auto=format&fit=crop&w=900&q=85',seats:10,self:4000,driver:5500,status:'available'
}
];
const $=id=>document.getElementById(id);
const peso=n=>'₱'+Number(n).toLocaleString('en-PH');
function renderFleet(){
  const q=$('vehicleSearch').value.trim().toLowerCase(),filter=$('vehicleFilter').value;
  const list=VEHICLES.filter(v=>v.name.toLowerCase().includes(q)&&(filter==='all'||v.status===filter));
  const grid=$('fleetGrid');
  grid.replaceChildren();
  if(!list.length){
    const p=document.createElement('p');
    p.className='empty';
    p.textContent='No matching vehicles found.';
    grid.append(p);
    return;
  }
  for(const v of list){
    const card=document.createElement('article');
    card.className='card vehicle';
    const visual=document.createElement('div');
    visual.className='vehicle-visual';
    // Sample photo only. Replace with a verified photo of the actual rental vehicle later.
    const photo=document.createElement('img');
    photo.src=v.image;
    photo.alt='Illustrative vehicle photo for '+v.name+' (not actual inventory)';
    photo.loading='lazy';
    photo.decoding='async';
    photo.onerror=()=>{
      photo.remove();
      visual.textContent=v.emoji;
      visual.style.fontSize='75px';
      visual.style.display='grid';
      visual.style.placeItems='center';
    };
    visual.append(photo);
    const body=document.createElement('div');
    body.className='vehicle-body';
    const tag=document.createElement('span');
    tag.className='tag';
    tag.textContent='SAMPLE CATEGORY';
    const status=document.createElement('span');
    status.className='status '+v.status;
    status.textContent=v.status==='available'?'● AVAILABLE (DEMO)':v.status==='booked'?'● CURRENTLY BOOKED (DEMO)':'● MAINTENANCE (DEMO)';
    const title=document.createElement('h3');
    title.textContent=v.name;
    const seats=document.createElement('p');
    seats.textContent='Illustrative capacity: up to '+v.seats+' passengers';
    const price=document.createElement('div');
    price.className='price';
    price.textContent='From '+peso(v.self)+'/day';
    const sub=document.createElement('div');
    sub.className='subprice';
    sub.textContent='Self-drive '+peso(v.self)+' / With driver '+peso(v.driver)+' per day • DEMO ONLY';
    const btn=document.createElement('button');
    btn.className='btn primary';
    btn.textContent='INQUIRE ABOUT THIS VEHICLE ↗';
    btn.onclick=()=>{
      $('vehicle').value=v.id;
      location.hash='booking';
    };
    body.append(tag,status,title,seats,price,sub,btn);
    card.append(visual,body);
    grid.append(card);
  }
}
function populateVehicles(){
  const sel=$('vehicle');
  for(const v of VEHICLES){
    const opt=document.createElement('option');
    opt.value=v.id;
    opt.textContent=v.name;
    sel.append(opt);
  }
}
$('vehicleSearch').addEventListener('input',renderFleet);
$('vehicleFilter').addEventListener('change',renderFleet);
populateVehicles();
renderFleet();
$('year').textContent=new Date().getFullYear();
const today=new Date();
const localToday=new Date(today.getTime()-today.getTimezoneOffset()*60000).toISOString().slice(0,10);
$('pickupDate').min=localToday;
$('returnDate').min=localToday;
for(const id of ['pickupDate','returnDate']){
  const el=$(id);
  el.addEventListener('click',()=>{
    if(typeof el.showPicker==='function'){
      try{
        el.showPicker();
      }
      catch(err){
      }
    }
  });
}
$('pickupDate').addEventListener('change',()=>{
  $('returnDate').min=$('pickupDate').value||localToday;
  if($('returnDate').value&&$('returnDate').value<$('pickupDate').value)$('returnDate').value=$('pickupDate').value;
});
let message='';
$('bookingForm').addEventListener('submit',e=>{
  e.preventDefault();
  const pickup=$('pickupDate').value,ret=$('returnDate').value;
  if(ret<pickup){
    alert('Return date cannot be earlier than pickup date.');
    return;
  }
  const v=VEHICLES.find(x=>x.id===$('vehicle').value);
  if(!v)return;
  message=`Hi Z & Z Transport Services! 🚗\n\nI would like to request a rental quotation.\n\nFull Name: ${$('fullName').value.trim()}\nContact Number: ${$('phone').value.trim()}\nVehicle Category: ${v.name}\nService Type: ${$('service').value}\nPickup Date: ${pickup}\nReturn Date: ${ret}\nPickup Location: ${$('pickupLocation').value.trim()}\nDestination / Route: ${$('destination').value.trim()||'Not specified'}\nPassengers: ${$('passengers').value||'Not specified'}\nAdditional Notes: ${$('notes').value.trim()||'None'}\n\nPlease confirm vehicle availability, final pricing, and rental requirements. Thank you!`;
  $('bookingMessage').textContent=message;
  $('bookingSummary').classList.add('show');
  $('copyStatus').textContent='Copy the message, then paste and send it through Messenger.';
  $('bookingSummary').scrollIntoView({
    behavior:'smooth',block:'nearest'
  });
  window.dispatchEvent(new CustomEvent('zz-inquiry-ready',{
    detail:{
      fullName:$('fullName').value.trim(),phone:$('phone').value.trim(),vehicleId:v.id,vehicleName:v.name,service:$('service').value,pickupDate:pickup,returnDate:ret,pickupLocation:$('pickupLocation').value.trim(),destination:$('destination').value.trim(),passengers:Number($('passengers').value)||null,notes:$('notes').value.trim()
    }
  }));
});
$('bookingForm').addEventListener('reset',()=>{
  message='';
  $('bookingSummary').classList.remove('show');
  $('firebaseStatus').textContent='';
  setTimeout(()=>{
    $('returnDate').min=$('pickupDate').value||localToday;
  },0);
});
$('copyMessage').addEventListener('click',async()=>{
  if(!message)return;
  try{
    await navigator.clipboard.writeText(message);
    $('copyStatus').textContent='Copied! Open Facebook and paste the message into Messenger.';
  }
  catch(e){
    $('copyStatus').textContent='Automatic copy unavailable. Please select and copy the message above manually.';
  }
});
let saving = false;
window.addEventListener('zz-inquiry-ready', async ({
  detail
}) => {
  const status = document.getElementById('firebaseStatus');
  if(saving) {
    status.textContent = 'An inquiry is already being saved. Please wait.';
    return;
  }
  saving = true;
  status.textContent = 'Saving your inquiry securely…';
  try {
    await addDoc(collection(db,'bookingInquiries'), {
      ...detail, status:'pending', createdAt:serverTimestamp()
    });
    status.textContent = '✓ Inquiry saved successfully! You may also send the message through Messenger. This is not yet a confirmed booking.';
  }
  catch(err) {
    console.error('Inquiry save failed:',err);
    status.textContent = '⚠ Could not save the inquiry online. Please copy the message and send it through Facebook Messenger instead.';
  }
  finally {
    saving = false;
  }
});
