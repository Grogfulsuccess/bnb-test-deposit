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
  // Evénements UI
  connectBtn.addEventListener('click', connectInjected);
  wcBtn.addEventListener('click', connectWalletConnect);
  depositBtn.addEventListener('click', doDeposit);
  withdrawBtn.addEventListener('click', requestWithdraw);

  // Si injected provider présent (MetaMask, Trust...)
  if (window.ethereum) {
    // Optional: auto show available
    // Listen for changes if user connects injected later
    window.ethereum.on && window.ethereum.on('accountsChanged', handleAccountsChanged);
    window.ethereum.on && window.ethereum.on('chainChanged', handleChainChanged);
  }
}

// ---------- Connection Injected (MetaMask, Trust Wallet in-app browser) ----------
async function connectInjected(){
  try {
    if (!window.ethereum) {
      alert("Aucun provider injecté détecté. Utilise MetaMask mobile/extension ou essaye WalletConnect (bouton WalletConnect).");
      return;
    }
    currentProviderType = 'injected';
    // Request accounts
    await window.ethereum.request({ method: 'eth_requestAccounts' });
    // Create ethers provider/wrapper
    ethersProvider = new ethers.BrowserProvider(window.ethereum);
    signer = await ethersProvider.getSigner();
    userAddress = await signer.getAddress();
    accountDiv.innerText = `Connecté : ${shortAddr(userAddress)}`;
    const network = await ethersProvider.getNetwork();
    networkDiv.innerText = `Réseau : ${network.name} (chainId ${network.chainId})`;
    if (network.chainId !== TARGET_CHAIN_ID) {
      networkDiv.innerText += ` — Veuillez switcher sur ${CHAIN_NAME} (chainId ${TARGET_CHAIN_ID})`;
    }
  } catch (e) {
    console.error(e);
    accountDiv.innerText = "Connexion refusée ou erreur (injected).";
  }
}

// ---------- Connection WalletConnect (SafePal, Trust Wallet via WalletConnect) ----------
async function connectWalletConnect(){
  try {
    // Si déjà connecté via WalletConnect, reuse
    if (wcProviderInstance && wcProviderInstance.wc && wcProviderInstance.wc.connected) {
      // create ethers provider wrapper around the provider
      ethersProvider = new ethers.BrowserProvider(wcProviderInstance);
      signer = await ethersProvider.getSigner();
      userAddress = await signer.getAddress();
      currentProviderType = 'walletconnect';
      accountDiv.innerText = `Connecté (WC) : ${shortAddr(userAddress)}`;
      const net = await ethersProvider.getNetwork();
      networkDiv.innerText = `Réseau : ${net.name} (chainId ${net.chainId})`;
      if (net.chainId !== TARGET_CHAIN_ID) networkDiv.innerText += ` — Veuillez switcher sur ${CHAIN_NAME}`;
      return;
    }

    // Initialise WalletConnectProvider via l'UMD export
    const WalletConnectProvider = window.WalletConnectProvider && window.WalletConnectProvider.default
      ? window.WalletConnectProvider.default
      : window.WalletConnectProvider; // fallback

    if (!WalletConnectProvider) {
      alert("WalletConnect Provider non trouvé. Vérifie la balise <script> CDN.");
      return;
    }

    // create provider instance
    wcProviderInstance = new WalletConnectProvider({
      rpc: {
        97: RPC_URL,
        56: "https://bsc-dataseed.binance.org/" // optional mainnet fallback
      },
      chainId: TARGET_CHAIN_ID,
      qrcodeModalOptions: {
        mobileLinks: ["metamask", "trust", "safe", "rainbow", "argent"] // aide
      }
    });

    // enable triggers QR / deep link
    await wcProviderInstance.enable();

    // wrap with ethers
    ethersProvider = new ethers.BrowserProvider(wcProviderInstance);
    signer = await ethersProvider.getSigner();
    userAddress = await signer.getAddress();
    currentProviderType = 'walletconnect';
    accountDiv.innerText = `Connecté (WC) : ${shortAddr(userAddress)}`;

    // network info
    const net = await ethersProvider.getNetwork();
    networkDiv.innerText = `Réseau : ${net.name} (chainId ${net.chainId})`;
    if (net.chainId !== TARGET_CHAIN_ID) networkDiv.innerText += ` — Veuillez switcher votre wallet sur ${CHAIN_NAME}`;

    // Optionnel : handle disconnect
    wcProviderInstance.on && wcProviderInstance.on("disconnect", (code, reason) => {
      console.log("WC disconnect", code, reason);
      resetConnection();
    });

  } catch (e) {
    console.error("WC connect error", e);
    alert("Connexion WalletConnect annulée ou erreur.");
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
  // reload to refresh provider state (simple)
  window.location.reload();
}
function resetConnection(){
  ethersProvider = null;
  signer = null;
  userAddress = null;
  currentProviderType = null;
  accountDiv.innerText = "Non connecté";
  networkDiv.innerText = "Réseau : inconnu";
  // if walletconnect instance exists, try to close session
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
