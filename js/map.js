// 1. Exportamos el mapa correctamente para que otros archivos lo puedan usar
export const map = new maplibregl.Map({
    container: 'map',
    style: {
        'version': 8,
        'glyphs': 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
        'sources': {
            'osm-base': {
                'type': 'raster',
                'tiles': ['https://a.tile.openstreetmap.org/{z}/{x}/{y}.png'],
                'tileSize': 256,
                'attribution': '&copy; OpenStreetMap'
            }
        },
        'layers': [
            { 'id': 'osm-tiles', 'type': 'raster', 'source': 'osm-base' }
        ]
    },
    center: [-104.6531, 24.0277], // Durango
    zoom: 12
});

map.on('load', () => {
    console.log("Sistema cartográfico cargado.");

    // ✨ NUEVO: Agregar fuente y capa de Satélite (Esri World Imagery)
    map.addSource('esri-satellite', {
        'type': 'raster',
        'tiles': [
            'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
        ],
        'tileSize': 256,
        'attribution': '&copy; Esri'
    });

    map.addLayer({
        'id': 'satellite-tiles',
        'type': 'raster',
        'source': 'esri-satellite',
        'layout': {
            'visibility': 'none' // Inicia apagada
        }
    });

    map.addSource('cartografia-electoral', {
        'type': 'vector',
        'tiles': [window.location.origin + '/tiles/{z}/{x}/{y}.pbf'],
        'minzoom': 10,
        'maxzoom': 14 
    });

    const addCleanLayer = (id, sourceLayer, color, width, minZoom = 10, labelField = null) => {
        map.addLayer({
            'id': `layer-${id}-fill`,
            'type': 'fill',
            'source': 'cartografia-electoral',
            'source-layer': sourceLayer,
            'layout': { 'visibility': 'none' },
            'paint': { 'fill-color': 'rgba(0,0,0,0)' }
        });

        map.addLayer({
            'id': `layer-${id}-line`,
            'type': 'line',
            'source': 'cartografia-electoral',
            'source-layer': sourceLayer,
            'minzoom': minZoom,
            'layout': { 'visibility': 'none' },
            'paint': { 'line-color': color, 'line-width': width }
        });

        if (labelField) {
            map.addLayer({
                'id': `layer-${id}-label`,
                'type': 'symbol',
                'source': 'cartografia-electoral',
                'source-layer': sourceLayer,
                'minzoom': minZoom, 
                'layout': {
                    'visibility': 'none',
                    'text-field': ['get', labelField],
                    'text-font': ['Noto Sans Regular'], 
                    'text-size': 13,
                    'text-allow-overlap': false
                },
                'paint': {
                    'text-color': '#ffffff',
                    'text-halo-color': 'rgba(15, 23, 42, 0.9)',
                    'text-halo-width': 2
                }
            });
        }
    };

    // --- CARGAR CAPAS ---
    addCleanLayer('manzana', 'MANZANA', '#475569', 0.4, 14);
    addCleanLayer('colonia', 'COLONIA', '#94a3b8', 0.8, 12, 'NOMBRE'); 
    addCleanLayer('seccion', 'SECCION', '#60a5fa', 1.2, 11, 'SECCION');
    addCleanLayer('zona', 'ZONAS HECHAS', '#38bdf8', 1.8, 10, 'Zona'); 
    addCleanLayer('distrito-local', 'DISTRITO_LOCAL', '#818cf8', 2.2, 10, 'DISTRITO_L');
    addCleanLayer('distrito-fed', 'DISTRITO_FEDERAL', '#2563eb', 3, 10, 'DISTRITO_F');
    addCleanLayer('municipio', 'MUNICIPIO', '#f8fafc', 4, 10, 'MUNICIPIO');

    // --- INTERRUPTORES Y VISIBILIDAD ---
    const layerNames = ['municipio', 'distrito-fed', 'distrito-local', 'zona', 'seccion', 'colonia', 'manzana'];
    const labelToggle = document.getElementById('check-show-labels');

    const updateLayerVisibility = () => {
        const labelsGlobalVisible = labelToggle ? labelToggle.checked : true;

        layerNames.forEach(name => {
            const checkbox = document.getElementById(`check-${name}`);
            if (!checkbox) return;

            const isLayerVisible = checkbox.checked ? 'visible' : 'none';
            
            if (map.getLayer(`layer-${name}-fill`)) map.setLayoutProperty(`layer-${name}-fill`, 'visibility', isLayerVisible);
            if (map.getLayer(`layer-${name}-line`)) map.setLayoutProperty(`layer-${name}-line`, 'visibility', isLayerVisible);
            
            if (map.getLayer(`layer-${name}-label`)) {
                const labelStatus = (isLayerVisible === 'visible' && labelsGlobalVisible) ? 'visible' : 'none';
                map.setLayoutProperty(`layer-${name}-label`, 'visibility', labelStatus);
            }
        });
    };

    layerNames.forEach(name => {
        const cb = document.getElementById(`check-${name}`);
        if (cb) cb.addEventListener('change', updateLayerVisibility);
    });

    if (labelToggle) labelToggle.addEventListener('change', updateLayerVisibility);

    // --- POPUPS INTERACTIVOS DE CAPAS ---
    map.on('click', (e) => {
        const activeClickableIds = layerNames
            .filter(n => document.getElementById(`check-${n}`)?.checked)
            .map(n => `layer-${n}-fill`);

        if (activeClickableIds.length === 0) return;

        const features = map.queryRenderedFeatures(e.point, { layers: activeClickableIds });
        if (!features.length) return;

        const feature = features[0];
        const props = feature.properties;
        
        let popupHtml = `<div class="popup-container">
                            <div class="popup-header">${feature.sourceLayer.replace('_', ' ')}</div>
                            <div class="popup-data-list">`;
        
        for (const key in props) {
            if (key.toLowerCase() === 'fid') continue;
            popupHtml += `<div class="popup-item">
                            <span class="popup-key">${key}</span>
                            <span class="popup-val">${props[key]}</span>
                            </div>`;
        }
        popupHtml += `</div></div>`;

        new maplibregl.Popup({ maxWidth: '300px', focusAfterOpen: false, closeButton: true, })
            .setLngLat(e.lngLat)
            .setHTML(popupHtml)
            .addTo(map);
    });

    const cursorMiraPremium = `url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><circle cx="16" cy="16" r="14" stroke="black" stroke-width="2" fill="none" opacity="0.5"/><circle cx="16" cy="16" r="14" stroke="white" stroke-width="2" fill="none"/><line x1="16" y1="2" x2="16" y2="30" stroke="black" stroke-width="2"/><line x1="16" y1="2" x2="16" y2="30" stroke="white" stroke-width="1"/><line x1="2" y1="16" x2="30" y2="16" stroke="black" stroke-width="2"/><line x1="2" y1="16" x2="30" y2="16" stroke="white" stroke-width="1"/><circle cx="16" cy="16" r="1" fill="white" stroke="black" stroke-width="1"/></svg>') 16 16, crosshair`;

    map.on('mousemove', (e) => {

        if (window.modoStreetViewActivo){
            map.getCanvas().style.cursor = cursorMiraPremium;
            return;
        }

        const activeClickableIds = layerNames
            .filter(n => document.getElementById(`check-${n}`)?.checked)
            .map(n => `layer-${n}-fill`);

        if(activeClickableIds.length === 0) {
            map.getCanvas().style.cursor = '';
            return;
        }

        map.getCanvas().style.cursor = map.queryRenderedFeatures(e.point, { layers: activeClickableIds }).length ? 'pointer' : '';
    });

    // --- BUSCADOR INTELIGENTE Y AUTOCOMPLETADO ---
    const btnSearch = document.getElementById('btn-search');
    const inputSearch = document.getElementById('search-input');
    const typeSearch = document.getElementById('search-type');
    const selectMunicipio = document.getElementById('search-municipio');
    const autocompleteList = document.getElementById('autocomplete-list');

    const asegurarCapaActiva = () => {
        if (!typeSearch) return;
        const tipoBusqueda = typeSearch.value;
        const checkbox = document.getElementById(`check-${tipoBusqueda}`);
        
        if (checkbox && !checkbox.checked) {
            checkbox.checked = true;
            updateLayerVisibility();
        }
    };

    if (inputSearch) inputSearch.addEventListener('focus', asegurarCapaActiva);
    if (typeSearch) typeSearch.addEventListener('change', asegurarCapaActiva);

    // AUTOCOMPLETADO
    if (inputSearch) {
        inputSearch.addEventListener('input', function() {
            let val = this.value.trim().toUpperCase();
            if (autocompleteList) autocompleteList.innerHTML = ''; 

            if (!val) {
                if (autocompleteList) autocompleteList.style.display = 'none';
                return;
            }

            const tipoBusqueda = typeSearch.value;
            const municipioFiltro = selectMunicipio ? selectMunicipio.value : 'TODOS';

            let layerName = tipoBusqueda === 'seccion' ? 'SECCION' : (tipoBusqueda === 'colonia' ? 'COLONIA' : 'ZONAS HECHAS');
            let columnName = tipoBusqueda === 'seccion' ? 'SECCION' : (tipoBusqueda === 'colonia' ? 'NOMBRE' : 'Zona');
            let columnMunicipio = 'MUNICIPIO';

            const features = map.querySourceFeatures('cartografia-electoral', { sourceLayer: layerName });
            
            let coincidencias = new Set();
            
            features.forEach(f => {
                if (f.properties && f.properties[columnName]) {
                    let munProp = f.properties[columnMunicipio] !== undefined ? String(f.properties[columnMunicipio]) : 'TODOS';
                    
                    if (municipioFiltro === 'TODOS' || munProp === municipioFiltro) {
                        let texto = String(f.properties[columnName]).toUpperCase();
                        if (texto.includes(val)) {
                            coincidencias.add(texto);
                        }
                    }
                }
            });

            let opciones = Array.from(coincidencias).slice(0, 8); 

            if (opciones.length > 0 && autocompleteList) {
                autocompleteList.style.display = 'flex';
                opciones.forEach(opcion => {
                    let item = document.createElement('div');
                    let regex = new RegExp(`(${val})`, "gi");
                    item.innerHTML = opcion.replace(regex, "<strong>$1</strong>");
                    
                    item.addEventListener('click', function() {
                        inputSearch.value = opcion; 
                        autocompleteList.style.display = 'none'; 
                        if (btnSearch) btnSearch.click(); 
                    });
                    
                    autocompleteList.appendChild(item);
                });
            } else if (autocompleteList) {
                autocompleteList.style.display = 'none';
            }
        });
    }

    document.addEventListener('click', function(e) {
        if (e.target !== inputSearch && autocompleteList) {
            autocompleteList.style.display = 'none';
        }
    });

    // BOTÓN BUSCAR
    const ejecutarBusqueda = () => {
        if (!inputSearch || !typeSearch) return;
        
        let valorBuscado = inputSearch.value.trim().toUpperCase();
        if (!valorBuscado) return;

        asegurarCapaActiva();

        const tipoBusqueda = typeSearch.value; 
        const municipioFiltro = selectMunicipio ? selectMunicipio.value : 'TODOS';

        let layerName = tipoBusqueda === 'seccion' ? 'SECCION' : (tipoBusqueda === 'colonia' ? 'COLONIA' : 'ZONAS HECHAS');
        let columnName = tipoBusqueda === 'seccion' ? 'SECCION' : (tipoBusqueda === 'colonia' ? 'NOMBRE' : 'Zona');
        let columnMunicipio = 'MUNICIPIO';

        const features = map.querySourceFeatures('cartografia-electoral', { sourceLayer: layerName });
        
        const resultados = features.filter(f => {
            if (!f.properties || !f.properties[columnName]) return false;
            
            let matchNombre = String(f.properties[columnName]).toUpperCase() === valorBuscado;
            let munProp = f.properties[columnMunicipio] !== undefined ? String(f.properties[columnMunicipio]) : 'TODOS';
            let matchMunicipio = (municipioFiltro === 'TODOS' || munProp === municipioFiltro);

            return matchNombre && matchMunicipio;
        });

        if (resultados.length > 0) {
            let minLng = 180, minLat = 90, maxLng = -180, maxLat = -90;
            
            resultados.forEach(res => {
                let geom = res.geometry;
                let coordsList = [];
                if (geom.type === 'Polygon') coordsList = geom.coordinates[0];
                else if (geom.type === 'MultiPolygon') geom.coordinates.forEach(poly => coordsList.push(...poly[0]));
                
                coordsList.forEach(pt => {
                    if (pt[0] < minLng) minLng = pt[0];
                    if (pt[1] < minLat) minLat = pt[1];
                    if (pt[0] > maxLng) maxLng = pt[0];
                    if (pt[1] > maxLat) maxLat = pt[1];
                });
            });

            const centerLng = (minLng + maxLng) / 2;
            const centerLat = (minLat + maxLat) / 2;

            map.flyTo({ center: [centerLng, centerLat], zoom: 15, essential: true, duration: 2000 });
        } else {
            alert("No se encontró la ubicación.\n\nRecuerda alejar un poco el mapa para que se descarguen los datos del municipio seleccionado.");
        }
    };

    if (btnSearch) btnSearch.addEventListener('click', ejecutarBusqueda);
    if (inputSearch) inputSearch.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            if (autocompleteList) autocompleteList.style.display = 'none';
            ejecutarBusqueda();
        }
    });

});

// ==========================================
// LÓGICA DEL MENÚ DE CAPAS (INTERFAZ)
// ==========================================
const btnLayers = document.getElementById('btn-layers-toggle');
const layerMenu = document.getElementById('layer-menu');

if (btnLayers && layerMenu) {
    btnLayers.addEventListener('click', (e) => {
        e.stopPropagation();
        layerMenu.classList.toggle('active');
        if (window.navigator.vibrate) window.navigator.vibrate(5);
    });

    document.addEventListener('click', (e) => {
        if (!layerMenu.contains(e.target) && e.target !== btnLayers) {
            layerMenu.classList.remove('active');
        }
    });
}

// ==========================================
// 🚶‍♂️ MODO STREET VIEW (PEGMAN MAGNÉTICO)
// ==========================================
const btnStreetView = document.getElementById('btn-streetview');
let pegmanMarker = null;

if (btnStreetView) {
    btnStreetView.addEventListener('click', () => {
        // 1. Si el monito ya está en el mapa, lo cancelamos y lo borramos
        if (pegmanMarker) {
            pegmanMarker.remove();
            pegmanMarker = null;
            btnStreetView.innerHTML = '🚶‍♂️ Street View';
            btnStreetView.style.backgroundColor = '#f59e0b'; // Naranja
            return;
        }

        // 2. Si no existe, lo creamos
        btnStreetView.innerHTML = '❌ Cancelar';
        btnStreetView.style.backgroundColor = '#ef4444'; // Rojo Tailwind

        // Crear el elemento visual (El emoji del monito parado)
        const el = document.createElement('div');
        el.className = 'pegman-marker';
        el.innerText = '🧍'; 

        // Obtener el centro actual de tu pantalla para que caiga justo ahí
        const centro = map.getCenter();

        // Crear el marcador con la súper propiedad "draggable" activada
        pegmanMarker = new maplibregl.Marker({
            element: el,
            draggable: true
        })
        .setLngLat([centro.lng, centro.lat])
        .addTo(map);

        // 3. Efecto visual: Cuando lo agarras, parece que camina
        pegmanMarker.on('dragstart', () => {
            el.innerText = '🚶‍♂️'; 
        });

        // 4. EL TRUCO FINAL: Cuando lo sueltas en la calle
        pegmanMarker.on('dragend', () => {
            el.innerText = '🧍'; // Vuelve a estar parado
            const lngLat = pegmanMarker.getLngLat();
            
            // Construimos la URL universal de Google Maps en modo 360° (Street View)
            const url = `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lngLat.lat},${lngLat.lng}`;
            
            // Abrimos la nueva pestaña como un rayo
            window.open(url, '_blank');

            // Limpiamos el mapa: regresamos el botón a la normalidad y borramos al monito
            pegmanMarker.remove();
            pegmanMarker = null;
            btnStreetView.innerHTML = '🚶‍♂️ Street View';
            btnStreetView.style.backgroundColor = '#f59e0b';
        });
    });
}

// ==========================================
// 🛰️ SELECTOR DE MAPA BASE (SATÉLITE / CALLES)
// ==========================================
const btnSatellite = document.getElementById('btn-satellite');
let isSatellite = false; // Estado inicial

if (btnSatellite) {
    btnSatellite.addEventListener('click', (e) => {
        e.stopPropagation(); // Evita clics accidentales en el mapa
        isSatellite = !isSatellite; // Cambiamos el estado

        if (isSatellite) {
            // Apagamos el mapa de calles y prendemos el satélite
            map.setLayoutProperty('osm-tiles', 'visibility', 'none');
            map.setLayoutProperty('satellite-tiles', 'visibility', 'visible');
            
            // Cambiamos la apariencia del botón
            btnSatellite.innerHTML = '🗺️ Mapa Calles';
            btnSatellite.style.backgroundColor = '#10b981'; // Verde para calles
            btnSatellite.style.borderColor = '#059669';
        } else {
            // Apagamos el satélite y regresamos al de calles
            map.setLayoutProperty('satellite-tiles', 'visibility', 'none');
            map.setLayoutProperty('osm-tiles', 'visibility', 'visible');
            
            // Regresamos el botón a la normalidad
            btnSatellite.innerHTML = '🛰️ Satélite';
            btnSatellite.style.backgroundColor = '#3b82f6'; // Azul
            btnSatellite.style.borderColor = '#2563eb';
        }
    });
}