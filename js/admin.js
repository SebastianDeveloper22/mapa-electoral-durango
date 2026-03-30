// js/admin.js
import { db } from './firebase-config.js';
import { showToast } from './utils.js';
import { collection, getDocs, addDoc, doc, updateDoc, deleteDoc, query, where } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-firestore.js";

const btnAdminPanel = document.getElementById('btn-admin-panel');
const adminModal = document.getElementById('admin-modal');
const btnCloseAdmin = document.getElementById('btn-close-admin');
const userListContainer = document.getElementById('admin-user-list');

// Inputs para nuevo usuario
const inputNewEmail = document.getElementById('new-user-email');
const selectNewRole = document.getElementById('new-user-role');
const btnAddUser = document.getElementById('btn-add-user');

// 1. Mostrar el botón SOLO si el usuario es Admin
export const verificarAccesoAdmin = () => {
    const userRole = localStorage.getItem('userRole');
    if (userRole === 'admin') {
        btnAdminPanel.style.display = 'flex';
    } else {
        btnAdminPanel.style.display = 'none';
    }
};

// 2. Cargar la lista de usuarios desde Firebase 'roles'
const cargarUsuarios = async () => {
    userListContainer.innerHTML = '<p style="color:white; text-align:center;">Cargando usuarios...</p>';
    try {
        const querySnapshot = await getDocs(collection(db, "roles"));
        userListContainer.innerHTML = ''; // Limpiar
        
        querySnapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const id = docSnap.id;
            
            const div = document.createElement('div');
            div.className = 'user-row';
            div.innerHTML = `
                <span class="user-email">📧 ${data.email}</span>
                <div class="user-actions">
                    <select class="premium-input role-select" data-id="${id}">
                        <option value="lector" ${data.rol === 'lector' ? 'selected' : ''}>Lector</option>
                        <option value="editor" ${data.rol === 'editor' ? 'selected' : ''}>Editor</option>
                        <option value="admin" ${data.rol === 'admin' ? 'selected' : ''}>Admin</option>
                    </select>
                    <button class="btn-delete-user" data-id="${id}">🗑️</button>
                </div>
            `;
            userListContainer.appendChild(div);
        });

        // Asignar eventos a los nuevos selectores y botones
        asignarEventosUsuarios();
        
    } catch (error) {
        console.error("Error cargando usuarios:", error);
        userListContainer.innerHTML = '<p style="color:#f87171; text-align:center;">Error al cargar usuarios. Verifica tu conexión.</p>';
        showToast('Error al cargar la lista de usuarios.', 'error');
    }
};

// 3. Asignar eventos de Actualizar y Borrar
const asignarEventosUsuarios = () => {
    // Cambiar Rol
    const selects = document.querySelectorAll('.role-select');
    selects.forEach(select => {
        select.addEventListener('change', async (e) => {
            const id = e.target.getAttribute('data-id');
            const nuevoRol = e.target.value;
            try {
                await updateDoc(doc(db, "roles", id), { rol: nuevoRol });
                showToast(`Rol actualizado a "${nuevoRol}".`, 'success');
            } catch (error) {
                console.error("Error al actualizar rol:", error);
                showToast('Error al actualizar el rol. Intenta de nuevo.', 'error');
            }
        });
    });

    // Borrar Usuario
    const btnsDelete = document.querySelectorAll('.btn-delete-user');
    btnsDelete.forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const id = e.target.getAttribute('data-id');
            if(confirm("¿Estás seguro de quitar el acceso a este correo?")) {
                try {
                    await deleteDoc(doc(db, "roles", id));
                    showToast('Acceso del usuario eliminado.', 'success');
                    cargarUsuarios();
                } catch (error) {
                    console.error("Error al borrar:", error);
                    showToast('Error al eliminar el usuario. Intenta de nuevo.', 'error');
                }
            }
        });
    });
};

// 4. Agregar Nuevo Usuario
btnAddUser.addEventListener('click', async () => {
    const email = inputNewEmail.value.trim().toLowerCase();
    const rol = selectNewRole.value;

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
        showToast('Por favor, ingresa un correo electrónico válido.', 'warning');
        return;
    }

    try {
        btnAddUser.innerText = "⏳";

        // Verificar si el correo ya tiene acceso
        const existingSnap = await getDocs(query(collection(db, "roles"), where("email", "==", email)));
        if (!existingSnap.empty) {
            showToast(`"${email}" ya tiene acceso asignado.`, 'warning');
            btnAddUser.innerText = "Agregar";
            return;
        }

        await addDoc(collection(db, "roles"), {
            email: email,
            rol: rol
        });

        showToast(`Usuario "${email}" agregado como ${rol}.`, 'success');
        inputNewEmail.value = '';
        cargarUsuarios();
        btnAddUser.innerText = "Agregar";
    } catch (error) {
        console.error("Error agregando usuario:", error);
        showToast('Error al agregar el usuario. Intenta de nuevo.', 'error');
        btnAddUser.innerText = "Agregar";
    }
});

// Enter en el campo de email del panel admin
if (inputNewEmail) {
    inputNewEmail.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') btnAddUser.click();
    });
}

// Eventos del Modal
btnAdminPanel.addEventListener('click', () => {
    adminModal.style.display = 'flex';
    cargarUsuarios();
});

btnCloseAdmin.addEventListener('click', () => {
    adminModal.style.display = 'none';
});