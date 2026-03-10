// js/pins.js
import { db } from './firebase-config.js';
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-firestore.js";
import { map } from './map.js';

const pinsCollection = collection(db, "obras_pp");
let marcadoresActivos = {}; 

const modal = document.getElementById('pin-modal');
const inputNombre = document.getElementById('pin-nombre');
const inputTipo = document.getElementById('pin-tipo');
const selectAnio = document.getElementById('pin-anio');
const btnSave = document.getElementById('btn-save-pin');
const btnCancel = document.getElementById('btn-cancel-pin');
const modalTitle = document.querySelector('#pin-modal h3');

let coordsTemporales = null;
let editandoId = null; 

// 1. ABRIR MODAL NUEVO (CLIC DERECHO)
map.on('contextmenu', (e) => {
    editandoId = null; 
    coordsTemporales = e.lngLat;
    
    inputNombre.value = '';
    inputTipo.value = '';
    selectAnio.value = '2024'; 
    
    modalTitle.innerText = '📍 Registrar Obra P.P.';
    btnSave.innerText = 'Guardar Obra';
    modal.style.display = 'flex';
});

// 2. CERRAR MODAL
btnCancel.addEventListener('click', () => {
    modal.style.display = 'none';
    coordsTemporales = null;
    editandoId = null;
});

// 3. GUARDAR (NUEVO O ACTUALIZADO) EN FIREBASE
btnSave.addEventListener('click', async () => {
    if (!inputNombre.value.trim() || !inputTipo.value.trim()) {
        alert("Por favor llena el nombre y el tipo de obra.");
        return;
    }

    const datosObra = {
        nombre: inputNombre.value.trim(),
        tipo: inputTipo.value.trim(),
        anio: selectAnio.value
    };

    try {
        btnSave.innerText = "Guardando...";

        if (editandoId) {
            const docRef = doc(db, "obras_pp", editandoId);
            await updateDoc(docRef, datosObra);
        } else {
            datosObra.coords = { lng: coordsTemporales.lng, lat: coordsTemporales.lat };
            datosObra.timestamp = new Date().getTime();
            await addDoc(pinsCollection, datosObra);
        }

        modal.style.display = 'none';
    } catch (error) {
        console.error("Error al guardar:", error);
        alert("Error al guardar. Verifica las reglas de tu base de datos Firebase.");
    } finally {
        btnSave.innerText = "Guardar Obra";
    }
});

// 🌟 MAGIA NUEVA: Función auxiliar para dibujar el Popup con el botón de Google Maps
const crearHTMLPopup = (data, id) => {
    const logoPath = `./img/logo-pp-${data.anio}.png`;
    
    // Generamos el enlace universal de Google Maps con las coordenadas exactas del pin
    const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${data.coords.lat},${data.coords.lng}`;
    
    return `
        <div class="popup-container">
            <div class="popup-header" style="text-align:center;">Obra P.P. ${data.anio}</div>
            <div style="text-align: center; margin-top: 10px; margin-bottom: 10px;">
                <img src="${logoPath}" alt="Logo ${data.anio}" style="max-height: 45px; border-radius: 4px;" onerror="this.style.display='none'">
            </div>
            <div class="popup-data-list">
                <div class="popup-item"><span class="popup-key">Nombre</span><span class="popup-val">${data.nombre}</span></div>
                <div class="popup-item"><span class="popup-key">Tipo</span><span class="popup-val">${data.tipo}</span></div>
            </div>
            <div class="popup-actions">
                <a href="${googleMapsUrl}" target="_blank" class="btn-popup btn-route" title="Trazar ruta hacia esta obra">
                    🗺️ Ir a la obra (Google Maps)
                </a>
                
                <button class="btn-popup btn-edit" data-id="${id}">✏️ Editar</button>
                <button class="btn-popup btn-delete" data-id="${id}">🗑️ Borrar</button>
            </div>
        </div>
    `;
};

// 4. LEER, EDITAR Y BORRAR EN TIEMPO REAL
const q = query(pinsCollection, orderBy("timestamp", "asc"));

onSnapshot(q, (snapshot) => {
    snapshot.docChanges().forEach((change) => {
        const data = change.doc.data();
        const id = change.doc.id;

        if (change.type === "added") {
            const el = document.createElement('div');
            el.className = `marker-pin pin-${data.anio}`;
            el.innerHTML = `📍`;

            const popup = new maplibregl.Popup({ offset: 25, focusAfterOpen: false })
                .setHTML(crearHTMLPopup(data, id));

            const marker = new maplibregl.Marker(el)
                .setLngLat([data.coords.lng, data.coords.lat])
                .setPopup(popup)
                .addTo(map);

            marcadoresActivos[id] = { marker, data, anio: data.anio };
        }

        if (change.type === "modified") {
            if (marcadoresActivos[id]) {
                marcadoresActivos[id].data = data;
                marcadoresActivos[id].anio = data.anio;
                marcadoresActivos[id].marker.getElement().className = `marker-pin pin-${data.anio}`;
                marcadoresActivos[id].marker.getPopup().setHTML(crearHTMLPopup(data, id));
            }
        }

        if (change.type === "removed") {
            if (marcadoresActivos[id]) {
                marcadoresActivos[id].marker.remove();
                delete marcadoresActivos[id];
            }
        }
    });

    actualizarVisibilidadPines();
});

// 5. ESCUCHAR CLICS EN LOS BOTONES DE EDITAR Y BORRAR
document.addEventListener('click', async (e) => {
    if (e.target.classList.contains('btn-edit')) {
        const id = e.target.getAttribute('data-id');
        const marcador = marcadoresActivos[id];
        
        if (marcador) {
            editandoId = id; 
            inputNombre.value = marcador.data.nombre;
            inputTipo.value = marcador.data.tipo;
            selectAnio.value = marcador.data.anio;
            
            modalTitle.innerText = '✏️ Editar Obra P.P.';
            btnSave.innerText = 'Actualizar Obra';
            modal.style.display = 'flex';
            
            marcador.marker.togglePopup(); 
        }
    }

    if (e.target.classList.contains('btn-delete')) {
        const id = e.target.getAttribute('data-id');
        if (confirm("⚠️ ¿Estás seguro de que deseas eliminar esta obra de forma permanente?")) {
            try {
                await deleteDoc(doc(db, "obras_pp", id));
            } catch (error) {
                console.error("Error al borrar:", error);
                alert("No se pudo borrar el marcador. Revisa tus permisos de Firebase.");
            }
        }
    }
});

// 6. LÓGICA DEL MENÚ DE CAPAS (Apagar/Encender años)
const aniosFiltro = ['2023', '2024', '2025', '2026'];

const actualizarVisibilidadPines = () => {
    Object.values(marcadoresActivos).forEach(item => {
        const checkbox = document.getElementById(`check-pin-${item.anio}`);
        const isVisible = checkbox ? checkbox.checked : true;
        item.marker.getElement().style.display = isVisible ? 'block' : 'none';
    });
};

aniosFiltro.forEach(anio => {
    const cb = document.getElementById(`check-pin-${anio}`);
    if (cb) cb.addEventListener('change', actualizarVisibilidadPines);
});