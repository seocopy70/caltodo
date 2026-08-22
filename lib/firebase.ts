import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyBTxHnbW5ptpBjbJt43wrfbVABKtm1n3OU",
  authDomain: "caltodo-b54b1.firebaseapp.com",
  projectId: "caltodo-b54b1",
  storageBucket: "caltodo-b54b1.firebasestorage.app",
  messagingSenderId: "262284702885",
  appId: "1:262284702885:web:5868909292c4cca0f6c94c",
  measurementId: "G-F8FGGZ1NBG"
};

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();