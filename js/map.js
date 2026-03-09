// js/map.js

const map = new maplibregl.Map({
    container: 'map',
    style: {
        'version': 8,
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
    center: [-104.6531, 24.0277],
    zoom: 12
});

map.on('load', () => {
    console.log("Mapa listo. Las capas están ocultas hasta que se seleccionen.");

    map.addSource('cartografia-electoral', {
        'type': 'vector',
        'tiles': [window.location.origin + '/tiles/{z}/{x}/{y}.pbf'],
        'minzoom': 10,
        'maxzoom': 14 
    });

    const addCleanLayer = (id, sourceLayer, color, width, minZoom = 10) => {
        // 1. Relleno invisible para el clic
        map.addLayer({
            'id': `${id}-fill`,
            'type': 'fill',
            'source': 'cartografia-electoral',
            'source-layer': sourceLayer,
            'layout': { 'visibility': 'none' }, // <--- OCULTO POR DEFECTO
            'paint': { 'fill-color': 'rgba(0,0,0,0)' }
        });

        // 2. Línea visual
        map.addLayer({
            'id': `${id}-line`,
            'type': 'line',
            'source': 'cartografia-electoral',
            'source-layer': sourceLayer,
            'minzoom': minZoom,
            'layout': { 'visibility': 'none' }, // <--- OCULTO POR DEFECTO
            'paint': {
                'line-color': color,
                'line-width': width
            }
        });
    };

    // --- AGREGANDO CAPAS ---
    addCleanLayer('layer-manzana', 'MANZANA', '#64748b', 0.5, 14);
    addCleanLayer('layer-colonia', 'COLONIA', '#475569', 1);
    addCleanLayer('layer-seccion', 'SECCION', '#2563eb', 1.8);
    addCleanLayer('layer-zona', 'ZONAS HECHAS', '#ea580c', 2);
    addCleanLayer('layer-distrito-local', 'DISTRITO_LOCAL', '#7c3aed', 2.5);
    addCleanLayer('layer-distrito-fed', 'DISTRITO_FEDERAL', '#059669', 3.5);
    addCleanLayer('layer-municipio', 'MUNICIPIO', '#000000', 5);

    // --- LÓGICA DEL MENÚ SELECTOR ---
    const layerNames = ['municipio', 'distrito-fed', 'distrito-local', 'zona', 'seccion', 'colonia', 'manzana'];
    
    layerNames.forEach(name => {
        const checkbox = document.getElementById(`check-${name}`);
        if (checkbox) {
            checkbox.addEventListener('change', (e) => {
                const visibility = e.target.checked ? 'visible' : 'none';
                map.setLayoutProperty(`layer-${name}-fill`, 'visibility', visibility);
                map.setLayoutProperty(`layer-${name}-line`, 'visibility', visibility);
            });
        }
    });

    // --- POPUP: SOLO FUNCIONA SI LA CAPA ESTÁ VISIBLE ---
    const clickableIds = layerNames.map(n => `layer-${n}-fill`);

    map.on('click', (e) => {
        const features = map.queryRenderedFeatures(e.point, { layers: clickableIds });

        if (!features.length) return;

        const feature = features[0];
        const props = feature.properties;
        
        let popupHtml = `<div style="padding:10px; max-height:200px; overflow-y:auto;">
                            <b style="color:#1e40af; font-size:14px;">Capa: ${feature.sourceLayer}</b>
                            <hr style="border:0; border-top:1px solid #eee; margin:8px 0;">
                            <ul style="list-style:none; padding:0; margin:0; font-size:11px;">`;
        
        for (const key in props) {
            popupHtml += `<li style="margin-bottom:3px;"><strong>${key}:</strong> ${props[key]}</li>`;
        }
        
        popupHtml += `</ul></div>`;

        new maplibregl.Popup({ maxWidth: '300px' })
            .setLngLat(e.lngLat)
            .setHTML(popupHtml)
            .addTo(map);
    });

    map.on('mousemove', (e) => {
        const features = map.queryRenderedFeatures(e.point, { layers: clickableIds });
        map.getCanvas().style.cursor = features.length ? 'pointer' : '';
    });
});

export { map };