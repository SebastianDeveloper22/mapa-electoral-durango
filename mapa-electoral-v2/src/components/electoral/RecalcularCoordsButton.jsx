import { useState } from "react";
import { doc, writeBatch } from "firebase/firestore";
import { db } from "../../services/firebase";
import { useElectoralStore } from "../../store/electoralStore";
import { calcularCentroidesDesdeArchivos } from "./importador/calcularCentroide";
import { useToast } from "../ui/Toast";
import { getCasillas } from "../../services/electoralService";

const RecalcularCoordsButton = ({ onRecalculado }) => {
  const { casillas, eleccionActiva, setCasillas } = useElectoralStore();
  const toast = useToast();
  const [calculando, setCalculando] = useState(false);
  const [progreso, setProgreso] = useState(0);
  const [fase, setFase] = useState(""); // 'leyendo' | 'guardando'

  const casillasSinCoords = casillas.filter((c) => !c.coords);
  const sinCoords = casillasSinCoords.length;

  if (sinCoords === 0) return null;

  const handleRecalcular = async () => {
    if (!eleccionActiva) return;
    setCalculando(true);
    setProgreso(0);
    setFase("leyendo");

    try {
      // Secciones únicas de las casillas sin coordenadas
      const seccionesUnicas = [
        ...new Set(casillasSinCoords.map((c) => c.seccion)),
      ];

      // Leer tiles .pbf directamente — sin depender del viewport del mapa
      const centroidesMap = await calcularCentroidesDesdeArchivos(
        seccionesUnicas,
        (pct) => setProgreso(pct),
      );

      const actualizadas = casillasSinCoords
        .map((c) => ({ id: c.id, coords: centroidesMap[c.seccion] ?? null }))
        .filter((c) => c.coords !== null);

      if (actualizadas.length === 0) {
        toast(
          "No se encontraron centroides. Verifica que las teselas .pbf estén en public/tiles/",
          "warning",
        );
        return;
      }

      setFase("guardando");
      setProgreso(0);

      // Guardar en Firestore en batches de 400
      const BATCH_SIZE = 400;
      for (let i = 0; i < actualizadas.length; i += BATCH_SIZE) {
        const lote = actualizadas.slice(i, i + BATCH_SIZE);
        const batch = writeBatch(db);
        lote.forEach(({ id, coords }) => {
          batch.update(doc(db, "casillas", id), { coords });
        });
        await batch.commit();
        setProgreso(
          Math.round(((i + lote.length) / actualizadas.length) * 100),
        );
      }

      // Recargar casillas actualizadas en el store
      const nuevas = await getCasillas(eleccionActiva.id);
      setCasillas(nuevas);

      const sinEncontrar = sinCoords - actualizadas.length;
      toast(
        `✅ ${actualizadas.length} casillas con coordenadas asignadas.` +
          (sinEncontrar > 0
            ? ` (${sinEncontrar} sin sección en los tiles)`
            : ""),
        "success",
      );
      onRecalculado?.();
    } catch (err) {
      console.error("[RecalcularCoords]", err);
      toast("Error al calcular coordenadas. Revisa la consola.", "error");
    } finally {
      setCalculando(false);
      setProgreso(0);
      setFase("");
    }
  };

  return (
    <div className="bg-amber-900/30 border border-amber-700 rounded-xl p-3 w-56">
      <p className="text-amber-400 text-xs font-medium mb-1">
        ⚠️ {sinCoords.toLocaleString()} casillas sin ubicación
      </p>
      <p className="text-amber-300/60 text-xs mb-2 leading-relaxed">
        Las casillas existen pero no tienen coordenadas GPS asignadas.
      </p>

      {calculando ? (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 border border-amber-400 border-t-transparent rounded-full animate-spin flex-shrink-0" />
            <span className="text-amber-300 text-xs">
              {fase === "leyendo"
                ? "Leyendo teselas cartográficas..."
                : "Guardando coordenadas..."}
            </span>
          </div>
          <div className="w-full bg-amber-900/40 rounded-full h-1.5">
            <div
              className="bg-amber-400 h-1.5 rounded-full transition-all duration-200"
              style={{ width: `${progreso}%` }}
            />
          </div>
          <p className="text-amber-500 text-xs text-right">{progreso}%</p>
        </div>
      ) : (
        <button
          onClick={handleRecalcular}
          className="w-full bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold py-2 rounded-lg transition-colors cursor-pointer"
        >
          🗺️ Recalcular posiciones
        </button>
      )}
    </div>
  );
};

export default RecalcularCoordsButton;
