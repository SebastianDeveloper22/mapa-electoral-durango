/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable react-hooks/immutability */
/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect, useRef, useCallback } from "react";
import { useObrasStore } from "../../store/obrasStore";
import { useAuthStore } from "../../store/authStore";
import { useToast } from "../ui/Toast";
import {
  createObra,
  updateObra,
  subirImagenPin,
  eliminarImagenPin,
} from "../../services/obrasService";
import { ANIOS, ANIO_DEFAULT } from "../../config";

const ObraModal = ({ onSaved }) => {
  const { modalOpen, editandoId, coordsTemporales, closeModal } =
    useObrasStore();
  const { user } = useAuthStore();
  const toast = useToast();

  const [nombre, setNombre] = useState("");
  const [tipo, setTipo] = useState("");
  const [anio, setAnio] = useState(ANIO_DEFAULT);
  const [saving, setSaving] = useState(false);

  // ── Imagen de pin ──────────────────────────────────────────────────────────
  const [imagenArchivo, setImagenArchivo] = useState(null); // File pendiente de subir
  const [imagenPreview, setImagenPreview] = useState(null); // data-URL para preview local
  const [imagenUrlActual, setImagenUrlActual] = useState(null); // URL en Storage (obra existente)
  const [imagenPathActual, setImagenPathActual] = useState(null); // path en Storage
  const [imagenEliminada, setImagenEliminada] = useState(false); // usuario la quitó
  const [dragOver, setDragOver] = useState(false);
  const inputImagenRef = useRef(null);

  // ── Prellenado al abrir ────────────────────────────────────────────────────
  useEffect(() => {
    if (!modalOpen) return;
    if (!editandoId) {
      setNombre("");
      setTipo("");
      setAnio(ANIO_DEFAULT);
      resetImagen();
    }
  }, [modalOpen, editandoId]);

  useEffect(() => {
    window.__llenarFormularioObra = ({
      nombre: n,
      tipo: t,
      anio: a,
      pinImageUrl,
      pinImagePath,
    }) => {
      setNombre(n);
      setTipo(t);
      setAnio(a);
      setImagenUrlActual(pinImageUrl ?? null);
      setImagenPathActual(pinImagePath ?? null);
      setImagenArchivo(null);
      setImagenPreview(null);
      setImagenEliminada(false);
    };
    return () => {
      delete window.__llenarFormularioObra;
    };
  }, []);

  const resetImagen = () => {
    setImagenArchivo(null);
    setImagenPreview(null);
    setImagenUrlActual(null);
    setImagenPathActual(null);
    setImagenEliminada(false);
  };

  // ── Manejo de archivo ──────────────────────────────────────────────────────
  const procesarArchivo = useCallback((file) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast("Solo se aceptan archivos de imagen.", "warning");
      return;
    }
    setImagenArchivo(file);
    setImagenEliminada(false);
    const reader = new FileReader();
    reader.onload = (e) => setImagenPreview(e.target.result);
    reader.readAsDataURL(file);
  }, []);

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    procesarArchivo(e.dataTransfer.files[0]);
  };

  const handleQuitarImagen = () => {
    setImagenArchivo(null);
    setImagenPreview(null);
    setImagenEliminada(true);
    if (inputImagenRef.current) inputImagenRef.current.value = "";
  };

  // Vista previa efectiva: nueva selección > imagen existente (si no fue eliminada)
  const previewActivo =
    imagenPreview ?? (imagenEliminada ? null : imagenUrlActual);

  // ── Guardar ────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!nombre.trim() || !tipo.trim()) {
      toast("Por favor, completa todos los campos.", "warning");
      return;
    }
    setSaving(true);
    try {
      const userEmail = user?.email || "Desconocido";
      let pinImageUrl = imagenUrlActual ?? null;
      let pinImagePath = imagenPathActual ?? null;

      // Si el usuario eliminó la imagen, borrarla de Storage
      if (imagenEliminada && imagenPathActual) {
        await eliminarImagenPin(imagenPathActual);
        pinImageUrl = null;
        pinImagePath = null;
      }

      // Si hay imagen nueva, subir (y borrar la anterior si la había)
      if (imagenArchivo) {
        if (imagenPathActual && !imagenEliminada) {
          await eliminarImagenPin(imagenPathActual);
        }
        const { url, path } = await subirImagenPin(imagenArchivo);
        pinImageUrl = url;
        pinImagePath = path;
      }

      if (editandoId) {
        await updateObra({
          id: editandoId,
          nombre,
          tipo,
          anio,
          coords: coordsTemporales,
          userEmail,
          pinImageUrl,
          pinImagePath,
        });
        toast("Obra actualizada correctamente.", "success");
      } else {
        await createObra({
          nombre,
          tipo,
          anio,
          coords: coordsTemporales,
          userEmail,
          pinImageUrl,
          pinImagePath,
        });
        toast("Obra registrada correctamente.", "success");
      }

      closeModal();
      onSaved?.();
    } catch (err) {
      console.error(err);
      toast("Error al guardar la obra.", "error");
    } finally {
      setSaving(false);
    }
  };

  if (!modalOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-[#1e293b] border border-[#334155] rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 pt-5 pb-4 border-b border-[#334155] shrink-0">
          <h3 className="text-base font-semibold text-white">
            {editandoId ? "✏️ Editar Obra P.P." : "📍 Nueva Obra P.P."}
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Ingresa los detalles técnicos de la obra en esta ubicación.
          </p>
        </div>

        {/* Cuerpo scrollable */}
        <div className="overflow-y-auto flex-1 px-6 py-5 flex flex-col gap-4">
          {/* Nombre */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5 uppercase tracking-wider">
              Nombre del Proyecto
            </label>
            <input
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              onKeyDown={(e) =>
                e.key === "Enter" &&
                document.getElementById("obra-tipo")?.focus()
              }
              placeholder="Ej. Pavimentación Calle Juárez"
              className="w-full bg-[#0f172a] border border-[#334155] text-white rounded-lg px-3 py-2.5 text-sm outline-none focus:border-blue-500 transition-colors placeholder:text-slate-600"
            />
          </div>

          {/* Tipo */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5 uppercase tracking-wider">
              Tipo de Obra
            </label>
            <input
              id="obra-tipo"
              type="text"
              value={tipo}
              onChange={(e) => setTipo(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSave()}
              placeholder="Ej. Infraestructura Hidráulica"
              className="w-full bg-[#0f172a] border border-[#334155] text-white rounded-lg px-3 py-2.5 text-sm outline-none focus:border-blue-500 transition-colors placeholder:text-slate-600"
            />
          </div>

          {/* Año */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5 uppercase tracking-wider">
              Año de Ejecución
            </label>
            <select
              value={anio}
              onChange={(e) => setAnio(e.target.value)}
              className="w-full bg-[#0f172a] border border-[#334155] text-white rounded-lg px-3 py-2.5 text-sm outline-none focus:border-blue-500 cursor-pointer"
            >
              {ANIOS.map((a) => (
                <option key={a} value={a}>
                  Generación {a}
                </option>
              ))}
            </select>
          </div>

          {/* ── Imagen del pin ── */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5 uppercase tracking-wider">
              Imagen del pin{" "}
              <span className="text-slate-500 normal-case font-normal">
                (PNG, JPG — opcional)
              </span>
            </label>

            {previewActivo ? (
              /* ── Vista previa de la imagen ── */
              <div className="relative">
                <div
                  className="rounded-xl overflow-hidden border border-[#334155] bg-[#0f172a] flex items-center justify-center"
                  style={{ height: "140px" }}
                >
                  <img
                    src={previewActivo}
                    alt="Pin preview"
                    className="max-h-full max-w-full object-contain"
                  />
                </div>
                {/* Overlay de la imagen en el pin */}
                <div className="absolute top-2 left-2 bg-black/60 text-white text-xs px-2 py-1 rounded-lg">
                  Vista previa del pin
                </div>
                <button
                  onClick={handleQuitarImagen}
                  className="absolute top-2 right-2 bg-red-600 hover:bg-red-500 text-white text-xs px-2 py-1 rounded-lg transition-colors cursor-pointer"
                >
                  ✕ Quitar
                </button>
              </div>
            ) : (
              /* ── Dropzone ── */
              <div
                onDrop={handleDrop}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onClick={() => inputImagenRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
                  dragOver
                    ? "border-blue-400 bg-blue-500/10"
                    : "border-[#334155] hover:border-slate-500 bg-[#0f172a]"
                }`}
              >
                <div className="text-3xl mb-2">🖼️</div>
                <p className="text-slate-300 text-xs font-medium mb-0.5">
                  Arrastra una imagen aquí
                </p>
                <p className="text-slate-500 text-xs">
                  o haz clic para seleccionarla
                </p>
              </div>
            )}

            <input
              ref={inputImagenRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(e) => procesarArchivo(e.target.files[0])}
            />

            {previewActivo && (
              <p className="text-slate-500 text-xs mt-1.5 text-center">
                Esta imagen reemplazará al pin de color en el mapa.
              </p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 pb-5 pt-4 border-t border-[#334155] shrink-0 flex gap-3">
          <button
            onClick={() => closeModal()}
            className="flex-1 bg-[#334155] hover:bg-[#475569] text-slate-200 text-sm font-medium py-2.5 rounded-lg transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white text-sm font-semibold py-2.5 rounded-lg transition-colors cursor-pointer"
          >
            {saving ? "Guardando..." : editandoId ? "Actualizar" : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ObraModal;
