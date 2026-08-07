import { useState } from "react";
import { signOut } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import maplibregl from "maplibre-gl";
import { auth } from "../../services/firebase";
import { useMapStore } from "../../store/mapStore";

const MapControls = ({
  onStatsClick,
  onAdminClick,
  onExportClick,
  isAdmin,
}) => {
  const { mapInstance, isSatellite, toggleSatellite } = useMapStore();
  const [streetViewActive, setStreetViewActive] = useState(false);
  const [pegman, setPegman] = useState(null);
  const navigate = useNavigate();

  const handleLogout = () => {
    signOut(auth).then(() => window.location.reload());
  };

  const handleStreetView = () => {
    if (!mapInstance) return;

    if (pegman) {
      pegman.remove();
      setPegman(null);
      setStreetViewActive(false);
      return;
    }

    setStreetViewActive(true);
    const el = document.createElement("div");
    el.innerText = "🧍";
    el.style.cssText = "font-size:28px; cursor:grab; user-select:none;";

    const centro = mapInstance.getCenter();
    const marker = new maplibregl.Marker({ element: el, draggable: true })
      .setLngLat([centro.lng, centro.lat])
      .addTo(mapInstance);

    marker.on("dragstart", () => {
      el.innerText = "🚶‍♂️";
    });
    marker.on("dragend", () => {
      el.innerText = "🧍";
      const { lat, lng } = marker.getLngLat();
      window.open(
        `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat},${lng}`,
        "_blank",
      );
      marker.remove();
      setPegman(null);
      setStreetViewActive(false);
    });

    setPegman(marker);
  };

  return (
    <>
      {/* Stack superior derecha — logout + admin + estadísticas */}
      <div className="absolute top-4 right-4 z-20 flex flex-col gap-2">
        <button
          onClick={handleLogout}
          className="bg-[#1e293b] border border-[#334155] text-slate-300 text-xs font-medium px-3 py-2 rounded-lg hover:bg-red-900/40 hover:border-red-500 hover:text-red-400 transition-colors cursor-pointer whitespace-nowrap"
        >
          Cerrar Sesión
        </button>

        {isAdmin && (
          <button
            onClick={onAdminClick}
            className="flex items-center justify-center gap-1.5 bg-[#1e293b] border border-[#334155] text-slate-200 text-xs font-medium px-3 py-2 rounded-lg hover:bg-[#334155] transition-colors cursor-pointer whitespace-nowrap"
          >
            🛡️ Admin
          </button>
        )}

        <button
          onClick={() => navigate("/electoral")}
          className="flex items-center justify-center gap-1.5 bg-[#1e293b] border border-[#334155] text-slate-200 text-xs font-medium px-3 py-2 rounded-lg hover:bg-indigo-900/40 hover:border-indigo-500 hover:text-indigo-300 transition-colors cursor-pointer whitespace-nowrap"
        >
          🗳️ Electoral
        </button>

        <button
          onClick={onStatsClick}
          className="flex items-center justify-center gap-1.5 bg-[#1e293b] border border-[#334155] text-slate-200 text-xs font-medium px-3 py-2 rounded-lg hover:bg-[#334155] transition-colors cursor-pointer whitespace-nowrap"
        >
          📊 Estadísticas
        </button>

        <button
          onClick={onExportClick}
          title="Exportar resultados a PDF"
          className="flex items-center justify-center gap-1.5 bg-[#1e293b] border border-[#334155] text-slate-200 text-xs font-medium px-3 py-2 rounded-lg hover:bg-emerald-900/40 hover:border-emerald-500 hover:text-emerald-400 transition-colors cursor-pointer whitespace-nowrap"
        >
          📄 Exportar PDF
        </button>
      </div>

      {/* Controles de vista — fondo izquierda, encima del atributo del mapa */}
      <div className="absolute bottom-6 left-4 z-20 flex items-center gap-2">
        {/* Satélite */}
        <button
          onClick={toggleSatellite}
          title={isSatellite ? "Volver a mapa" : "Ver satélite"}
          className={`flex items-center gap-1.5 border text-xs font-semibold px-3 py-2 rounded-xl shadow-lg transition-colors cursor-pointer ${
            isSatellite
              ? "bg-blue-600 border-blue-400 text-white"
              : "bg-[#1e293b]/95 border-[#334155] text-slate-200 hover:bg-[#334155]"
          }`}
        >
          🛰️ <span>Satélite</span>
        </button>

        {/* Street View */}
        <button
          onClick={handleStreetView}
          title={
            streetViewActive ? "Cancelar Street View" : "Abrir Street View"
          }
          className={`flex items-center gap-1.5 border text-xs font-semibold px-3 py-2 rounded-xl shadow-lg transition-colors cursor-pointer ${
            streetViewActive
              ? "bg-red-600 border-red-400 text-white"
              : "bg-[#1e293b]/95 border-[#334155] text-slate-200 hover:bg-[#334155]"
          }`}
        >
          🚶‍♂️ <span>{streetViewActive ? "Cancelar" : "Street View"}</span>
        </button>
      </div>
    </>
  );
};

export default MapControls;
