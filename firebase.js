// Z & Z Transport Services
// Shared Firebase connection for customer and admin pages.

import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js';

import { getAuth } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js';

import { getFirestore } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';

const firebaseConfig = {
  apiKey: 'AIzaSyCRV7WVDn2hBT7p3pK4xlkV17SFeM0ErRU',
  authDomain: 'zandztransport.firebaseapp.com',
  projectId: 'zandztransport',
  storageBucket: 'zandztransport.firebasestorage.app',
  messagingSenderId: '645011956358',
  appId: '1:645011956358:web:6ae9c285f4167586b22707'
};

export const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);

export const db = getFirestore(app);
