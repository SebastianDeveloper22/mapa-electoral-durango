import { useState, useEffect, useRef, useCallback } from "react";
import { useObrasStore } from "../../store/obrasStore";
import { useAuthStore } from "../../store/authStore";
import { useColeccionesStore } from "../../store/coleccionesStore";
import { useToast } from "../ui/Toast";
import {
  createObra,
  updateObra,
  subirImagenPin,
  eliminarImagenPin,
  subirFoto,
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
  REDES_GUARDIANES,
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

const ImagenDropzone = ({ previewActivo, onDrop, onQuitar, onProcesar, label = "Imagen del pin", sublabel = "Esta imagen reemplazará al pin de color en el mapa." }) => {
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
        {label}{" "}
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
          {sublabel}
        </p>
      )}
    </div>
  );
};

// ── Modal principal ─────────────────────────────────────────────────────────

const ObraModal = ({ onSaved }) => {
  const {
    modalOpen, editandoId, editandoCapa, coordsTemporales, closeModal,
    marcadorEditando, setMarcadorEditando,
  } = useObrasStore();
  const { user } = useAuthStore();
  const { coleccionesConfig } = useColeccionesStore();
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
  const [zonaElectoral, setZonaElectoral] = useState("");
  const [referencia, setReferencia] = useState("");
  const [participacion, setParticipacion] = useState("");
  const [detalles, setDetalles] = useState("");

  // Color individual (capas Espectaculares)
  const [pinColor, setPinColor] = useState("#94a3b8");

  // Checkbox seleccionado (capas Espectaculares)
  const [seleccionado, setSeleccionado] = useState(false);

  // Checkbox visitado (Rural / Top 100)
  const [visitado, setVisitado] = useState(false);

  // Campos Guardianes del Camino
  const [direccion, setDireccion] = useState("");
  const [telefono, setTelefono] = useState("");
  const [zona, setZona] = useState("");
  const [red, setRed] = useState("");
  const [atendido, setAtendido] = useState(false);

  const [saving, setSaving] = useState(false);
  const imagen = useImagen();
  const foto = useImagen();

  // ── Reset al abrir modal en modo "Nuevo" ───────────────────────────────────
  useEffect(() => {
    if (!modalOpen || editandoId) return;
    setCapa("pp");
    setNombre("");
    setTipo("");
    setAnio(ANIO_DEFAULT);
    setDistritoLocal("");
    setSeccion("");
    setZonaElectoral("");
    setReferencia("");
    setParticipacion("");
    setDetalles("");
    setPinColor("#94a3b8");
    setSeleccionado(false);
    setVisitado(false);
    setDireccion("");
    setTelefono("");
    setZona("");
    setRed("");
    setAtendido(false);
    imagen.reset();
    foto.reset();
  }, [modalOpen, editandoId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Prellenar formulario al editar (datos enviados por PinLayer vía store) ──
  useEffect(() => {
    if (!modalOpen || !editandoId || !marcadorEditando) return;
    const m = marcadorEditando;
    setCapa(m.capa ?? "pp");
    setNombre(m.nombre ?? "");
    setTipo(m.tipo ?? "");
    setAnio(m.anio ?? ANIO_DEFAULT);
    setDistritoLocal(m.distritoLocal ?? "");
    setSeccion(m.seccion ?? "");
    setZonaElectoral(m.zonaElectoral ?? "");
    setReferencia(m.referencia ?? "");
    setParticipacion(m.participacion != null ? String(m.participacion) : "");
    setDetalles(m.detalles ?? "");
    setPinColor(m.pinColor ?? "#94a3b8");
    setSeleccionado(m.seleccionado ?? false);
    setVisitado(m.visitado ?? false);
    setDireccion(m.direccion ?? "");
    setTelefono(m.telefono ?? "");
    setZona(m.zona ?? "");
    setRed(m.red ?? "");
    setAtendido(m.atendido ?? false);
    imagen.cargar({ pinImageUrl: m.pinImageUrl, pinImagePath: m.pinImagePath });
    foto.cargar({ pinImageUrl: m.fotoUrl, pinImagePath: m.fotoPath });
    // Limpiar para no re-disparar si el componente se re-renderiza
    setMarcadorEditando(null);
  }, [modalOpen, editandoId, marcadorEditando]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Guardar ────────────────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    const cfgCapa = coleccionesConfig.find((c) => c.key === capa) ?? null;
    const camposCapa = cfgCapa?.campos ?? [];
    const esCapaDin = !!cfgCapa;

    if (esCapaDin) {
      if (!nombre.trim()) {
        toast("Por favor, completa el Nombre.", "warning");
        return;
      }
    } else {
      const requiereNombreTipo = capa === "pp" || capa === "general" || capa === "capital" || capa === "municipios";
      if (requiereNombreTipo && (!nombre.trim() || !tipo.trim())) {
        toast("Por favor, completa Nombre y Tipo.", "warning");
        return;
      }
      if (capa === "guardianes" && !nombre.trim()) {
        toast("Por favor, completa el Nombre.", "warning");
        return;
      }
      if (capa !== "pp" && !distritoLocal) {
        toast("Selecciona un Distrito Local.", "warning");
        return;
      }
    }

    setSaving(true);
    // Paths de imágenes nuevas subidas en esta operación (para rollback si Firestore falla)
    const nuevosPathsSubidos = [];
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
        nuevosPathsSubidos.push(path); // registrar para posible rollback
        pinImageUrl = url;
        pinImagePath = path;
      }

      // ── Foto del marcador ──
      let fotoUrl = foto.imagenUrlActual ?? null;
      let fotoPath = foto.imagenPathActual ?? null;

      if (foto.imagenEliminada && foto.imagenPathActual) {
        await eliminarImagenPin(foto.imagenPathActual);
        fotoUrl = null;
        fotoPath = null;
      }

      if (foto.imagenArchivo) {
        if (foto.imagenPathActual && !foto.imagenEliminada) {
          await eliminarImagenPin(foto.imagenPathActual);
        }
        const { url, path } = await subirFoto(foto.imagenArchivo);
        nuevosPathsSubidos.push(path); // registrar para posible rollback
        fotoUrl = url;
        fotoPath = path;
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
            fotoUrl,
            fotoPath,
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
            fotoUrl,
            fotoPath,
          });
          toast("Obra registrada correctamente.", "success");
        }
      } else if (esCapaDin) {
        // ── Marcadores de capa dinámica ──
        const has = (f) => camposCapa.includes(f);
        const payload = {
          capa,
          nombre,
          tipo:          has("tipo")          ? (tipo || null)                     : null,
          distritoLocal: has("distritoLocal") ? (distritoLocal || null)            : null,
          seccion:       has("seccion")       ? (seccion || null)                  : null,
          zonaElectoral: has("zonaElectoral") ? (zonaElectoral || null)            : null,
          referencia:    has("referencia")    ? (referencia || null)               : null,
          participacion: has("participacion") ? (parseFloat(participacion) || null) : null,
          detalles:      has("detalles")      ? (detalles || null)                 : null,
          pinColor:      has("pinColor")      ? pinColor                           : null,
          seleccionado:  has("seleccionado")  ? seleccionado                       : false,
          visitado:      has("visitado")      ? visitado                           : false,
          direccion:     has("direccion")     ? (direccion || null)                : null,
          telefono:      has("telefono")      ? (telefono || null)                 : null,
          zona:          has("zona")          ? (zona || null)                     : null,
          red:           has("red")           ? (red || null)                      : null,
          atendido:      has("atendido")      ? atendido                           : false,
          coords: coordsTemporales,
          userEmail,
          pinImageUrl,
          pinImagePath,
          fotoUrl,
          fotoPath,
        };
        if (editandoId) {
          await updateMarcador({ ...payload, id: editandoId });
          toast("Marcador actualizado correctamente.", "success");
        } else {
          await createMarcador(payload);
          toast("Marcador registrado correctamente.", "success");
        }
      } else {
        // ── Marcadores Rural / Top100 / General ──
        const esEspectacular = capa === "general" || capa === "capital" || capa === "municipios";
        const payload = {
          capa,
          nombre,
          tipo: capa === "guardianes" ? null : tipo,
          distritoLocal: distritoLocal || null,
          seccion: seccion || null,
          zonaElectoral: (capa === "rural" || capa === "top100") ? (zonaElectoral || null) : null,
          referencia: (capa === "rural" || capa === "top100") ? (referencia || null) : null,
          participacion: (capa === "rural" || capa === "top100") ? (parseFloat(participacion) || null) : null,
          detalles: detalles || null,
          pinColor: esEspectacular ? pinColor : null,
          seleccionado: esEspectacular ? seleccionado : null,
          visitado: (capa === "rural" || capa === "top100") ? visitado : null,
          direccion: capa === "guardianes" ? (direccion || null) : null,
          telefono: capa === "guardianes" ? (telefono || null) : null,
          zona: capa === "guardianes" ? (zona || null) : null,
          red: capa === "guardianes" ? (red || null) : null,
          atendido: capa === "guardianes" ? atendido : null,
          coords: coordsTemporales,
          userEmail,
          pinImageUrl,
          pinImagePath,
          fotoUrl,
          fotoPath,
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
      // Rollback: eliminar imágenes recién subidas si el write a Firestore falló
      for (const path of nuevosPathsSubidos) {
        await eliminarImagenPin(path).catch(() => {});
      }
      console.error(err);
      toast("Error al guardar el marcador.", "error");
    } finally {
      setSaving(false);
    }
  }, [
    capa, nombre, tipo, anio, distritoLocal, seccion, zonaElectoral, referencia, participacion, detalles,
    pinColor, seleccionado, visitado, direccion, telefono, zona, red, atendido,
    imagen, foto, editandoId, coordsTemporales, user, toast, closeModal, onSaved, coleccionesConfig,
  ]);

  if (!modalOpen) return null;

  const esEdicion = !!editandoId;
  const capaActiva = esEdicion ? (editandoCapa ?? capa) : capa;
  const cfgActiva = coleccionesConfig.find((c) => c.key === capaActiva) ?? null;
  const camposActivos = cfgActiva?.campos ?? [];
  const has = (f) => camposActivos.includes(f);

  const tituloModal = esEdicion
    ? `✏️ Editar ${TIPOS_MARCADOR.find((t) => t.value === capaActiva)?.label ?? cfgActiva?.label ?? "Marcador"}`
    : "📍 Nuevo Marcador";

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4">
      <div className="w-full sm:max-w-sm bg-[#1e293b] border border-[#334155] rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[92vh] sm:max-h-[90vh]">
        {/* Header */}
        <div className="px-4 sm:px-6 pt-4 sm:pt-5 pb-3 sm:pb-4 border-b border-[#334155] shrink-0">
          <h3 className="text-base font-semibold text-white">{tituloModal}</h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Ingresa los detalles del marcador en esta ubicación.
          </p>
        </div>

        {/* Cuerpo scrollable */}
        <div className="overflow-y-auto flex-1 px-4 sm:px-6 py-4 sm:py-5 flex flex-col gap-4">

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
                {coleccionesConfig.map(({ key, label: lbl, color }) => (
                  <button
                    key={key}
                    onClick={() => setCapa(key)}
                    className={`text-xs font-medium py-2 px-3 rounded-lg border transition-colors cursor-pointer ${
                      capa === key
                        ? "border-2 text-white"
                        : "bg-[#0f172a] border-[#334155] text-slate-300 hover:border-slate-400"
                    }`}
                    style={capa === key ? { backgroundColor: color + "33", borderColor: color, color } : {}}
                  >
                    {lbl}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Nombre — PP, Espectaculares, Guardianes y capas dinámicas */}
          {(capaActiva === "pp" || capaActiva === "general" || capaActiva === "capital" || capaActiva === "municipios" || capaActiva === "guardianes" || cfgActiva) && (
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
          )}

          {/* Tipo — PP y capas Espectaculares */}
          {(capaActiva === "pp" || capaActiva === "general" || capaActiva === "capital" || capaActiva === "municipios") && (
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
          )}

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

          {/* Campos dinámicos para capas personalizadas */}
          {cfgActiva && (
            <>
              {has("tipo") && (
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5 uppercase tracking-wider">Tipo</label>
                  <input type="text" value={tipo} onChange={(e) => setTipo(e.target.value)} placeholder="Ej. Categoría..." className="w-full bg-[#0f172a] border border-[#334155] text-white rounded-lg px-3 py-2.5 text-sm outline-none focus:border-blue-500 transition-colors placeholder:text-slate-600" />
                </div>
              )}
              {has("distritoLocal") && (
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5 uppercase tracking-wider">Distrito Local</label>
                  <select value={distritoLocal} onChange={(e) => setDistritoLocal(e.target.value)} className="w-full bg-[#0f172a] border border-[#334155] text-white rounded-lg px-3 py-2.5 text-sm outline-none focus:border-blue-500 cursor-pointer">
                    <option value="">Seleccionar distrito...</option>
                    {(cfgActiva.dlMax === 6 ? DISTRITOS_LOCALES.slice(0, 6) : DISTRITOS_LOCALES).map((dl) => (
                      <option key={dl} value={dl}>{dl}</option>
                    ))}
                  </select>
                </div>
              )}
              {has("seccion") && (
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5 uppercase tracking-wider">Sección Electoral</label>
                  <input type="text" list="secciones-list-dyn" value={seccion} onChange={(e) => setSeccion(e.target.value)} placeholder="Ej. 42" className="w-full bg-[#0f172a] border border-[#334155] text-white rounded-lg px-3 py-2.5 text-sm outline-none focus:border-blue-500 transition-colors placeholder:text-slate-600" />
                  <datalist id="secciones-list-dyn">{SECCIONES.map((s) => <option key={s} value={s} />)}</datalist>
                </div>
              )}
              {has("zonaElectoral") && (
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5 uppercase tracking-wider">Zona Electoral</label>
                  <input type="text" value={zonaElectoral} onChange={(e) => setZonaElectoral(e.target.value)} placeholder="Ej. 39" className="w-full bg-[#0f172a] border border-[#334155] text-white rounded-lg px-3 py-2.5 text-sm outline-none focus:border-blue-500 transition-colors placeholder:text-slate-600" />
                </div>
              )}
              {has("referencia") && (
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5 uppercase tracking-wider">Referencia</label>
                  <input type="text" value={referencia} onChange={(e) => setReferencia(e.target.value)} placeholder="Ej. Frente al parque" className="w-full bg-[#0f172a] border border-[#334155] text-white rounded-lg px-3 py-2.5 text-sm outline-none focus:border-blue-500 transition-colors placeholder:text-slate-600" />
                </div>
              )}
              {has("participacion") && (
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5 uppercase tracking-wider">Participación <span className="text-slate-500 normal-case">(%)</span></label>
                  <input type="number" min="0" max="100" step="0.1" value={participacion} onChange={(e) => setParticipacion(e.target.value)} placeholder="Ej. 63.4" className="w-full bg-[#0f172a] border border-[#334155] text-white rounded-lg px-3 py-2.5 text-sm outline-none focus:border-blue-500 transition-colors placeholder:text-slate-600" />
                </div>
              )}
              {has("direccion") && (
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5 uppercase tracking-wider">Dirección</label>
                  <input type="text" value={direccion} onChange={(e) => setDireccion(e.target.value)} placeholder="Ej. Av. 20 de Noviembre 123" className="w-full bg-[#0f172a] border border-[#334155] text-white rounded-lg px-3 py-2.5 text-sm outline-none focus:border-blue-500 transition-colors placeholder:text-slate-600" />
                </div>
              )}
              {has("telefono") && (
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5 uppercase tracking-wider">Teléfono</label>
                  <input type="text" value={telefono} onChange={(e) => setTelefono(e.target.value)} placeholder="Ej. 618 123 4567" className="w-full bg-[#0f172a] border border-[#334155] text-white rounded-lg px-3 py-2.5 text-sm outline-none focus:border-blue-500 transition-colors placeholder:text-slate-600" />
                </div>
              )}
              {has("zona") && (
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5 uppercase tracking-wider">Zona</label>
                  <input type="text" value={zona} onChange={(e) => setZona(e.target.value)} placeholder="Ej. Norte, Centro..." className="w-full bg-[#0f172a] border border-[#334155] text-white rounded-lg px-3 py-2.5 text-sm outline-none focus:border-blue-500 transition-colors placeholder:text-slate-600" />
                </div>
              )}
              {has("red") && (
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5 uppercase tracking-wider">Red / Dependencia</label>
                  <select value={red} onChange={(e) => setRed(e.target.value)} className="w-full bg-[#0f172a] border border-[#334155] text-white rounded-lg px-3 py-2.5 text-sm outline-none focus:border-blue-500 cursor-pointer">
                    <option value="">Seleccionar red...</option>
                    {REDES_GUARDIANES.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
              )}
              {has("detalles") && (
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5 uppercase tracking-wider">Detalles</label>
                  <textarea value={detalles} onChange={(e) => setDetalles(e.target.value)} rows={3} placeholder="Descripción adicional..." className="w-full bg-[#0f172a] border border-[#334155] text-white rounded-lg px-3 py-2.5 text-sm outline-none focus:border-blue-500 transition-colors placeholder:text-slate-600 resize-none" />
                </div>
              )}
              {has("visitado") && (
                <label className="flex items-center gap-3 bg-[#0f172a] border border-[#334155] rounded-lg px-3 py-2.5 cursor-pointer hover:border-slate-400 transition-colors">
                  <input type="checkbox" checked={visitado} onChange={(e) => setVisitado(e.target.checked)} className="w-4 h-4 cursor-pointer accent-emerald-500 shrink-0" />
                  <span className="text-slate-200 text-sm">Visitado</span>
                </label>
              )}
              {has("atendido") && (
                <label className="flex items-center gap-3 bg-[#0f172a] border border-[#334155] rounded-lg px-3 py-2.5 cursor-pointer hover:border-slate-400 transition-colors">
                  <input type="checkbox" checked={atendido} onChange={(e) => setAtendido(e.target.checked)} className="w-4 h-4 cursor-pointer accent-yellow-500 shrink-0" />
                  <span className="text-slate-200 text-sm">Atendido</span>
                </label>
              )}
              {has("seleccionado") && (
                <label className="flex items-center gap-3 bg-[#0f172a] border border-[#334155] rounded-lg px-3 py-2.5 cursor-pointer hover:border-slate-400 transition-colors">
                  <input type="checkbox" checked={seleccionado} onChange={(e) => setSeleccionado(e.target.checked)} className="w-4 h-4 cursor-pointer accent-blue-500 shrink-0" />
                  <span className="text-slate-200 text-sm">Seleccionado</span>
                </label>
              )}
              {has("pinColor") && (
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5 uppercase tracking-wider">Color del Pin</label>
                  <div className="flex items-center gap-2 bg-[#0f172a] border border-[#334155] rounded-lg px-3 py-2">
                    <input type="color" value={pinColor} onChange={(e) => setPinColor(e.target.value)} className="w-8 h-8 rounded cursor-pointer border-0 bg-transparent p-0 shrink-0" />
                    <span className="text-slate-300 text-sm font-mono flex-1">{pinColor}</span>
                    <button type="button" onClick={() => setPinColor("#94a3b8")} className="text-slate-500 hover:text-slate-300 text-xs transition-colors cursor-pointer shrink-0">Reset</button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Campos Rural / Top100 / General (capas estáticas) */}
          {capaActiva !== "pp" && !cfgActiva && (
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
                  {(capaActiva === "guardianes" ? DISTRITOS_LOCALES.slice(0, 6) : DISTRITOS_LOCALES).map((dl) => (
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

              {/* Campos exclusivos de Guardianes del Camino */}
              {capaActiva === "guardianes" && (
                <>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5 uppercase tracking-wider">
                      Dirección
                    </label>
                    <input
                      type="text"
                      value={direccion}
                      onChange={(e) => setDireccion(e.target.value)}
                      placeholder="Ej. Av. 20 de Noviembre 123"
                      className="w-full bg-[#0f172a] border border-[#334155] text-white rounded-lg px-3 py-2.5 text-sm outline-none focus:border-blue-500 transition-colors placeholder:text-slate-600"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5 uppercase tracking-wider">
                      Teléfono
                    </label>
                    <input
                      type="text"
                      value={telefono}
                      onChange={(e) => setTelefono(e.target.value)}
                      placeholder="Ej. 618 123 4567"
                      className="w-full bg-[#0f172a] border border-[#334155] text-white rounded-lg px-3 py-2.5 text-sm outline-none focus:border-blue-500 transition-colors placeholder:text-slate-600"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5 uppercase tracking-wider">
                      Zona
                    </label>
                    <input
                      type="text"
                      value={zona}
                      onChange={(e) => setZona(e.target.value)}
                      placeholder="Ej. Norte, Centro..."
                      className="w-full bg-[#0f172a] border border-[#334155] text-white rounded-lg px-3 py-2.5 text-sm outline-none focus:border-blue-500 transition-colors placeholder:text-slate-600"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5 uppercase tracking-wider">
                      Red
                    </label>
                    <select
                      value={red}
                      onChange={(e) => setRed(e.target.value)}
                      className="w-full bg-[#0f172a] border border-[#334155] text-white rounded-lg px-3 py-2.5 text-sm outline-none focus:border-blue-500 cursor-pointer"
                    >
                      <option value="">Seleccionar red...</option>
                      {REDES_GUARDIANES.map((r) => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  </div>
                  <label className="flex items-center gap-3 bg-[#0f172a] border border-[#334155] rounded-lg px-3 py-2.5 cursor-pointer hover:border-slate-400 transition-colors">
                    <input
                      type="checkbox"
                      checked={atendido}
                      onChange={(e) => setAtendido(e.target.checked)}
                      className="w-4 h-4 cursor-pointer accent-yellow-500 shrink-0"
                    />
                    <span className="text-slate-200 text-sm">Atendido</span>
                  </label>
                </>
              )}

              {/* Zona Electoral y Referencia (solo Rural y Top 100) */}
              {(capaActiva === "rural" || capaActiva === "top100") && (
                <>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5 uppercase tracking-wider">
                      Zona Electoral
                    </label>
                    <input
                      type="text"
                      value={zonaElectoral}
                      onChange={(e) => setZonaElectoral(e.target.value)}
                      placeholder="Ej. 39"
                      className="w-full bg-[#0f172a] border border-[#334155] text-white rounded-lg px-3 py-2.5 text-sm outline-none focus:border-blue-500 transition-colors placeholder:text-slate-600"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5 uppercase tracking-wider">
                      Referencia
                    </label>
                    <input
                      type="text"
                      value={referencia}
                      onChange={(e) => setReferencia(e.target.value)}
                      placeholder="Ej. Frente al parque central"
                      className="w-full bg-[#0f172a] border border-[#334155] text-white rounded-lg px-3 py-2.5 text-sm outline-none focus:border-blue-500 transition-colors placeholder:text-slate-600"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5 uppercase tracking-wider">
                      Participación <span className="text-slate-500 normal-case">(%)</span>
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={participacion}
                      onChange={(e) => setParticipacion(e.target.value)}
                      placeholder="Ej. 63.4"
                      className="w-full bg-[#0f172a] border border-[#334155] text-white rounded-lg px-3 py-2.5 text-sm outline-none focus:border-blue-500 transition-colors placeholder:text-slate-600"
                    />
                  </div>
                </>
              )}

              {/* Visitado (Rural / Top 100) */}
              {(capaActiva === "rural" || capaActiva === "top100") && (
                <label className="flex items-center gap-3 bg-[#0f172a] border border-[#334155] rounded-lg px-3 py-2.5 cursor-pointer hover:border-slate-400 transition-colors">
                  <input
                    type="checkbox"
                    checked={visitado}
                    onChange={(e) => setVisitado(e.target.checked)}
                    className="w-4 h-4 cursor-pointer accent-emerald-500 shrink-0"
                  />
                  <span className="text-slate-200 text-sm">Visitado</span>
                </label>
              )}

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

              {/* Color del pin y Seleccionado (capas Espectaculares) */}
              {(capaActiva === "general" || capaActiva === "capital" || capaActiva === "municipios") && (
                <>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5 uppercase tracking-wider">
                      Color del Pin
                    </label>
                    <div className="flex items-center gap-2 bg-[#0f172a] border border-[#334155] rounded-lg px-3 py-2">
                      <input
                        type="color"
                        value={pinColor}
                        onChange={(e) => setPinColor(e.target.value)}
                        className="w-8 h-8 rounded cursor-pointer border-0 bg-transparent p-0 shrink-0"
                        style={{ appearance: "none", WebkitAppearance: "none" }}
                      />
                      <span className="text-slate-300 text-sm font-mono flex-1">{pinColor}</span>
                      <button
                        type="button"
                        onClick={() => setPinColor("#94a3b8")}
                        className="text-slate-500 hover:text-slate-300 text-xs transition-colors cursor-pointer shrink-0"
                      >
                        Reset
                      </button>
                    </div>
                  </div>

                  <label className="flex items-center gap-3 bg-[#0f172a] border border-[#334155] rounded-lg px-3 py-2.5 cursor-pointer hover:border-slate-400 transition-colors">
                    <input
                      type="checkbox"
                      checked={seleccionado}
                      onChange={(e) => setSeleccionado(e.target.checked)}
                      className="w-4 h-4 cursor-pointer accent-blue-500 shrink-0"
                    />
                    <span className="text-slate-200 text-sm">Seleccionado</span>
                  </label>
                </>
              )}
            </>
          )}

          {/* Imagen del pin */}
          <ImagenDropzone
            previewActivo={imagen.previewActivo}
            onDrop={(file) => imagen.procesar(file, toast)}
            onQuitar={(ref) => imagen.quitar(ref)}
            onProcesar={(file) => imagen.procesar(file, toast)}
          />

          {/* Foto del marcador (aparece en popup) */}
          <ImagenDropzone
            label="Foto del marcador"
            sublabel="Esta foto aparecerá al hacer clic en el marcador del mapa."
            previewActivo={foto.previewActivo}
            onDrop={(file) => foto.procesar(file, toast)}
            onQuitar={(ref) => foto.quitar(ref)}
            onProcesar={(file) => foto.procesar(file, toast)}
          />
        </div>

        {/* Footer */}
        <div className="px-4 sm:px-6 pb-5 pt-3 sm:pt-4 border-t border-[#334155] shrink-0 flex gap-3">
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
