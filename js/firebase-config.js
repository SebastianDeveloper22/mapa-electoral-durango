// Importar las funciones principales desde la CDN de Google (Versión 12.10.0)
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-firestore.js";

// Tus credenciales (las que copiaste de tu consola)
const firebaseConfig = {
  apiKey: "AIzaSyA5mmNc_R9hz6szXCBmiSj9fIEQZFGl7wo",
  authDomain: "mapa-electoral-durango.firebaseapp.com",
  projectId: "mapa-electoral-durango",
  storageBucket: "mapa-electoral-durango.firebasestorage.app",
  messagingSenderId: "967673913188",
  appId: "1:967673913188:web:9a2c259dc713d0b4c4e471"
};

// Inicializar la aplicación, la autenticación y la base de datos
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);