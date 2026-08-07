import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useMapStore } from "../../store/mapStore";
import { useObrasStore } from "../../store/obrasStore";
import { useAuthStore } from "../../store/authStore";
import { CAPAS, MAP_CENTER, MAP_ZOOM } from "../../config";
import { ROLES } from "../../config";

const MapContainer = () => {
  const containerRef = useRef(null);
  const { setMapInstance, layersVisible, labelsVisible, isSatellite } =
    useMapStore();
  const { openModalNuevo } = useObrasStore();
  const { role } = useAuthStore();

  useEffect(() => {
    if (!containerRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: {
        version: 8,
        glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
        sources: {
          "osm-base": {
            type: "raster",
            tiles: ["https://a.tile.openstreetmap.org/{z}/{x}/{y}.png"],
            tileSize: 256,
            attribution: "© OpenStreetMap",
          },
        },
        layers: [{ id: "osm-tiles", type: "raster", source: "osm-base" }],
      },
      center: MAP_CENTER,
      zoom: MAP_ZOOM,
      preserveDrawingBuffer: true, // necesario para capturar canvas como imagen (PDF export)
    });

    map.addControl(new maplibregl.NavigationControl(), "bottom-right");

    map.on("load", () => {
      // Satélite (Esri)
      map.addSource("esri-satellite", {
        type: "raster",
        tiles: [
          "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        ],
        tileSize: 256,
        attribution: "© Esri",
      });
      map.addLayer({
        id: "satellite-tiles",
        type: "raster",
        source: "esri-satellite",
        layout: { visibility: "none" },
      });

      // Teselas vectoriales locales
      map.addSource("cartografia-electoral", {
        type: "vector",
        tiles: [`${window.location.origin}/tiles/{z}/{x}/{y}.pbf`],
        minzoom: 10,
        maxzoom: 14,
      });

      // Agregar cada capa cartográfica
      CAPAS.forEach(
        ({
          id,
          sourceLayer,
          color,
          width,
          dash,
          minZoom,
          labelField,
          labelColor,
          labelSize,
          labelMinZoom,
        }) => {
          // Fill (área clickable transparente)
          map.addLayer({
            id: `layer-${id}-fill`,
            type: "fill",
            source: "cartografia-electoral",
            "source-layer": sourceLayer,
            minzoom: minZoom,
            layout: { visibility: "none" },
            paint: { "fill-color": "rgba(0,0,0,0)" },
          });

          // Line (borde) — punteada si dash está definido
          const linePaint = { "line-color": color, "line-width": width };
          if (dash) linePaint["line-dasharray"] = dash;
          map.addLayer({
            id: `layer-${id}-line`,
            type: "line",
            source: "cartografia-electoral",
            "source-layer": sourceLayer,
            minzoom: minZoom,
            layout: { visibility: "none" },
            paint: linePaint,
          });

          // Label (etiqueta)
          if (labelField) {
            map.addLayer({
              id: `layer-${id}-label`,
              type: "symbol",
              source: "cartografia-electoral",
              "source-layer": sourceLayer,
              // Las etiquetas tienen su propio zoom mínimo independiente de la capa
              // (secciones solo etiquetadas zoom 13+, evita amontonamiento)
              minzoom: labelMinZoom ?? minZoom,
              layout: {
                visibility: "none",
                "text-field": ["get", labelField],
                "text-font": ["Noto Sans Bold"],
                "text-size": labelSize ?? 12,
                // Si el label no cabe sin solaparse, saltarlo (no forzar)
                "text-optional": true,
                "text-allow-overlap": false,
                "text-ignore-placement": false,
                // Espaciado extra para que los números respiren
                "text-padding": 8,
                "text-letter-spacing": 0.02,
              },
              paint: {
                "text-color": labelColor ?? "#ffffff",
                // Halo oscuro y sólido: crea un contorno neto alrededor del número
                "text-halo-color": "rgba(5, 8, 18, 0.96)",
                "text-halo-width": 2,
                "text-halo-blur": 0,
              },
            });
          }
        },
      );

      // Popups al hacer click en capas
      map.on("click", (e) => {
        const activeIds = CAPAS.filter(
          ({ id }) => useMapStore.getState().layersVisible[id],
        ).map(({ id }) => `layer-${id}-fill`);
        if (!activeIds.length) return;

        const features = map.queryRenderedFeatures(e.point, {
          layers: activeIds,
        });
        if (!features.length) return;

        const { properties, sourceLayer } = features[0];
        let html = `<div class="sig-popup">
          <div class="sig-popup-header">${sourceLayer.replace(/_/g, " ")}</div>
          <div class="sig-popup-body">`;
        for (const key in properties) {
          if (key.toLowerCase() === "fid") continue;
          html += `<div class="sig-popup-row">
            <span class="sig-popup-key">${key}</span>
            <span class="sig-popup-val">${properties[key]}</span>
          </div>`;
        }
        html += `</div></div>`;

        new maplibregl.Popup({
          maxWidth: "300px",
          closeButton: true,
          focusAfterOpen: false,
        })
          .setLngLat(e.lngLat)
          .setHTML(html)
          .addTo(map);
      });

      // Cursor pointer sobre capas activas
      let frame = null;
      map.on("mousemove", (e) => {
        if (frame) return;
        frame = requestAnimationFrame(() => {
          frame = null;
          const activeIds = CAPAS.filter(
            ({ id }) => useMapStore.getState().layersVisible[id],
          ).map(({ id }) => `layer-${id}-fill`);
          if (!activeIds.length) {
            map.getCanvas().style.cursor = "";
            return;
          }
          map.getCanvas().style.cursor = map.queryRenderedFeatures(e.point, {
            layers: activeIds,
          }).length
            ? "pointer"
            : "";
        });
      });

      // Clic derecho → nueva obra (solo editor/admin)
      map.on("contextmenu", (e) => {
        const currentRole = useAuthStore.getState().role;
        if (currentRole === ROLES.LECTOR) return;
        openModalNuevo(e.lngLat);
      });

      setMapInstance(map);
    });

    return () => map.remove();
  }, []);

  // Sincronizar visibilidad de capas con el store
  useEffect(() => {
    const map = useMapStore.getState().mapInstance;
    if (!map) return;

    CAPAS.forEach(({ id, labelField }) => {
      const vis = layersVisible[id] ? "visible" : "none";
      if (map.getLayer(`layer-${id}-fill`))
        map.setLayoutProperty(`layer-${id}-fill`, "visibility", vis);
      if (map.getLayer(`layer-${id}-line`))
        map.setLayoutProperty(`layer-${id}-line`, "visibility", vis);
      if (labelField && map.getLayer(`layer-${id}-label`)) {
        map.setLayoutProperty(
          `layer-${id}-label`,
          "visibility",
          layersVisible[id] && labelsVisible ? "visible" : "none",
        );
      }
    });
  }, [layersVisible, labelsVisible]);

  // Sincronizar modo satélite
  useEffect(() => {
    const map = useMapStore.getState().mapInstance;
    if (!map || !map.getLayer("satellite-tiles")) return;
    map.setLayoutProperty(
      "osm-tiles",
      "visibility",
      isSatellite ? "none" : "visible",
    );
    map.setLayoutProperty(
      "satellite-tiles",
      "visibility",
      isSatellite ? "visible" : "none",
    );
  }, [isSatellite]);

  return <div ref={containerRef} className="absolute inset-0 w-full h-full" />;
};

export default MapContainer;
