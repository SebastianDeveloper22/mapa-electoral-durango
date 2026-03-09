import { auth } from './firebase-config.js';
// Actualizamos la versión aquí también a 12.10.0
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-auth.js";

// Referencias a los elementos del HTML
const loginScreen = document.getElementById('login-screen');
const mapContainer = document.getElementById('map-container');
const btnLogin = document.getElementById('btn-login');
const btnLogout = document.getElementById('btn-logout');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');

// 1. Observador de Sesión
onAuthStateChanged(auth, (user) => {
    if (user) {
        loginScreen.style.display = 'none';
        mapContainer.style.display = 'block';
    } else {
        loginScreen.style.display = 'block';
        mapContainer.style.display = 'none';
    }
});

// 2. Función para Iniciar Sesión
btnLogin.addEventListener('click', () => {
    const email = emailInput.value;
    const password = passwordInput.value;
    
    signInWithEmailAndPassword(auth, email, password)
        .then((userCredential) => {
            console.log("Bienvenido:", userCredential.user.email);
        })
        .catch((error) => {
            alert("Error de acceso: Revisa tu correo o contraseña.");
            console.error(error.message);
        });
});

// 3. Función para Cerrar Sesión
btnLogout.addEventListener('click', () => {
    signOut(auth).then(() => {
        console.log("Sesión cerrada exitosamente");
    });
});