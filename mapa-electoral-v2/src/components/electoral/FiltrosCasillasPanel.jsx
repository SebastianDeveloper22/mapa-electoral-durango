import { useState, useMemo } from "react";
import { useElectoralStore } from "../../store/electoralStore";
import { MUNICIPIOS, PARTIDOS } from "../../config";
import { ganadorCoalicion } from "./electoralHelpers";

// Store de filtros — lo exportamos para que CasillaLayer lo consuma
import { create } from "zustand";

export const useFiltrosStore = create((set) => ({
  municipioFiltro: "TODOS",
  seccionFiltro: "",
  partidoFiltro: "TODOS",
  setMunicipio: (v) => set({ municipioFiltro: v, seccionFiltro: "" }),
  setSeccion: (v) => set({ seccionFiltro: v }),
  setPartido: (v) => set({ partidoFiltro: v }),
  resetFiltros: () =>
    set({
      municipioFiltro: "TODOS",
      seccionFiltro: "",
      partidoFiltro: "TODOS",
    }),
}));

const FiltrosCasillasPanel = () => {
  const { casillas, resultados } = useElectoralStore();
  const {
    municipioFiltro,
    seccionFiltro,
    partidoFiltro,
    setMunicipio,
    setSeccion,
    setPartido,
    resetFiltros,
  } = useFiltrosStore();

  const [abierto, setAbierto] = useState(false);

  // Secciones disponibles para el municipio seleccionado
  const seccionesDisponibles = useMemo(() => {
    const fuente =
      municipioFiltro === "TODOS"
        ? casillas
        : casillas.filter((c) => c.id_municipio === municipioFiltro);
    return [...new Set(fuente.map((c) => c.seccion))].sort();
  }, [casillas, municipioFiltro]);

  // Conteo de casillas que pasan los filtros activos
  const conteoFiltradas = useMemo(() => {
    return casillas.filter((c) => {
      const pasaMun =
        municipioFiltro === "TODOS" || c.id_municipio === municipioFiltro;
      const pasaSec = !seccionFiltro || c.seccion === seccionFiltro;
      const resultado = resultados[c.id];
      const pasaPartido =
        partidoFiltro === "TODOS" ||
        (resultado && ganadorCoalicion(resultado.votos) === partidoFiltro);
      return pasaMun && pasaSec && pasaPartido;
    }).length;
  }, [casillas, resultados, municipioFiltro, seccionFiltro, partidoFiltro]);

  const hayFiltrosActivos =
    municipioFiltro !== "TODOS" ||
    seccionFiltro !== "" ||
    partidoFiltro !== "TODOS";

  return (
    <div className="absolute top-16 left-4 z-20">
      {/* Botón toggle */}
      <button
        onClick={() => setAbierto((v) => !v)}
        className={`flex items-center gap-2 text-xs font-medium px-3 py-2 rounded-xl border shadow-lg transition-colors cursor-pointer ${
          hayFiltrosActivos
            ? "bg-blue-600 border-blue-400 text-white"
            : "bg-[#1e293b] border-[#334155] text-slate-200 hover:bg-[#334155]"
        }`}
      >
        🔍 Filtros
        {hayFiltrosActivos && (
          <span className="bg-white/20 text-white rounded-full px-1.5 text-xs font-bold">
            {conteoFiltradas.toLocaleString()}
          </span>
        )}
      </button>

      {/* Panel de filtros */}
      {abierto && (
        <div className="mt-2 w-64 bg-[#1e293b] border border-[#334155] rounded-xl shadow-2xl p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Filtrar casillas
            </p>
            {hayFiltrosActivos && (
              <button
                onClick={resetFiltros}
                className="text-xs text-blue-400 hover:text-blue-300 cursor-pointer"
              >
                Limpiar todo
              </button>
            )}
          </div>

          {/* Municipio */}
          <div>
            <label className="block text-xs text-slate-400 mb-1">
              Municipio
            </label>
            <select
              value={municipioFiltro}
              onChange={(e) => setMunicipio(e.target.value)}
              className="w-full bg-[#0f172a] border border-[#334155] text-white text-xs rounded-lg px-3 py-2 outline-none focus:border-blue-500 cursor-pointer"
            >
              <option value="TODOS">Todos los municipios</option>
              {MUNICIPIOS.filter((m) => m.value !== "TODOS").map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          {/* Sección */}
          <div>
            <label className="block text-xs text-slate-400 mb-1">
              Sección{" "}
              {seccionesDisponibles.length > 0 && (
                <span className="text-slate-500">
                  ({seccionesDisponibles.length} disponibles)
                </span>
              )}
            </label>
            <select
              value={seccionFiltro}
              onChange={(e) => setSeccion(e.target.value)}
              className="w-full bg-[#0f172a] border border-[#334155] text-white text-xs rounded-lg px-3 py-2 outline-none focus:border-blue-500 cursor-pointer"
            >
              <option value="">Todas las secciones</option>
              {seccionesDisponibles.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          {/* Partido ganador */}
          <div>
            <label className="block text-xs text-slate-400 mb-1">
              Partido ganador
            </label>
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => setPartido("TODOS")}
                className={`text-xs px-2.5 py-1 rounded-lg border transition-colors cursor-pointer ${
                  partidoFiltro === "TODOS"
                    ? "bg-slate-600 border-slate-400 text-white"
                    : "border-[#334155] text-slate-400 hover:bg-[#334155]"
                }`}
              >
                Todos
              </button>
              {PARTIDOS.filter(
                (p) => !["OTROS", "NULOS"].includes(p.clave),
              ).map(({ clave, color }) => (
                <button
                  key={clave}
                  onClick={() => setPartido(clave)}
                  className={`text-xs px-2.5 py-1 rounded-lg border transition-colors cursor-pointer font-medium ${
                    partidoFiltro === clave
                      ? "text-white border-transparent"
                      : "border-[#334155] text-slate-300 hover:bg-[#334155]"
                  }`}
                  style={
                    partidoFiltro === clave
                      ? { backgroundColor: color, borderColor: color }
                      : {}
                  }
                >
                  {clave}
                </button>
              ))}
            </div>
          </div>

          {/* Resultado del filtro */}
          <div className="bg-[#0f172a] rounded-lg px-3 py-2 flex items-center justify-between">
            <span className="text-slate-400 text-xs">Casillas visibles</span>
            <span className="text-white text-sm font-bold">
              {conteoFiltradas.toLocaleString()} /{" "}
              {casillas.length.toLocaleString()}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default FiltrosCasillasPanel;
