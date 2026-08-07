import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useElectoralStore } from "../../store/electoralStore";
import { useMapStore } from "../../store/mapStore";
import { MUNICIPIOS } from "../../config";
import { exportarCartografiaPDF } from "../../services/exportarPDF";

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Consulta el source layer SECCION y devuelve todas las secciones
 * que pertenecen a la zona indicada (campo ZONA de las teselas).
 * Intenta tanto comparación numérica como de string.
 */
function seccionesDeZona(mapInstance, zonaNum) {
  if (!mapInstance || !zonaNum) return [];
  try {
    const zonaInt = Number(zonaNum);

    // Intentar con valor numérico primero
    let features = mapInstance.querySourceFeatures("cartografia-electoral", {
      sourceLayer: "SECCION",
      filter: ["==", ["get", "ZONA"], zonaInt],
    });

    // Si no hay resultado, intentar como string
    if (features.length === 0) {
      features = mapInstance.querySourceFeatures("cartografia-electoral", {
        sourceLayer: "SECCION",
        filter: ["==", ["get", "ZONA"], zonaNum.trim()],
      });
    }

    return [
      ...new Set(
        features.map((f) => String(f.properties?.SECCION)).filter(Boolean),
      ),
    ].sort((a, b) => Number(a) - Number(b));
  } catch {
    return [];
  }
}

/**
 * Calcula el bounding box de todas las features de una zona
 * para usarlo en fitBounds.
 * Retorna [[minLng, minLat], [maxLng, maxLat]] o null.
 */
function bboxDeZona(mapInstance, zonaNum) {
  if (!mapInstance || !zonaNum) return null;
  try {
    const zonaInt = Number(zonaNum);
    let features = mapInstance.querySourceFeatures("cartografia-electoral", {
      sourceLayer: "SECCION",
      filter: ["==", ["get", "ZONA"], zonaInt],
    });
    if (features.length === 0) {
      features = mapInstance.querySourceFeatures("cartografia-electoral", {
        sourceLayer: "SECCION",
        filter: ["==", ["get", "ZONA"], zonaNum.trim()],
      });
    }
    if (features.length === 0) return null;

    let minLng = Infinity,
      maxLng = -Infinity;
    let minLat = Infinity,
      maxLat = -Infinity;

    features.forEach((f) => {
      const geom = f.geometry;
      if (!geom) return;
      const polys =
        geom.type === "MultiPolygon" ? geom.coordinates : [geom.coordinates];
      polys.forEach((poly) => {
        poly[0]?.forEach(([lng, lat]) => {
          if (lng < minLng) minLng = lng;
          if (lng > maxLng) maxLng = lng;
          if (lat < minLat) minLat = lat;
          if (lat > maxLat) maxLat = lat;
        });
      });
    });

    if (!isFinite(minLng)) return null;
    return [
      [minLng, minLat],
      [maxLng, maxLat],
    ];
  } catch {
    return null;
  }
}

/**
 * Vuela al centroide de una sección usando primero las casillas del store,
 * y como fallback las teselas ya cargadas.
 */
function volarASeccion(mapInstance, seccionNum, casillas) {
  if (!mapInstance || !seccionNum) return;

  const conCoords = casillas.filter(
    (c) => c.seccion === seccionNum && c.coords,
  );
  if (conCoords.length > 0) {
    const lat =
      conCoords.reduce((s, c) => s + c.coords.lat, 0) / conCoords.length;
    const lng =
      conCoords.reduce((s, c) => s + c.coords.lng, 0) / conCoords.length;
    mapInstance.flyTo({ center: [lng, lat], zoom: 14, duration: 1000 });
    return;
  }

  try {
    const features = mapInstance.querySourceFeatures("cartografia-electoral", {
      sourceLayer: "SECCION",
      filter: ["==", ["get", "SECCION"], Number(seccionNum)],
    });
    if (features.length > 0 && features[0].geometry) {
      const ring =
        features[0].geometry.coordinates?.[0]?.[0] ??
        features[0].geometry.coordinates?.[0];
      if (ring?.length) {
        const lngs = ring.map((p) => p[0]);
        const lats = ring.map((p) => p[1]);
        mapInstance.flyTo({
          center: [
            (Math.min(...lngs) + Math.max(...lngs)) / 2,
            (Math.min(...lats) + Math.max(...lats)) / 2,
          ],
          zoom: 14,
          duration: 1000,
        });
      }
    }
  } catch {
    /* sin coords disponibles */
  }
}

// ── Componente ─────────────────────────────────────────────────────────────

const ExportarPDFModal = ({ open, onClose }) => {
  const { casillas } = useElectoralStore();
  const { mapInstance } = useMapStore();

  // ── Estado ──────────────────────────────────────────────────────────────
  const [dependencia, setDependencia] = useState(
    () => localStorage.getItem("pdf_dependencia") || "",
  );
  const [tipo, setTipo] = useState("seccion");
  const [municipio, setMunicipio] = useState("TODOS");
  const [seccion, setSeccion] = useState("");
  const [bboxSeccion, setBboxSeccion] = useState(null); // bbox solo para secciones

  // Estado zona
  const [zonaInput, setZonaInput] = useState(""); // campo de texto de la zona actual
  const [zonaPreview, setZonaPreview] = useState({ secciones: [], bbox: null }); // preview mientras se teclea
  const [zonasSeleccionadas, setZonasSeleccionadas] = useState([]); // zonas confirmadas

  const [progreso, setProgreso] = useState(0);
  const [exportando, setExportando] = useState(false);
  const [error, setError] = useState(null);
  const [exito, setExito] = useState(false);

  // Ref para guardar el handler de sourcedata (limpieza)
  const sourcedataHandlerRef = useRef(null);

  // ── Reset al abrir ───────────────────────────────────────────────────────
  useEffect(() => {
    if (open) {
      setDependencia(localStorage.getItem("pdf_dependencia") || "");
      setTipo("seccion");
      setMunicipio("TODOS");
      setSeccion("");
      setBboxSeccion(null);
      setZonaInput("");
      setZonaPreview({ secciones: [], bbox: null });
      setZonasSeleccionadas([]);
      setProgreso(0);
      setError(null);
      setExito(false);
      setExportando(false);
    }
  }, [open]);

  // ── Secciones disponibles para sección (del store) ───────────────────────
  const seccionesDisponibles = useMemo(() => {
    const base =
      municipio === "TODOS"
        ? casillas
        : casillas.filter((c) => c.id_municipio === municipio);
    return [...new Set(base.map((c) => c.seccion))].sort(
      (a, b) => Number(a) - Number(b),
    );
  }, [casillas, municipio]);

  const municipioNombre = useMemo(
    () => MUNICIPIOS.find((m) => m.value === municipio)?.label ?? "",
    [municipio],
  );

  // ── Calcular bbox de la sección seleccionada ────────────────────────────
  useEffect(() => {
    if (tipo !== "seccion" || !seccion) {
      if (tipo === "seccion") setBboxSeccion(null);
      return;
    }

    // Intentar con coords de casillas
    const conCoords = casillas.filter((c) => c.seccion === seccion && c.coords);
    if (conCoords.length > 0) {
      const lats = conCoords.map((c) => c.coords.lat);
      const lngs = conCoords.map((c) => c.coords.lng);
      const pad = 0.0008; // ~90 m de margen — suficiente para ver el borde sin alejar demasiado
      setBboxSeccion([
        [Math.min(...lngs) - pad, Math.min(...lats) - pad],
        [Math.max(...lngs) + pad, Math.max(...lats) + pad],
      ]);
      return;
    }

    // Fallback: teselas vectoriales
    if (!mapInstance) return;
    try {
      const features = mapInstance.querySourceFeatures(
        "cartografia-electoral",
        {
          sourceLayer: "SECCION",
          filter: ["==", ["get", "SECCION"], Number(seccion)],
        },
      );
      if (features.length > 0 && features[0].geometry) {
        let minLng = Infinity,
          maxLng = -Infinity;
        let minLat = Infinity,
          maxLat = -Infinity;
        const polys =
          features[0].geometry.type === "MultiPolygon"
            ? features[0].geometry.coordinates
            : [features[0].geometry.coordinates];
        polys.forEach((poly) =>
          poly[0]?.forEach(([lng, lat]) => {
            if (lng < minLng) minLng = lng;
            if (lng > maxLng) maxLng = lng;
            if (lat < minLat) minLat = lat;
            if (lat > maxLat) maxLat = lat;
          }),
        );
        if (isFinite(minLng))
          setBboxSeccion([
            [minLng, minLat],
            [maxLng, maxLat],
          ]);
      }
    } catch {
      /* sin teselas disponibles aún */
    }
  }, [seccion, tipo, mapInstance, casillas]);

  // ── Resolver secciones + bbox del zonaInput → actualiza zonaPreview ───────
  const resolverSeccionesZona = useCallback(() => {
    if (tipo !== "zona" || !zonaInput.trim() || !mapInstance) return;
    const nums = seccionesDeZona(mapInstance, zonaInput);
    const box = nums.length > 0 ? bboxDeZona(mapInstance, zonaInput) : null;
    setZonaPreview({ secciones: nums, bbox: box });
  }, [tipo, zonaInput, mapInstance]);

  // Ejecutar al cambiar zonaInput
  useEffect(() => {
    if (!open || tipo !== "zona") return;
    setZonaPreview({ secciones: [], bbox: null });
    if (!zonaInput.trim()) return;

    // Intentar de inmediato (tiles podrían ya estar cargadas)
    resolverSeccionesZona();

    // Escuchar cuando nuevas tiles terminen de cargar para re-intentar
    if (!mapInstance) return;
    if (sourcedataHandlerRef.current) {
      mapInstance.off("sourcedata", sourcedataHandlerRef.current);
    }
    const handler = (e) => {
      if (e.isSourceLoaded && e.sourceId === "cartografia-electoral") {
        resolverSeccionesZona();
      }
    };
    sourcedataHandlerRef.current = handler;
    mapInstance.on("sourcedata", handler);

    return () => {
      mapInstance.off("sourcedata", handler);
    };
  }, [open, tipo, zonaInput, mapInstance, resolverSeccionesZona]);

  // ── Limpiar listener al cerrar el modal ──────────────────────────────────
  useEffect(() => {
    if (!open && sourcedataHandlerRef.current && mapInstance) {
      mapInstance.off("sourcedata", sourcedataHandlerRef.current);
      sourcedataHandlerRef.current = null;
    }
  }, [open, mapInstance]);

  // ── bbox combinado de TODAS las zonas seleccionadas ──────────────────────
  const bboxZonas = useMemo(() => {
    const boxes = zonasSeleccionadas.map((z) => z.bbox).filter(Boolean);
    if (boxes.length === 0) return zonaPreview.bbox;
    if (boxes.length === 1) return boxes[0];
    let minLng = Infinity,
      maxLng = -Infinity,
      minLat = Infinity,
      maxLat = -Infinity;
    boxes.forEach(([[lng1, lat1], [lng2, lat2]]) => {
      if (lng1 < minLng) minLng = lng1;
      if (lng2 > maxLng) maxLng = lng2;
      if (lat1 < minLat) minLat = lat1;
      if (lat2 > maxLat) maxLat = lat2;
    });
    return [
      [minLng, minLat],
      [maxLng, maxLat],
    ];
  }, [zonasSeleccionadas, zonaPreview.bbox]);

  // ── Agregar zona a la lista ───────────────────────────────────────────────
  const agregarZona = useCallback(() => {
    const num = zonaInput.trim();
    if (!num) return;
    if (zonasSeleccionadas.length >= 3) {
      setError("Máximo 3 zonas por PDF.");
      return;
    }
    if (zonasSeleccionadas.some((z) => z.numero === num)) {
      setError(`La zona ${num} ya está en la lista.`);
      return;
    }
    setZonasSeleccionadas((prev) => [
      ...prev,
      {
        numero: num,
        secciones: zonaPreview.secciones,
        bbox: zonaPreview.bbox,
      },
    ]);
    setZonaInput("");
    setZonaPreview({ secciones: [], bbox: null });
    setError(null);
  }, [zonaInput, zonaPreview, zonasSeleccionadas]);

  // ── Eliminar zona de la lista ─────────────────────────────────────────────
  const eliminarZona = (numero) => {
    setZonasSeleccionadas((prev) => prev.filter((z) => z.numero !== numero));
  };

  // ── Validación ───────────────────────────────────────────────────────────
  const puedeExportar = useMemo(() => {
    if (exportando) return false;
    if (!dependencia.trim()) return false;
    if (tipo === "seccion") return !!seccion;
    return zonasSeleccionadas.length > 0;
  }, [tipo, seccion, zonasSeleccionadas, exportando, dependencia]);

  // ── Exportar ──────────────────────────────────────────────────────────────────────────────────────
  const handleExportar = async () => {
    setError(null);
    setExito(false);
    setExportando(true);
    setProgreso(0);

    const dependenciaFinal = dependencia.trim();
    localStorage.setItem("pdf_dependencia", dependenciaFinal);

    try {
      // El bbox ya NO se pasa al servicio: el usuario posiciona el mapa
      // a su gusto antes de exportar. El servicio captura lo que hay en pantalla.
      await exportarCartografiaPDF({
        mapInstance,
        tipo,
        numero: tipo === "seccion" ? seccion : "",
        zonas: tipo === "zona" ? zonasSeleccionadas : [],
        municipioNombre: tipo === "seccion" ? municipioNombre : "",
        dependencia: dependenciaFinal,
        onProgress: setProgreso,
      });
      setExito(true);
    } catch (err) {
      console.error("Error exportando PDF:", err);
      setError("Ocurrió un error al generar el PDF. Verifica la consola.");
    } finally {
      setExportando(false);
    }
  };

  if (!open) return null;

  // ── Nombre de archivo de éxito ────────────────────────────────────────────
  const nombreArchivo =
    tipo === "seccion"
      ? `seccion_${seccion}_cartografia.pdf`
      : zonasSeleccionadas.length === 1
        ? `zona_${zonasSeleccionadas[0].numero}_cartografia.pdf`
        : `multizona_${zonasSeleccionadas.map((z) => z.numero).join("-")}_cartografia.pdf`;

  // ── Helpers de UI ─────────────────────────────────────────────────────────
  const MAX_ZONAS = 3;
  const puedeAgregarZona =
    !!zonaInput.trim() &&
    zonasSeleccionadas.length < MAX_ZONAS &&
    !zonasSeleccionadas.some((z) => z.numero === zonaInput.trim()) &&
    !exportando;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-[#1e293b] border border-[#334155] rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-[#334155]">
          <div>
            <h3 className="text-sm font-bold text-white">
              🗺️ Exportar mapa a PDF
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Captura cartográfica en hoja oficio — sin datos electorales
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={exportando}
            className="text-slate-400 hover:text-white text-xl cursor-pointer disabled:opacity-50"
          >
            ✖
          </button>
        </div>

        <div className="px-5 py-4 flex flex-col gap-4">
          {/* ── Dependencia ── */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">
              Dependencia <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={dependencia}
              onChange={(e) => {
                setDependencia(e.target.value);
                setError(null);
              }}
              disabled={exportando}
              placeholder="Ej. AMD, IEED, Ayuntamiento de Durango..."
              maxLength={60}
              className="w-full bg-[#0f172a] border border-[#334155] text-white text-sm rounded-lg px-3 py-2 outline-none focus:border-blue-500 disabled:opacity-50"
            />
            <p className="text-xs text-slate-600 mt-1">
              Aparecerá en la esquina superior izquierda del PDF.
            </p>
          </div>

          {/* ── Selector de tipo ── */}
          <div>
            <p className="text-xs font-medium text-slate-400 mb-2">
              ¿Qué quieres exportar?
            </p>
            <div className="grid grid-cols-2 gap-2">
              {[
                {
                  val: "seccion",
                  icon: "📍",
                  label: "Sección",
                  desc: "Una sección electoral",
                },
                {
                  val: "zona",
                  icon: "🗂",
                  label: "Zona",
                  desc: "Zona con sus secciones",
                },
              ].map(({ val, icon, label, desc }) => (
                <button
                  key={val}
                  onClick={() => {
                    setTipo(val);
                    setError(null);
                    setZonaPreview({ secciones: [], bbox: null });
                  }}
                  disabled={exportando}
                  className={`flex flex-col items-center gap-1 py-3 px-2 rounded-xl border text-xs font-medium transition-colors cursor-pointer disabled:opacity-50 ${
                    tipo === val
                      ? "bg-blue-600 border-blue-400 text-white"
                      : "bg-[#0f172a] border-[#334155] text-slate-300 hover:bg-[#334155]"
                  }`}
                >
                  <span className="text-lg">{icon}</span>
                  <span className="font-bold">{label}</span>
                  <span
                    className={`font-normal ${tipo === val ? "text-blue-200" : "text-slate-500"}`}
                  >
                    {desc}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* ── SECCIÓN ── */}
          {tipo === "seccion" && (
            <>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">
                  Municipio{" "}
                  <span className="text-slate-600">(filtro opcional)</span>
                </label>
                <select
                  value={municipio}
                  onChange={(e) => {
                    setMunicipio(e.target.value);
                    setSeccion("");
                  }}
                  disabled={exportando}
                  className="w-full bg-[#0f172a] border border-[#334155] text-white text-sm rounded-lg px-3 py-2 outline-none focus:border-blue-500 cursor-pointer disabled:opacity-50"
                >
                  <option value="TODOS">Todo el Estado</option>
                  {MUNICIPIOS.filter((m) => m.value !== "TODOS").map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">
                  Número de sección
                  {seccionesDisponibles.length > 0 && (
                    <span className="text-slate-600 ml-1">
                      ({seccionesDisponibles.length} disponibles)
                    </span>
                  )}
                </label>
                <select
                  value={seccion}
                  onChange={(e) => setSeccion(e.target.value)}
                  disabled={exportando}
                  className="w-full bg-[#0f172a] border border-[#334155] text-white text-sm rounded-lg px-3 py-2 outline-none focus:border-blue-500 cursor-pointer disabled:opacity-50"
                >
                  <option value="">— Selecciona una sección —</option>
                  {seccionesDisponibles.map((s) => (
                    <option key={s} value={s}>
                      Sección {s}
                    </option>
                  ))}
                </select>
              </div>

              {seccion && (
                <div className="flex items-start gap-2 bg-blue-950/40 border border-blue-800/50 rounded-xl px-3 py-2.5">
                  <span className="text-blue-400 text-base">ℹ️</span>
                  <p className="text-xs text-blue-300">
                    El mapa se desplazó a la sección <strong>{seccion}</strong>.
                    Ajusta la vista antes de exportar si lo necesitas.
                  </p>
                </div>
              )}
            </>
          )}

          {/* ── ZONA ── */}
          {tipo === "zona" && (
            <>
              {/* Input + botón agregar */}
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">
                  Número de zona
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={zonaInput}
                    onChange={(e) => {
                      setZonaInput(e.target.value);
                      setError(null);
                    }}
                    onKeyDown={(e) =>
                      e.key === "Enter" && puedeAgregarZona && agregarZona()
                    }
                    disabled={exportando}
                    placeholder="Ej. 4"
                    className="flex-1 bg-[#0f172a] border border-[#334155] text-white text-sm rounded-lg px-3 py-2 outline-none focus:border-blue-500 disabled:opacity-50"
                  />
                  <button
                    onClick={agregarZona}
                    disabled={!puedeAgregarZona}
                    className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold px-3 py-2 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                  >
                    + Agregar
                  </button>
                </div>
              </div>

              {/* Preview de secciones del input actual */}
              {zonaInput.trim() && (
                <div className="bg-[#0f172a] border border-[#334155] rounded-xl p-3">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-medium text-slate-400">
                      Preview — zona {zonaInput.trim()}
                    </p>
                    {zonaPreview.secciones.length > 0 && (
                      <span className="text-xs font-bold text-sky-400">
                        {zonaPreview.secciones.length} secciones
                      </span>
                    )}
                  </div>

                  {zonaPreview.secciones.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                      {zonaPreview.secciones.slice(0, 12).map((s) => (
                        <span
                          key={s}
                          className="bg-[#1a3f6f] border border-[#2563eb]/50 text-sky-300 text-xs font-semibold px-2.5 py-1 rounded-lg"
                        >
                          {s}
                        </span>
                      ))}
                      {zonaPreview.secciones.length > 12 && (
                        <span className="bg-[#1a3f6f] border border-[#2563eb]/50 text-sky-400 text-xs font-semibold px-2.5 py-1 rounded-lg">
                          +{zonaPreview.secciones.length - 12} más
                        </span>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-amber-400">
                      ⏳ Cargando secciones... Asegúrate de que la capa{" "}
                      <span className="font-semibold text-amber-300">
                        Secciones
                      </span>{" "}
                      esté activa y navega al área de la zona (zoom ≥ 11).
                    </p>
                  )}
                </div>
              )}

              {/* Lista de zonas seleccionadas */}
              {zonasSeleccionadas.length > 0 && (
                <div className="flex flex-col gap-2">
                  {/* Header de la lista */}
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-slate-300">
                      Zonas seleccionadas ({zonasSeleccionadas.length}/
                      {MAX_ZONAS})
                    </p>
                    <button
                      onClick={() => setZonasSeleccionadas([])}
                      disabled={exportando}
                      className="text-xs text-red-400 hover:text-red-300 transition-colors cursor-pointer disabled:opacity-50"
                    >
                      Limpiar todo
                    </button>
                  </div>

                  {/* Cards de cada zona */}
                  {zonasSeleccionadas.map((zona) => (
                    <div
                      key={zona.numero}
                      className="bg-[#0f172a] border border-[#334155] rounded-xl p-3"
                    >
                      {/* Fila superior */}
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="bg-[#facc15]/20 text-yellow-300 text-xs font-bold px-2.5 py-1 rounded-lg">
                            Zona {zona.numero}
                          </span>
                          {zona.secciones.length > 0 && (
                            <span className="text-xs text-slate-400">
                              {zona.secciones.length} secciones
                            </span>
                          )}
                        </div>
                        <button
                          onClick={() => eliminarZona(zona.numero)}
                          disabled={exportando}
                          className="text-slate-500 hover:text-red-400 text-sm transition-colors cursor-pointer disabled:opacity-50 leading-none"
                          title="Quitar zona"
                        >
                          ✕
                        </button>
                      </div>

                      {/* Chips de secciones */}
                      {zona.secciones.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {zona.secciones.slice(0, 12).map((s) => (
                            <span
                              key={s}
                              className="bg-[#1a3f6f] border border-[#2563eb]/50 text-sky-300 text-xs font-semibold px-2 py-0.5 rounded-md"
                            >
                              {s}
                            </span>
                          ))}
                          {zona.secciones.length > 12 && (
                            <span className="bg-[#1a3f6f] border border-[#2563eb]/50 text-sky-400 text-xs font-semibold px-2 py-0.5 rounded-md">
                              +{zona.secciones.length - 12} más
                            </span>
                          )}
                        </div>
                      ) : (
                        <p className="text-xs text-yellow-400">
                          ⚠️ No se detectaron secciones para esta zona. Las
                          teselas pueden no estar cargadas aún.
                        </p>
                      )}
                    </div>
                  ))}

                  {/* Tip combinado cuando hay más de 1 zona */}
                  {zonasSeleccionadas.length > 1 && (
                    <div className="flex items-start gap-2 bg-blue-950/40 border border-blue-800/50 rounded-xl px-3 py-2.5">
                      <span className="text-blue-400 text-base">ℹ️</span>
                      <p className="text-xs text-blue-300">
                        El PDF mostrará una vista general con todas las zonas.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Tip general de zona */}
              {zonasSeleccionadas.length === 0 && !zonaInput.trim() && (
                <div className="flex items-start gap-2 bg-amber-950/30 border border-amber-800/40 rounded-xl px-3 py-2.5">
                  <span className="text-amber-500 text-base">💡</span>
                  <p className="text-xs text-amber-300 leading-relaxed">
                    Las secciones se detectan del campo{" "}
                    <span className="font-mono font-semibold">ZONA</span> de las
                    teselas cartográficas. Si el contador sigue en 0, activa la
                    capa Secciones y acerca el zoom al área de la zona.
                  </p>
                </div>
              )}
            </>
          )}

          {/* ── Barra de progreso ── */}
          {exportando && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs text-slate-400">
                  Generando PDF en hoja oficio...
                </span>
                <span className="text-xs text-blue-400 font-bold">
                  {progreso}%
                </span>
              </div>
              <div className="w-full bg-[#334155] rounded-full h-2">
                <div
                  className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progreso}%` }}
                />
              </div>
            </div>
          )}

          {/* ── Éxito ── */}
          {exito && (
            <div className="bg-emerald-900/30 border border-emerald-700 rounded-xl px-4 py-3 flex items-center gap-3">
              <span className="text-2xl">✅</span>
              <div>
                <p className="text-emerald-400 text-xs font-semibold">
                  PDF generado correctamente
                </p>
                <p className="text-emerald-600 text-xs mt-0.5 font-mono">
                  {nombreArchivo}
                </p>
              </div>
            </div>
          )}

          {/* ── Error ── */}
          {error && (
            <div className="bg-red-900/30 border border-red-700 rounded-xl px-4 py-3">
              <p className="text-red-400 text-xs leading-relaxed">⚠️ {error}</p>
            </div>
          )}
        </div>

        {/* ── Acciones ── */}
        <div className="px-5 pb-5 flex gap-2">
          <button
            onClick={onClose}
            disabled={exportando}
            className="flex-1 bg-[#334155] hover:bg-[#475569] text-slate-200 text-sm font-medium py-2.5 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
          >
            {exito ? "Cerrar" : "Cancelar"}
          </button>
          <button
            onClick={handleExportar}
            disabled={!puedeExportar}
            className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold py-2.5 rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-2"
          >
            {exportando ? (
              <>
                <span className="animate-spin inline-block">⏳</span>{" "}
                Generando...
              </>
            ) : (
              <>
                <span>📄</span> Exportar PDF
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExportarPDFModal;
