import { useState, useCallback } from "react";
import MapContainer from "./MapContainer";
import LayerPanel from "./LayerPanel";
import SearchBar from "./SearchBar";
import MapControls from "./MapControls";
import PinLayer from "../obras/PinLayer";
import ObraModal from "../obras/ObraModal";
import StatsModal from "../obras/StatsModal";
import AdminPanel from "../admin/AdminPanel";
import ColeccionCreadorModal from "../admin/ColeccionCreadorModal";
import ExportarPDFModal from "../electoral/ExportarPDFModal";
import { useAuthStore } from "../../store/authStore";
import { ROLES } from "../../config";
import { useColecciones } from "../../hooks/useColecciones";

const MapPage = () => {
  const { role } = useAuthStore();
  const isAdmin      = role === ROLES.ADMIN;
  const isPresidente = role === ROLES.PRESIDENTE;

  useColecciones();

  const [statsOpen, setStatsOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [nuevaCapaOpen, setNuevaCapaOpen] = useState(false);
  const [exportPDFOpen, setExportPDFOpen] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  // Cuando se guarda o borra una obra, recargamos los pines
  const handleReload = useCallback(() => setReloadKey((k) => k + 1), []);

  return (
    <div className="relative w-screen h-screen overflow-hidden">
      {/* Mapa base */}
      <MapContainer />

      {/* Pines de obras PP (no renderiza DOM, actúa sobre el mapa) */}
      <PinLayer reloadTrigger={reloadKey} onReload={handleReload} />

      {/* Controles flotantes */}
      <LayerPanel />
      <SearchBar />
      <MapControls
        isAdmin={isAdmin}
        isLector={role === ROLES.LECTOR}
        isPresidente={isPresidente}
        onStatsClick={() => setStatsOpen(true)}
        onAdminClick={() => setAdminOpen(true)}
        onNuevaCapaClick={() => setNuevaCapaOpen(true)}
        onExportClick={() => setExportPDFOpen(true)}
      />

      {/* Modales */}
      <ObraModal onSaved={handleReload} />
      <StatsModal open={statsOpen} onClose={() => setStatsOpen(false)} />

      {/* Panel Admin */}
      <AdminPanel open={adminOpen} onClose={() => setAdminOpen(false)} />

      {/* Modal Nueva Capa */}
      <ColeccionCreadorModal open={nuevaCapaOpen} onClose={() => setNuevaCapaOpen(false)} />

      {/* Modal exportar PDF */}
      <ExportarPDFModal
        open={exportPDFOpen}
        onClose={() => setExportPDFOpen(false)}
      />
    </div>
  );
};

export default MapPage;
