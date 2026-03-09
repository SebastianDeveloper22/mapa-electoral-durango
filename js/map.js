// js/map.js

// 1. Inicialización del Mapa
const map = new maplibregl.Map({
    container: 'map',
    style: {
        'version': 8,
        // DICCIONARIO DE FUENTES (Obligatorio para que no se ponga azul/blanco al pedir texto)
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
    console.log("Sistema cartográfico cargado. Capas listas.");

    // Fuente de los datos
    map.addSource('cartografia-electoral', {
        'type': 'vector',
        'tiles': [window.location.origin + '/tiles/{z}/{x}/{y}.pbf'],
        'minzoom': 10,
        'maxzoom': 14 
    });

    // Función maestra para crear capas
    const addCleanLayer = (id, sourceLayer, color, width, minZoom = 10, labelField = null) => {
        // Relleno invisible para clics
        map.addLayer({
            'id': `layer-${id}-fill`,
            'type': 'fill',
            'source': 'cartografia-electoral',
            'source-layer': sourceLayer,
            'layout': { 'visibility': 'none' },
            'paint': { 'fill-color': 'rgba(0,0,0,0)' }
        });

        // Líneas visuales
        map.addLayer({
            'id': `layer-${id}-line`,
            'type': 'line',
            'source': 'cartografia-electoral',
            'source-layer': sourceLayer,
            'minzoom': minZoom,
            'layout': { 'visibility': 'none' },
            'paint': { 'line-color': color, 'line-width': width }
        });

        // Etiquetas de texto (si existen)
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

    // --- CARGAR TODAS LAS CAPAS ---
    addCleanLayer('manzana', 'MANZANA', '#475569', 0.4, 14);
    addCleanLayer('colonia', 'COLONIA', '#94a3b8', 0.8, 12, 'COLONIA'); 
    addCleanLayer('seccion', 'SECCION', '#60a5fa', 1.2, 11, 'SECCION');
    addCleanLayer('zona', 'ZONAS HECHAS', '#38bdf8', 1.8, 10, 'Zona'); // <-- Zonas con etiqueta
    addCleanLayer('distrito-local', 'DISTRITO_LOCAL', '#818cf8', 2.2, 10, 'DISTRITO_L');
    addCleanLayer('distrito-fed', 'DISTRITO_FEDERAL', '#2563eb', 3, 10, 'DISTRITO_F');
    addCleanLayer('municipio', 'MUNICIPIO', '#f8fafc', 4, 10, 'MUNICIPIO');

    // --- LÓGICA DE INTERRUPTORES (Líneas y Texto) ---
    const layerNames = ['municipio', 'distrito-fed', 'distrito-local', 'zona', 'seccion', 'colonia', 'manzana'];
    const labelToggle = document.getElementById('check-show-labels'); // El nuevo botón de texto

    const updateLayerVisibility = () => {
        // Blindaje: Si el botón de texto no existe en el HTML, asumimos que es "true"
        const labelsGlobalVisible = labelToggle ? labelToggle.checked : true;

        layerNames.forEach(name => {
            const checkbox = document.getElementById(`check-${name}`);
            if (!checkbox) return; // Si no hay checkbox, nos saltamos esta capa

            const isLayerVisible = checkbox.checked ? 'visible' : 'none';
            
            if (map.getLayer(`layer-${name}-fill`)) map.setLayoutProperty(`layer-${name}-fill`, 'visibility', isLayerVisible);
            if (map.getLayer(`layer-${name}-line`)) map.setLayoutProperty(`layer-${name}-line`, 'visibility', isLayerVisible);
            
            // La etiqueta solo se ve si la capa está activa Y el interruptor global de texto está activo
            if (map.getLayer(`layer-${name}-label`)) {
                const labelStatus = (isLayerVisible === 'visible' && labelsGlobalVisible) ? 'visible' : 'none';
                map.setLayoutProperty(`layer-${name}-label`, 'visibility', labelStatus);
            }
        });
    };

    // Asignar los eventos "click" a cada botón
    layerNames.forEach(name => {
        const cb = document.getElementById(`check-${name}`);
        if (cb) cb.addEventListener('change', updateLayerVisibility);
    });

    if (labelToggle) {
        labelToggle.addEventListener('change', updateLayerVisibility);
    }

    // --- POPUPS DE INFORMACIÓN ---
    const clickableIds = layerNames.map(n => `layer-${n}-fill`);

    map.on('click', (e) => {
        const features = map.queryRenderedFeatures(e.point, { layers: clickableIds });
        if (!features.length) return;

        const feature = features[0];
        const props = feature.properties;
        
        let popupHtml = `<div class="popup-container">
                            <div class="popup-header">${feature.sourceLayer.replace('_', ' ')}</div>
                            <div class="popup-data-list">`;
        
        for (const key in props) {
            if (key.toLowerCase() === 'fid') continue; // Filtramos la basura técnica
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

    // Cambiar el cursor a la "manita" cuando se pueda hacer clic
    map.on('mousemove', (e) => {
        const features = map.queryRenderedFeatures(e.point, { layers: clickableIds });
        map.getCanvas().style.cursor = features.length ? 'pointer' : '';
    });
});

// Exportamos el mapa
export { map };