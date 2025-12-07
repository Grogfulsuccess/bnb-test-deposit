// main.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-functions.js";

// ----- PLACE TA firebaseConfig ICI (ou importe depuis firebase-config.js) -----
const firebaseConfig = {
  apiKey: "AIzaSyBI0hCMMGYAg9_E7aEopux_w_YLyGSA6uU",
  authDomain: "bnb-invest-cdadd.firebaseapp.com",
  projectId: "bnb-invest-cdadd",
  storageBucket: "bnb-invest-cdadd.firebasestorage.app",
  messagingSenderId: "370802266124",
  appId: "1:370802266124:web:d611d0dedd1a90caed5e29",
  measurementId: "G-8X1XR856DM"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const functions = getFunctions(app);

// UI refs
const authDiv = document.getElementById('auth');
const appDiv = document.getElementById('app');
const balanceSpan = document.getElementById('balance');
const msg = (t)=> { const d=document.getElementById('messages'); d.innerText = t; console.log(t); };

// Auth handlers
document.getElementById('signup').onclick = async () => {
  const e = document.getElementById('email').value;
  const p = document.getElementById('password').value;
  try { await createUserWithEmailAndPassword(auth, e, p); msg('Inscription réussie'); }
  catch(err){ msg(err.message); }
};
document.getElementById('login').onclick = async () => {
  const e = document.getElementById('email').value;
  const p = document.getElementById('password').value;
  try { await signInWithEmailAndPassword(auth, e, p); msg('Connecté'); }
  catch(err){ msg(err.message); }
};
document.getElementById('logout').onclick = ()=> signOut(auth);

// Observe auth
onAuthStateChanged(auth, async user => {
  if(user){
    authDiv.style.display='none'; appDiv.style.display='block';
    document.getElementById('depositAddr').innerText = '0x84B1CeB4642F0a837526d85caCbcBE5F9B8764c0';
    loadBalance(user.uid);
  } else {
    authDiv.style.display='block'; appDiv.style.display='none';
  }
});

async function loadBalance(uid){
  const d = await getDoc(doc(db,'users',uid));
  const b = d.exists() && d.data().balance ? d.data().balance : 0;
  balanceSpan.innerText = b;
}

// Callable functions
const verifyDeposit = httpsCallable(functions, 'verifyDeposit'); // cloud func
const requestWithdraw = httpsCallable(functions, 'requestWithdraw'); // cloud func

document.getElementById('reportDeposit').onclick = async ()=>{
  const txHash = document.getElementById('txHash').value.trim();
  const amount = document.getElementById('depositAmount').value.trim();
  const user = auth.currentUser;
  if(!user) return msg('Connecte-toi d\'abord');
  if(!txHash) return msg('Met le txHash');
  try {
    const res = await verifyDeposit({ uid: user.uid, txHash, amount: amount || null });
    msg(JSON.stringify(res.data));
    await loadBalance(user.uid);
  } catch(e){ msg('Erreur: '+(e.message||e)); }
};

document.getElementById('requestWithdraw').onclick = async ()=>{
  const dest = document.getElementById('destAddress').value.trim();
  const amount = parseFloat(document.getElementById('withdrawAmount').value);
  const user = auth.currentUser;
  if(!user) return msg('Connecte-toi d\'abord');
  if(!dest || !amount) return msg('Adresse et montant requis');
  try {
    const res = await requestWithdraw({ uid: user.uid, to: dest, amount });
    msg(JSON.stringify(res.data));
    await loadBalance(user.uid);
  } catch(e){ msg('Erreur: '+(e.message||e)); }
};
