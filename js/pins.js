// js/pins.js
import { map } from './map.js'; // 🌟 LA LÍNEA MÁGICA
import { db } from './firebase-config.js';
import { collection, addDoc, getDocs, doc, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// Variables globales para el control de los pines
let marcadores = []; 
let editandoId = null; 
let coordsTemporales = null;

// Referencias al Modal del DOM (Formulario de Cristal)
const pinModal = document.getElementById('pin-modal');
const btnSavePin = document.getElementById('btn-save-pin');
const btnCancelPin = document.getElementById('btn-cancel-pin');
const inputNombre = document.getElementById('pin-nombre');
const inputTipo = document.getElementById('pin-tipo');
const inputAnio = document.getElementById('pin-anio');
const modalTitle = document.getElementById('modal-title');

// ==========================================
// 1. DISEÑO DEL POPUP (CON PERMISOS RBAC)
// ==========================================
const crearHTMLPopup = (data, id) => {
    // Si la imagen no existe en tu carpeta local, se ocultará automáticamente gracias al onerror
    const logoPath = `./img/logo-pp-${data.anio}.png`;
    const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${data.coords.lat},${data.coords.lng}`;
    
    // 🛡️ SEGURIDAD: Leemos qué rol tiene el usuario activo
    const userRole = localStorage.getItem('userRole') || 'lector';
    
    // Condicionamos los botones: Solo admin y editor pueden verlos
    let botonesEdicion = '';
    if (userRole === 'admin' || userRole === 'editor') {
        botonesEdicion = `
            <button class="btn-popup btn-edit" data-id="${id}">✏️ Editar</button>
            <button class="btn-popup btn-delete" data-id="${id}">🗑️ Borrar</button>
        `;
    }

    // HTML del Popup Premium
    return `
        <div class="popup-container">
            <div class="popup-header">Obra P.P. ${data.anio}</div>
            
            <div class="popup-logo-box">
                <img src="${logoPath}" alt="Logo" onerror="this.parentElement.style.display='none'">
            </div>

            <div class="popup-data-list">
                <div class="popup-item">
                    <span class="popup-key">Nombre de la obra</span>
                    <span class="popup-val">${data.nombre}</span>
                </div>
                <div class="popup-item">
                    <span class="popup-key">Tipo de intervención</span>
                    <span class="popup-val">${data.tipo}</span>
                </div>
            </div>

            <div class="popup-actions">
                <a href="${googleMapsUrl}" target="_blank" class="btn-popup btn-route">
                    🗺️ Trazar Ruta
                </a>
                ${botonesEdicion}
            </div>
        </div>
    `;
};

// ==========================================
// 2. CARGAR Y DIBUJAR PINES DE FIRESTORE
// ==========================================
export const cargarPines = async () => {
    // Limpiar marcadores anteriores si estamos recargando
    marcadores.forEach(m => m.remove());
    marcadores = [];

    try {
        const querySnapshot = await getDocs(collection(db, "obras"));
        
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            const id = doc.id;

            // 1. Crear el elemento visual (El pin)
            const el = document.createElement('div');
            el.className = `marker-pin pin-${data.anio}`; // Añade la clase de color por año
            el.innerText = '📍';

            // 2. Crear el Popup (Burbuja de información)
            const popup = new maplibregl.Popup({ offset: 25, closeButton: false })
                .setHTML(crearHTMLPopup(data, id));

            // 3. Agregar el marcador al mapa
            const marker = new maplibregl.Marker({ element: el })
                .setLngLat([data.coords.lng, data.coords.lat])
                .setPopup(popup)
                .addTo(map);

            // Guardar en el arreglo por si necesitamos borrarlos todos después
            marcadores.push(marker);
        });
    } catch (error) {
        console.error("Error cargando los pines:", error);
    }
};

// ==========================================
// 3. AGREGAR PINES NUEVOS (CLIC DERECHO)
// ==========================================
map.on('contextmenu', (e) => {
    // 🛡️ SEGURIDAD: Candado para Lectores
    const userRole = localStorage.getItem('userRole') || 'lector';
    if (userRole === 'lector') {
        console.log("Acceso denegado: Los lectores no pueden crear obras.");
        return; // Detiene la función, no muestra el modal
    }

    // Si tiene permiso, abrimos el modal
    editandoId = null; 
    coordsTemporales = e.lngLat;
    
    // Limpiar el formulario
    inputNombre.value = '';
    inputTipo.value = '';
    inputAnio.value = '2024';
    modalTitle.innerText = "📍 Nueva Obra P.P.";

    // Mostrar el modal
    pinModal.style.display = 'flex';
});

// ==========================================
// 4. GUARDAR O ACTUALIZAR PIN EN FIRESTORE
// ==========================================
btnSavePin.addEventListener('click', async () => {
    const nombre = inputNombre.value.trim();
    const tipo = inputTipo.value.trim();
    const anio = inputAnio.value;

    if (!nombre || !tipo) {
        alert("Por favor, completa todos los campos.");
        return;
    }

    const obraData = {
        nombre: nombre,
        tipo: tipo,
        anio: anio,
        coords: { lat: coordsTemporales.lat, lng: coordsTemporales.lng }
    };

    try {
        btnSavePin.innerText = "Guardando...";
        
        if (editandoId) {
            // ACTUALIZAR OBRA EXISTENTE
            await updateDoc(doc(db, "obras", editandoId), obraData);
            console.log("Obra actualizada");
        } else {
            // CREAR OBRA NUEVA
            await addDoc(collection(db, "obras"), obraData);
            console.log("Obra guardada");
        }

        pinModal.style.display = 'none';
        btnSavePin.innerText = "Guardar Cambios";
        cargarPines(); // Recargar el mapa para ver los cambios

    } catch (error) {
        console.error("Error guardando la obra:", error);
        alert("Ocurrió un error al guardar.");
        btnSavePin.innerText = "Guardar Cambios";
    }
});

// Cerrar Modal al cancelar
btnCancelPin.addEventListener('click', () => {
    pinModal.style.display = 'none';
});

// ==========================================
// 5. EVENTOS DE EDICIÓN Y BORRADO (EN EL POPUP)
// ==========================================
// Como los botones se crean de forma dinámica, capturamos el clic a nivel del documento
document.addEventListener('click', async (e) => {
    // 🛡️ BOTÓN BORRAR
    if (e.target.classList.contains('btn-delete')) {
        const id = e.target.getAttribute('data-id');
        if (confirm("¿Estás seguro de eliminar esta obra? Esta acción no se puede deshacer.")) {
            try {
                await deleteDoc(doc(db, "obras", id));
                cargarPines(); // Refrescar mapa
            } catch (error) {
                console.error("Error al borrar:", error);
            }
        }
    }

    // ✏️ BOTÓN EDITAR
    if (e.target.classList.contains('btn-edit')) {
        const id = e.target.getAttribute('data-id');
        
        // Extraer los datos del HTML del popup para rellenar el formulario rápido
        const popupContainer = e.target.closest('.popup-container');
        const nombreText = popupContainer.querySelector('.popup-item:nth-child(1) .popup-val').innerText;
        const tipoText = popupContainer.querySelector('.popup-item:nth-child(2) .popup-val').innerText;
        const tituloAnio = popupContainer.querySelector('.popup-header').innerText; // Ej: "Obra P.P. 2024"
        const anioExtraido = tituloAnio.split(" ").pop(); // Saca solo el "2024"

        // Rellenar formulario
        inputNombre.value = nombreText;
        inputTipo.value = tipoText;
        inputAnio.value = anioExtraido;
        
        // Guardamos el ID y la coordenada actual por si solo cambia el texto
        editandoId = id;
        
        // Para no perder la ubicación original si solo se edita el texto
        const marker = marcadores.find(m => m.getPopup()._content.innerHTML.includes(id));
        if(marker) coordsTemporales = marker.getLngLat();

        modalTitle.innerText = "✏️ Editar Obra";
        pinModal.style.display = 'flex';
        
        // Cerramos el popup activo
        document.querySelector('.maplibregl-popup-close-button')?.click();
    }
});

// Inicializar cargando los pines cuando el script cargue
// (Asumimos que la variable 'map' ya está definida globalmente en map.js)
map.on('load', () => {
    cargarPines();
});