import { useEffect, useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import { useToast } from "../components/ui/Toast";
import { useElectoralStore } from "../store/electoralStore";
import { useMapStore } from "../store/mapStore";
import {
  getElecciones,
  getEleccionActiva,
  getCasillas,
  suscribirResultados,
} from "../services/electoralService";
import MapContainer from "../components/map/MapContainer";
import CasillaLayer from "../components/electoral/CasillaLayer";
import CapturaVotosModal from "../components/electoral/CapturaVotosModal";
import NuevaCasillaModal from "../components/electoral/NuevaCasillaModal";
import EleccionesAdminPanel from "../components/electoral/EleccionesAdminPanel";
import { useFiltrosStore } from "../components/electoral/FiltrosCasillasPanel";
import RecalcularCoordsButton from "../components/electoral/RecalcularCoordsButton";
import { PARTIDOS, TIPOS_ELECCION, MUNICIPIOS } from "../config";
import { ROLES } from "../config";
import {
  ganadorCoalicion,
  totalesCoalicion,
} from "../components/electoral/electoralHelpers";

// ── Sub-componentes del módulo electoral ─────────────────────────────────────

/**
 * Indicador de módulo + botón de regreso al módulo PP.
 */
const HeaderElectoral = ({ onBack }) => (
  <div
    className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-3
                  bg-[#1e293b]/90 backdrop-blur-sm border border-[#334155]
                  rounded-full px-5 py-2 shadow-xl pointer-events-auto"
  >
    <span className="text-lg">🗳️</span>
    <span className="text-white text-sm font-semibold tracking-wide">
      Módulo Electoral
    </span>
    <div className="w-px h-4 bg-[#334155]" />
    <button
      onClick={onBack}
      className="text-slate-400 hover:text-white text-xs font-medium transition-colors cursor-pointer"
    >
      ← Volver a PP
    </button>
  </div>
);

const VISTAS = [
  {
    value: "ganador",
    label: "🏆 Ganador",
    title: "Colorear por partido ganador",
  },
  {
    value: "participacion",
    label: "📊 Participación",
    title: "Colorear por % de participación",
  },
  { value: "calor", label: "🌡️ Calor", title: "Densidad de votos" },
];

/**
 * Panel izquierdo unificado: elección + vista + filtros.
 */
const ControlesElectorales = ({ onReload }) => {
  const {
    elecciones,
    eleccionActiva,
    setEleccionActiva,
    vistaElectoral,
    setVistaElectoral,
    casillas,
    resultados,
  } = useElectoralStore();
  const {
    municipioFiltro,
    seccionFiltro,
    partidoFiltro,
    setMunicipio,
    setSeccion,
    setPartido,
    resetFiltros,
  } = useFiltrosStore();
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(false);

  const hayFiltros =
    municipioFiltro !== "TODOS" ||
    seccionFiltro !== "" ||
    partidoFiltro !== "TODOS";

  // Secciones disponibles según municipio
  const seccionesDisponibles = useMemo(() => {
    const fuente =
      municipioFiltro === "TODOS"
        ? casillas
        : casillas.filter((c) => c.id_municipio === municipioFiltro);
    return [...new Set(fuente.map((c) => c.seccion))].sort();
  }, [casillas, municipioFiltro]);

  const conteoFiltradas = useMemo(
    () =>
      casillas.filter((c) => {
        const pasaMun =
          municipioFiltro === "TODOS" || c.id_municipio === municipioFiltro;
        const pasaSec = !seccionFiltro || c.seccion === seccionFiltro;
        const res = resultados[c.id];
        const pasaPartido =
          partidoFiltro === "TODOS" ||
          (res && ganadorCoalicion(res.votos) === partidoFiltro);
        return pasaMun && pasaSec && pasaPartido;
      }).length,
    [casillas, resultados, municipioFiltro, seccionFiltro, partidoFiltro],
  );

  return (
    <div
      className="absolute top-4 left-4 z-20 flex flex-col gap-2 pointer-events-auto max-h-[calc(100vh-2rem)] overflow-y-auto"
      style={{ scrollbarWidth: "none" }}
    >
      {/* Selector de elección */}
      <div className="bg-[#1e293b]/95 backdrop-blur-sm border border-[#334155] rounded-xl p-3 shadow-xl w-56">
        <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">
          Elección
        </p>
        {elecciones.length === 0 ? (
          <p className="text-slate-500 text-xs italic">
            Sin elecciones configuradas
          </p>
        ) : (
          <select
            value={eleccionActiva?.id ?? ""}
            onChange={(e) => {
              const found = elecciones.find((el) => el.id === e.target.value);
              setEleccionActiva(found ?? null);
            }}
            className="w-full bg-[#0f172a] border border-[#334155] text-white text-xs rounded-lg px-2 py-2 outline-none focus:border-blue-500 cursor-pointer"
          >
            <option value="">— Selecciona —</option>
            {elecciones.map((el) => (
              <option key={el.id} value={el.id}>
                {el.nombre} ({el.anio})
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Selector de vista */}
      <div className="bg-[#1e293b]/95 backdrop-blur-sm border border-[#334155] rounded-xl p-3 shadow-xl w-56">
        <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">
          Vista
        </p>
        <div className="flex flex-col gap-1">
          {VISTAS.map(({ value, label, title }) => (
            <button
              key={value}
              title={title}
              onClick={() => setVistaElectoral(value)}
              className={`text-left text-xs font-medium px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                vistaElectoral === value
                  ? "bg-blue-600 text-white"
                  : "text-slate-300 hover:bg-[#334155]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Botón recalcular coords */}
      {eleccionActiva && <RecalcularCoordsButton onRecalculado={onReload} />}

      {/* Filtros — solo si hay elección activa */}
      {eleccionActiva && (
        <div className="bg-[#1e293b]/95 backdrop-blur-sm border border-[#334155] rounded-xl shadow-xl w-56 overflow-hidden">
          {/* Header del filtro */}
          <button
            onClick={() => setFiltrosAbiertos((v) => !v)}
            className={`w-full flex items-center justify-between px-3 py-2.5 text-xs font-medium transition-colors cursor-pointer ${
              hayFiltros
                ? "text-blue-400 bg-blue-500/10"
                : "text-slate-300 hover:bg-[#334155]"
            }`}
          >
            <span className="flex items-center gap-1.5">
              🔍 Filtros
              {hayFiltros && (
                <span className="bg-blue-500 text-white rounded-full px-1.5 text-xs font-bold">
                  {conteoFiltradas.toLocaleString()}
                </span>
              )}
            </span>
            <span className="text-slate-500">
              {filtrosAbiertos ? "▲" : "▼"}
            </span>
          </button>

          {filtrosAbiertos && (
            <div className="px-3 pb-3 flex flex-col gap-2.5 border-t border-[#334155]">
              {/* Municipio */}
              <div className="pt-2">
                <label className="block text-xs text-slate-400 mb-1">
                  Municipio
                </label>
                <select
                  value={municipioFiltro}
                  onChange={(e) => setMunicipio(e.target.value)}
                  className="w-full bg-[#0f172a] border border-[#334155] text-white text-xs rounded-lg px-2 py-1.5 outline-none focus:border-blue-500 cursor-pointer"
                >
                  <option value="TODOS">Todos</option>
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
                  Sección
                </label>
                <select
                  value={seccionFiltro}
                  onChange={(e) => setSeccion(e.target.value)}
                  className="w-full bg-[#0f172a] border border-[#334155] text-white text-xs rounded-lg px-2 py-1.5 outline-none focus:border-blue-500 cursor-pointer"
                >
                  <option value="">Todas</option>
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
                <div className="flex flex-wrap gap-1">
                  <button
                    onClick={() => setPartido("TODOS")}
                    className={`text-xs px-2 py-1 rounded-md border cursor-pointer transition-colors ${
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
                      className="text-xs px-2 py-1 rounded-md border cursor-pointer font-medium transition-colors"
                      style={
                        partidoFiltro === clave
                          ? {
                              backgroundColor: color,
                              borderColor: color,
                              color: "#fff",
                            }
                          : { borderColor: "#334155", color: "#94a3b8" }
                      }
                    >
                      {clave}
                    </button>
                  ))}
                </div>
              </div>

              {/* Limpiar */}
              {hayFiltros && (
                <button
                  onClick={resetFiltros}
                  className="w-full text-xs text-blue-400 hover:text-blue-300 py-1 cursor-pointer text-center"
                >
                  ✕ Limpiar filtros
                </button>
              )}

              {/* Conteo */}
              <div className="flex items-center justify-between bg-[#0f172a] rounded-lg px-2 py-1.5">
                <span className="text-slate-400 text-xs">Visibles</span>
                <span className="text-white text-xs font-bold">
                  {conteoFiltradas.toLocaleString()} /{" "}
                  {casillas.length.toLocaleString()}
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

/**
 * Leyenda de partidos en la esquina inferior izquierda.
 */
const LeyendaPartidos = () => {
  const { vistaElectoral } = useElectoralStore();

  if (vistaElectoral !== "ganador") return null;

  return (
    <div
      className="absolute bottom-10 left-4 z-20 pointer-events-auto
                    bg-[#1e293b]/90 backdrop-blur-sm border border-[#334155]
                    rounded-xl p-3 shadow-xl"
    >
      <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">
        Leyenda
      </p>
      <div className="flex flex-col gap-1.5">
        {PARTIDOS.map(({ clave, nombre, color }) => (
          <div key={clave} className="flex items-center gap-2">
            <span
              className="inline-block w-3 h-3 rounded-sm shrink-0"
              style={{ backgroundColor: color }}
            />
            <span className="text-slate-300 text-xs">{clave}</span>
            <span
              className="text-slate-500 text-xs truncate max-w-140"
              title={nombre}
            >
              {nombre}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

/**
 * Panel de resumen de resultados de la elección activa.
 */
const ResumenResultados = () => {
  const { eleccionActiva, resultados, casillas } = useElectoralStore();

  if (!eleccionActiva) return null;

  const totalCasillas = casillas.length;
  const casillasCapturadas = Object.keys(resultados).length;
  const porcentaje =
    totalCasillas > 0
      ? Math.round((casillasCapturadas / totalCasillas) * 100)
      : 0;

  // Sumar votos globales por coalición usando helper compartido
  const totalesPartido = Object.values(resultados).reduce(
    (acc, r) => {
      const t = totalesCoalicion(r.votos);
      acc.PAN = (acc.PAN ?? 0) + t.PAN;
      acc.MORENA = (acc.MORENA ?? 0) + t.MORENA;
      acc.MC = (acc.MC ?? 0) + t.MC;
      acc.OTROS = (acc.OTROS ?? 0) + t.OTROS;
      acc.NULOS = (acc.NULOS ?? 0) + t.NULOS;
      return acc;
    },
    { PAN: 0, MORENA: 0, MC: 0, OTROS: 0, NULOS: 0 },
  );

  const totalVotos = Object.values(totalesPartido).reduce((a, b) => a + b, 0);

  return (
    <div
      className="absolute bottom-10 right-4 z-20 pointer-events-auto
                    bg-[#1e293b]/90 backdrop-blur-sm border border-[#334155]
                    rounded-xl p-4 shadow-xl min-w-200"
    >
      <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-3">
        Resultados — {eleccionActiva.nombre}
      </p>

      {/* Barra de avance de captura */}
      <div className="mb-3">
        <div className="flex justify-between text-xs text-slate-400 mb-1">
          <span>Casillas capturadas</span>
          <span className="text-white font-medium">
            {casillasCapturadas}/{totalCasillas}
          </span>
        </div>
        <div className="w-full h-1.5 bg-[#334155] rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-500 rounded-full transition-all duration-500"
            style={{ width: `${porcentaje}%` }}
          />
        </div>
        <p className="text-right text-xs text-slate-500 mt-0.5">
          {porcentaje}%
        </p>
      </div>

      {/* Votos por partido */}
      {totalVotos > 0 && (
        <div className="flex flex-col gap-1.5">
          {PARTIDOS.filter(({ clave }) => (totalesPartido[clave] ?? 0) > 0)
            .sort(
              (a, b) =>
                (totalesPartido[b.clave] ?? 0) - (totalesPartido[a.clave] ?? 0),
            )
            .map(({ clave, color }) => {
              const votos = totalesPartido[clave] ?? 0;
              const pct =
                totalVotos > 0
                  ? ((votos / totalVotos) * 100).toFixed(1)
                  : "0.0";
              return (
                <div key={clave} className="flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-sm shrink-0"
                    style={{ backgroundColor: color }}
                  />
                  <span className="text-slate-300 text-xs w-14 font-mono">
                    {clave}
                  </span>
                  <div className="flex-1 h-1 bg-[#334155] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${pct}%`, backgroundColor: color }}
                    />
                  </div>
                  <span className="text-slate-400 text-xs w-10 text-right">
                    {pct}%
                  </span>
                </div>
              );
            })}
        </div>
      )}

      {totalVotos === 0 && (
        <p className="text-slate-500 text-xs italic text-center py-1">
          Sin resultados capturados
        </p>
      )}
    </div>
  );
};

// ── ElectoralPage ─────────────────────────────────────────────────────────────

const ElectoralPage = () => {
  const navigate = useNavigate();
  const { role } = useAuthStore();
  const toast = useToast();
  const [adminEleccionesOpen, setAdminEleccionesOpen] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const handleReload = useCallback(() => setReloadKey((k) => k + 1), []);
  const [casillaReloadKey, setCasillaReloadKey] = useState(0);
  const handleCasillaReload = useCallback(
    () => setCasillaReloadKey((k) => k + 1),
    [],
  );

  const {
    eleccionActiva,
    setElecciones,
    setEleccionActiva,
    setCasillas,
    setResultados,
    updateResultado,
  } = useElectoralStore();

  // Cargar lista de elecciones al montar
  useEffect(() => {
    let cancelled = false;

    const cargarElecciones = async () => {
      try {
        const [todas, activa] = await Promise.all([
          getElecciones(),
          getEleccionActiva(),
        ]);
        if (cancelled) return;
        setElecciones(todas);
        if (activa) setEleccionActiva(activa);
      } catch (err) {
        console.error("[ElectoralPage] Error cargando elecciones:", err);
      }
    };

    cargarElecciones();
    return () => {
      cancelled = true;
    };
  }, []);

  // Cuando cambia la elección activa → cargar casillas y suscribir resultados
  useEffect(() => {
    if (!eleccionActiva) {
      setCasillas([]);
      setResultados([]);
      return;
    }

    let unsub = null;
    let cancelled = false;

    const cargarCasillas = async () => {
      try {
        const casillas = await getCasillas(eleccionActiva.id);
        if (cancelled) return;
        setCasillas(casillas);
        if (casillas.length === 0) {
          toast(
            "No hay casillas para esta elección. Usa ⚙️ Elecciones → 📥 para importar el CSV.",
            "warning",
          );
        }
      } catch (err) {
        console.error("[ElectoralPage] Error cargando casillas:", err);
        if (!cancelled)
          toast(
            "Error al cargar casillas. Verifica las reglas de Firestore.",
            "error",
          );
      }
    };

    cargarCasillas();

    // Suscripción en tiempo real a resultados
    unsub = suscribirResultados(eleccionActiva.id, (resultadosArr) => {
      if (cancelled) return;
      setResultados(resultadosArr);
    });

    return () => {
      cancelled = true;
      unsub?.();
    };
  }, [eleccionActiva?.id, casillaReloadKey]);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#0f172a]">
      {/* Mapa base — reutiliza el mismo MapContainer con las mismas teselas */}
      <MapContainer />

      {/* Capa de casillas electorales */}
      {eleccionActiva && <CasillaLayer key={reloadKey} />}

      {/* ── Controles flotantes del módulo electoral ── */}

      {/* Indicador de módulo + botón de regreso */}
      <HeaderElectoral onBack={() => navigate("/")} />

      {/* Selector de elección y vista — esquina superior izquierda */}
      <ControlesElectorales onReload={handleReload} />

      {/* Leyenda de partidos — esquina inferior izquierda */}
      <LeyendaPartidos />

      {/* Resumen de resultados — esquina inferior derecha */}
      <ResumenResultados />

      {/* Botón admin elecciones — solo admins */}
      {role === ROLES.ADMIN && (
        <button
          onClick={() => setAdminEleccionesOpen(true)}
          className="absolute top-4 right-4 z-20 flex items-center gap-1.5 bg-[#1e293b] border border-[#334155] text-slate-200 text-xs font-medium px-3 py-2 rounded-lg hover:bg-[#334155] transition-colors cursor-pointer"
        >
          ⚙️ Elecciones
        </button>
      )}

      {/* Modales electorales */}
      <CapturaVotosModal
        onSaved={handleReload}
        onCasillaDeleted={handleReload}
      />
      <NuevaCasillaModal onSaved={handleReload} />
      <EleccionesAdminPanel
        open={adminEleccionesOpen}
        onClose={() => setAdminEleccionesOpen(false)}
        onImportado={handleCasillaReload}
      />

      {/* Aviso de módulo en construcción — solo cuando no hay elección */}
      {!eleccionActiva && (
        <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
          <div
            className="bg-[#1e293b]/80 backdrop-blur-sm border border-[#334155] rounded-2xl
                          px-8 py-6 text-center shadow-2xl max-w-sm mx-4"
          >
            <div className="text-4xl mb-3">🗳️</div>
            <h2 className="text-white font-semibold text-lg mb-1">
              Módulo Electoral
            </h2>
            <p className="text-slate-400 text-sm">
              Selecciona una elección en el panel izquierdo para visualizar
              resultados y casillas sobre el mapa.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default ElectoralPage;
