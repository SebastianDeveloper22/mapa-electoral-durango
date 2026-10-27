import { useEffect } from "react";
import { getColeccionesConfig } from "../services/coleccionesConfigService";
import { useColeccionesStore } from "../store/coleccionesStore";
import { useMapStore } from "../store/mapStore";

export const useColecciones = () => {
  const { setColecciones, setLoading } = useColeccionesStore();
  const addColeccionDinamica = useMapStore((s) => s.addColeccionDinamica);

  const cargar = async () => {
    setLoading(true);
    try {
      const configs = await getColeccionesConfig();
      setColecciones(configs);
      configs.forEach((c) => addColeccionDinamica(c));
    } catch (err) {
      console.error("[useColecciones] error cargando configs:", err);
      setColecciones([]);
    }
  };

  useEffect(() => {
    cargar();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { recargar: cargar };
};
