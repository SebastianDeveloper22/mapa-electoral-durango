/* eslint-disable react-hooks/exhaustive-deps */
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
import {
  createMarcador,
  updateMarcador,
} from "../../services/marcadoresService";
import {
  ANIOS,
  ANIO_DEFAULT,
  TIPOS_MARCADOR,
  DISTRITOS_LOCALES,
  SECCIONES,
} from "../../config";

// ── Dropzone / imagen compartida ────────────────────────────────────────────

const useImagen = () => {
  const [imagenArchivo, setImagenArchivo] = useState(null);
  const [imagenPreview, setImagenPreview] = useState(null);
  const [imagenUrlActual, setImagenUrlActual] = useState(null);
  const [imagenPathActual, setImagenPathActual] = useState(null);
  const [imagenEliminada, setImagenEliminada] = useState(false);

  const reset = () => {
    setImagenArchivo(null);
    setImagenPreview(null);
    setImagenUrlActual(null);
    setImagenPathActual(null);
    setImagenEliminada(false);
  };

  const cargar = ({ pinImageUrl, pinImagePath }) => {
    setImagenUrlActual(pinImageUrl ?? null);
    setImagenPathActual(pinImagePath ?? null);
    setImagenArchivo(null);
    setImagenPreview(null);
    setImagenEliminada(false);
  };

  const procesar = (file, toast) => {
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
  };

  const quitar = (inputRef) => {
    setImagenArchivo(null);
    setImagenPreview(null);
    setImagenEliminada(true);
    if (inputRef?.current) inputRef.current.value = "";
  };

  const previewActivo =
    imagenPreview ?? (imagenEliminada ? null : imagenUrlActual);

  return {
    imagenArchivo,
    imagenUrlActual,
    imagenPathActual,
    imagenEliminada,
    previewActivo,
    reset,
    cargar,
    procesar,
    quitar,
  };
};

// ── Componente dropzone de imagen ───────────────────────────────────────────

const ImagenDropzone = ({ previewActivo, onDrop, onQuitar, onProcesar }) => {
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef(null);

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    onDrop(e.dataTransfer.files[0]);
  };

  return (
    <div>
      <label className="block text-xs font-medium text-slate-300 mb-1.5 uppercase tracking-wider">
        Imagen del pin{" "}
        <span className="text-slate-500 normal-case font-normal">
          (PNG, JPG — opcional)
        </span>
      </label>

      {previewActivo ? (
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
          <div className="absolute top-2 left-2 bg-black/60 text-white text-xs px-2 py-1 rounded-lg">
            Vista previa del pin
          </div>
          <button
            onClick={() => onQuitar(inputRef)}
            className="absolute top-2 right-2 bg-red-600 hover:bg-red-500 text-white text-xs px-2 py-1 rounded-lg transition-colors cursor-pointer"
          >
            ✕ Quitar
          </button>
        </div>
      ) : (
        <div
          onDrop={handleDrop}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onClick={() => inputRef.current?.click()}
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
          <p className="text-slate-500 text-xs">o haz clic para seleccionarla</p>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => onProcesar(e.target.files[0])}
      />

      {previewActivo && (
        <p className="text-slate-500 text-xs mt-1.5 text-center">
          Esta imagen reemplazará al pin de color en el mapa.
        </p>
      )}
    </div>
  );
};

// ── Modal principal ─────────────────────────────────────────────────────────

const ObraModal = ({ onSaved }) => {
  const { modalOpen, editandoId, editandoCapa, coordsTemporales, closeModal } =
    useObrasStore();
  const { user } = useAuthStore();
  const toast = useToast();

  // Selector de capa (solo editable al crear)
  const [capa, setCapa] = useState("pp");

  // Campos PP
  const [nombre, setNombre] = useState("");
  const [tipo, setTipo] = useState("");
  const [anio, setAnio] = useState(ANIO_DEFAULT);

  // Campos Rural / Top100 / General
  const [distritoLocal, setDistritoLocal] = useState("");
  const [seccion, setSeccion] = useState("");
  const [detalles, setDetalles] = useState("");

  const [saving, setSaving] = useState(false);
  const imagen = useImagen();

  // ── Prellenado al abrir ────────────────────────────────────────────────────
  useEffect(() => {
    if (!modalOpen) return;
    if (!editandoId) {
      setCapa("pp");
      setNombre("");
      setTipo("");
      setAnio(ANIO_DEFAULT);
      setDistritoLocal("");
      setSeccion("");
      setDetalles("");
      imagen.reset();
    }
  }, [modalOpen, editandoId]);

  // Global para prellenar desde PinLayer al editar
  useEffect(() => {
    window.__llenarFormularioObra = ({
      nombre: n,
      tipo: t,
      anio: a,
      distritoLocal: dl,
      seccion: sec,
      detalles: det,
      capa: c,
      pinImageUrl,
      pinImagePath,
    }) => {
      setCapa(c ?? "pp");
      setNombre(n ?? "");
      setTipo(t ?? "");
      setAnio(a ?? ANIO_DEFAULT);
      setDistritoLocal(dl ?? "");
      setSeccion(sec ?? "");
      setDetalles(det ?? "");
      imagen.cargar({ pinImageUrl, pinImagePath });
    };
    return () => { delete window.__llenarFormularioObra; };
  }, []);

  // ── Guardar ────────────────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (!nombre.trim() || !tipo.trim()) {
      toast("Por favor, completa Nombre y Tipo.", "warning");
      return;
    }
    if (capa !== "pp" && !distritoLocal) {
      toast("Selecciona un Distrito Local.", "warning");
      return;
    }

    setSaving(true);
    try {
      const userEmail = user?.email || "Desconocido";
      let pinImageUrl = imagen.imagenUrlActual ?? null;
      let pinImagePath = imagen.imagenPathActual ?? null;

      if (imagen.imagenEliminada && imagen.imagenPathActual) {
        await eliminarImagenPin(imagen.imagenPathActual);
        pinImageUrl = null;
        pinImagePath = null;
      }

      if (imagen.imagenArchivo) {
        if (imagen.imagenPathActual && !imagen.imagenEliminada) {
          await eliminarImagenPin(imagen.imagenPathActual);
        }
        const { url, path } = await subirImagenPin(imagen.imagenArchivo);
        pinImageUrl = url;
        pinImagePath = path;
      }

      if (capa === "pp") {
        // ── Obras PP ──
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
      } else {
        // ── Marcadores Rural / Top100 / General ──
        const payload = {
          capa,
          nombre,
          tipo,
          distritoLocal: distritoLocal || null,
          seccion: seccion || null,
          detalles: detalles || null,
          coords: coordsTemporales,
          userEmail,
          pinImageUrl,
          pinImagePath,
        };
        if (editandoId) {
          await updateMarcador({ ...payload, id: editandoId });
          toast("Marcador actualizado correctamente.", "success");
        } else {
          await createMarcador(payload);
          toast("Marcador registrado correctamente.", "success");
        }
      }

      closeModal();
      onSaved?.();
    } catch (err) {
      console.error(err);
      toast("Error al guardar el marcador.", "error");
    } finally {
      setSaving(false);
    }
  }, [
    capa, nombre, tipo, anio, distritoLocal, seccion, detalles,
    imagen, editandoId, coordsTemporales, user, toast, closeModal, onSaved,
  ]);

  if (!modalOpen) return null;

  const esEdicion = !!editandoId;
  const capaActiva = esEdicion ? (editandoCapa ?? capa) : capa;

  const tituloModal = esEdicion
    ? `✏️ Editar ${TIPOS_MARCADOR.find((t) => t.value === capaActiva)?.label ?? "Marcador"}`
    : "📍 Nuevo Marcador";

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-[#1e293b] border border-[#334155] rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 pt-5 pb-4 border-b border-[#334155] shrink-0">
          <h3 className="text-base font-semibold text-white">{tituloModal}</h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Ingresa los detalles del marcador en esta ubicación.
          </p>
        </div>

        {/* Cuerpo scrollable */}
        <div className="overflow-y-auto flex-1 px-6 py-5 flex flex-col gap-4">

          {/* Selector de capa (solo al crear) */}
          {!esEdicion && (
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5 uppercase tracking-wider">
                Tipo de Capa
              </label>
              <div className="grid grid-cols-2 gap-2">
                {TIPOS_MARCADOR.map(({ value, label }) => (
                  <button
                    key={value}
                    onClick={() => setCapa(value)}
                    className={`text-xs font-medium py-2 px-3 rounded-lg border transition-colors cursor-pointer ${
                      capa === value
                        ? "bg-blue-600 border-blue-500 text-white"
                        : "bg-[#0f172a] border-[#334155] text-slate-300 hover:border-slate-400"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Nombre */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5 uppercase tracking-wider">
              Nombre
            </label>
            <input
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej. Domo, Comité Vecinal, Puente..."
              className="w-full bg-[#0f172a] border border-[#334155] text-white rounded-lg px-3 py-2.5 text-sm outline-none focus:border-blue-500 transition-colors placeholder:text-slate-600"
            />
          </div>

          {/* Tipo */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5 uppercase tracking-wider">
              Tipo
            </label>
            <input
              type="text"
              value={tipo}
              onChange={(e) => setTipo(e.target.value)}
              placeholder={
                capaActiva === "pp"
                  ? "Ej. Infraestructura Hidráulica"
                  : "Ej. Camino, Escuela, Parque..."
              }
              className="w-full bg-[#0f172a] border border-[#334155] text-white rounded-lg px-3 py-2.5 text-sm outline-none focus:border-blue-500 transition-colors placeholder:text-slate-600"
            />
          </div>

          {/* Campos PP: Año */}
          {capaActiva === "pp" && (
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
          )}

          {/* Campos Rural / Top100 / General */}
          {capaActiva !== "pp" && (
            <>
              {/* Distrito Local */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5 uppercase tracking-wider">
                  Distrito Local <span className="text-red-400">*</span>
                </label>
                <select
                  value={distritoLocal}
                  onChange={(e) => setDistritoLocal(e.target.value)}
                  className="w-full bg-[#0f172a] border border-[#334155] text-white rounded-lg px-3 py-2.5 text-sm outline-none focus:border-blue-500 cursor-pointer"
                >
                  <option value="">Seleccionar distrito...</option>
                  {DISTRITOS_LOCALES.map((dl) => (
                    <option key={dl} value={dl}>
                      {dl}
                    </option>
                  ))}
                </select>
              </div>

              {/* Sección electoral (combobox con autocomplete) */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5 uppercase tracking-wider">
                  Sección Electoral
                </label>
                <input
                  type="text"
                  list="secciones-list"
                  value={seccion}
                  onChange={(e) => setSeccion(e.target.value)}
                  placeholder="Ej. 42"
                  className="w-full bg-[#0f172a] border border-[#334155] text-white rounded-lg px-3 py-2.5 text-sm outline-none focus:border-blue-500 transition-colors placeholder:text-slate-600"
                />
                <datalist id="secciones-list">
                  {SECCIONES.map((s) => (
                    <option key={s} value={s} />
                  ))}
                </datalist>
              </div>

              {/* Detalles */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5 uppercase tracking-wider">
                  Detalles
                </label>
                <textarea
                  value={detalles}
                  onChange={(e) => setDetalles(e.target.value)}
                  rows={3}
                  placeholder="Descripción adicional, observaciones..."
                  className="w-full bg-[#0f172a] border border-[#334155] text-white rounded-lg px-3 py-2.5 text-sm outline-none focus:border-blue-500 transition-colors placeholder:text-slate-600 resize-none"
                />
              </div>
            </>
          )}

          {/* Imagen del pin */}
          <ImagenDropzone
            previewActivo={imagen.previewActivo}
            onDrop={(file) => imagen.procesar(file, toast)}
            onQuitar={(ref) => imagen.quitar(ref)}
            onProcesar={(file) => imagen.procesar(file, toast)}
          />
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
            {saving ? "Guardando..." : esEdicion ? "Actualizar" : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ObraModal;
