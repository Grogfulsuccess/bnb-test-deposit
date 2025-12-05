// ====== CONFIG - MODIFIE AVANT TEST si besoin ======
const CHAIN_NAME = "BNB Smart Chain Testnet";
const TARGET_CHAIN_ID = 97; // BSC Testnet
const RPC_URL = "https://data-seed-prebsc-1-s1.binance.org:8545/";
const EXPLORER = "https://testnet.bscscan.com";
const CURRENCY_SYMBOL = "tBNB";

// Adresse réception des dépôts (remplace si besoin)
const RECEIVER_ADDRESS = "0x1be22251704335F0Be0776a490F479ADBBda6f72";
const BNB_DECIMALS = 18;

// UI
const connectBtn = document.getElementById('connectBtn');
const wcBtn = document.getElementById('walletconnectBtn');
const accountDiv = document.getElementById('account');
const networkDiv = document.getElementById('network');
const wcDebug = document.getElementById('wcDebug');
const depositBtn = document.getElementById('depositBtn');
const depositAmountInput = document.getElementById('depositAmount');
const depositStatus = document.getElementById('depositStatus');
const withdrawBtn = document.getElementById('withdrawBtn');
const withdrawAmountInput = document.getElementById('withdrawAmount');
const withdrawAddressInput = document.getElementById('withdrawAddress');
const withdrawStatus = document.getElementById('withdrawStatus');

let ethersProvider = null; // ethers BrowserProvider
let signer = null;
let userAddress = null;
let currentProviderType = null; // "injected" or "walletconnect"
let wcProviderInstance = null; // WalletConnect provider instance (if utilisé)

// Helper : format short address
function shortAddr(a) {
  if (!a) return '';
  return a.slice(0,6) + '...' + a.slice(-4);
}

async function init() {
  connectBtn.addEventListener('click', connectInjected);
  wcBtn.addEventListener('click', connectWalletConnect);
  depositBtn.addEventListener('click', doDeposit);
  withdrawBtn.addEventListener('click', requestWithdraw);

  if (window.ethereum) {
    window.ethereum.on && window.ethereum.on('accountsChanged', handleAccountsChanged);
    window.ethereum.on && window.ethereum.on('chainChanged', handleChainChanged);
  }
  wcDebug.innerText = "Ready.";
}

// ---------- Connection Injected (MetaMask, Trust Wallet in-app browser) ----------
async function connectInjected(){
  try {
    if (!window.ethereum) {
      alert("Aucun provider injecté détecté. Utilise MetaMask mobile/extension ou essaye WalletConnect (bouton WalletConnect).");
      return;
    }
    currentProviderType = 'injected';
    await window.ethereum.request({ method: 'eth_requestAccounts' });
    ethersProvider = new ethers.BrowserProvider(window.ethereum);
    signer = await ethersProvider.getSigner();
    userAddress = await signer.getAddress();
    accountDiv.innerText = `Connecté : ${shortAddr(userAddress)}`;
    const network = await ethersProvider.getNetwork();
    networkDiv.innerText = `Réseau : ${network.name} (chainId ${network.chainId})`;
    if (network.chainId !== TARGET_CHAIN_ID) {
      networkDiv.innerText += ` — Veuillez switcher sur ${CHAIN_NAME} (chainId ${TARGET_CHAIN_ID})`;
    }
    wcDebug.innerText = "Connected (injected).";
  } catch (e) {
    console.error(e);
    accountDiv.innerText = "Connexion refusée ou erreur (injected).";
    wcDebug.innerText = "Injected connect error: " + (e.message || e);
  }
}

// ---------- Connection WalletConnect (SafePal, Trust Wallet via WalletConnect) ----------
async function connectWalletConnect(){
  try {
    wcDebug.innerText = "WC: starting connection...";
    console.log("WC: starting connection...");

    // ensure WalletConnectProvider available
    const WalletConnectProvider = window.WalletConnectProvider && window.WalletConnectProvider.default
      ? window.WalletConnectProvider.default
      : window.WalletConnectProvider;
    if (!WalletConnectProvider) {
      alert("WalletConnect Provider non trouvé — vérifie le script CDN.");
      wcDebug.innerText = "WC provider not found.";
      return;
    }

    // create instance (qrcode false, we handle modal manually)
    wcProviderInstance = new WalletConnectProvider({
      rpc: { 97: RPC_URL, 56: "https://bsc-dataseed.binance.org/" },
      chainId: TARGET_CHAIN_ID,
      qrcode: false
    });

    // Enable with timeout (8s)
    const enablePromise = wcProviderInstance.enable();
    const timeoutMs = 8000;
    const timeoutPromise = new Promise((_, rej) => setTimeout(() => rej(new Error("WC enable timeout")), timeoutMs));

    await Promise.race([enablePromise, timeoutPromise]).catch(async (err) => {
      console.warn("WC enable race result:", err);
      wcDebug.innerText = "WC enable timeout/fallback...";
      // Fallback: show QR modal (desktop) or instruct user (mobile)
      const uri = wcProviderInstance.connector && wcProviderInstance.connector.uri;
      console.log("WC uri:", uri);
      if (uri && window.WalletConnectQRCodeModal) {
        wcDebug.innerText = "WC fallback: showing QR modal (desktop).";
        window.WalletConnectQRCodeModal.open(uri, () => {
          console.log("QR modal closed");
          wcDebug.innerText = "QR modal closed";
        });
        // Wait for user to connect via QR (or deep link)
        await wcProviderInstance.enable();
        // close modal if open
        window.WalletConnectQRCodeModal.close();
      } else {
        // No uri -> probably mobile deep link issue. Show instructions.
        alert("La liaison WalletConnect prend trop de temps.\nSi tu es sur mobile :\n• Ouvre SafePal → Menu → WalletConnect → Scanner/Deep link\n• Ou ouvre la page dans le navigateur du wallet (MetaMask Browser) et réessaye.\nSi tu es sur desktop : recharge et réessaie pour voir le QR.");
        throw err;
      }
    });

    // If we arrive here, enable succeeded
    ethersProvider = new ethers.BrowserProvider(wcProviderInstance);
    signer = await ethersProvider.getSigner();
    userAddress = await signer.getAddress();
    currentProviderType = 'walletconnect';
    accountDiv.innerText = `Connecté (WC) : ${shortAddr(userAddress)}`;
    const net = await ethersProvider.getNetwork();
    networkDiv.innerText = `Réseau : ${net.name} (chainId ${net.chainId})`;
    if (net.chainId !== TARGET_CHAIN_ID) networkDiv.innerText += ` — Veuillez switcher votre wallet sur ${CHAIN_NAME}`;
    wcDebug.innerText = "Connected via WalletConnect.";
    console.log("WC connected:", userAddress);

    // handle disconnect
    wcProviderInstance.on && wcProviderInstance.on("disconnect", (code, reason) => {
      console.log("WC disconnect", code, reason);
      resetConnection();
    });

  } catch (e) {
    console.error("WC connect error final:", e);
    alert("Erreur de connexion WalletConnect. Voir console pour détails.");
    wcDebug.innerText = "WC error: " + (e.message || e);
  }
}

// ---------- Helpers pour changements ----------
async function handleAccountsChanged(accounts){
  if (!accounts || accounts.length === 0) {
    resetConnection();
  } else {
    userAddress = accounts[0];
    accountDiv.innerText = `Connecté : ${shortAddr(userAddress)}`;
  }
}
function handleChainChanged(_chainId) {
  // simple: reload
  window.location.reload();
}
function resetConnection(){
  ethersProvider = null;
  signer = null;
  userAddress = null;
  currentProviderType = null;
  accountDiv.innerText = "Non connecté";
  networkDiv.innerText = "Réseau : inconnu";
  wcDebug.innerText = "Reset connection.";
  if (wcProviderInstance && wcProviderInstance.disconnect) {
    try { wcProviderInstance.disconnect(); } catch(e){/*ignore*/ }
    wcProviderInstance = null;
  }
}

// ---------- Dépôt BNB (transaction native) ----------
async function doDeposit(){
  depositStatus.innerText = "";
  if (!signer) return depositStatus.innerText = "Connecte ton wallet d'abord (Injected ou WalletConnect).";
  if (!RECEIVER_ADDRESS || !RECEIVER_ADDRESS.startsWith('0x')) return depositStatus.innerText = "Configure RECEIVER_ADDRESS dans script.js";
  const amt = depositAmountInput.value;
  if (!amt || Number(amt) <= 0) return depositStatus.innerText = "Montant invalide";
  try {
    depositStatus.innerText = "Ouverture du wallet pour signer la transaction...";
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

// ---------- Demande de retrait (signature) ----------
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
    withdrawStatus.innerText = "Ouverture du wallet pour signer la demande de retrait...";
    const sig = await signer.signMessage(message);
    const requestObject = { payload, signature: sig };
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(requestObject, null, 2));
    window.open(dataStr, "_blank");
    withdrawStatus.innerText = "Demande signée — JSON ouvert dans un nouvel onglet. Envoie ce JSON au backend.";
  } catch (e) {
    console.error(e);
    withdrawStatus.innerText = `Erreur: ${e.message || e}`;
  }
}

// init
init();
