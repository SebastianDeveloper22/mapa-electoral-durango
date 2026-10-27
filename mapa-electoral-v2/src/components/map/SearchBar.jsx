import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import maplibregl from "maplibre-gl";
import { useMapStore } from "../../store/mapStore";
import { useObrasStore } from "../../store/obrasStore";
import { MUNICIPIOS } from "../../config";

const TIPOS = [
  { value: "direccion", label: "Dirección" },
  { value: "marcador",  label: "Marcador" },
  { value: "seccion",   label: "Sección",  sourceLayer: "SECCION",      col: "SECCION", colMun: "MUNICIPIO" },
  { value: "colonia",   label: "Colonia",  sourceLayer: "COLONIA",      col: "NOMBRE",  colMun: "MUNICIPIO" },
  { value: "zona",      label: "Zona",     sourceLayer: "ZONAS HECHAS", col: "Zona",    colMun: "MUNICIPIO" },
];

const CAPA_LABELS = {
  pp:         "PP",
  rural:      "Rural",
  top100:     "Top 100",
  general:    "Laguna",
  capital:    "Capital",
  municipios: "Municipios",
  guardianes: "Guardianes",
};

const GOOGLE_API_KEY = import.meta.env.VITE_FIREBASE_API_KEY;

// ── Google Places Autocomplete (New) ────────────────────────────────────────

const buscarPlaces = async (input) => {
  const res = await fetch("https://places.googleapis.com/v1/places:autocomplete", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": GOOGLE_API_KEY,
    },
    body: JSON.stringify({
      input,
      locationBias: {
        circle: {
          center: { latitude: 24.0277, longitude: -104.6531 },
          radius: 50000,
        },
      },
      languageCode: "es",
    }),
  });
  const data = await res.json();
  if (data.error) {
    console.error("Google Places error:", data.error.message, data.error);
    return [];
  }
  return (data.suggestions ?? [])
    .filter((s) => s.placePrediction)
    .map((s) => ({
      texto: s.placePrediction.text?.text ?? "",
      textoSecundario: s.placePrediction.structuredFormat?.secondaryText?.text ?? "",
      placeId: s.placePrediction.placeId,
    }));
};

const obtenerDetallesPlace = async (placeId) => {
  const res = await fetch(
    `https://places.googleapis.com/v1/places/${placeId}`,
    {
      headers: {
        "X-Goog-Api-Key": GOOGLE_API_KEY,
        "X-Goog-FieldMask": "location,displayName,formattedAddress",
      },
    },
  );
  return await res.json();
};

const escaparRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const normalizar   = (s) =>
  (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

const SearchBar = () => {
  const { mapInstance, layersVisible, toggleLayer } = useMapStore();
  const { obras, extras } = useObrasStore();

  const [tipo,       setTipo]       = useState("seccion");
  const [municipio,  setMunicipio]  = useState("TODOS");
  const [query,      setQuery]      = useState("");
  const [sugerencias, setSugerencias] = useState([]);
  const [showSug,    setShowSug]    = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [buscandoPlace, setBuscandoPlace] = useState(false);
  const inputRef = useRef(null);
  const barRef = useRef(null);
  const debounceRef = useRef(null);
  const pinTempRef = useRef(null);

  // ── Pin temporal de búsqueda ──────────────────────────────────────────────
  const quitarPinTemp = useCallback(() => {
    pinTempRef.current?.remove();
    pinTempRef.current = null;
  }, []);

  const colocarPinTemp = useCallback((lng, lat, label, direccion = "") => {
    quitarPinTemp();
    if (!mapInstance) return;

    const esc = (s) => String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const textoSeguro = esc(label);
    const dirSegura = esc(direccion);

    // Crear elemento del pin
    const el = document.createElement("div");
    el.className = "pin-busqueda-temp";
    el.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="36" height="46" viewBox="0 0 36 46">
        <ellipse cx="18" cy="44" rx="7" ry="2.5" fill="rgba(0,0,0,0.3)"/>
        <path d="M18 0C11 0 5 6 5 13c0 10 13 29 13 29s13-19 13-29C31 6 25 0 18 0z" fill="#e53e3e"/>
        <path d="M18 1.5C11.5 1.5 6.5 6.8 6.5 13c0 9.3 11.5 27 11.5 27S29.5 22.3 29.5 13C29.5 6.8 24.5 1.5 18 1.5z"
          fill="none" stroke="rgba(255,255,255,0.4)" stroke-width="1.5"/>
        <circle cx="18" cy="13" r="5.5" fill="white" opacity="0.95"/>
        <circle cx="18" cy="13" r="2.5" fill="#e53e3e"/>
      </svg>`;
    el.style.cssText = "cursor:pointer;filter:drop-shadow(0 3px 6px rgba(0,0,0,0.4));transition:transform 0.15s;transform-origin:bottom center;";
    el.addEventListener("mouseenter", () => { el.style.transform = "scale(1.2)"; });
    el.addEventListener("mouseleave", () => { el.style.transform = "scale(1)"; });

    const popupHTML = `
      <div style="padding:10px 8px;min-width:180px;">
        <div style="font-size:15px;color:#f1f5f9;font-weight:700;line-height:1.3;margin-bottom:6px;">${textoSeguro}</div>
        ${dirSegura ? `<div style="font-size:12px;color:#cbd5e1;line-height:1.4;margin-bottom:6px;border-left:3px solid #e53e3e;padding-left:8px;">${dirSegura}</div>` : ""}
        <div style="font-size:10px;color:#64748b;font-family:monospace;letter-spacing:0.3px;">${lat.toFixed(6)}, ${lng.toFixed(6)}</div>
      </div>`;

    const popup = new maplibregl.Popup({ offset: 28, closeButton: true, maxWidth: "260px" })
      .setHTML(popupHTML);

    const marker = new maplibregl.Marker({ element: el, anchor: "bottom" })
      .setLngLat([lng, lat])
      .setPopup(popup)
      .addTo(mapInstance);

    marker.togglePopup();
    pinTempRef.current = marker;

    // Quitar pin al cerrar el popup
    popup.on("close", () => {
      if (pinTempRef.current === marker) quitarPinTemp();
    });
  }, [mapInstance, quitarPinTemp]);

  // Cerrar barra en mobile al hacer click fuera
  useEffect(() => {
    const handler = (e) => {
      if (mobileOpen && barRef.current && !barRef.current.contains(e.target)) {
        setMobileOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [mobileOpen]);

  const tipoConfig   = TIPOS.find((t) => t.value === tipo);
  const esMarcador   = tipo === "marcador";
  const esDireccion  = tipo === "direccion";

  // Lista combinada de todos los marcadores ya cargados por PinLayer
  const todosMarcadores = useMemo(() => [
    ...obras.map((o) => ({ ...o, capa: "pp" })),
    ...(extras ? Object.values(extras).flat() : []),
  ], [obras, extras]);

  // Activa la capa cartográfica necesaria (irrelevante para marcadores)
  const asegurarCapa = (tipoBusqueda) => {
    if (tipoBusqueda === "marcador") return;
    if (!layersVisible[tipoBusqueda]) toggleLayer(tipoBusqueda);
  };

  // ── Autocompletado en tiempo real ───────────────────────────────────────────
  useEffect(() => {
    // Limpiar debounce anterior
    if (debounceRef.current) { clearTimeout(debounceRef.current); debounceRef.current = null; }

    if (!query.trim()) {
      setSugerencias([]);
      return;
    }

    // ── Dirección (Google Places) ──
    if (esDireccion) {
      if (query.trim().length < 3) { setSugerencias([]); return; }
      debounceRef.current = setTimeout(async () => {
        try {
          const results = await buscarPlaces(query);
          setSugerencias(results);
          setShowSug(true);
        } catch (err) {
          console.error("Places API error:", err);
          setSugerencias([]);
        }
      }, 300);
      return;
    }

    // ── Marcadores ──
    if (esMarcador) {
      const q = normalizar(query);
      const matches = todosMarcadores
        .filter((m) => normalizar(m.nombre).includes(q))
        .slice(0, 8)
        .map((m) => ({
          texto:     m.nombre || "(sin nombre)",
          coords:    m.coords,
          capaLabel: CAPA_LABELS[m.capa] ?? m.capa,
        }));
      setSugerencias(matches);
      setShowSug(true);
      return;
    }

    // ── Cartografía electoral ──
    if (!mapInstance) { setSugerencias([]); return; }

    const val = query.trim().toUpperCase();
    const { sourceLayer, col, colMun } = tipoConfig;
    const features = mapInstance.querySourceFeatures("cartografia-electoral", { sourceLayer });
    const set = new Set();

    features.forEach((f) => {
      if (!f.properties?.[col]) return;
      const munProp = String(f.properties[colMun] ?? "TODOS");
      if (municipio !== "TODOS" && munProp !== municipio) return;
      const texto = String(f.properties[col]).toUpperCase();
      if (texto.includes(val)) set.add(texto);
    });

    setSugerencias(Array.from(set).slice(0, 8).map((t) => ({ texto: t })));
    setShowSug(true);
  }, [query, tipo, municipio, mapInstance, todosMarcadores, esMarcador, esDireccion, tipoConfig]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Ejecutar búsqueda ───────────────────────────────────────────────────────
  const ejecutarBusqueda = async (valor = query, coordsSugerencia = null, placeId = null) => {
    setShowSug(false);
    if (!valor.trim()) return;

    // ── Dirección: resolver placeId → coordenadas + nombre ──
    if (placeId) {
      setBuscandoPlace(true);
      try {
        const place = await obtenerDetallesPlace(placeId);
        if (place?.location) {
          const nombre = place.displayName?.text || valor;
          const direccion = place.formattedAddress || "";
          colocarPinTemp(place.location.longitude, place.location.latitude, nombre, direccion);
          mapInstance?.flyTo({
            center:   [place.location.longitude, place.location.latitude],
            zoom:     18,
            essential: true,
            duration: 1500,
          });
        }
      } catch (err) {
        console.error("Error obteniendo coordenadas:", err);
        alert("No se pudieron obtener las coordenadas de esta dirección.");
      } finally {
        setBuscandoPlace(false);
      }
      return;
    }

    // ── Dirección: Enter sin seleccionar sugerencia → buscar primer resultado ──
    if (esDireccion) {
      if (valor.trim().length < 3) return;
      setBuscandoPlace(true);
      try {
        const results = await buscarPlaces(valor);
        if (results.length && results[0].placeId) {
          const place = await obtenerDetallesPlace(results[0].placeId);
          if (place?.location) {
            const nombre = place.displayName?.text || valor;
            const direccion = place.formattedAddress || "";
            colocarPinTemp(place.location.longitude, place.location.latitude, nombre, direccion);
            mapInstance?.flyTo({
              center:   [place.location.longitude, place.location.latitude],
              zoom:     18,
              essential: true,
              duration: 1500,
            });
          }
        } else {
          alert("No se encontró la dirección.");
        }
      } catch (err) {
        console.error("Places error:", err);
        alert("Error al buscar la dirección.");
      } finally {
        setBuscandoPlace(false);
      }
      return;
    }

    // Navegar directamente al marcador seleccionado
    if (coordsSugerencia?.lat && coordsSugerencia?.lng) {
      mapInstance?.flyTo({
        center:   [coordsSugerencia.lng, coordsSugerencia.lat],
        zoom:     16,
        essential: true,
        duration: 1500,
      });
      return;
    }

    // Enter sin seleccionar sugerencia → primer resultado
    if (esMarcador) {
      const q      = normalizar(valor);
      const primer = todosMarcadores.find((m) => normalizar(m.nombre).includes(q));
      if (primer?.coords) {
        mapInstance?.flyTo({
          center:   [primer.coords.lng, primer.coords.lat],
          zoom:     16,
          essential: true,
          duration: 1500,
        });
      } else {
        alert("No se encontró ningún marcador con ese nombre.");
      }
      return;
    }

    // Búsqueda de cartografía electoral
    if (!mapInstance) return;
    asegurarCapa(tipo);

    const val = valor.trim().toUpperCase();
    const { sourceLayer, col, colMun } = tipoConfig;
    const features  = mapInstance.querySourceFeatures("cartografia-electoral", { sourceLayer });
    const resultados = features.filter((f) => {
      if (!f.properties?.[col]) return false;
      const matchNombre = String(f.properties[col]).toUpperCase() === val;
      const munProp     = String(f.properties[colMun] ?? "TODOS");
      const matchMun    = municipio === "TODOS" || munProp === municipio;
      return matchNombre && matchMun;
    });

    if (!resultados.length) {
      alert("No se encontró la ubicación.\n\nRecuerda alejar el mapa primero para cargar los datos del municipio.");
      return;
    }

    let minLng = 180, minLat = 90, maxLng = -180, maxLat = -90;
    resultados.forEach(({ geometry: g }) => {
      const polys = g.type === "Polygon"
        ? [g.coordinates[0]]
        : g.coordinates.map((p) => p[0]);
      polys.forEach((ring) =>
        ring.forEach(([lng, lat]) => {
          if (lng < minLng) minLng = lng;
          if (lat < minLat) minLat = lat;
          if (lng > maxLng) maxLng = lng;
          if (lat > maxLat) maxLat = lat;
        }),
      );
    });

    mapInstance.flyTo({
      center:   [(minLng + maxLng) / 2, (minLat + maxLat) / 2],
      zoom:     15,
      essential: true,
      duration: 2000,
    });
  };

  return (
    <div
      ref={barRef}
      className="absolute top-4 z-20"
      style={{ left: "50%", transform: "translateX(-50%)" }}
    >
      {/* Botón toggle en mobile */}
      <button
        onClick={() => setMobileOpen((v) => !v)}
        className="md:hidden flex items-center gap-1.5 bg-[#1e293b] border border-[#334155] text-white text-sm font-medium px-3 py-2.5 rounded-xl shadow-lg hover:bg-[#334155] transition-colors cursor-pointer"
      >
        🔍 <span>Buscar</span>
      </button>

      {/* Contenedor de controles — visible en desktop, toggle en mobile */}
      <div className={`${mobileOpen ? "flex" : "hidden"} md:flex flex-col md:flex-row items-stretch md:items-center gap-2 mt-2 md:mt-0 bg-[#0f172a]/95 md:bg-transparent p-3 md:p-0 rounded-xl md:rounded-none border border-[#334155] md:border-0 shadow-xl md:shadow-none min-w-[260px] md:min-w-0`}>
        {/* Municipio — oculto cuando se busca por marcador o dirección */}
        {!esMarcador && !esDireccion && (
          <select
            value={municipio}
            onChange={(e) => setMunicipio(e.target.value)}
            className="bg-[#1e293b] border border-[#334155] text-white text-xs rounded-lg px-3 py-2.5 outline-none focus:border-blue-500 cursor-pointer"
          >
            {MUNICIPIOS.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        )}

        {/* Tipo de búsqueda */}
        <select
          value={tipo}
          onChange={(e) => {
            setTipo(e.target.value);
            setQuery("");
            setSugerencias([]);
            quitarPinTemp();
            asegurarCapa(e.target.value);
          }}
          className="bg-[#1e293b] border border-[#334155] text-white text-xs rounded-lg px-3 py-2.5 outline-none focus:border-blue-500 cursor-pointer"
        >
          {TIPOS.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>

        {/* Input con sugerencias */}
        <div className="relative flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => { if (!esMarcador && !esDireccion) asegurarCapa(tipo); }}
            onKeyDown={(e) => {
              if (e.key === "Enter")  { setShowSug(false); ejecutarBusqueda(); }
              if (e.key === "Escape") setShowSug(false);
            }}
            placeholder={esDireccion ? "Calle, número, colonia..." : esMarcador ? "Nombre del marcador..." : "Ej: Centro..."}
            className="bg-[#1e293b] border border-[#334155] text-white text-xs rounded-lg px-3 py-2.5 w-full md:w-48 outline-none focus:border-blue-500 placeholder:text-slate-500 flex-1"
          />

          {/* Botón buscar */}
          <button
            onClick={() => ejecutarBusqueda()}
            disabled={buscandoPlace}
            className="bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white rounded-lg px-3 py-2.5 text-sm transition-colors cursor-pointer shrink-0"
          >
            {buscandoPlace ? "⏳" : "🔍"}
          </button>

          {/* Lista de sugerencias */}
          {showSug && sugerencias.length > 0 && (
            <div className="absolute top-full mt-1 left-0 right-0 md:right-auto bg-[#1e293b] border border-[#334155] rounded-lg shadow-xl overflow-hidden z-30 md:min-w-[220px]">
              {sugerencias.map((s, i) => {
                const regex = new RegExp(`(${escaparRegex(query)})`, "gi");
                return (
                  <div
                    key={i}
                    onMouseDown={() => {
                      setQuery(s.texto);
                      ejecutarBusqueda(s.texto, s.coords, s.placeId);
                      setMobileOpen(false);
                    }}
                    className="px-3 py-2.5 text-xs text-slate-200 hover:bg-[#334155] cursor-pointer flex flex-col gap-0.5"
                  >
                    <span className="flex items-center justify-between gap-3">
                      <span
                        dangerouslySetInnerHTML={{
                          __html: s.texto.replace(
                            regex,
                            '<strong class="text-blue-400">$1</strong>',
                          ),
                        }}
                      />
                      {s.capaLabel && (
                        <span className="text-[10px] text-slate-400 shrink-0 bg-[#0f172a] px-1.5 py-0.5 rounded">
                          {s.capaLabel}
                        </span>
                      )}
                    </span>
                    {s.textoSecundario && (
                      <span className="text-[10px] text-slate-500 truncate">
                        {s.textoSecundario}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SearchBar;
