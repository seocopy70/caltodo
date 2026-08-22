import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyBTXHnbW5ptpBjbJt43wrfbVABKtm1n3OU",
  authDomain: "caltodo-b54b1.firebaseapp.com",
  projectId: "caltodo-b54b1",
  storageBucket: "caltodo-b54b1.firebasestorage.app",
  messagingSenderId: "262284702885",
  appId: "1:262284702885:web:5868909292c4cca0f6c94c",
  measurementId: "G-F8FGGZ1NBG"
};

// 앱이 이미 초기화되었는지 확인 후 초기화
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const db = getFirestore(app);