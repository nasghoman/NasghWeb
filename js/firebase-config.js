// js/firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

const firebaseConfig = {
apiKey: "AIzaSyCPCDnSjazRrxAZ1uVuwlvK5lBUYfmx4Io",
  authDomain: "nasgh1.firebaseapp.com",
  projectId: "nasgh1",
  storageBucket: "nasgh1.firebasestorage.app",
  messagingSenderId: "37730120812",
  appId: "1:37730120812:web:995e4f7d60cced8a709449"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);