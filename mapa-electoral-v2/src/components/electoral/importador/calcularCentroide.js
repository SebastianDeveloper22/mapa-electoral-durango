/**
 * calcularCentroide.js
 *
 * Dos estrategias para calcular el centroide de una sección:
 *
 * 1. calcularCentroideSeccion / calcularCentroidesLote
 *    Usa querySourceFeatures sobre las teselas YA cargadas en el viewport.
 *    Solo funciona si el mapa está mostrando esa zona al zoom correcto.
 *
 * 2. calcularCentroidesDesdeArchivos  ← estrategia principal
 *    Lee los archivos .pbf de /public/tiles/10/... directamente con fetch(),
 *    sin importar qué está mostrando el mapa. Determinista y completo.
 */

import { VectorTile } from "@mapbox/vector-tile";
import Pbf from "pbf";

// ── Helpers de coordenadas ────────────────────────────────────────────────────

/**
 * Normaliza un valor de sección para comparación:
 * '0001' → 1, '1' → 1, 1 → 1
 */
const normSeccion = (val) => parseInt(String(val).trim(), 10);

/**
 * Convierte coordenada X dentro de una tesela a longitud geográfica.
 * @param {number} px  — coordenada X en espacio de tesela (0 … extent-1)
 * @param {number} tileX — columna X de la tesela en el esquema Z/X/Y
 * @param {number} z   — nivel de zoom
 * @param {number} extent — tamaño interno de la tesela (normalmente 4096)
 */
const tileToLng = (px, tileX, z, extent = 4096) =>
  ((tileX + px / extent) / Math.pow(2, z)) * 360 - 180;

/**
 * Convierte coordenada Y dentro de una tesela a latitud geográfica.
 */
const tileToLat = (py, tileY, z, extent = 4096) => {
  const n = Math.PI - (2 * Math.PI * (tileY + py / extent)) / Math.pow(2, z);
  return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
};

// ── Estrategia 1: viewport (fallback) ────────────────────────────────────────

/**
 * Calcula el centroide de una sección usando las teselas del mapa.
 * Solo devuelve resultado si el tile está actualmente cargado en el viewport.
 * @param {Object} mapInstance — instancia de MapLibre
 * @param {string|number} seccion
 * @returns {{ lat: number, lng: number } | null}
 */
export const calcularCentroideSeccion = (mapInstance, seccion) => {
  if (!mapInstance || seccion === undefined || seccion === null) return null;

  const seccionNorm = normSeccion(seccion);
  if (isNaN(seccionNorm)) return null;

  try {
    const allFeatures = mapInstance.querySourceFeatures(
      "cartografia-electoral",
      { sourceLayer: "SECCION" },
    );

    const features = allFeatures.filter((f) => {
      const fSec = f.properties?.SECCION;
      if (fSec === undefined || fSec === null) return false;
      return normSeccion(fSec) === seccionNorm;
    });

    if (!features.length) return null;

    let sumLng = 0,
      sumLat = 0,
      count = 0;

    features.forEach(({ geometry: g }) => {
      const anillos =
        g.type === "Polygon"
          ? g.coordinates
          : g.type === "MultiPolygon"
            ? g.coordinates.flatMap((poly) => poly)
            : [];

      anillos.forEach((anillo) => {
        anillo.forEach(([lng, lat]) => {
          sumLng += lng;
          sumLat += lat;
          count++;
        });
      });
    });

    if (count === 0) return null;
    return { lat: sumLat / count, lng: sumLng / count };
  } catch {
    return null;
  }
};

/**
 * Calcula centroides para un array de secciones únicas usando el viewport.
 */
export const calcularCentroidesLote = (mapInstance, secciones) => {
  const mapa = {};
  secciones.forEach((sec) => {
    const c = calcularCentroideSeccion(mapInstance, sec);
    if (c) mapa[sec] = c;
  });
  return mapa;
};

// ── Estrategia 2: lectura directa de archivos .pbf ────────────────────────────

/**
 * Rango de teselas de Durango en zoom 10.
 * Calculado a partir de los bounds [-107.5, 22.5] → [-103.0, 26.5].
 */
const ZOOM = 10;
const TILE_X_MIN = 206;
const TILE_X_MAX = 220;
const TILE_Y_MIN = 432;
const TILE_Y_MAX = 446;

/**
 * Lee TODOS los archivos .pbf del zoom 10 y calcula centroides de secciones.
 *
 * No depende del viewport del mapa — usa fetch() directo a /tiles/10/x/y.pbf.
 * Itera los ~136 tiles de Durango y acumula vértices por número de sección.
 *
 * @param {string[]} secciones   — array de valores de sección tal como están en Firestore
 * @param {Function} [onProgress]  — callback(porcentaje: 0-100)
 * @returns {Promise<{ [seccion: string]: { lat: number, lng: number } }>}
 */
export const calcularCentroidesDesdeArchivos = async (
  secciones,
  onProgress,
) => {
  // Mapa: número normalizado → lista de claves originales
  // (una sección '0001' y '1' apuntan al mismo número 1)
  const normToOrig = new Map();
  secciones.forEach((sec) => {
    const n = normSeccion(sec);
    if (!isNaN(n)) {
      if (!normToOrig.has(n)) normToOrig.set(n, []);
      normToOrig.get(n).push(sec);
    }
  });

  // Acumuladores: normSeccion → { sumLng, sumLat, count }
  const acum = {};

  // Generar lista de tiles a procesar
  const tiles = [];
  for (let x = TILE_X_MIN; x <= TILE_X_MAX; x++) {
    for (let y = TILE_Y_MIN; y <= TILE_Y_MAX; y++) {
      tiles.push({ x, y });
    }
  }

  for (let i = 0; i < tiles.length; i++) {
    const { x, y } = tiles[i];

    try {
      const resp = await fetch(`/tiles/${ZOOM}/${x}/${y}.pbf`);
      if (!resp.ok) {
        // Tile no existe para esta posición — normal en zonas sin datos
        onProgress?.(Math.round(((i + 1) / tiles.length) * 100));
        continue;
      }

      const buffer = await resp.arrayBuffer();
      const tile = new VectorTile(new Pbf(buffer));
      const layer = tile.layers?.["SECCION"];

      if (layer) {
        const extent = layer.extent || 4096;

        for (let j = 0; j < layer.length; j++) {
          const feat = layer.feature(j);
          const secRaw = feat.properties?.SECCION;
          if (secRaw == null) continue;

          const secNorm = normSeccion(secRaw);
          if (isNaN(secNorm) || !normToOrig.has(secNorm)) continue;

          // Acumular todos los vértices del polígono
          const rings = feat.loadGeometry(); // array de rings con puntos {x, y}
          if (!acum[secNorm])
            acum[secNorm] = { sumLng: 0, sumLat: 0, count: 0 };

          for (const ring of rings) {
            for (const pt of ring) {
              acum[secNorm].sumLng += tileToLng(pt.x, x, ZOOM, extent);
              acum[secNorm].sumLat += tileToLat(pt.y, y, ZOOM, extent);
              acum[secNorm].count++;
            }
          }
        }
      }
    } catch {
      // Tile corrupto o error de red — continuar con los demás
    }

    onProgress?.(Math.round(((i + 1) / tiles.length) * 100));
  }

  // Construir resultado: clave original → { lat, lng }
  const resultado = {};
  for (const [secNormStr, data] of Object.entries(acum)) {
    if (data.count === 0) continue;
    const centroide = {
      lat: data.sumLat / data.count,
      lng: data.sumLng / data.count,
    };
    const origKeys = normToOrig.get(parseInt(secNormStr)) ?? [];
    origKeys.forEach((k) => {
      resultado[k] = centroide;
    });
  }

  return resultado;
};
