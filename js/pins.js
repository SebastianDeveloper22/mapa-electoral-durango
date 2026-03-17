// js/pins.js
import { map } from './map.js'; // 🌟 LA LÍNEA MÁGICA
import { db } from './firebase-config.js';
import { collection, addDoc, getDocs, doc, updateDoc, deleteDoc, getDoc } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-firestore.js";

// Variables globales para el control de los pines
let datosObrasGlobales = []; // Para usar en las estadísticas
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
    const logoPath = `./img/logo-pp-${data.anio}.png`;
    const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${data.coords.lat},${data.coords.lng}`;
    const userRole = localStorage.getItem('userRole') || 'lector';
    
    let botonesEdicion = '';
    if (userRole === 'admin' || userRole === 'editor') {
        botonesEdicion = `
            <button class="btn-popup btn-edit" data-id="${id}">✏️ Editar</button>
            <button class="btn-popup btn-delete" data-id="${id}">🗑️ Borrar</button>
        `;
    }

    // ✨ NUEVO: Trazabilidad (Si es una obra vieja que no tenía autor, dice "Sistema")
    const creador = data.creadoPor || 'Sistema Base';
    const fecha = data.fechaCreacion || 'Fecha desconocida';

    return `
        <div class="popup-container">
            <div class="popup-header">Obra P.P. ${data.anio}</div>
            <div class="popup-logo-box">
                <img src="${logoPath}" alt="Logo" onerror="this.parentElement.style.display='none'">
            </div>
            <div class="popup-data-list">
                <div class="popup-item">
                    <span class="popup-key">Nombre</span>
                    <span class="popup-val">${data.nombre}</span>
                </div>
                <div class="popup-item">
                    <span class="popup-key">Intervención</span>
                    <span class="popup-val">${data.tipo}</span>
                </div>
            </div>
            <div class="popup-actions">
                <a href="${googleMapsUrl}" target="_blank" class="btn-popup btn-route">🗺️ Ruta</a>
                ${botonesEdicion}
            </div>
            <!-- SECCIÓN DE TRAZABILIDAD -->
            <div class="popup-traceability">
                Registrado por <span>${creador}</span><br>${fecha}
            </div>
        </div>
    `;
};

// ==========================================
// 2. CARGAR Y DIBUJAR PINES DE FIRESTORE
// ==========================================
export const cargarPines = async () => {
    marcadores.forEach(m => m.remove());
    marcadores = [];
    datosObrasGlobales = []; // ✨ NUEVO: Limpiamos el arreglo global

    try {
        const querySnapshot = await getDocs(collection(db, "obras"));
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            const id = doc.id;
            
            datosObrasGlobales.push(data); // ✨ NUEVO: Guardamos para las estadísticas

            const el = document.createElement('div');
            el.className = `marker-pin pin-${data.anio}`;
            el.innerText = '📍';

            // ✨ NUEVO: Le inyectamos los datos al HTML del pin para los filtros
            el.dataset.anio = data.anio;
            el.dataset.tipo = data.tipo;

            const popup = new maplibregl.Popup({ offset: 25, closeButton: false }).setHTML(crearHTMLPopup(data, id));
            const marker = new maplibregl.Marker({ element: el }).setLngLat([data.coords.lng, data.coords.lat]).setPopup(popup).addTo(map);
            marcadores.push(marker);
        });
    } catch (error) {
        console.error("Error cargando los pines:", error);
    }
};

// ==========================================
// 📊 LÓGICA DEL PANEL DE ESTADÍSTICAS (Con Generación Dinámica de Colores Únicos)
// ==========================================
const btnStats = document.getElementById('btn-stats');
const statsModal = document.getElementById('stats-modal');
const btnCloseStats = document.getElementById('btn-close-stats');
const statsContainer = document.getElementById('stats-container');

let chartTipos = null;
let chartAnios = null;

if (btnStats) {
    btnStats.addEventListener('click', () => {
        if (datosObrasGlobales.length === 0) {
            alert("No hay obras registradas para graficar.");
            return;
        }

        const total = datosObrasGlobales.length;
        
        // 1. Agrupar y Sanitizar datos
        const conteoPorAnio = {};
        const conteoPorTipo = {};
        const nombresVisuales = {};

        datosObrasGlobales.forEach(obra => {
            const anio = obra.anio || 'Sin Año';
            const tipoOriginal = (obra.tipo || 'Sin Especificar').trim();
            
            // Función para limpiar texto y agrupar bien
            const normalizeText = (text) => text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            const tipoKey = normalizeText(tipoOriginal);

            if (!nombresVisuales[tipoKey]) {
                nombresVisuales[tipoKey] = tipoOriginal.charAt(0).toUpperCase() + tipoOriginal.slice(1);
            }

            conteoPorAnio[anio] = (conteoPorAnio[anio] || 0) + 1;
            conteoPorTipo[tipoKey] = (conteoPorTipo[tipoKey] || 0) + 1;
        });

        // 2. ✨ NUEVO CEREBRO: Función para generar un color ÚNICO y DETERMINISTA (HSL)
        const getStringHash = (str) => {
            let hash = 0;
            for (let i = 0; i < str.length; i++) {
                hash = ((hash << 5) - hash) + str.charCodeAt(i);
                hash = hash & hash;
            }
            return Math.abs(hash);
        };

        const generateUniqueColor = (str) => {
            const hash = getStringHash(str);
            // El Hue (H) va de 0 a 360, es el color principal. Esto nos da 360 opciones de inicio.
            const h = hash % 360;
            // Saturación (S) y Luminosidad (L) ajustadas para que sean vibrantes y legibles en tema oscuro.
            const s = (hash % 15) + 65; // S: 65% - 80% (vibrante)
            const l = (hash % 20) + 50; // L: 50% - 70% (evita oscuros)
            return `hsl(${h}, ${s}%, ${l}%)`;
        };

        // 3. Inyectar estructura HTML limpia
        statsContainer.innerHTML = `
            <div class="popup-item" style="background: rgba(56, 189, 248, 0.1); border-left: 3px solid #38bdf8; margin-bottom: 20px;">
                <span class="popup-key" style="font-size: 14px; color: #38bdf8;">Total de Obras Mapeadas</span>
                <span class="popup-val" style="font-size: 24px; font-weight: bold;">${total}</span>
            </div>
            
            <div style="display: flex; align-items: center; justify-content: space-between; width: 100%; margin-bottom: 25px; height: 180px;">
                <div style="width: 55%; height: 100%; position: relative;">
                    <canvas id="canvasTipos"></canvas>
                </div>
                <div id="custom-legend" style="width: 45%; height: 100%; overflow-y: auto; padding-left: 10px; border-left: 1px solid rgba(255,255,255,0.1); scrollbar-width: thin; scrollbar-color: rgba(255,255,255,0.2) rgba(0,0,0,0);">
                    </div>
            </div>

            <div style="position: relative; height: 180px; width: 100%;">
                <canvas id="canvasAnios"></canvas>
            </div>
        `;
        
        statsModal.style.display = 'flex';

        if (chartTipos) chartTipos.destroy();
        if (chartAnios) chartAnios.destroy();

        // 4. Procesar datos para la Dona con Colores Dinámicos
        const labelsTiposKeys = Object.keys(conteoPorTipo);
        const dataTiposValues = labelsTiposKeys.map(key => conteoPorTipo[key]);
        const visualLabels = labelsTiposKeys.map(key => nombresVisuales[key]);
        
        // ✨ NUEVO: Generamos un color único para cada categoría basándonos en su nombre
        const backgroundColorsTipos = labelsTiposKeys.map(key => generateUniqueColor(key));

        // 5. Dibujar la Dona
        const ctxTipos = document.getElementById('canvasTipos').getContext('2d');
        chartTipos = new Chart(ctxTipos, {
            type: 'doughnut',
            data: {
                labels: visualLabels,
                datasets: [{
                    data: dataTiposValues,
                    backgroundColor: backgroundColorsTipos, // ✨ Colores Únicos Dinámicos ✨
                    borderWidth: 0,
                    hoverOffset: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    title: { display: true, text: 'Distribución por Tipo', color: '#94a3b8', font: {size: 11} }
                }
            }
        });

        // 6. Llenar la Leyenda Custom con scroll
        const customLegendContainer = document.getElementById('custom-legend');
        labelsTiposKeys.forEach((key, index) => {
            customLegendContainer.innerHTML += `
                <div style="display: flex; align-items: center; margin-bottom: 6px;">
                    <div style="min-width: 12px; height: 12px; border-radius: 3px; background-color: ${backgroundColorsTipos[index]}; margin-right: 8px;"></div>
                    <span style="flex-grow: 1; color: #e2e8f0; font-size: 11px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; padding-right: 5px;">${nombresVisuales[key]}</span>
                    <span style="color: #94a3b8; font-size: 11px; font-weight: bold;">${conteoPorTipo[key]}</span>
                </div>
            `;
        });

        // 7. Dibujar Gráfica de Barras
        const ctxAnios = document.getElementById('canvasAnios').getContext('2d');
        const aniosOrdenados = Object.keys(conteoPorAnio).sort();
        
        chartAnios = new Chart(ctxAnios, {
            type: 'bar',
            data: {
                labels: aniosOrdenados,
                datasets: [{
                    label: 'Obras',
                    data: aniosOrdenados.map(anio => conteoPorAnio[anio]),
                    backgroundColor: '#3b82f6',
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    title: { display: true, text: 'Inversión por Año', color: '#94a3b8', font: {size: 11} }
                },
                scales: {
                    y: { beginAtZero: true, ticks: { color: '#94a3b8', stepSize: 1, font: {size: 10} }, grid: { color: 'rgba(255,255,255,0.05)' } },
                    x: { ticks: { color: '#e2e8f0', font: { weight: 'bold', size: 10 } }, grid: { display: false } }
                }
            }
        });
    });

    btnCloseStats.addEventListener('click', () => {
        statsModal.style.display = 'none';
    });
}

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
    
    // Obtenemos el correo del autor desde la memoria
    const userEmail = localStorage.getItem('userEmail') || 'Usuario Desconocido';
    const fechaActual = new Date().toLocaleDateString('es-MX', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

    if (!nombre || !tipo) {
        alert("Por favor, completa todos los campos.");
        return;
    }

    try {
        btnSavePin.innerText = "Guardando...";
        
        if (editandoId) {
            // ACTUALIZAR (Solo cambiamos los datos y quién lo editó al final)
            await updateDoc(doc(db, "obras", editandoId), {
                nombre: nombre,
                tipo: tipo,
                anio: anio,
                coords: { lat: coordsTemporales.lat, lng: coordsTemporales.lng },
                ultimaEdicionPor: userEmail,
                fechaEdicion: fechaActual
            });
        } else {
            // CREAR NUEVO (Estampamos el creador original)
            await addDoc(collection(db, "obras"), {
                nombre: nombre,
                tipo: tipo,
                anio: anio,
                coords: { lat: coordsTemporales.lat, lng: coordsTemporales.lng },
                creadoPor: userEmail,
                fechaCreacion: fechaActual
            });
        }

        pinModal.style.display = 'none';
        btnSavePin.innerText = "Guardar Cambios";
        cargarPines(); // Recarga el mapa

    } catch (error) {
        console.error("Error guardando:", error);
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
// 🛡️ BOTÓN BORRAR (Con envío a la Papelera)
    if (e.target.classList.contains('btn-delete')) {
        const id = e.target.getAttribute('data-id');
        
        if (confirm("¿Estás seguro de eliminar esta obra? Quedará un registro en la auditoría.")) {
            try {
                // 1. Quién y cuándo lo borra
                const userEmail = localStorage.getItem('userEmail') || 'Desconocido';
                const fechaActual = new Date().toLocaleDateString('es-MX', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

                const docRef = doc(db, "obras", id);
                
                // 2. Leemos la obra antes de que desaparezca
                const docSnap = await getDoc(docRef);
                
                if (docSnap.exists()) {
                    // 3. La guardamos en la "papelera" de Firestore
                    await addDoc(collection(db, "papelera"), {
                        ...docSnap.data(), // Copia toda la info de la obra
                        borradoPor: userEmail,
                        fechaBorrado: fechaActual
                    });
                }

                // 4. Ahora sí, la destruimos del mapa visible
                await deleteDoc(docRef);
                cargarPines(); // Refrescar mapa
                console.log("Obra eliminada y enviada a la papelera.");

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

// ==========================================
// 📥 DESCARGAR A EXCEL (CSV)
// ==========================================
const btnExportCsv = document.getElementById('btn-export-csv');
if (btnExportCsv) {
    btnExportCsv.addEventListener('click', () => {
        if (datosObrasGlobales.length === 0) {
            alert("No hay obras en el mapa para exportar.");
            return;
        }
        
        // \uFEFF ayuda a que Excel lea los acentos (á, é, í, ó, ú) correctamente
        let csvContent = "data:text/csv;charset=utf-8,\uFEFF";
        csvContent += "Nombre de la Obra,Tipo de Intervención,Año,Latitud,Longitud,Registrado Por,Fecha de Registro\n";
        
        datosObrasGlobales.forEach(obra => {
            const nombre = `"${obra.nombre || ''}"`; // Comillas por si llevan comas en el texto
            const tipo = `"${obra.tipo || ''}"`;
            const anio = obra.anio || '';
            const lat = obra.coords?.lat || '';
            const lng = obra.coords?.lng || '';
            const creador = obra.creadoPor || 'Sistema';
            const fecha = obra.fechaCreacion || '';
            
            csvContent += `${nombre},${tipo},${anio},${lat},${lng},${creador},${fecha}\n`;
        });
        
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `Reporte_Obras_${new Date().getFullYear()}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    });
}

// ==========================================
// 🎛️ FILTROS UNIFICADOS (AÑOS LATERAL + TIPO ABAJO)
// ==========================================
const normalizarTexto = (texto) => {
    if (!texto) return "";
    return texto.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
};

const chipsFiltros = document.querySelectorAll('.filter-chip');
const checkboxesLateralPP = document.querySelectorAll('input[type="checkbox"][id^="check-pin-"]');

const aplicarFiltrosCombinados = () => {
    // 1. Qué tipo de obra está seleccionada abajo
    const chipActivo = document.querySelector('.filter-chip.active');
    const filtroTipo = chipActivo ? chipActivo.getAttribute('data-filter') : 'all';
    const filtroLimpio = normalizarTexto(filtroTipo);

    // 2. Qué años están encendidos en el menú lateral
    const aniosActivos = [];
    if (document.getElementById('check-pin-2023')?.checked) aniosActivos.push('2023');
    if (document.getElementById('check-pin-2024')?.checked) aniosActivos.push('2024');
    if (document.getElementById('check-pin-2025')?.checked) aniosActivos.push('2025');
    if (document.getElementById('check-pin-2026')?.checked) aniosActivos.push('2026');

    // 3. Evaluar y mostrar/ocultar cada pin
    marcadores.forEach(m => {
        const pinHTML = m.getElement();
        const anioPin = pinHTML.dataset.anio;
        const tipoPin = normalizarTexto(pinHTML.dataset.tipo);

        // ¿El año del pin está marcado con palomita en el menú lateral?
        const pasaAnio = aniosActivos.includes(anioPin);

        // ¿El tipo de obra coincide con el botón azul de abajo?
        const pasaTipo = (filtroTipo === 'all') || tipoPin.includes(filtroLimpio);

        // Si cumple ambas reglas, lo mostramos. Si no, lo ocultamos.
        if (pasaAnio && pasaTipo) {
            pinHTML.style.display = ''; 
        } else {
            pinHTML.style.display = 'none';
        }
    });
};

// Evento: Al hacer clic en los botones flotantes (Agua, Pavimentación, etc.)
chipsFiltros.forEach(chip => {
    chip.addEventListener('click', (e) => {
        chipsFiltros.forEach(c => c.classList.remove('active'));
        e.target.classList.add('active');
        aplicarFiltrosCombinados();
    });
});

// Evento: Al encender o apagar las palomitas de los años en el panel lateral
checkboxesLateralPP.forEach(cb => {
    cb.addEventListener('change', aplicarFiltrosCombinados);
});