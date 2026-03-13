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

        new maplibregl.Popup({ maxWidth: '300px', focusAfterOpen: false })
            .setLngLat(e.lngLat)
            .setHTML(popupHtml)
            .addTo(map);
    });

    map.on('mousemove', (e) => {
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