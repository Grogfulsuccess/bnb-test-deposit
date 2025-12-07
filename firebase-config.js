// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBI0hCMMGYAg9_E7aEopux_w_YLyGSA6uU",
  authDomain: "bnb-invest-cdadd.firebaseapp.com",
  projectId: "bnb-invest-cdadd",
  storageBucket: "bnb-invest-cdadd.firebasestorage.app",
  messagingSenderId: "370802266124",
  appId: "1:370802266124:web:d611d0dedd1a90caed5e29",
  measurementId: "G-8X1XR856DM"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
