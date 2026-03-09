// js/pins.js
import { db } from './firebase-config.js';
import { collection, addDoc, onSnapshot, query, orderBy } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-firestore.js";
import { map } from './map.js';

// 1. Referencia a la colección en Firestore (se creará sola si no existe)
const pinsCollection = collection(db, "marcadores");

// 2. ESCUCHAR CLIC DERECHO PARA AGREGAR PINES
map.on('contextmenu', async (e) => {
    const { lng, lat } = e.lngLat;

    // Ventana simple para pedir el nombre/descripción del marcador
    const label = prompt("📍 Nuevo Marcador\nIngresa el nombre o descripción del punto:");
    
    if (label && label.trim() !== "") {
        try {
            // Guardamos en Firebase
            await addDoc(pinsCollection, {
                nombre: label,
                coords: { lng, lat },
                timestamp: new Date().getTime() // Útil para ordenarlos
            });
            console.log("Pin guardado exitosamente en Firebase.");
        } catch (error) {
            console.error("Error al guardar el pin:", error);
            alert("No se pudo guardar el pin. Revisa tus permisos de Firebase.");
        }
    }
});

// 3. RENDERIZAR PINES EN TIEMPO REAL
// onSnapshot "escucha" la base de datos. Si alguien agrega un pin, aparece automático.
const q = query(pinsCollection, orderBy("timestamp", "asc"));

onSnapshot(q, (snapshot) => {
    snapshot.docChanges().forEach((change) => {
        // Solo nos interesan los pines "nuevos" que llegan de la base de datos
        if (change.type === "added") {
            const data = change.doc.data();
            
            // Crear el elemento HTML del marcador usando los estilos premium de styles.css
            const el = document.createElement('div');
            el.className = 'marker-pin';
            el.innerHTML = `
                <div class="pin-icon">📍</div>
                <div class="pin-label">${data.nombre}</div>
            `;

            // Crear el popup que saldrá al hacer clic izquierdo en el pin
            const popup = new maplibregl.Popup({ offset: 25, focusAfterOpen: false })
                .setHTML(`
                    <div class="popup-container">
                        <div class="popup-header">Marcador Guardado</div>
                        <div class="popup-item">
                            <span class="popup-key">Nombre</span>
                            <span class="popup-val">${data.nombre}</span>
                        </div>
                        <div class="popup-item">
                            <span class="popup-key">Coordenadas</span>
                            <span class="popup-val" style="font-size: 11px;">
                                Lat: ${data.coords.lat.toFixed(5)}<br>
                                Lng: ${data.coords.lng.toFixed(5)}
                            </span>
                        </div>
                    </div>
                `);

            // Agregar el marcador al mapa de MapLibre
            new maplibregl.Marker(el)
                .setLngLat([data.coords.lng, data.coords.lat])
                .setPopup(popup)
                .addTo(map);
        }
    });
});