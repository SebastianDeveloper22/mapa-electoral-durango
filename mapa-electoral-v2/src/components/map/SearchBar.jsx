import { useState, useRef, useEffect, useMemo } from "react";
import { useMapStore } from "../../store/mapStore";
import { useObrasStore } from "../../store/obrasStore";
import { MUNICIPIOS } from "../../config";

const TIPOS = [
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
  // { texto: string, coords?: {lat,lng}, capaLabel?: string }[]
  const [sugerencias, setSugerencias] = useState([]);
  const [showSug,    setShowSug]    = useState(false);
  const inputRef = useRef(null);

  const tipoConfig  = TIPOS.find((t) => t.value === tipo);
  const esMarcador  = tipo === "marcador";

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
    if (!query.trim()) {
      setSugerencias([]);
      return;
    }

    if (esMarcador) {
      // Buscar en marcadores cargados por nombre
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
  }, [query, tipo, municipio, mapInstance, todosMarcadores, esMarcador, tipoConfig]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Ejecutar búsqueda ───────────────────────────────────────────────────────
  const ejecutarBusqueda = (valor = query, coordsMarcador = null) => {
    setShowSug(false);
    if (!valor.trim()) return;

    // Navegar directamente al marcador seleccionado
    if (coordsMarcador?.lat && coordsMarcador?.lng) {
      mapInstance?.flyTo({
        center:   [coordsMarcador.lng, coordsMarcador.lat],
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
      className="absolute top-4 z-20 flex items-center gap-2"
      style={{ left: "50%", transform: "translateX(-50%)" }}
    >
      {/* Municipio — oculto cuando se busca por marcador */}
      {!esMarcador && (
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
          asegurarCapa(e.target.value);
        }}
        className="bg-[#1e293b] border border-[#334155] text-white text-xs rounded-lg px-3 py-2.5 outline-none focus:border-blue-500 cursor-pointer"
      >
        {TIPOS.map((t) => (
          <option key={t.value} value={t.value}>{t.label}</option>
        ))}
      </select>

      {/* Input con sugerencias */}
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => { if (!esMarcador) asegurarCapa(tipo); }}
          onKeyDown={(e) => {
            if (e.key === "Enter")  { setShowSug(false); ejecutarBusqueda(); }
            if (e.key === "Escape") setShowSug(false);
          }}
          placeholder={esMarcador ? "Nombre del marcador..." : "Ej: Centro..."}
          className="bg-[#1e293b] border border-[#334155] text-white text-xs rounded-lg px-3 py-2.5 w-48 outline-none focus:border-blue-500 placeholder:text-slate-500"
        />

        {/* Lista de sugerencias */}
        {showSug && sugerencias.length > 0 && (
          <div className="absolute top-full mt-1 left-0 bg-[#1e293b] border border-[#334155] rounded-lg shadow-xl overflow-hidden z-30 min-w-[220px]">
            {sugerencias.map((s, i) => {
              const regex = new RegExp(`(${escaparRegex(query)})`, "gi");
              return (
                <div
                  key={i}
                  onMouseDown={() => {
                    setQuery(s.texto);
                    ejecutarBusqueda(s.texto, s.coords);
                  }}
                  className="px-3 py-2 text-xs text-slate-200 hover:bg-[#334155] cursor-pointer flex items-center justify-between gap-3"
                >
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
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Botón buscar */}
      <button
        onClick={() => ejecutarBusqueda()}
        className="bg-blue-600 hover:bg-blue-500 text-white rounded-lg px-3 py-2.5 text-sm transition-colors cursor-pointer"
      >
        🔍
      </button>
    </div>
  );
};

export default SearchBar;
