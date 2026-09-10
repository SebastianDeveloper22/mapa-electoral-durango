/* eslint-disable react-hooks/exhaustive-deps */
import { useEffect, useRef } from "react";
import { useMapStore } from "../../store/mapStore";
import { CAPAS, ANIOS, DISTRITOS_LOCALES, COLORES_MARCADOR } from "../../config";

const PIN_COLORS = {
  2023: "#f59e0b",
  2024: "#3b82f6",
  2025: "#10b981",
  2026: "#a855f7",
};

const CAPA_LABELS = {
  municipio: "Municipios",
  "distrito-fed": "Distrito Federal",
  "distrito-local": "Distrito Local",
  zona: "Zonas",
  seccion: "Secciones",
  colonia: "Colonias",
  manzana: "Manzanas",
};

const MARCADORES_EXTRA = [
  { key: "rural",   label: "Rural",          conDL: true },
  { key: "top100",  label: "Top 100 Urbano", conDL: true },
  { key: "general", label: "General",        conDL: false },
];

const LayerPanel = () => {
  const {
    layerMenuOpen,
    toggleLayerMenu,
    closeLayerMenu,
    layersVisible,
    toggleLayer,
    labelsVisible,
    toggleLabels,
    aniosVisibles,
    toggleAnio,
    marcadoresVisibles,
    toggleMarcador,
    filtrosDL,
    toggleDL,
  } = useMapStore();

  const panelRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        closeLayerMenu();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={panelRef} className="absolute top-4 left-4 z-20">
      {/* Botón FAB */}
      <button
        onClick={toggleLayerMenu}
        className="flex items-center gap-2 bg-[#1e293b] border border-[#334155] text-white text-sm font-medium px-4 py-2.5 rounded-xl shadow-lg hover:bg-[#334155] transition-colors cursor-pointer"
      >
        <span>🗺️</span>
        <span>Capas</span>
      </button>

      {/* Panel desplegable */}
      {layerMenuOpen && (
        <div className="mt-2 w-60 bg-[#1e293b] border border-[#334155] rounded-xl shadow-2xl p-4 flex flex-col gap-1 max-h-[80vh] overflow-y-auto">

          {/* ── Cartografía Electoral ── */}
          <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">
            Cartografía Electoral
          </h3>

          {CAPAS.map(({ id, color }) => (
            <label
              key={id}
              className="flex items-center gap-2.5 py-1 cursor-pointer hover:text-white transition-colors text-sm text-slate-200"
            >
              <input
                type="checkbox"
                checked={layersVisible[id] || false}
                onChange={() => toggleLayer(id)}
                className="w-3.5 h-3.5 cursor-pointer shrink-0"
                style={{ accentColor: color }}
              />
              <span
                className="inline-block shrink-0"
                style={{
                  width: "18px",
                  height: "3px",
                  backgroundColor: color,
                  borderRadius: "2px",
                  opacity: layersVisible[id] ? 1 : 0.35,
                  boxShadow: layersVisible[id] ? `0 0 4px ${color}80` : "none",
                }}
              />
              {CAPA_LABELS[id]}
            </label>
          ))}

          <hr className="border-[#334155] my-2" />

          {/* ── Marcadores PP ── */}
          <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-1">
          Presupuesto Participativo
          </h4>

          {ANIOS.map((anio) => (
            <label
              key={anio}
              className="flex items-center gap-2.5 py-1 cursor-pointer hover:text-blue-400 transition-colors text-sm text-slate-200"
            >
              <input
                type="checkbox"
                checked={aniosVisibles[anio] || false}
                onChange={() => toggleAnio(anio)}
                className="w-3.5 h-3.5 cursor-pointer"
                style={{ accentColor: PIN_COLORS[anio] }}
              />
              <span
                className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: PIN_COLORS[anio] }}
              />
              Obras {anio}
            </label>
          ))}

          <hr className="border-[#334155] my-2" />

          {/* ── Marcadores Adicionales ── */}
          <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-1">
            Marcadores Adicionales
          </h4>

          {MARCADORES_EXTRA.map(({ key, label, conDL }) => {
            const color = COLORES_MARCADOR[key];
            const activo = marcadoresVisibles[key] !== false;
            return (
              <div key={key} className="flex flex-col">
                {/* Toggle de visibilidad de la capa */}
                <label className="flex items-center gap-2.5 py-1 cursor-pointer hover:text-white transition-colors text-sm text-slate-200">
                  <input
                    type="checkbox"
                    checked={activo}
                    onChange={() => toggleMarcador(key)}
                    className="w-3.5 h-3.5 cursor-pointer shrink-0"
                    style={{ accentColor: color }}
                  />
                  <span
                    className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: color, opacity: activo ? 1 : 0.35 }}
                  />
                  {label}
                </label>

                {/* Sub-filtros DL solo para rural y top100 */}
                {conDL && activo && (
                  <div className="ml-6 mt-0.5 mb-1 flex flex-col gap-0.5">
                    <span className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">
                      Filtrar por Distrito
                    </span>
                    {DISTRITOS_LOCALES.map((dl) => (
                      <label
                        key={dl}
                        className="flex items-center gap-2 cursor-pointer text-xs text-slate-300 hover:text-white transition-colors py-0.5"
                      >
                        <input
                          type="checkbox"
                          checked={filtrosDL[key]?.[dl] !== false}
                          onChange={() => toggleDL(key, dl)}
                          className="w-3 h-3 cursor-pointer"
                          style={{ accentColor: color }}
                        />
                        {dl}
                      </label>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          <hr className="border-[#334155] my-2" />

          {/* ── Etiquetas ── */}
          <label className="flex items-center gap-2.5 py-1 cursor-pointer text-sm font-semibold text-blue-400">
            <input
              type="checkbox"
              checked={labelsVisible}
              onChange={toggleLabels}
              className="accent-blue-500 w-3.5 h-3.5 cursor-pointer"
            />
            Mostrar Etiquetas
          </label>
        </div>
      )}
    </div>
  );
};

export default LayerPanel;
