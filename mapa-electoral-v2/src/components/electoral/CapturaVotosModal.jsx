import { useState, useEffect } from "react";
import { useElectoralStore } from "../../store/electoralStore";
import { useAuthStore } from "../../store/authStore";
import {
  upsertResultado,
  deleteCasilla,
} from "../../services/electoralService";
import { useToast } from "../ui/Toast";
import { ROLES } from "../../config";
import { ganadorCoalicion, totalesCoalicion } from "./electoralHelpers";

// Grupos de campos para captura manual — refleja la estructura original del INE
const GRUPOS_VOTOS = [
  {
    titulo: "Individuales de partido",
    campos: [
      "PAN",
      "PRI",
      "PVEM",
      "PT",
      "MC",
      "MORENA",
      "PESD",
      "PV",
      "PER",
      "CAND_IND_EDRH",
    ],
  },
  {
    titulo: "Boletas de coalición",
    campos: [
      "CC_PAN_PRI",
      "C_PVEM_PT_MORENA",
      "C_PVEM_PT",
      "C_PVEM_MORENA",
      "C_PT_MORENA",
    ],
  },
  {
    titulo: "Sin registro y nulos",
    campos: ["NO_REGISTRADAS", "NULOS"],
  },
];

const TODOS_LOS_CAMPOS = GRUPOS_VOTOS.flatMap((g) => g.campos);

// Colores fijos por columna para el dot indicador
const COLOR_CAMPO = {
  PAN: "#003f8a",
  PRI: "#009900",
  PVEM: "#4ade80",
  PT: "#dc2626",
  MC: "#f97316",
  MORENA: "#7f1d1d",
  PESD: "#8b5cf6",
  PV: "#10b981",
  PER: "#0ea5e9",
  CAND_IND_EDRH: "#a78bfa",
  CC_PAN_PRI: "#1d4ed8",
  C_PVEM_PT_MORENA: "#991b1b",
  C_PVEM_PT: "#b45309",
  C_PVEM_MORENA: "#92400e",
  C_PT_MORENA: "#7c2d12",
  NO_REGISTRADAS: "#64748b",
  NULOS: "#374151",
};

const CapturaVotosModal = ({ onSaved, onCasillaDeleted }) => {
  const {
    modalCapturaOpen,
    casillaSeleccionada,
    eleccionActiva,
    resultados,
    closeModalCaptura,
  } = useElectoralStore();
  const { user, role } = useAuthStore();
  const toast = useToast();

  const [votos, setVotos] = useState({});
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const canEdit = role === ROLES.ADMIN || role === ROLES.EDITOR;

  // Pre-llenar con resultados existentes si ya fue capturada
  useEffect(() => {
    if (!modalCapturaOpen || !casillaSeleccionada) return;

    const existente = resultados[casillaSeleccionada.id];
    if (existente?.votos) {
      setVotos({ ...existente.votos });
    } else {
      setVotos(TODOS_LOS_CAMPOS.reduce((acc, c) => ({ ...acc, [c]: "" }), {}));
    }
  }, [modalCapturaOpen, casillaSeleccionada]);

  if (!modalCapturaOpen || !casillaSeleccionada) return null;

  const totalVotos = TODOS_LOS_CAMPOS.reduce(
    (sum, c) => sum + (parseInt(votos[c]) || 0),
    0,
  );

  // Determinar ganador usando lógica de coalición
  const votosNumericos = TODOS_LOS_CAMPOS.reduce(
    (acc, c) => ({ ...acc, [c]: parseInt(votos[c]) || 0 }),
    {},
  );
  const ganador = ganadorCoalicion(votosNumericos);
  const totalesActuales = totalesCoalicion(votosNumericos);
  const COLORES_GANADOR = { PAN: "#003f8a", MORENA: "#7f1d1d", MC: "#f97316" };
  const ganadorInfo = ganador
    ? { clave: ganador, color: COLORES_GANADOR[ganador] ?? "#64748b" }
    : null;

  const handleChange = (campo, val) => {
    const num = val.replace(/\D/g, "");
    setVotos((prev) => ({ ...prev, [campo]: num }));
  };

  const handleSave = async () => {
    if (!canEdit) return;
    setSaving(true);
    try {
      const votosNum = TODOS_LOS_CAMPOS.reduce(
        (acc, c) => ({
          ...acc,
          [c]: parseInt(votos[c]) || 0,
        }),
        {},
      );

      await upsertResultado({
        casilla_id: casillaSeleccionada.id,
        eleccion_id: eleccionActiva.id,
        seccion: casillaSeleccionada.seccion,
        municipio: casillaSeleccionada.municipio,
        votos: votosNum,
        total_votos: totalVotos,
        capturado_por: user?.email || "Desconocido",
        verificado: false,
      });

      toast("Resultado capturado correctamente.", "success");
      closeModalCaptura();
      onSaved?.();
    } catch (err) {
      console.error(err);
      toast("Error al guardar. Verifica tu conexión.", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteCasilla = async () => {
    if (
      !confirm(
        `¿Eliminar la casilla "${casillaSeleccionada.nombre || casillaSeleccionada.id}"? Esta acción no se puede deshacer.`,
      )
    )
      return;
    setDeleting(true);
    try {
      await deleteCasilla(casillaSeleccionada.id);
      toast("Casilla eliminada.", "success");
      closeModalCaptura();
      onCasillaDeleted?.();
    } catch {
      toast("Error al eliminar la casilla.", "error");
    } finally {
      setDeleting(false);
    }
  };

  const existente = resultados[casillaSeleccionada.id];
  const participacion =
    casillaSeleccionada.lista_nominal > 0 && totalVotos > 0
      ? ((totalVotos / casillaSeleccionada.lista_nominal) * 100).toFixed(1)
      : null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-[#1e293b] border border-[#334155] rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-[#334155]">
          <div>
            <h3 className="text-sm font-semibold text-white">
              🗳️{" "}
              {casillaSeleccionada.nombre ||
                `Casilla ${casillaSeleccionada.seccion}`}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Sección {casillaSeleccionada.seccion} ·{" "}
              {casillaSeleccionada.tipo || "Básica"}
              {casillaSeleccionada.lista_nominal > 0 && (
                <>
                  {" "}
                  · Lista nominal:{" "}
                  <span className="text-slate-300">
                    {casillaSeleccionada.lista_nominal}
                  </span>
                </>
              )}
            </p>
          </div>
          <button
            onClick={closeModalCaptura}
            className="text-slate-400 hover:text-white text-xl cursor-pointer"
          >
            ✖
          </button>
        </div>

        {/* Preview ganador */}
        {ganadorInfo && (
          <div
            className="mx-5 mt-4 px-4 py-2.5 rounded-xl flex items-center justify-between"
            style={{
              backgroundColor: `${ganadorInfo.color}22`,
              borderLeft: `3px solid ${ganadorInfo.color}`,
            }}
          >
            <span
              className="text-xs font-bold"
              style={{ color: ganadorInfo.color }}
            >
              Va ganando: {ganadorInfo.clave}
            </span>
            <span className="text-white text-sm font-bold">
              {ganador ? (totalesActuales[ganador] ?? 0) : 0} votos
            </span>
          </div>
        )}

        {/* Campos de votos agrupados */}
        <div className="px-5 py-4 flex flex-col gap-4">
          {GRUPOS_VOTOS.map((grupo) => (
            <div key={grupo.titulo}>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                {grupo.titulo}
              </p>
              <div className="grid grid-cols-2 gap-2">
                {grupo.campos.map((campo) => (
                  <div key={campo}>
                    <label className="flex items-center gap-1.5 text-xs font-medium text-slate-300 mb-1">
                      <span
                        className="w-2 h-2 rounded-sm flex-shrink-0"
                        style={{
                          backgroundColor: COLOR_CAMPO[campo] ?? "#64748b",
                        }}
                      />
                      <span className="truncate" title={campo}>
                        {campo}
                      </span>
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={votos[campo] ?? ""}
                      onChange={(e) => handleChange(campo, e.target.value)}
                      disabled={!canEdit}
                      placeholder="0"
                      className="w-full bg-[#0f172a] border border-[#334155] text-white text-xs
                                 rounded-lg px-2 py-1.5 outline-none focus:border-blue-500
                                 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Resumen por coalición */}
          <div className="bg-[#0f172a] rounded-xl p-3 grid grid-cols-3 gap-2 text-center">
            {Object.entries(totalesActuales)
              .filter(([k]) => k !== "NULOS")
              .map(([k, v]) => (
                <div key={k}>
                  <p
                    className="text-xs font-bold"
                    style={{ color: COLORES_GANADOR[k] ?? "#94a3b8" }}
                  >
                    {k === "OTROS" ? "OTROS" : k}
                  </p>
                  <p className="text-white text-sm font-semibold">{v}</p>
                </div>
              ))}
          </div>

          {/* Total */}
          <div className="flex items-center justify-between bg-[#0f172a] rounded-xl px-4 py-3">
            <span className="text-slate-400 text-xs">Total de votos</span>
            <span className="text-white font-bold text-lg">{totalVotos}</span>
          </div>

          {participacion && (
            <div className="mt-2 flex items-center justify-between bg-[#0f172a] rounded-xl px-4 py-2.5">
              <span className="text-slate-400 text-xs">Participación</span>
              <span className="text-emerald-400 font-semibold text-sm">
                {participacion}%
              </span>
            </div>
          )}

          {existente && (
            <p className="text-xs text-slate-500 mt-2 text-center">
              Capturado por {existente.capturado_por}
            </p>
          )}
        </div>

        {/* Acciones */}
        <div className="px-5 pb-5 flex gap-2">
          {role === ROLES.ADMIN && (
            <button
              onClick={handleDeleteCasilla}
              disabled={deleting}
              className="bg-red-900/40 hover:bg-red-900/70 border border-red-800 text-red-400 text-xs font-medium px-3 py-2.5 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
            >
              {deleting ? "⏳" : "🗑️"}
            </button>
          )}
          <button
            onClick={closeModalCaptura}
            className="flex-1 bg-[#334155] hover:bg-[#475569] text-slate-200 text-sm font-medium py-2.5 rounded-lg transition-colors cursor-pointer"
          >
            {canEdit ? "Cancelar" : "Cerrar"}
          </button>
          {canEdit && (
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white text-sm font-semibold py-2.5 rounded-lg transition-colors cursor-pointer"
            >
              {saving ? "Guardando..." : existente ? "Actualizar" : "Guardar"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default CapturaVotosModal;
