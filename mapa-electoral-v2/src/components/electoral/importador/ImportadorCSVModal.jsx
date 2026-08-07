import { useState, useRef, useCallback, useEffect } from "react";
import { useToast } from "../../ui/Toast";
import { parsearCSVCasillas } from "./parsearCSV";
import { calcularCentroidesDesdeArchivos } from "./calcularCentroide";
import { db } from "../../../services/firebase";
import {
  collection,
  writeBatch,
  doc,
  serverTimestamp,
} from "firebase/firestore";
import {
  limpiarCasillasEleccion,
  getCasillas,
} from "../../../services/electoralService";

// Cada casilla crea 2 docs (casilla + resultado), así que max 200 × 2 = 400 ops por batch
// Firestore tiene límite de 500 operaciones por batch
const BATCH_SIZE = 200;

const ImportadorCSVModal = ({ open, onClose, eleccionId, onImportado }) => {
  const toast = useToast();
  const inputRef = useRef(null);

  const [etapa, setEtapa] = useState("subir"); // subir | preview | importando | listo
  const [casillas, setCasillas] = useState([]);
  const [resumen, setResumen] = useState(null);
  const [errores, setErrores] = useState([]);
  const [progreso, setProgreso] = useState(0);
  const [faseMsg, setFaseMsg] = useState("");
  const [sinCoords, setSinCoords] = useState(0);
  const [casillasPrevias, setCasillasPrevias] = useState(0);

  // Verificar si ya hay casillas importadas para esta elección
  useEffect(() => {
    if (!open || !eleccionId) return;
    getCasillas(eleccionId)
      .then((arr) => setCasillasPrevias(arr.length))
      .catch(() => {});
  }, [open, eleccionId]);

  const resetear = () => {
    setEtapa("subir");
    setCasillas([]);
    setResumen(null);
    setErrores([]);
    setProgreso(0);
    setSinCoords(0);
  };

  const handleArchivo = useCallback((archivo) => {
    if (!archivo) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const contenido = e.target.result;
      const resultado = parsearCSVCasillas(contenido);
      setCasillas(resultado.casillas);
      setResumen(resultado.resumen);
      setErrores(resultado.errores);
      setEtapa("preview");
    };
    reader.readAsText(archivo, "UTF-8");
  }, []);

  const handleDrop = (e) => {
    e.preventDefault();
    const archivo = e.dataTransfer.files[0];
    if (archivo?.name.endsWith(".csv")) handleArchivo(archivo);
    else toast("Solo se aceptan archivos .csv", "warning");
  };

  const handleImportar = async () => {
    if (!eleccionId) {
      toast("No hay elección seleccionada.", "error");
      return;
    }
    if (!casillas.length) {
      toast("No hay casillas para importar.", "warning");
      return;
    }

    setEtapa("importando");
    setProgreso(0);

    // ── Paso 0: limpiar casillas previas si existen ──
    if (casillasPrevias > 0) {
      setFaseMsg(`Eliminando ${casillasPrevias} casillas previas...`);
      try {
        await limpiarCasillasEleccion(eleccionId);
      } catch (err) {
        console.error("[ImportadorCSV] Error limpiando previos:", err);
        toast("Error al limpiar datos previos.", "error");
        setEtapa("preview");
        return;
      }
    }

    // ── Paso 1: calcular centroides leyendo los .pbf directamente ──
    setFaseMsg("Leyendo teselas cartográficas...");
    const seccionesUnicas = [...new Set(casillas.map((c) => c.seccion))];
    const centroidesMap = await calcularCentroidesDesdeArchivos(
      seccionesUnicas,
      (pct) => setProgreso(Math.round(pct * 0.4)), // 0-40 %
    );
    const sinCoordsCount = casillas.filter(
      (c) => !centroidesMap[c.seccion],
    ).length;
    setSinCoords(sinCoordsCount);

    // ── Paso 2: escribir en Firestore ──
    setFaseMsg("Guardando en Firestore...");
    setProgreso(40);
    const total = casillas.length;
    let procesadas = 0;

    try {
      // Dividir en batches
      for (let i = 0; i < casillas.length; i += BATCH_SIZE) {
        const lote = casillas.slice(i, i + BATCH_SIZE);
        const batch = writeBatch(db);

        lote.forEach((casilla) => {
          const coords = centroidesMap[casilla.seccion] ?? null;
          const ref = doc(collection(db, "casillas"));

          // Documento de casilla
          batch.set(ref, {
            eleccion_id: eleccionId,
            clave_casilla: casilla.clave_casilla,
            id_municipio: casilla.id_municipio,
            municipio: casilla.municipio,
            seccion: casilla.seccion,
            id_casilla: casilla.id_casilla,
            tipo: casilla.tipo,
            ubicacion: casilla.ubicacion,
            lista_nominal: casilla.lista_nominal,
            contabilizada: casilla.contabilizada,
            coords: coords,
            creadoEn: serverTimestamp(),
          });

          // Documento de resultado (si tiene votos)
          if (casilla.total_votos > 0) {
            const refResult = doc(collection(db, "resultados"));
            batch.set(refResult, {
              casilla_id: ref.id,
              eleccion_id: eleccionId,
              seccion: casilla.seccion,
              municipio: casilla.municipio,
              votos: casilla.votos,
              total_votos: casilla.total_votos,
              capturado_por: "Importación CSV INE 2025",
              verificado: true,
              creadoEn: serverTimestamp(),
              actualizadoEn: serverTimestamp(),
            });
          }
        });

        await batch.commit();
        procesadas += lote.length;
        setProgreso(40 + Math.round((procesadas / total) * 60)); // 40-100 %
      }

      setEtapa("listo");
      toast(`✅ ${procesadas} casillas importadas correctamente.`, "success");
      onImportado?.();
    } catch (err) {
      console.error("[ImportadorCSV]", err);
      toast("Error durante la importación. Revisa la consola.", "error");
      setEtapa("preview");
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-[#1e293b] border border-[#334155] rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-[#334155] flex-shrink-0">
          <div>
            <h3 className="text-base font-semibold text-white">
              📥 Importar Casillas desde CSV
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Formato INE — DGO_AYUN_2025.csv
            </p>
          </div>
          <button
            onClick={() => {
              resetear();
              onClose();
            }}
            className="text-slate-400 hover:text-white text-xl cursor-pointer"
          >
            ✖
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {/* ── ETAPA: SUBIR ── */}
          {etapa === "subir" && (
            <div
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              className="border-2 border-dashed border-[#334155] hover:border-blue-500 rounded-xl p-10 text-center transition-colors cursor-pointer"
              onClick={() => inputRef.current?.click()}
            >
              <div className="text-4xl mb-3">📄</div>
              <p className="text-slate-300 text-sm font-medium mb-1">
                Arrastra tu archivo CSV aquí
              </p>
              <p className="text-slate-500 text-xs mb-4">
                o haz clic para seleccionarlo
              </p>
              <p className="text-slate-600 text-xs">
                Formato: DGO_AYUN_2025.csv del INE
              </p>
              <input
                ref={inputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={(e) => handleArchivo(e.target.files[0])}
              />
            </div>
          )}

          {/* ── ETAPA: PREVIEW ── */}
          {etapa === "preview" && resumen && (
            <div className="flex flex-col gap-4">
              {/* Aviso de reimportación */}
              {casillasPrevias > 0 && (
                <div className="bg-red-900/25 border border-red-700 rounded-xl px-4 py-3 flex items-start gap-3">
                  <span className="text-xl mt-0.5">⚠️</span>
                  <div>
                    <p className="text-red-300 text-xs font-semibold mb-0.5">
                      Ya existen {casillasPrevias.toLocaleString()} casillas en
                      esta elección
                    </p>
                    <p className="text-red-400/70 text-xs leading-relaxed">
                      Al importar se eliminarán todas las casillas y resultados
                      previos antes de cargar los nuevos datos.
                    </p>
                  </div>
                </div>
              )}
              <div className="bg-[#0f172a] rounded-xl p-4 grid grid-cols-2 gap-3">
                <div className="text-center">
                  <p className="text-2xl font-bold text-white">
                    {resumen.total.toLocaleString()}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Casillas detectadas
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-white">
                    {resumen.municipios}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">Municipios</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-white">
                    {resumen.secciones}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">Secciones</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-amber-400">
                    {resumen.omitidas}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Omitidas (tipo A)
                  </p>
                </div>
              </div>

              {errores.length > 0 && (
                <div className="bg-red-900/20 border border-red-800 rounded-xl p-3">
                  {errores.map((e, i) => (
                    <p key={i} className="text-red-400 text-xs">
                      {e}
                    </p>
                  ))}
                </div>
              )}

              <div className="bg-blue-900/20 border border-blue-800 rounded-xl p-3">
                <p className="text-blue-300 text-xs leading-relaxed">
                  <strong>ℹ️ Sobre las coordenadas:</strong> Las casillas se
                  posicionarán automáticamente en el centroide de su sección
                  electoral usando las teselas del mapa. Las que no tengan
                  sección reconocida quedarán sin coordenadas y podrás ubicarlas
                  manualmente.
                </p>
              </div>

              {/* Preview primeras 5 casillas */}
              <div>
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">
                  Muestra (primeras 5)
                </p>
                <div className="flex flex-col gap-1.5">
                  {casillas.slice(0, 5).map((c, i) => (
                    <div
                      key={i}
                      className="bg-[#0f172a] rounded-lg px-3 py-2 flex items-center justify-between text-xs"
                    >
                      <span className="text-slate-300">
                        <span className="text-slate-500">Mun.</span>{" "}
                        {c.municipio} ·
                        <span className="text-slate-500"> Secc.</span>{" "}
                        {c.seccion} ·
                        <span className="text-slate-500"> Casilla</span>{" "}
                        {c.id_casilla}
                        {c.tipo}
                      </span>
                      <span className="text-emerald-400 font-mono">
                        {c.total_votos} votos
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── ETAPA: IMPORTANDO ── */}
          {etapa === "importando" && (
            <div className="flex flex-col items-center gap-4 py-8">
              <div className="w-12 h-12 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-white font-semibold">
                {faseMsg || "Importando casillas..."}
              </p>
              <div className="w-full bg-[#334155] rounded-full h-2">
                <div
                  className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progreso}%` }}
                />
              </div>
              <p className="text-slate-400 text-sm">{progreso}% completado</p>
            </div>
          )}

          {/* ── ETAPA: LISTO ── */}
          {etapa === "listo" && (
            <div className="flex flex-col items-center gap-4 py-8 text-center">
              <div className="text-5xl">✅</div>
              <p className="text-white font-semibold text-lg">
                ¡Importación completada!
              </p>
              <p className="text-slate-400 text-sm">
                {resumen?.total.toLocaleString()} casillas importadas con sus
                resultados.
              </p>
              {sinCoords > 0 && (
                <p className="text-amber-400 text-xs">
                  ⚠️ {sinCoords} casillas sin coordenadas — aleja el mapa a
                  nivel estatal y vuelve a importar, o ubícalas manualmente con
                  clic derecho.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 pb-5 flex gap-3 flex-shrink-0 border-t border-[#334155] pt-4">
          {etapa === "subir" && (
            <button
              onClick={() => {
                resetear();
                onClose();
              }}
              className="flex-1 bg-[#334155] hover:bg-[#475569] text-slate-200 text-sm font-medium py-2.5 rounded-lg transition-colors cursor-pointer"
            >
              Cancelar
            </button>
          )}
          {etapa === "preview" && (
            <>
              <button
                onClick={resetear}
                className="flex-1 bg-[#334155] hover:bg-[#475569] text-slate-200 text-sm font-medium py-2.5 rounded-lg transition-colors cursor-pointer"
              >
                ← Otro archivo
              </button>
              <button
                onClick={handleImportar}
                className="flex-1 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold py-2.5 rounded-lg transition-colors cursor-pointer"
              >
                Importar {resumen?.total.toLocaleString()} casillas
              </button>
            </>
          )}
          {etapa === "listo" && (
            <button
              onClick={() => {
                resetear();
                onClose();
              }}
              className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold py-2.5 rounded-lg transition-colors cursor-pointer"
            >
              Cerrar
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ImportadorCSVModal;
