// ====== CONFIG - MODIFIE AVANT TEST si besoin ======
// Chaîne & RPC (info provenant de ta capture d'écran)
const CHAIN_NAME = "BNB Smart Chain Testnet";
const TARGET_CHAIN_ID = 97; // BSC Testnet
const RPC_URL = "https://data-seed-prebsc-1-s1.binance.org:8545/"; // attention parfois différents endpoints / ports
const EXPLORER = "https://testnet.bscscan.com";
const CURRENCY_SYMBOL = "tBNB"; // selon MetaMask screenshot

// Adresse qui reçoit les dépôts (ton service / hot wallet).
// Remplace par ton adresse si tu veux une autre.
// NOTE : Je mets ici l'adresse mentionnée précédemment dans ton projet si c'est OK pour toi.
// Si tu veux autre adresse, remplace la valeur ci-dessous.
const RECEIVER_ADDRESS = "0x84B1CeB4642F0a837526d85caCbcBE5F9B8764c0"; // <-- Remplace si nécessaire

// Décimales de BNB (native) = 18
const BNB_DECIMALS = 18;

// ====== UI SELECTORS ======
const connectBtn = document.getElementById('connectBtn');
const accountDiv = document.getElementById('account');
const networkDiv = document.getElementById('network');
const depositBtn = document.getElementById('depositBtn');
const depositAmountInput = document.getElementById('depositAmount');
const depositStatus = document.getElementById('depositStatus');
const withdrawBtn = document.getElementById('withdrawBtn');
const withdrawAmountInput = document.getElementById('withdrawAmount');
const withdrawAddressInput = document.getElementById('withdrawAddress');
const withdrawStatus = document.getElementById('withdrawStatus');

let provider, signer, userAddress;

async function init() {
  if (window.ethereum) {
    provider = new ethers.BrowserProvider(window.ethereum);
    connectBtn.addEventListener('click', connectWallet);
    depositBtn.addEventListener('click', doDeposit);
    withdrawBtn.addEventListener('click', requestWithdraw);
    window.ethereum.on('accountsChanged', handleAccountsChanged);
    window.ethereum.on('chainChanged', handleChainChanged);
  } else {
    accountDiv.innerText = "MetaMask non détecté — installe MetaMask ou Wallet compatible";
  }
}

async function connectWallet(){
  try {
    await provider.send("eth_requestAccounts", []);
    signer = await provider.getSigner();
    userAddress = await signer.getAddress();
    accountDiv.innerText = `Connecté : ${userAddress}`;
    const network = await provider.getNetwork();
    networkDiv.innerText = `Réseau : ${network.name} (chainId ${network.chainId})`;
    if (network.chainId !== TARGET_CHAIN_ID) {
      networkDiv.innerText += ` — Veuillez switcher sur ${CHAIN_NAME} (chainId ${TARGET_CHAIN_ID})`;
    }
  } catch (e) {
    console.error(e);
    accountDiv.innerText = "Connexion refusée ou erreur";
  }
}

async function handleAccountsChanged(accounts){
  if (accounts.length === 0) {
    accountDiv.innerText = "Disconnected";
  } else {
    userAddress = accounts[0];
    accountDiv.innerText = `Connecté : ${userAddress}`;
  }
}
function handleChainChanged(_chainId) {
  // Recharger la page pour mettre à jour provider/signers
  window.location.reload();
}

// Dépôt : crée une transaction native BNB vers RECEIVER_ADDRESS
async function doDeposit(){
  depositStatus.innerText = "";
  if (!signer) return depositStatus.innerText = "Connecte ton wallet d'abord.";
  if (!RECEIVER_ADDRESS || !RECEIVER_ADDRESS.startsWith('0x')) return depositStatus.innerText = "Configure RECEIVER_ADDRESS dans script.js";
  const amt = depositAmountInput.value;
  if (!amt || Number(amt) <= 0) return depositStatus.innerText = "Montant invalide";
  try {
    depositStatus.innerText = "Ouverture de MetaMask pour signer la transaction native BNB...";
    // parse amount to wei (BNB uses 18 decimals)
    const value = ethers.parseUnits(amt.toString(), BNB_DECIMALS);
    const tx = await signer.sendTransaction({
      to: RECEIVER_ADDRESS,
      value: value
    });
    depositStatus.innerText = `Tx envoyée : ${tx.hash}\nEn attente de confirmation...`;
    await tx.wait();
    depositStatus.innerText = `Dépôt BNB confirmé ✅ Tx: ${tx.hash}`;
  } catch (e) {
    console.error(e);
    depositStatus.innerText = `Erreur : ${e.message || e}`;
  }
}

// Retrait : on crée une "demande" signée par l'utilisateur
// Le service centralisé récupère cette demande, la vérifie et paie depuis son coffre.
async function requestWithdraw(){
  withdrawStatus.innerText = "";
  if (!signer) return withdrawStatus.innerText = "Connecte ton wallet d'abord.";
  const amt = withdrawAmountInput.value;
  const to = withdrawAddressInput.value;
  if (!amt || Number(amt) <= 0) return withdrawStatus.innerText = "Montant invalide";
  if (!to || !to.startsWith('0x')) return withdrawStatus.innerText = "Adresse destinataire invalide";
  try {
    const timestamp = Math.floor(Date.now() / 1000);
    const payload = {
      requester: userAddress,
      to: to,
      amount: amt,
      currency: "BNB",
      chainId: TARGET_CHAIN_ID,
      ts: timestamp,
      nonce: Math.floor(Math.random()*1e9)
    };
    const message = JSON.stringify(payload);
    withdrawStatus.innerText = "Ouverture MetaMask pour signer la demande de retrait...";
    // signer la demande (personal_sign)
    const sig = await signer.signMessage(message);
    // Le JSON résultant à envoyer au backend :
    const requestObject = { payload, signature: sig };
    // Pour test : on affiche le JSON dans une nouvelle fenêtre
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(requestObject, null, 2));
    window.open(dataStr, "_blank");
    withdrawStatus.innerText = "Demande signée — JSON ouvert dans un nouvel onglet. (Envoyer ce JSON à ton backend pour traitement)";
  } catch (e) {
    console.error(e);
    withdrawStatus.innerText = `Erreur: ${e.message || e}`;
  }
}

init();
