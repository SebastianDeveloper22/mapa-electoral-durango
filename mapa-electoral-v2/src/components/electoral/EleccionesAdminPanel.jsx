import { useState, useEffect, useCallback } from "react";
import { useElectoralStore } from "../../store/electoralStore";
import ImportadorCSVModal from "./importador/ImportadorCSVModal";
import {
  getElecciones,
  createEleccion,
  updateEleccion,
  deleteEleccion,
  setEleccionActiva,
  limpiarCasillasEleccion,
} from "../../services/electoralService";
import { useToast } from "../ui/Toast";
import { TIPOS_ELECCION } from "../../config";

const ANIOS = Array.from(
  { length: 10 },
  (_, i) => new Date().getFullYear() - 2 + i,
);

const EleccionesAdminPanel = ({ open, onClose, onImportado }) => {
  const { setElecciones, setEleccionActiva: setActiva } = useElectoralStore();
  const toast = useToast();

  const [elecciones, setLocal] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modo, setModo] = useState("lista"); // 'lista' | 'nueva' | 'editar'
  const [editando, setEditando] = useState(null);
  const [importando, setImportando] = useState(null); // id de elección a importar

  // Formulario
  const [nombre, setNombre] = useState("");
  const [tipo, setTipo] = useState("gubernatura");
  const [anio, setAnio] = useState(new Date().getFullYear());
  const [fecha, setFecha] = useState("");
  const [saving, setSaving] = useState(false);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getElecciones();
      setLocal(data);
      setElecciones(data);
    } catch {
      toast("Error al cargar elecciones.", "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) cargar();
  }, [open]);

  const abrirNueva = () => {
    setNombre("");
    setTipo("gubernatura");
    setAnio(new Date().getFullYear());
    setFecha("");
    setEditando(null);
    setModo("nueva");
  };

  const abrirEditar = (e) => {
    setNombre(e.nombre);
    setTipo(e.tipo);
    setAnio(e.anio);
    setFecha(e.fecha || "");
    setEditando(e);
    setModo("editar");
  };

  const handleSave = async () => {
    if (!nombre.trim()) {
      toast("El nombre es obligatorio.", "warning");
      return;
    }
    setSaving(true);
    try {
      const data = {
        nombre: nombre.trim(),
        tipo,
        anio: parseInt(anio),
        fecha,
        activa: false,
      };
      if (modo === "nueva") {
        await createEleccion(data);
        toast("Elección creada.", "success");
      } else {
        await updateEleccion(editando.id, data);
        toast("Elección actualizada.", "success");
      }
      await cargar();
      setModo("lista");
    } catch {
      toast("Error al guardar.", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id, nombre) => {
    if (
      !confirm(
        `¿Eliminar "${nombre}"? Se perderán todas las casillas y resultados asociados.`,
      )
    )
      return;
    try {
      await deleteEleccion(id);
      toast("Elección eliminada.", "success");
      cargar();
    } catch {
      toast("Error al eliminar.", "error");
    }
  };

  const handleLimpiar = async (id, nombre) => {
    if (
      !confirm(
        `¿Eliminar TODAS las casillas y resultados de "${nombre}"?\n\nEsto no elimina la elección, solo sus datos. Útsalo para borrar duplicados antes de reimportar.`,
      )
    )
      return;
    try {
      const { casillas, resultados } = await limpiarCasillasEleccion(id);
      toast(
        `✅ Eliminados: ${casillas} casillas y ${resultados} resultados.`,
        "success",
      );
      onImportado?.(); // recargar casillas en el mapa
    } catch {
      toast("Error al limpiar datos.", "error");
    }
  };

  const handleActivar = async (id) => {
    try {
      await setEleccionActiva(id);
      toast("Elección activada.", "success");
      const data = await getElecciones();
      setLocal(data);
      setElecciones(data);
      const activa = data.find((e) => e.id === id);
      if (activa) setActiva(activa);
    } catch {
      toast("Error al activar.", "error");
    }
  };

  if (!open) return null;

  // Modal importador (montado fuera del panel para no heredar z-index)
  const importadorNode = importando ? (
    <ImportadorCSVModal
      open={!!importando}
      eleccionId={importando}
      onClose={() => setImportando(null)}
      onImportado={() => {
        setImportando(null);
        cargar();
        onImportado?.();
      }}
    />
  ) : null;

  const tipoLabel = (t) =>
    TIPOS_ELECCION.find((x) => x.value === t)?.label ?? t;

  return (
    <>
      {importadorNode}
      {/* Ocultar este panel mientras el importador está abierto */}
      <div
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
        style={{ display: importando ? "none" : "flex" }}
      >
        <div className="w-full max-w-lg bg-[#1e293b] border border-[#334155] rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
          {/* Header */}
          <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-[#334155] flex-shrink-0">
            <div>
              <h3 className="text-base font-semibold text-white">
                🗳️ Gestión de Elecciones
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Configura y activa elecciones para captura de resultados.
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white text-xl cursor-pointer"
            >
              ✖
            </button>
          </div>

          {/* Vista lista */}
          {modo === "lista" && (
            <>
              <div className="px-6 py-3 border-b border-[#334155] flex-shrink-0">
                <button
                  onClick={abrirNueva}
                  className="w-full bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold py-2.5 rounded-lg transition-colors cursor-pointer"
                >
                  + Nueva Elección
                </button>
              </div>

              <div className="overflow-y-auto flex-1 px-6 py-4">
                {loading ? (
                  <p className="text-slate-400 text-sm text-center py-8 animate-pulse">
                    Cargando...
                  </p>
                ) : elecciones.length === 0 ? (
                  <p className="text-slate-500 text-sm text-center py-8">
                    No hay elecciones registradas.
                  </p>
                ) : (
                  <div className="flex flex-col gap-3">
                    {elecciones.map((e) => (
                      <div
                        key={e.id}
                        className={`rounded-xl border px-4 py-3 transition-colors ${
                          e.activa
                            ? "border-blue-500 bg-blue-500/10"
                            : "border-[#334155] bg-[#0f172a]"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-white text-sm font-semibold">
                                {e.nombre}
                              </span>
                              {e.activa && (
                                <span className="text-xs bg-blue-500 text-white px-2 py-0.5 rounded-full font-medium">
                                  ACTIVA
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-400 mt-0.5">
                              {tipoLabel(e.tipo)} · {e.anio}
                              {e.fecha && ` · ${e.fecha}`}
                            </p>
                          </div>

                          {/* Acciones */}
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            {!e.activa && (
                              <button
                                onClick={() => handleActivar(e.id)}
                                className="text-xs bg-emerald-700/50 hover:bg-emerald-600/70 border border-emerald-600 text-emerald-300 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
                              >
                                ▶ Activar
                              </button>
                            )}
                            <button
                              onClick={() => setImportando(e.id)}
                              className="text-xs bg-purple-900/40 hover:bg-purple-800/60 border border-purple-700 text-purple-300 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
                              title="Importar casillas desde CSV"
                            >
                              📥
                            </button>
                            <button
                              onClick={() => handleLimpiar(e.id, e.nombre)}
                              className="text-xs bg-orange-900/30 hover:bg-orange-900/60 border border-orange-800 text-orange-400 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
                              title="Eliminar todas las casillas y resultados (sin borrar la elección)"
                            >
                              🧹
                            </button>
                            <button
                              onClick={() => abrirEditar(e)}
                              className="text-xs bg-[#334155] hover:bg-[#475569] text-slate-200 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
                            >
                              ✏️
                            </button>
                            <button
                              onClick={() => handleDelete(e.id, e.nombre)}
                              className="text-xs bg-red-900/30 hover:bg-red-900/60 border border-red-800 text-red-400 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
                            >
                              🗑️
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {/* Vista formulario (nueva / editar) */}
          {(modo === "nueva" || modo === "editar") && (
            <div className="flex flex-col flex-1 overflow-y-auto">
              <div className="px-6 py-4 flex flex-col gap-4 flex-1">
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                  {modo === "nueva"
                    ? "Nueva elección"
                    : `Editando: ${editando?.nombre}`}
                </p>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5 uppercase tracking-wider">
                    Nombre
                  </label>
                  <input
                    type="text"
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    placeholder="Ej. Gubernatura Durango 2028"
                    className="w-full bg-[#0f172a] border border-[#334155] text-white text-sm rounded-lg px-3 py-2.5 outline-none focus:border-blue-500 transition-colors placeholder:text-slate-600"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5 uppercase tracking-wider">
                      Tipo
                    </label>
                    <select
                      value={tipo}
                      onChange={(e) => setTipo(e.target.value)}
                      className="w-full bg-[#0f172a] border border-[#334155] text-white text-sm rounded-lg px-3 py-2.5 outline-none focus:border-blue-500 cursor-pointer"
                    >
                      {TIPOS_ELECCION.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5 uppercase tracking-wider">
                      Año
                    </label>
                    <select
                      value={anio}
                      onChange={(e) => setAnio(e.target.value)}
                      className="w-full bg-[#0f172a] border border-[#334155] text-white text-sm rounded-lg px-3 py-2.5 outline-none focus:border-blue-500 cursor-pointer"
                    >
                      {ANIOS.map((a) => (
                        <option key={a} value={a}>
                          {a}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5 uppercase tracking-wider">
                    Fecha de elección
                  </label>
                  <input
                    type="date"
                    value={fecha}
                    onChange={(e) => setFecha(e.target.value)}
                    className="w-full bg-[#0f172a] border border-[#334155] text-white text-sm rounded-lg px-3 py-2.5 outline-none focus:border-blue-500 cursor-pointer"
                  />
                </div>
              </div>

              <div className="px-6 pb-5 flex gap-3 flex-shrink-0">
                <button
                  onClick={() => setModo("lista")}
                  className="flex-1 bg-[#334155] hover:bg-[#475569] text-slate-200 text-sm font-medium py-2.5 rounded-lg transition-colors cursor-pointer"
                >
                  ← Volver
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white text-sm font-semibold py-2.5 rounded-lg transition-colors cursor-pointer"
                >
                  {saving
                    ? "Guardando..."
                    : modo === "nueva"
                      ? "Crear"
                      : "Guardar"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default EleccionesAdminPanel;
