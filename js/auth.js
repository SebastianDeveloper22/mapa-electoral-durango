// js/auth.js
import { auth, db } from './firebase-config.js';
import { verificarAccesoAdmin } from './admin.js';
import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-auth.js";
import { collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-firestore.js";

const loginScreen = document.getElementById('login-screen');
const btnLogin = document.getElementById('btn-login');
const btnLogout = document.getElementById('btn-logout');

// Usamos los IDs correctos que están en nuestro HTML del Login
const inputEmail = document.getElementById('login-email');
const inputPassword = document.getElementById('login-password');

// ==========================================
// FUNCIÓN PARA OBTENER EL ROL (CON REGLA MÓVIL)
// ==========================================
async function fetchAndSetUserRole(email) {
    try {
        const q = query(collection(db, "roles"), where("email", "==", email));
        const querySnapshot = await getDocs(q);
        
        let userRole = "lector"; // Rol por defecto (el más seguro)

        if (!querySnapshot.empty) {
            userRole = querySnapshot.docs[0].data().rol;
        }

        // 🚨 NUEVA REGLA: FORZAR 'LECTOR' EN DISPOSITIVOS MÓVILES
        // Detectamos si es un celular por el ancho de la pantalla (<=768px) 
        // o leyendo el User-Agent del navegador.
        const isMobile = window.innerWidth <= 768 || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        
        if (isMobile && (userRole === 'admin' || userRole === 'editor')) {
            console.warn(`📱 Dispositivo móvil detectado. El rol de ${userRole.toUpperCase()} ha sido degradado a LECTOR para evitar conflictos de diseño.`);
            userRole = "lector"; // Le quitamos los poderes temporalmente
        }

        // Guardamos el rol (ya filtrado) en el navegador
        localStorage.setItem('userRole', userRole);
        console.log(`🔐 Acceso concedido. Privilegios finales: ${userRole.toUpperCase()}`);
        
    } catch (error) {
        console.error("Error al obtener el rol del usuario:", error);
        localStorage.setItem('userRole', 'lector'); 
    }
}

// ==========================================
// LÓGICA PARA INICIAR SESIÓN
// ==========================================
if (btnLogin) {
    btnLogin.addEventListener('click', () => {
        const email = inputEmail.value.trim();
        const pass = inputPassword.value;

        if (!email || !pass) {
            alert("⚠️ Por favor, ingresa tu correo y contraseña.");
            return;
        }

        // Efecto visual en el botón
        btnLogin.innerText = "Verificando...";
        btnLogin.disabled = true;

        signInWithEmailAndPassword(auth, email, pass)
            .then(() => {
                console.log("Sesión iniciada correctamente en Auth");
                // No ocultamos la pantalla aquí, dejamos que el observador lo haga
            })
            .catch((error) => {
                alert("❌ Error: " + error.message);
                btnLogin.innerText = "Iniciar Sesión";
                btnLogin.disabled = false;
            });
    });
}

// ==========================================
// OBSERVADOR: ¿HAY ALGUIEN LOGUEADO?
// ==========================================
onAuthStateChanged(auth, async (user) => {
    if (user) {
        // 1. Si hay usuario, primero buscamos su rol en la base de datos
        localStorage.setItem('userEmail', user.email);
        await fetchAndSetUserRole(user.email);

        verificarAccesoAdmin(); // Verificamos si es admin para mostrar el botón

        
        // 2. Restauramos el texto del botón por si acaso
        if(btnLogin) {
            btnLogin.innerText = "Iniciar Sesión";
            btnLogin.disabled = false;
        }

        // 3. Tu transición suave para esconder el login
        loginScreen.style.opacity = '0';
        setTimeout(() => {
            loginScreen.style.display = 'none';
        }, 500);
        
    } else {
        // Si no hay usuario, destruimos permisos y mostramos el login
        localStorage.removeItem('userRole');
        loginScreen.style.display = 'flex';
        // Un pequeño delay para que la opacidad se anime correctamente de regreso
        setTimeout(() => {
            loginScreen.style.opacity = '1';
        }, 50);
    }
});

// ==========================================
// CERRAR SESIÓN
// ==========================================
if (btnLogout) {
    btnLogout.addEventListener('click', () => {
        signOut(auth).then(() => {
            console.log("Sesión cerrada");
            localStorage.removeItem('userEmail'); // Limpiamos la memoria
            localStorage.removeItem('userRole'); // Limpiamos la memoria
            window.location.reload(); // Recargamos para limpiar el mapa visualmente
        });
    });
}