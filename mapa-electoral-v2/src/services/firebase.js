import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyA5mmNc_R9hz6szXCBmiSj9fIEQZFGl7wo",
  authDomain: "mapa-electoral-durango.firebaseapp.com",
  projectId: "mapa-electoral-durango",
  storageBucket: "mapa-electoral-durango.firebasestorage.app",
  messagingSenderId: "967673913188",
  appId: "1:967673913188:web:9a2c259dc713d0b4c4e471",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
