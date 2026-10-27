import { useState } from "react";
import { createColeccionConfig } from "../../services/coleccionesConfigService";
import { useColeccionesStore } from "../../store/coleccionesStore";
import { useMapStore } from "../../store/mapStore";
import { useAuthStore } from "../../store/authStore";
import { useToast } from "../ui/Toast";

// Genera un slug a partir de un texto
const toSlug = (s) =>
  s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");

const CAMPOS_OPCIONES = [
  {
    grupo: "Básico",
    campos: [
      { key: "tipo",     label: "Tipo / Categoría" },
      { key: "detalles", label: "Detalles / Observaciones" },
    ],
  },
  {
    grupo: "Electoral",
    campos: [
      { key: "distritoLocal",  label: "Distrito Local" },
      { key: "seccion",        label: "Sección Electoral" },
      { key: "zonaElectoral",  label: "Zona Electoral" },
      { key: "referencia",     label: "Referencia Geográfica" },
      { key: "participacion",  label: "% Participación" },
    ],
  },
  {
    grupo: "Operativo",
    campos: [
      { key: "visitado",    label: "Visitado (checkbox)" },
      { key: "atendido",   label: "Atendido (checkbox)" },
      { key: "seleccionado", label: "Seleccionado (checkbox)" },
      { key: "direccion",  label: "Dirección" },
      { key: "telefono",   label: "Teléfono" },
      { key: "zona",       label: "Zona" },
      { key: "red",        label: "Red / Dependencia" },
    ],
  },
  {
    grupo: "Visual",
    campos: [
      { key: "pinColor", label: "Color personalizado del pin" },
    ],
  },
];

const ColeccionCreadorModal = ({ open, onClose }) => {
  const toast = useToast();
  const { user } = useAuthStore();
  const { addColeccion } = useColeccionesStore();
  const addColeccionDinamica = useMapStore((s) => s.addColeccionDinamica);

  const [label, setLabel]               = useState("");
  const [color, setColor]               = useState("#3b82f6");
  const [ocultarPresidente, setOcultar] = useState(false);
  const [dlMax, setDlMax]               = useState(15);
  const [campos, setCampos]             = useState([]);
  const [guardando, setGuardando]       = useState(false);

  const key = toSlug(label);

  const toggleCampo = (campo) =>
    setCampos((prev) =>
      prev.includes(campo) ? prev.filter((c) => c !== campo) : [...prev, campo]
    );

  const handleGuardar = async () => {
    if (!label.trim()) {
      toast("Ingresa un nombre para la capa.", "warning");
      return;
    }
    if (!key) {
      toast("El nombre no genera un identificador válido.", "warning");
      return;
    }
    setGuardando(true);
    try {
      const config = {
        key,
        label: label.trim(),
        color,
        campos,
        dlMax: campos.includes("distritoLocal") ? dlMax : null,
        ocultarPresidente,
        creadoPor: user?.email ?? "sistema",
        fechaCreacion: new Date().toLocaleDateString("es-MX", {
          year: "numeric", month: "short", day: "numeric",
        }),
      };
      await createColeccionConfig(config);
      // Actualizar stores en memoria para efecto inmediato
      addColeccion(config);
      addColeccionDinamica(config);
      toast(`Capa "${label.trim()}" creada correctamente.`, "success");
      // Reset
      setLabel(""); setColor("#3b82f6"); setOcultar(false);
      setDlMax(15); setCampos([]);
      onClose();
    } catch (err) {
      if (err.message === "KEY_EXISTS") {
        toast(`Ya existe una capa con el identificador "${key}".`, "warning");
      } else {
        console.error(err);
        toast("Error al crear la capa.", "error");
      }
    } finally {
      setGuardando(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4">
      <div className="w-full sm:max-w-lg bg-[#1e293b] border border-[#334155] rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[92vh] sm:max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-[#334155] shrink-0">
          <div>
            <h3 className="text-base font-semibold text-white">🗂️ Nueva Capa Personalizada</h3>
            <p className="text-xs text-slate-400 mt-0.5">Define los campos y crea una nueva capa en el mapa.</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white text-xl leading-none cursor-pointer transition-colors"
          >✖</button>
        </div>

        {/* Cuerpo scrollable */}
        <div className="overflow-y-auto flex-1 px-6 py-4 flex flex-col gap-5">

          {/* Nombre */}
          <div>
            <label className="text-xs font-medium text-slate-400 uppercase tracking-wider block mb-1.5">
              Nombre de la capa
            </label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Ej: Promotores Zona Norte"
              className="w-full bg-[#0f172a] border border-[#334155] text-white text-sm rounded-lg px-3 py-2 outline-none focus:border-blue-500 transition-colors placeholder:text-slate-600"
            />
            {key && (
              <p className="text-[11px] text-slate-500 mt-1">
                Identificador: <span className="text-slate-300 font-mono">{key}</span>
              </p>
            )}
          </div>

          {/* Color + opciones */}
          <div className="flex flex-wrap gap-4 items-start">
            <div>
              <label className="text-xs font-medium text-slate-400 uppercase tracking-wider block mb-1.5">
                Color del pin
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="w-9 h-9 rounded-lg border border-[#334155] cursor-pointer bg-transparent"
                />
                <span className="text-sm font-mono text-slate-300">{color}</span>
              </div>
            </div>

            <div className="flex items-center gap-2 mt-5">
              <input
                type="checkbox"
                id="ocultarPres"
                checked={ocultarPresidente}
                onChange={(e) => setOcultar(e.target.checked)}
                className="w-4 h-4 accent-amber-500 cursor-pointer"
              />
              <label htmlFor="ocultarPres" className="text-sm text-slate-300 cursor-pointer">
                Ocultar para Presidente
              </label>
            </div>
          </div>

          {/* Campos seleccionables */}
          <div>
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-3">
              Campos de la capa
            </p>
            <p className="text-[11px] text-slate-500 mb-3">
              <span className="text-slate-300 font-semibold">Nombre</span> y <span className="text-slate-300 font-semibold">Coordenadas</span> siempre se incluyen.
            </p>

            {CAMPOS_OPCIONES.map(({ grupo, campos: opciones }) => (
              <div key={grupo} className="mb-4">
                <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-2">{grupo}</p>
                <div className="flex flex-col gap-1.5">
                  {opciones.map(({ key: ck, label: cl }) => (
                    <label
                      key={ck}
                      className="flex items-center gap-2.5 cursor-pointer text-sm text-slate-300 hover:text-white transition-colors py-0.5"
                    >
                      <input
                        type="checkbox"
                        checked={campos.includes(ck)}
                        onChange={() => toggleCampo(ck)}
                        className="w-3.5 h-3.5 cursor-pointer accent-blue-500"
                      />
                      {cl}
                    </label>
                  ))}
                </div>

                {/* Opción DL max si distritoLocal está seleccionado */}
                {grupo === "Electoral" && campos.includes("distritoLocal") && (
                  <div className="ml-6 mt-2 flex items-center gap-4">
                    <span className="text-[11px] text-slate-500 uppercase tracking-wider">Distritos:</span>
                    {[15, 6].map((n) => (
                      <label key={n} className="flex items-center gap-1.5 cursor-pointer text-xs text-slate-300">
                        <input
                          type="radio"
                          name="dlMax"
                          checked={dlMax === n}
                          onChange={() => setDlMax(n)}
                          className="accent-blue-500 cursor-pointer"
                        />
                        DL 1–{n}
                      </label>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#334155] shrink-0">
          <button
            onClick={handleGuardar}
            disabled={guardando || !label.trim()}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white text-sm font-semibold py-2.5 rounded-lg transition-colors cursor-pointer"
          >
            {guardando ? "Creando..." : "✅ Crear Capa"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ColeccionCreadorModal;
