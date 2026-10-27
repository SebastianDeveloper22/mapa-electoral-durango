import { useEffect, useRef } from "react";
import { useMapStore } from "../../store/mapStore";
import { useAuthStore } from "../../store/authStore";
import { useColeccionesStore } from "../../store/coleccionesStore";
import { CAPAS, ANIOS, DISTRITOS_LOCALES, COLORES_MARCADOR, REDES_GUARDIANES, ROLES } from "../../config";

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
  { key: "rural",      label: "Rural",                   conDL: true,  conSelec: false, conVisitado: true,  conAtendido: false, conRed: false },
  { key: "top100",     label: "Top 100 Urbano",          conDL: true,  conSelec: false, conVisitado: true,  conAtendido: false, conRed: false },
  { key: "general",    label: "Espectaculares Laguna",   conDL: false, conSelec: true,  conVisitado: false, conAtendido: false, conRed: false },
  { key: "capital",    label: "Espectaculares Capital",  conDL: false, conSelec: true,  conVisitado: false, conAtendido: false, conRed: false },
  { key: "municipios", label: "Espectaculares Municipios", conDL: false, conSelec: true, conVisitado: false, conAtendido: false, conRed: false },
  { key: "guardianes", label: "Guardianes del Camino",   conDL: true,  conSelec: false, conVisitado: false, conAtendido: true,  conRed: true  },
];

const ESPECTACULARES_KEYS = new Set(["general", "capital", "municipios"]);

const LayerPanel = () => {
  const { role } = useAuthStore();
  const isPresidente = role === ROLES.PRESIDENTE;
  const { coleccionesConfig } = useColeccionesStore();
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
    filtroSeleccionado,
    toggleFiltroSeleccionado,
    filtroVisitado,
    toggleFiltroVisitado,
    filtroAtendido,
    toggleFiltroAtendido,
    filtroRed,
    setFiltroRed,
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
  }, [closeLayerMenu]);

  return (
    <div ref={panelRef} className="absolute top-4 left-2 md:left-4 z-20">
      {/* Botón FAB */}
      <button
        onClick={toggleLayerMenu}
        className="flex items-center gap-2 bg-[#1e293b] border border-[#334155] text-white text-sm font-medium px-3 md:px-4 py-2.5 rounded-xl shadow-lg hover:bg-[#334155] transition-colors cursor-pointer"
      >
        <span>🗺️</span>
        <span className="hidden sm:inline">Capas</span>
      </button>

      {/* Panel desplegable */}
      {layerMenuOpen && (
        <div className="mt-2 w-[calc(100vw-1rem)] sm:w-60 bg-[#1e293b] border border-[#334155] rounded-xl shadow-2xl p-3 md:p-4 flex flex-col gap-1 max-h-[75vh] md:max-h-[80vh] overflow-y-auto">

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

          {MARCADORES_EXTRA.filter((m) => !(isPresidente && ESPECTACULARES_KEYS.has(m.key))).map(({ key, label, conDL, conSelec, conVisitado, conAtendido, conRed }) => {
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
                    {(key === "guardianes" ? DISTRITOS_LOCALES.slice(0, 6) : DISTRITOS_LOCALES).map((dl) => (
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

                {/* Filtro "Solo seleccionados" para capas Espectaculares */}
                {conSelec && activo && (
                  <div className="ml-6 mt-0.5 mb-1">
                    <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300 hover:text-white transition-colors py-0.5">
                      <input
                        type="checkbox"
                        checked={filtroSeleccionado[key] === true}
                        onChange={() => toggleFiltroSeleccionado(key)}
                        className="w-3 h-3 cursor-pointer"
                        style={{ accentColor: color }}
                      />
                      Solo seleccionados
                    </label>
                  </div>
                )}

                {/* Filtro "Solo visitados" para Rural y Top 100 */}
                {conVisitado && activo && (
                  <div className="ml-6 mt-0.5 mb-1">
                    <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300 hover:text-white transition-colors py-0.5">
                      <input
                        type="checkbox"
                        checked={filtroVisitado[key] === true}
                        onChange={() => toggleFiltroVisitado(key)}
                        className="w-3 h-3 cursor-pointer"
                        style={{ accentColor: color }}
                      />
                      Solo visitados
                    </label>
                  </div>
                )}

                {/* Filtro "Solo atendidos" para Guardianes */}
                {conAtendido && activo && (
                  <div className="ml-6 mt-0.5 mb-1">
                    <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300 hover:text-white transition-colors py-0.5">
                      <input
                        type="checkbox"
                        checked={filtroAtendido[key] === true}
                        onChange={() => toggleFiltroAtendido(key)}
                        className="w-3 h-3 cursor-pointer"
                        style={{ accentColor: color }}
                      />
                      Solo atendidos
                    </label>
                  </div>
                )}

                {/* Filtro por Red — Guardianes */}
                {conRed && activo && (
                  <div className="ml-6 mt-0.5 mb-2">
                    <span className="text-[10px] uppercase tracking-wider text-slate-500 block mb-1">
                      Filtrar por Red
                    </span>
                    <select
                      value={filtroRed[key] || ""}
                      onChange={(e) => setFiltroRed(key, e.target.value)}
                      className="w-full bg-[#0f172a] border border-[#334155] text-slate-200 text-xs rounded-lg px-2 py-1.5 outline-none focus:border-slate-400 cursor-pointer"
                    >
                      <option value="">Todas las Redes</option>
                      {REDES_GUARDIANES.map((r) => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            );
          })}

          {/* ── Capas Personalizadas (dinámicas) ── */}
          {coleccionesConfig.filter((c) => !(isPresidente && c.ocultarPresidente)).length > 0 && (
            <>
              <hr className="border-[#334155] my-2" />
              <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-1">
                Capas Personalizadas
              </h4>

              {coleccionesConfig
                .filter((c) => !(isPresidente && c.ocultarPresidente))
                .map((cfg) => {
                  const { key, label: lbl, color, campos = [], dlMax = 15 } = cfg;
                  const activo   = marcadoresVisibles[key] !== false;
                  const conDL    = campos.includes("distritoLocal");
                  const conVisit = campos.includes("visitado");
                  const conAtend = campos.includes("atendido");
                  const conSelec = campos.includes("seleccionado");
                  const conRed   = campos.includes("red");
                  const dlLista  = dlMax === 6 ? DISTRITOS_LOCALES.slice(0, 6) : DISTRITOS_LOCALES;
                  return (
                    <div key={key} className="flex flex-col">
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
                        {lbl}
                      </label>

                      {conDL && activo && (
                        <div className="ml-6 mt-0.5 mb-1 flex flex-col gap-0.5">
                          <span className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Filtrar por Distrito</span>
                          {dlLista.map((dl) => (
                            <label key={dl} className="flex items-center gap-2 cursor-pointer text-xs text-slate-300 hover:text-white transition-colors py-0.5">
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

                      {conSelec && activo && (
                        <div className="ml-6 mt-0.5 mb-1">
                          <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300 hover:text-white transition-colors py-0.5">
                            <input
                              type="checkbox"
                              checked={filtroSeleccionado[key] === true}
                              onChange={() => toggleFiltroSeleccionado(key)}
                              className="w-3 h-3 cursor-pointer"
                              style={{ accentColor: color }}
                            />
                            Solo seleccionados
                          </label>
                        </div>
                      )}

                      {conVisit && activo && (
                        <div className="ml-6 mt-0.5 mb-1">
                          <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300 hover:text-white transition-colors py-0.5">
                            <input
                              type="checkbox"
                              checked={filtroVisitado[key] === true}
                              onChange={() => toggleFiltroVisitado(key)}
                              className="w-3 h-3 cursor-pointer"
                              style={{ accentColor: color }}
                            />
                            Solo visitados
                          </label>
                        </div>
                      )}

                      {conAtend && activo && (
                        <div className="ml-6 mt-0.5 mb-1">
                          <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300 hover:text-white transition-colors py-0.5">
                            <input
                              type="checkbox"
                              checked={filtroAtendido[key] === true}
                              onChange={() => toggleFiltroAtendido(key)}
                              className="w-3 h-3 cursor-pointer"
                              style={{ accentColor: color }}
                            />
                            Solo atendidos
                          </label>
                        </div>
                      )}

                      {conRed && activo && (
                        <div className="ml-6 mt-0.5 mb-2">
                          <span className="text-[10px] uppercase tracking-wider text-slate-500 block mb-1">Filtrar por Red</span>
                          <select
                            value={filtroRed[key] || ""}
                            onChange={(e) => setFiltroRed(key, e.target.value)}
                            className="w-full bg-[#0f172a] border border-[#334155] text-slate-200 text-xs rounded-lg px-2 py-1.5 outline-none focus:border-slate-400 cursor-pointer"
                          >
                            <option value="">Todas las Redes</option>
                            {REDES_GUARDIANES.map((r) => (
                              <option key={r} value={r}>{r}</option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  );
                })}
            </>
          )}

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
