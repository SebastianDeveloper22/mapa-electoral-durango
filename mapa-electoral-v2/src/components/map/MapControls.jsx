import { useState } from "react";
import { signOut } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { auth } from "../../services/firebase";
import { useMapStore } from "../../store/mapStore";

const API_KEY = import.meta.env.VITE_FIREBASE_API_KEY;

const MapControls = ({
  onStatsClick,
  onAdminClick,
  onExportClick,
  onNuevaCapaClick,
  isAdmin,
  isLector,
  isPresidente,
}) => {
  const { mapInstance, isSatellite, toggleSatellite } = useMapStore();
  const [streetViewActive, setStreetViewActive] = useState(false);
  const [streetViewCoords, setStreetViewCoords] = useState(null);
  const navigate = useNavigate();

  const handleLogout = () => {
    signOut(auth).then(() => window.location.reload());
  };

  const handleStreetViewToggle = () => {
    if (streetViewCoords) {
      setStreetViewCoords(null);
      return;
    }
    setStreetViewActive((v) => !v);
  };

  const handleOverlayClick = (e) => {
    if (!mapInstance) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const { lat, lng } = mapInstance.unproject([
      e.clientX - rect.left,
      e.clientY - rect.top,
    ]);
    setStreetViewCoords({ lat, lng });
    setStreetViewActive(false);
  };

  return (
    <>
      {/* Overlay captura de click para Street View */}
      {streetViewActive && (
        <div
          className="absolute inset-0 z-25 cursor-crosshair"
          onClick={handleOverlayClick}
        />
      )}

      {/* Stack superior derecha — logout + admin + estadísticas */}
      <div className="absolute top-4 right-2 md:right-4 z-20 flex flex-col gap-1.5 md:gap-2">
        <button
          onClick={handleLogout}
          title="Cerrar Sesión"
          className="bg-[#1e293b] border border-[#334155] text-slate-300 text-xs font-medium px-2.5 md:px-3 py-2 rounded-lg hover:bg-red-900/40 hover:border-red-500 hover:text-red-400 transition-colors cursor-pointer whitespace-nowrap"
        >
          <span className="hidden md:inline">Cerrar Sesión</span>
          <span className="md:hidden">🚪</span>
        </button>

        {isAdmin && (
          <button
            onClick={onAdminClick}
            title="Admin"
            className="flex items-center justify-center gap-1.5 bg-[#1e293b] border border-[#334155] text-slate-200 text-xs font-medium px-2.5 md:px-3 py-2 rounded-lg hover:bg-[#334155] transition-colors cursor-pointer whitespace-nowrap"
          >
            🛡️ <span className="hidden md:inline">Admin</span>
          </button>
        )}

        {isAdmin && (
          <button
            onClick={onNuevaCapaClick}
            title="Nueva Capa"
            className="flex items-center justify-center gap-1.5 bg-[#1e293b] border border-[#334155] text-slate-200 text-xs font-medium px-2.5 md:px-3 py-2 rounded-lg hover:bg-blue-900/40 hover:border-blue-500 hover:text-blue-300 transition-colors cursor-pointer whitespace-nowrap"
          >
            🗂️ <span className="hidden md:inline">Nueva Capa</span>
          </button>
        )}

        {!isLector && !isPresidente && (
          <button
            onClick={() => navigate("/electoral")}
            title="Electoral"
            className="flex items-center justify-center gap-1.5 bg-[#1e293b] border border-[#334155] text-slate-200 text-xs font-medium px-2.5 md:px-3 py-2 rounded-lg hover:bg-indigo-900/40 hover:border-indigo-500 hover:text-indigo-300 transition-colors cursor-pointer whitespace-nowrap"
          >
            🗳️ <span className="hidden md:inline">Electoral</span>
          </button>
        )}

        <button
          onClick={onStatsClick}
          title="Estadísticas"
          className="flex items-center justify-center gap-1.5 bg-[#1e293b] border border-[#334155] text-slate-200 text-xs font-medium px-2.5 md:px-3 py-2 rounded-lg hover:bg-[#334155] transition-colors cursor-pointer whitespace-nowrap"
        >
          📊 <span className="hidden md:inline">Estadísticas</span>
        </button>

        {!isLector && !isPresidente && (
          <button
            onClick={onExportClick}
            title="Exportar PDF"
            className="flex items-center justify-center gap-1.5 bg-[#1e293b] border border-[#334155] text-slate-200 text-xs font-medium px-2.5 md:px-3 py-2 rounded-lg hover:bg-emerald-900/40 hover:border-emerald-500 hover:text-emerald-400 transition-colors cursor-pointer whitespace-nowrap"
          >
            📄 <span className="hidden md:inline">Exportar PDF</span>
          </button>
        )}
      </div>

      {/* Controles de vista — fondo izquierda, encima del atributo del mapa */}
      <div className="absolute bottom-6 left-2 md:left-4 z-20 flex items-center gap-1.5 md:gap-2">
        {/* Satélite */}
        <button
          onClick={toggleSatellite}
          title={isSatellite ? "Volver a mapa" : "Ver satélite"}
          className={`flex items-center gap-1 md:gap-1.5 border text-[11px] md:text-xs font-semibold px-2.5 md:px-3 py-1.5 md:py-2 rounded-xl shadow-lg transition-colors cursor-pointer ${
            isSatellite
              ? "bg-blue-600 border-blue-400 text-white"
              : "bg-[#1e293b]/95 border-[#334155] text-slate-200 hover:bg-[#334155]"
          }`}
        >
          🛰️ <span className="hidden sm:inline">Satélite</span>
        </button>

        {/* Street View */}
        <button
          onClick={handleStreetViewToggle}
          title={
            streetViewActive
              ? "Cancelar — haz click en el mapa"
              : streetViewCoords
                ? "Cerrar Street View"
                : "Abrir Street View"
          }
          className={`flex items-center gap-1 md:gap-1.5 border text-[11px] md:text-xs font-semibold px-2.5 md:px-3 py-1.5 md:py-2 rounded-xl shadow-lg transition-colors cursor-pointer ${
            streetViewActive
              ? "bg-amber-600 border-amber-400 text-white animate-pulse"
              : streetViewCoords
                ? "bg-red-600 border-red-400 text-white"
                : "bg-[#1e293b]/95 border-[#334155] text-slate-200 hover:bg-[#334155]"
          }`}
        >
          🚶‍♂️{" "}
          <span className="hidden sm:inline">
            {streetViewActive
              ? "Click en el mapa..."
              : streetViewCoords
                ? "Cerrar"
                : "Street View"}
          </span>
        </button>
      </div>

      {/* Panel Street View embebido */}
      {streetViewCoords && (
        <div className="absolute bottom-2 md:bottom-4 left-1/2 -translate-x-1/2 w-[min(620px,calc(100vw-1rem))] h-[240px] sm:h-[300px] md:h-[380px] z-30 flex flex-col rounded-2xl overflow-hidden shadow-[0_8px_40px_rgba(0,0,0,0.6)] border border-white/10 backdrop-blur-sm">
          {/* Barra superior */}
          <div className="flex items-center justify-between px-4 py-2.5 bg-[#0f172a]/95 border-b border-white/10 shrink-0">
            <div className="flex items-center gap-2.5">
              <span className="text-base leading-none">🚶‍♂️</span>
              <div className="flex flex-col">
                <span className="text-slate-100 text-xs font-semibold tracking-wide">Street View</span>
                <span className="text-slate-500 text-[10px] font-mono mt-0.5">
                  {streetViewCoords.lat.toFixed(5)}, {streetViewCoords.lng.toFixed(5)}
                </span>
              </div>
            </div>
            <button
              onClick={() => setStreetViewCoords(null)}
              className="flex items-center justify-center w-6 h-6 rounded-full bg-white/10 hover:bg-white/20 text-slate-400 hover:text-white text-xs transition-colors cursor-pointer"
            >
              ✕
            </button>
          </div>
          <iframe
            className="flex-1 w-full border-0"
            src={`https://www.google.com/maps/embed/v1/streetview?key=${API_KEY}&location=${streetViewCoords.lat},${streetViewCoords.lng}&fov=80`}
            allowFullScreen
          />
        </div>
      )}
    </>
  );
};

export default MapControls;
