/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useRef, useEffect } from "react";
import { useMapStore } from "../../store/mapStore";
import { MUNICIPIOS } from "../../config";

const TIPOS = [
  {
    value: "seccion",
    label: "Sección",
    sourceLayer: "SECCION",
    col: "SECCION",
    colMun: "MUNICIPIO",
  },
  {
    value: "colonia",
    label: "Colonia",
    sourceLayer: "COLONIA",
    col: "NOMBRE",
    colMun: "MUNICIPIO",
  },
  {
    value: "zona",
    label: "Zona",
    sourceLayer: "ZONAS HECHAS",
    col: "Zona",
    colMun: "MUNICIPIO",
  },
];

const escaparRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const SearchBar = () => {
  const { mapInstance, layersVisible, toggleLayer } = useMapStore();

  const [tipo, setTipo] = useState("seccion");
  const [municipio, setMunicipio] = useState("TODOS");
  const [query, setQuery] = useState("");
  const [sugerencias, setSugerencias] = useState([]);
  const [showSug, setShowSug] = useState(false);
  const inputRef = useRef(null);

  const tipoConfig = TIPOS.find((t) => t.value === tipo);

  // Asegura que la capa del tipo buscado esté activa
  const asegurarCapa = (tipoBusqueda) => {
    if (!layersVisible[tipoBusqueda]) toggleLayer(tipoBusqueda);
  };

  // Autocompletado en tiempo real
  useEffect(() => {
    if (!mapInstance || !query.trim()) {
      setSugerencias([]);
      return;
    }

    const val = query.trim().toUpperCase();
    const { sourceLayer, col, colMun } = tipoConfig;

    const features = mapInstance.querySourceFeatures("cartografia-electoral", {
      sourceLayer,
    });
    const set = new Set();

    features.forEach((f) => {
      if (!f.properties?.[col]) return;
      const munProp = String(f.properties[colMun] ?? "TODOS");
      if (municipio !== "TODOS" && munProp !== municipio) return;
      const texto = String(f.properties[col]).toUpperCase();
      if (texto.includes(val)) set.add(texto);
    });

    setSugerencias(Array.from(set).slice(0, 8));
    setShowSug(true);
  }, [query, tipo, municipio, mapInstance]);

  const ejecutarBusqueda = (valor = query) => {
    if (!mapInstance || !valor.trim()) return;
    asegurarCapa(tipo);
    setShowSug(false);

    const val = valor.trim().toUpperCase();
    const { sourceLayer, col, colMun } = tipoConfig;

    const features = mapInstance.querySourceFeatures("cartografia-electoral", {
      sourceLayer,
    });
    const resultados = features.filter((f) => {
      if (!f.properties?.[col]) return false;
      const matchNombre = String(f.properties[col]).toUpperCase() === val;
      const munProp = String(f.properties[colMun] ?? "TODOS");
      const matchMun = municipio === "TODOS" || munProp === municipio;
      return matchNombre && matchMun;
    });

    if (!resultados.length) {
      alert(
        "No se encontró la ubicación.\n\nRecuerda alejar el mapa primero para cargar los datos del municipio.",
      );
      return;
    }

    let minLng = 180,
      minLat = 90,
      maxLng = -180,
      maxLat = -90;
    resultados.forEach(({ geometry: g }) => {
      const polys =
        g.type === "Polygon"
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
      center: [(minLng + maxLng) / 2, (minLat + maxLat) / 2],
      zoom: 15,
      essential: true,
      duration: 2000,
    });
  };

  return (
    <div
      className="absolute top-4 z-20 flex items-center gap-2"
      style={{ left: "50%", transform: "translateX(-50%)" }}
    >
      {/* Municipio */}
      <select
        value={municipio}
        onChange={(e) => setMunicipio(e.target.value)}
        className="bg-[#1e293b] border border-[#334155] text-white text-xs rounded-lg px-3 py-2.5 outline-none focus:border-blue-500 cursor-pointer"
      >
        {MUNICIPIOS.map((m) => (
          <option key={m.value} value={m.value}>
            {m.label}
          </option>
        ))}
      </select>

      {/* Tipo */}
      <select
        value={tipo}
        onChange={(e) => {
          setTipo(e.target.value);
          asegurarCapa(e.target.value);
        }}
        className="bg-[#1e293b] border border-[#334155] text-white text-xs rounded-lg px-3 py-2.5 outline-none focus:border-blue-500 cursor-pointer"
      >
        {TIPOS.map((t) => (
          <option key={t.value} value={t.value}>
            {t.label}
          </option>
        ))}
      </select>

      {/* Input con autocompletado */}
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => asegurarCapa(tipo)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              setShowSug(false);
              ejecutarBusqueda();
            }
            if (e.key === "Escape") setShowSug(false);
          }}
          placeholder="Ej: Centro..."
          className="bg-[#1e293b] border border-[#334155] text-white text-xs rounded-lg px-3 py-2.5 w-44 outline-none focus:border-blue-500 placeholder:text-slate-500"
        />

        {/* Sugerencias */}
        {showSug && sugerencias.length > 0 && (
          <div className="absolute top-full mt-1 left-0 w-full bg-[#1e293b] border border-[#334155] rounded-lg shadow-xl overflow-hidden z-30">
            {sugerencias.map((s) => {
              const regex = new RegExp(
                `(${escaparRegex(query.toUpperCase())})`,
                "gi",
              );
              return (
                <div
                  key={s}
                  onMouseDown={() => {
                    setQuery(s);
                    ejecutarBusqueda(s);
                  }}
                  className="px-3 py-2 text-xs text-slate-200 hover:bg-[#334155] cursor-pointer"
                  dangerouslySetInnerHTML={{
                    __html: s.replace(
                      regex,
                      '<strong class="text-blue-400">$1</strong>',
                    ),
                  }}
                />
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
