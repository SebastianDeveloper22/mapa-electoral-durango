import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import { useMapStore } from "../../store/mapStore";
import { useElectoralStore } from "../../store/electoralStore";
import { useAuthStore } from "../../store/authStore";
import { useFiltrosStore } from "./FiltrosCasillasPanel";
import { calcularCentroideSeccion } from "./importador/calcularCentroide";
import { PARTIDOS, ROLES } from "../../config";
import { ganadorCoalicion } from "./electoralHelpers";

// ── Helpers de color ─────────────────────────────────────────────────────────

const getPartidoColor = (clave) =>
  PARTIDOS.find((p) => p.clave === clave)?.color ?? "#94a3b8";

/** Determina el ganador de un resultado y retorna su color */
const colorGanador = (votos) => {
  const ganador = ganadorCoalicion(votos);
  if (!ganador) return "#334155";
  return getPartidoColor(ganador);
};

// ── Espiral dorada para separar casillas con mismo centroide ──────────────────
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5)); // ~137.5°
const BASE_RADIO = 0.00028; // ~31 m en latitud 24°N

/**
 * Aplica offset de espiral dorada al índice i dentro de un grupo.
 * i=0 queda en el centroide exacto; i>0 reciben offset creciente.
 */
const offsetEspiral = (coords, i) => {
  if (i === 0) return coords;
  const r = BASE_RADIO * Math.sqrt(i);
  const angle = i * GOLDEN_ANGLE;
  return {
    lat: coords.lat + r * Math.cos(angle),
    lng: coords.lng + r * Math.sin(angle),
  };
};

/** Color según % de participación (azul frío → verde cálido) */
const colorParticipacion = (pct) => {
  if (pct === null || pct === undefined) return "#334155";
  if (pct < 20) return "#1e3a5f";
  if (pct < 40) return "#1d4ed8";
  if (pct < 60) return "#0891b2";
  if (pct < 80) return "#059669";
  return "#16a34a";
};

/** Color de calor según densidad de votos totales */
const colorCalor = (total, maxTotal) => {
  if (!total || maxTotal === 0) return "#1e293b";
  const ratio = total / maxTotal;
  if (ratio < 0.2) return "#1e3a5f";
  if (ratio < 0.4) return "#1d4ed8";
  if (ratio < 0.6) return "#7c3aed";
  if (ratio < 0.8) return "#be185d";
  return "#dc2626";
};

// ── SVG de casilla ────────────────────────────────────────────────────────────

const casillaCircle = (color, capturada) => `
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="10" fill="${color}" stroke="rgba(255,255,255,0.6)" stroke-width="${capturada ? 2 : 1}"/>
    ${capturada ? '<circle cx="12" cy="12" r="5" fill="rgba(255,255,255,0.3)"/>' : ""}
    <circle cx="12" cy="12" r="3" fill="rgba(255,255,255,${capturada ? "0.9" : "0.3"})"/>
  </svg>
`;

// ── Componente ────────────────────────────────────────────────────────────────

const CasillaLayer = () => {
  const { mapInstance } = useMapStore();
  const {
    casillas,
    resultados,
    vistaElectoral,
    eleccionActiva,
    openModalCaptura,
    openModalNuevaCasilla,
  } = useElectoralStore();
  const { role } = useAuthStore();
  const { municipioFiltro, seccionFiltro, partidoFiltro } = useFiltrosStore();

  const marcadoresRef = useRef([]);
  const [tileVersion, setTileVersion] = useState(0);

  // Re-ejecutar el render de marcadores cuando la fuente cartográfica termine de cargar
  // (resuelve casillas con coords: null cuyas teselas no estaban listas en el primer render)
  useEffect(() => {
    if (!mapInstance) return;
    let timer = null;
    const handler = (e) => {
      if (e.isSourceLoaded && e.sourceId === "cartografia-electoral") {
        clearTimeout(timer);
        timer = setTimeout(() => setTileVersion((v) => v + 1), 400);
      }
    };
    mapInstance.on("sourcedata", handler);
    return () => {
      mapInstance.off("sourcedata", handler);
      clearTimeout(timer);
    };
  }, [mapInstance]);

  // Calcular maxTotal para el mapa de calor
  const maxTotal = Math.max(
    1,
    ...Object.values(resultados).map((r) => r.total_votos ?? 0),
  );

  // Redibujar marcadores cuando cambian casillas, resultados, vista o filtros
  useEffect(() => {
    if (!mapInstance) return;

    // Limpiar anteriores
    marcadoresRef.current.forEach((m) => m.remove());
    marcadoresRef.current = [];

    // ── Paso 1: filtrar y resolver coords ────────────────────────────────────
    const candidatos = [];

    casillas.forEach((casilla) => {
      const pasaMun =
        municipioFiltro === "TODOS" || casilla.id_municipio === municipioFiltro;
      const pasaSec = !seccionFiltro || casilla.seccion === seccionFiltro;
      const resultado = resultados[casilla.id];
      const ganador = resultado ? ganadorCoalicion(resultado.votos) : null;
      const pasaPartido =
        partidoFiltro === "TODOS" || ganador === partidoFiltro;

      if (!pasaMun || !pasaSec || !pasaPartido) return;

      // Resolver coordenadas — calculamos centroide al vuelo si son null
      let coords = casilla.coords;
      if (!coords) {
        coords = calcularCentroideSeccion(mapInstance, casilla.seccion);
      }
      if (!coords) return; // Sin coordenadas y sin tesela cargada → skip

      candidatos.push({ casilla, coords, resultado });
    });

    // ── Paso 2: agrupar por coord key, aplicar espiral dorada y crear marcadores
    /** @type {Map<string, Array<{casilla, coords, resultado}>>} */
    const grupos = new Map();
    candidatos.forEach((item) => {
      const key = `${item.coords.lat.toFixed(5)},${item.coords.lng.toFixed(5)}`;
      if (!grupos.has(key)) grupos.set(key, []);
      grupos.get(key).push(item);
    });

    grupos.forEach((grupo) => {
      grupo.forEach(({ casilla, coords, resultado }, i) => {
        const coordsFinales = offsetEspiral(coords, i);
        const capturada = !!resultado;

        // Determinar color según vista
        let color = "#334155";
        if (vistaElectoral === "ganador") {
          color = capturada ? colorGanador(resultado.votos) : "#334155";
        } else if (vistaElectoral === "participacion") {
          if (capturada && casilla.lista_nominal > 0) {
            const pct = (resultado.total_votos / casilla.lista_nominal) * 100;
            color = colorParticipacion(pct);
          }
        } else if (vistaElectoral === "calor") {
          color = capturada
            ? colorCalor(resultado.total_votos, maxTotal)
            : "#1e293b";
        }

        // Crear elemento
        const el = document.createElement("div");
        el.style.cssText =
          "width:24px; height:24px; cursor:pointer; user-select:none;";

        const inner = document.createElement("div");
        inner.style.cssText = `
          width:24px; height:24px;
          filter: drop-shadow(0 2px 4px rgba(0,0,0,0.5));
          transition: transform 0.15s ease;
          transform-origin: center;
        `;
        inner.innerHTML = casillaCircle(color, capturada);

        el.appendChild(inner);
        el.dataset.casillaId = casilla.id;

        // Hover
        el.addEventListener("mouseenter", () => {
          inner.style.transform = "scale(1.4)";
        });
        el.addEventListener("mouseleave", () => {
          inner.style.transform = "scale(1)";
        });

        // Click → abrir modal de captura
        el.addEventListener("click", (e) => {
          e.stopPropagation();
          openModalCaptura(casilla);
        });

        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([coordsFinales.lng, coordsFinales.lat])
          .addTo(mapInstance);

        marcadoresRef.current.push(marker);
      });
    });

    return () => {
      marcadoresRef.current.forEach((m) => m.remove());
      marcadoresRef.current = [];
    };
  }, [
    mapInstance,
    casillas,
    resultados,
    vistaElectoral,
    municipioFiltro,
    seccionFiltro,
    partidoFiltro,
    tileVersion,
  ]);

  // Clic derecho en el mapa → nueva casilla (solo admin/editor)
  useEffect(() => {
    if (!mapInstance || !eleccionActiva) return;
    const canEdit = role === ROLES.ADMIN || role === ROLES.EDITOR;
    if (!canEdit) return;

    const handler = (e) => openModalNuevaCasilla(e.lngLat);
    mapInstance.on("contextmenu", handler);
    return () => mapInstance.off("contextmenu", handler);
  }, [mapInstance, eleccionActiva, role]);

  return null;
};

export default CasillaLayer;
