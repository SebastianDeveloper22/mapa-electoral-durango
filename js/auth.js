// js/auth.js
import { auth } from './firebase-config.js';
import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-auth.js";

const loginScreen = document.getElementById('login-screen');
const btnLogin = document.getElementById('btn-login');
const btnLogout = document.getElementById('btn-logout');

// Lógica para Iniciar Sesión
if (btnLogin) {
    btnLogin.addEventListener('click', () => {
        const email = document.getElementById('email').value;
        const pass = document.getElementById('password').value;

        signInWithEmailAndPassword(auth, email, pass)
            .then(() => console.log("Sesión iniciada correctamente"))
            .catch((error) => alert("Error: " + error.message));
    });
}

// Observador: ¿Hay alguien logueado?
onAuthStateChanged(auth, (user) => {
    if (user) {
        // Si hay usuario, escondemos el login con una transición suave
        loginScreen.style.opacity = '0';
        setTimeout(() => {
            loginScreen.style.display = 'none';
        }, 500);
    } else {
        // Si no hay usuario, mostramos el login
        loginScreen.style.display = 'flex';
        loginScreen.style.opacity = '1';
    }
});

// Cerrar Sesión
if (btnLogout) {
    btnLogout.addEventListener('click', () => {
        signOut(auth).then(() => {
            console.log("Sesión cerrada");
            window.location.reload(); // Recargamos para limpiar el mapa
        });
    });
}