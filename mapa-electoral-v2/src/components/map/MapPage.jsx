import { useState, useCallback } from "react";
import MapContainer from "./MapContainer";
import LayerPanel from "./LayerPanel";
import SearchBar from "./SearchBar";
import MapControls from "./MapControls";
import PinLayer from "../obras/PinLayer";
import ObraModal from "../obras/ObraModal";
import StatsModal from "../obras/StatsModal";
import AdminPanel from "../admin/AdminPanel";
import ExportarPDFModal from "../electoral/ExportarPDFModal";
import { useAuthStore } from "../../store/authStore";
import { ROLES } from "../../config";

const MapPage = () => {
  const { role } = useAuthStore();
  const isAdmin = role === ROLES.ADMIN;

  const [statsOpen, setStatsOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
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
        onStatsClick={() => setStatsOpen(true)}
        onAdminClick={() => setAdminOpen(true)}
        onExportClick={() => setExportPDFOpen(true)}
      />

      {/* Modales */}
      <ObraModal onSaved={handleReload} />
      <StatsModal open={statsOpen} onClose={() => setStatsOpen(false)} />

      {/* Panel Admin */}
      <AdminPanel open={adminOpen} onClose={() => setAdminOpen(false)} />

      {/* Modal exportar PDF */}
      <ExportarPDFModal
        open={exportPDFOpen}
        onClose={() => setExportPDFOpen(false)}
      />
    </div>
  );
};

export default MapPage;
