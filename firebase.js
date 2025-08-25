// firebase.js
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

//Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyB0TQOkK0BeS_QufBZR51cZQpTHLDKuYZs",
  authDomain: "chatroom-29165.firebaseapp.com",
  projectId: "chatroom-29165",
  storageBucket: "chatroom-29165.firebasestorage.app",
  messagingSenderId: "878582832921",
  appId: "1:878582832921:web:ee1fda4d7128dca815ef88",
  measurementId: "G-792K1FRS6P"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Export Auth & Firestore
export const auth = getAuth(app);
export const db = getFirestore(app);
