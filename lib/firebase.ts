import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';

// Firestore는 더 이상 사용하지 않음 (데이터는 Turso로 이전됨).
// 로그인(구글 인증)만 Firebase Auth를 계속 사용.
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
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();