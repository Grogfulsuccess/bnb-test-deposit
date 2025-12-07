// functions/index.js
const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { ethers } = require('ethers');
const fetch = require('node-fetch');

admin.initializeApp();
const db = admin.firestore();

// Utilise les variables d'environnement pour la clé privée et l'adresse
// Définis-les avec: firebase functions:config:set admin.private_key="..." admin.address="0x..." bsc.rpc="https://bsc-dataseed.binance.org/"
const PRIVATE_KEY = functions.config().admin.private_key;
const ADMIN_ADDR = functions.config().admin.address;
const BSC_RPC = functions.config().bsc.rpc || 'https://bsc-dataseed.binance.org/';

if(!PRIVATE_KEY || !ADMIN_ADDR){
  console.warn('CONFIG MISSING: set admin.private_key and admin.address with firebase functions:config:set');
}

// Provider & Wallet
const provider = new ethers.providers.JsonRpcProvider(BSC_RPC);
const wallet = PRIVATE_KEY ? new ethers.Wallet(PRIVATE_KEY, provider) : null;

// Callable: verifyDeposit({uid, txHash, amount})
exports.verifyDeposit = functions.https.onCall(async (data, context) => {
  const { uid, txHash, amount } = data;
  if(!uid || !txHash) throw new functions.https.HttpsError('invalid-argument','uid et txHash requis');

  // call BSC RPC to get tx
  let tx;
  try {
    tx = await provider.getTransaction(txHash);
    if(!tx) {
      // sometimes RPC node needs the receipt
      const receipt = await provider.getTransactionReceipt(txHash);
      if(!receipt) throw new Error('Transaction non trouvée');
      // if receipt present, fetch tx via block/txIndex
      // but provider.getTransaction should normally work
    }
  } catch(e){ throw new functions.https.HttpsError('not-found','Transaction introuvable: '+e.message); }

  // Vérifie 'to' (peut être token transfer via contract — ici on supporte simple native BNB)
  if(tx.to && tx.to.toLowerCase() !== ADMIN_ADDR.toLowerCase()){
    throw new functions.https.HttpsError('failed-precondition','La transaction n\'est pas destinée à l\'adresse du service');
  }

  // Montant en wei -> BNB
  const valueBNB = parseFloat(ethers.utils.formatEther(tx.value));
  // Optionnel: si user a fourni 'amount' vérifier correspondance
  if(amount && Math.abs(valueBNB - parseFloat(amount)) > 0.000001){
    // tolérance minime
    throw new functions.https.HttpsError('failed-precondition','Le montant envoyé diffère de la valeur fournie');
  }

  // Eviter double-usage: vérifier si txHash existe déjà dans transactions
  const txQuery = await db.collection('transactions').where('txHash','==',txHash).get();
  if(!txQuery.empty) throw new functions.https.HttpsError('already-exists','Transaction déjà traitée');

  // Enregistrer transaction et créditer le solde
  const tRef = db.collection('transactions').doc();
  await tRef.set({
    uid,
    type: 'deposit',
    txHash,
    amount: valueBNB,
    timestamp: admin.firestore.FieldValue.serverTimestamp()
  });

  // Mettre à jour le balance (transaction-safe via transaction)
  const userRef = db.collection('users').doc(uid);
  await db.runTransaction(async (t) => {
    const snap = await t.get(userRef);
    let balance = 0;
    if(snap.exists && snap.data().balance) balance = snap.data().balance;
    balance = parseFloat(balance) + parseFloat(valueBNB);
    t.set(userRef, { balance }, { merge: true });
  });

  return { success: true, credited: valueBNB };
});

// Callable: requestWithdraw({uid, to, amount})
exports.requestWithdraw = functions.https.onCall(async (data, context) => {
  const { uid, to, amount } = data;
  if(!uid || !to || !amount) throw new functions.https.HttpsError('invalid-argument','uid,to,amount requis');
  if(!wallet) throw new functions.https.HttpsError('failed-precondition','Wallet non configuré côté fonctions');

  // Vérifier solde
  const userRef = db.collection('users').doc(uid);
  const snap = await userRef.get();
  const balance = snap.exists && snap.data().balance ? parseFloat(snap.data().balance) : 0;
  if(amount > balance) throw new functions.https.HttpsError('failed-precondition','Solde insuffisant');

  // Déduire solde (transaction Firestore)
  await db.runTransaction(async (t) => {
    const s = await t.get(userRef);
    let cur = s.exists && s.data().balance ? parseFloat(s.data().balance) : 0;
    if(amount > cur) throw new functions.https.HttpsError('failed-precondition','Solde insuffisant (concurence)');
    cur -= amount;
    t.set(userRef, { balance: cur }, { merge: true });
  });

  // Préparer et envoyer la tx (valeur en wei)
  const value = ethers.utils.parseEther(String(amount));
  const txResponse = await wallet.sendTransaction({ to, value });
  // Attendre la confirmation (optionnel)
  const receipt = await txResponse.wait(1);

  // Enregistrer transaction de sortie
  await db.collection('transactions').add({
    uid,
    type: 'withdraw',
    txHash: txResponse.hash,
    amount,
    to,
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
    status: receipt.status === 1 ? 'confirmed' : 'failed'
  });

  return { success: true, txHash: txResponse.hash };
});
