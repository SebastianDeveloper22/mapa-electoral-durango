import { useEffect, useRef } from "react";
import { useState } from "react";
import {
  Chart,
  ArcElement,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Title,
  DoughnutController,
  BarController,
} from "chart.js";
import { useObrasStore } from "../../store/obrasStore";
import { useAuthStore } from "../../store/authStore";
import { useColeccionesStore } from "../../store/coleccionesStore";
import { ROLES } from "../../config";

Chart.register(
  ArcElement, BarElement, CategoryScale, LinearScale,
  Tooltip, Title, DoughnutController, BarController,
);

const TABS = [
  { key: "pp",         label: "PP" },
  { key: "rural",      label: "Rural" },
  { key: "top100",     label: "Top 100" },
  { key: "general",    label: "Laguna" },
  { key: "capital",    label: "Capital" },
  { key: "municipios", label: "Municipios" },
  { key: "guardianes", label: "Guardianes" },
];

const strHash = (s) => {
  let h = 0;
  for (let i = 0; i < s.length; i++) { h = (h << 5) - h + s.charCodeAt(i); h = h & h; }
  return Math.abs(h);
};
const colorFromStr = (s) => {
  const h = strHash(s) % 360;
  const sat = (strHash(s) % 15) + 65;
  const lit = (strHash(s) % 20) + 50;
  return `hsl(${h},${sat}%,${lit}%)`;
};
const normalizar = (t) =>
  (t || "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

// Colores por Distrito Local (DL 1–6)
const COLORES_DL = ["#3b82f6", "#06b6d4", "#10b981", "#8b5cf6", "#eab308", "#ec4899"];
const colorDL = (i) => COLORES_DL[i % COLORES_DL.length];

// ── Gráficas por tipo (dona) + eje secundario (barras) ──────────────────────

const useGraficas = (open, items, ejeSecundario, claveEje, modoParticipacion = false, claveEjePrimario = "tipo") => {
  const donaRef = useRef(null);
  const barraRef = useRef(null);
  const donaInst = useRef(null);
  const barraInst = useRef(null);

  useEffect(() => {
    if (!open || !items.length) return;

    donaInst.current?.destroy();
    barraInst.current?.destroy();

    if (modoParticipacion) {
      // ── Gráfica 1: Promedio de participación por DL ──
      const sumaPorDL = {};
      const contPorDL = {};
      items.forEach((item) => {
        const dl = item.distritoLocal || "Sin dato";
        if (item.participacion != null) {
          sumaPorDL[dl] = (sumaPorDL[dl] || 0) + Number(item.participacion);
          contPorDL[dl] = (contPorDL[dl] || 0) + 1;
        }
      });
      const dlKeys = Object.keys(sumaPorDL).sort();
      const promedios = dlKeys.map((dl) => +(sumaPorDL[dl] / contPorDL[dl]).toFixed(1));

      donaInst.current = new Chart(donaRef.current, {
        type: "bar",
        data: {
          labels: dlKeys,
          datasets: [{ label: "Participación Promedio (%)", data: promedios, backgroundColor: dlKeys.map((_, i) => colorDL(i)), borderRadius: 4 }],
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            title: { display: true, text: "Participación Promedio por DL", color: "#94a3b8", font: { size: 11 } },
          },
          scales: {
            y: { beginAtZero: true, max: 100, ticks: { color: "#94a3b8", font: { size: 10 }, callback: (v) => v + "%" }, grid: { color: "rgba(255,255,255,0.05)" } },
            x: { ticks: { color: "#e2e8f0", font: { weight: "bold", size: 10 } }, grid: { display: false } },
          },
        },
      });

      const legendEl = document.getElementById("stats-legend");
      if (legendEl) {
        legendEl.innerHTML = dlKeys.length
          ? dlKeys.map((dl, i) => `
            <div style="display:flex;align-items:center;gap:6px;margin-bottom:5px;">
              <div style="min-width:10px;height:10px;border-radius:2px;background:${colorDL(i)}"></div>
              <span style="flex:1;font-size:11px;color:#e2e8f0;">${dl}</span>
              <span style="color:#94a3b8;font-size:11px;font-weight:bold;">${promedios[i]}%</span>
            </div>
          `).join("")
          : `<p style="font-size:11px;color:#64748b;">Sin datos de participación.</p>`;
      }
    } else {
      // ── Gráfica 1: Dona por claveEjePrimario (tipo por defecto, red para guardianes) ──
      const porKey = {};
      const keyVisual = {};
      items.forEach((item) => {
        const valOrig = (item[claveEjePrimario] || "Sin Especificar").trim();
        const key = normalizar(valOrig);
        porKey[key] = (porKey[key] || 0) + 1;
        if (!keyVisual[key])
          keyVisual[key] = valOrig.charAt(0).toUpperCase() + valOrig.slice(1);
      });

      const keys = Object.keys(porKey);
      const keyColors = keys.map(colorFromStr);
      const tituloG1 = claveEjePrimario === "red" ? "Por Red" : "Por Tipo";

      donaInst.current = new Chart(donaRef.current, {
        type: "doughnut",
        data: {
          labels: keys.map((k) => keyVisual[k]),
          datasets: [{ data: keys.map((k) => porKey[k]), backgroundColor: keyColors, borderWidth: 0, hoverOffset: 4 }],
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            title: { display: true, text: tituloG1, color: "#94a3b8", font: { size: 11 } },
          },
        },
      });

      const legendEl = document.getElementById("stats-legend");
      if (legendEl) {
        legendEl.innerHTML = keys.map((k, i) => `
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:5px;">
            <div style="min-width:10px;height:10px;border-radius:2px;background:${keyColors[i]}"></div>
            <span style="flex:1;font-size:11px;color:#e2e8f0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${keyVisual[k]}</span>
            <span style="color:#94a3b8;font-size:11px;font-weight:bold;">${porKey[k]}</span>
          </div>
        `).join("");
      }
    }

    // ── Gráfica 2: Conteo por eje secundario (siempre) ──
    const porEje = {};
    items.forEach((item) => {
      const ejeVal = item[claveEje] || "Sin dato";
      porEje[ejeVal] = (porEje[ejeVal] || 0) + 1;
    });
    const ejeOrdenado = Object.keys(porEje).sort();
    barraInst.current = new Chart(barraRef.current, {
      type: "bar",
      data: {
        labels: ejeOrdenado,
        datasets: [{ label: ejeSecundario, data: ejeOrdenado.map((k) => porEje[k]), backgroundColor: ejeOrdenado.map((_, i) => colorDL(i)), borderRadius: 4 }],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          title: { display: true, text: ejeSecundario, color: "#94a3b8", font: { size: 11 } },
        },
        scales: {
          y: { beginAtZero: true, ticks: { color: "#94a3b8", stepSize: 1, font: { size: 10 } }, grid: { color: "rgba(255,255,255,0.05)" } },
          x: { ticks: { color: "#e2e8f0", font: { weight: "bold", size: 10 } }, grid: { display: false } },
        },
      },
    });

    return () => { donaInst.current?.destroy(); barraInst.current?.destroy(); };
  }, [open, items]); // eslint-disable-line react-hooks/exhaustive-deps

  return { donaRef, barraRef };
};

// ── Panel de una pestaña ──────────────────────────────────────────────────────

const TabPanel = ({ open, items, ejeSecundario, claveEje, modoParticipacion, claveEjePrimario, onExportar }) => {
  const { donaRef, barraRef } = useGraficas(open, items, ejeSecundario, claveEje, modoParticipacion, claveEjePrimario);

  if (!open) return null;

  if (items.length === 0) {
    return (
      <p className="text-slate-400 text-sm text-center py-8">
        No hay marcadores registrados en esta capa.
      </p>
    );
  }

  return (
    <>
      <div className="flex items-center justify-between bg-sky-500/10 border-l-4 border-sky-500 rounded-lg px-4 py-3 mb-4">
        <span className="text-sky-400 text-sm font-medium">Total Mapeados</span>
        <span className="text-white text-2xl font-bold">{items.length}</span>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-4" style={{ minHeight: "140px" }}>
        <div className="flex-1 relative" style={{ height: "150px" }}>
          <canvas ref={donaRef} />
        </div>
        <div id="stats-legend" className="w-full sm:w-2/5 max-h-[120px] sm:max-h-none overflow-y-auto pr-1" style={{ scrollbarWidth: "thin" }} />
      </div>

      <div className="relative mb-4" style={{ height: "140px" }}>
        <canvas ref={barraRef} />
      </div>

      <button
        onClick={onExportar}
        className="w-full bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold py-2.5 rounded-lg transition-colors cursor-pointer"
      >
        📥 Descargar a Excel (CSV)
      </button>
    </>
  );
};

// ── Modal principal ───────────────────────────────────────────────────────────

const TABS_PRESIDENTE = new Set(["pp", "rural", "top100", "guardianes"]);

const StatsModal = ({ open, onClose }) => {
  const { obras, extras } = useObrasStore();
  const { role } = useAuthStore();
  const { coleccionesConfig } = useColeccionesStore();
  const isPresidente = role === ROLES.PRESIDENTE;

  // Tabs estáticas + tabs dinámicas (filtradas por rol)
  const tabsDinamicas = coleccionesConfig
    .filter((c) => !(isPresidente && c.ocultarPresidente))
    .map(({ key, label }) => ({ key, label, dinamica: true }));
  const tabsBase = isPresidente ? TABS.filter((t) => TABS_PRESIDENTE.has(t.key)) : TABS;
  const tabsVisibles = [...tabsBase, ...tabsDinamicas];

  const [tabActiva, setTabActiva] = useState("pp");

  // extras === null significa que PinLayer todavía no ha terminado de cargar
  const cargando = extras === null;

  const exportarCSV = (items, nombreArchivo, camposExtra = []) => {
    const cabecera = ["Nombre", "Tipo", ...camposExtra, "Latitud", "Longitud", "Registrado Por", "Fecha"];
    let csv = "data:text/csv;charset=utf-8,\uFEFF" + cabecera.join(",") + "\n";
    items.forEach((item) => {
      const extrasRow = camposExtra.map((c) => `"${item[c] || ""}"`).join(",");
      csv += `"${item.nombre || ""}","${item.tipo || ""}",${extrasRow},${item.coords?.lat || ""},${item.coords?.lng || ""},"${item.creadoPor || "Sistema"}","${item.fechaCreacion || ""}"\n`;
    });
    const link = document.createElement("a");
    link.href = encodeURI(csv);
    link.download = `${nombreArchivo}_${new Date().getFullYear()}.csv`;
    link.click();
  };

  if (!open) return null;

  const rural      = extras?.rural      ?? [];
  const top100     = extras?.top100     ?? [];
  const general    = extras?.general    ?? [];
  const capital    = extras?.capital    ?? [];
  const municipios = extras?.municipios ?? [];
  const guardianes = extras?.guardianes ?? [];

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-[#1e293b] border border-[#334155] rounded-2xl shadow-2xl p-4 sm:p-6 max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-base font-semibold text-white">📊 Resumen de Marcadores</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-xl leading-none cursor-pointer">✖</button>
        </div>
        <p className="text-xs text-slate-400 mb-4">Análisis en tiempo real por capa.</p>

        {/* Tabs */}
        <div className="flex flex-wrap gap-1 mb-4 bg-[#0f172a] p-1 rounded-lg">
          {tabsVisibles.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setTabActiva(key)}
              className={`flex-1 min-w-[60px] text-[11px] sm:text-xs font-medium py-1.5 rounded-md transition-colors cursor-pointer ${
                tabActiva === key
                  ? "bg-blue-600 text-white"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {cargando ? (
          <p className="text-slate-400 text-sm text-center py-8">Cargando datos...</p>
        ) : (
          <>
            {tabActiva === "pp" && (
              <TabPanel
                open
                items={obras}
                ejeSecundario="Por Año"
                claveEje="anio"
                onExportar={() => exportarCSV(obras, "Reporte_PP")}
              />
            )}
            {tabActiva === "rural" && (
              <TabPanel
                open
                items={rural}
                ejeSecundario="Por Distrito Local"
                claveEje="distritoLocal"
                modoParticipacion
                onExportar={() => exportarCSV(rural, "Reporte_Rural", ["distritoLocal", "seccion", "zonaElectoral", "referencia", "participacion"])}
              />
            )}
            {tabActiva === "top100" && (
              <TabPanel
                open
                items={top100}
                ejeSecundario="Por Distrito Local"
                claveEje="distritoLocal"
                modoParticipacion
                onExportar={() => exportarCSV(top100, "Reporte_Top100", ["distritoLocal", "seccion", "zonaElectoral", "referencia", "participacion"])}
              />
            )}
            {tabActiva === "general" && (
              <TabPanel
                open
                items={general}
                ejeSecundario="Por Tipo"
                claveEje="tipo"
                onExportar={() => exportarCSV(general, "Reporte_Espectaculares_Laguna", ["distritoLocal", "seccion", "detalles"])}
              />
            )}
            {tabActiva === "capital" && (
              <TabPanel
                open
                items={capital}
                ejeSecundario="Por Tipo"
                claveEje="tipo"
                onExportar={() => exportarCSV(capital, "Reporte_Espectaculares_Capital", ["distritoLocal", "seccion", "detalles"])}
              />
            )}
            {tabActiva === "municipios" && (
              <TabPanel
                open
                items={municipios}
                ejeSecundario="Por Tipo"
                claveEje="tipo"
                onExportar={() => exportarCSV(municipios, "Reporte_Espectaculares_Municipios", ["distritoLocal", "seccion", "detalles"])}
              />
            )}
            {tabActiva === "guardianes" && (
              <TabPanel
                open
                items={guardianes}
                ejeSecundario="Por Distrito Local"
                claveEje="distritoLocal"
                claveEjePrimario="red"
                onExportar={() => exportarCSV(guardianes, "Reporte_Guardianes", ["distritoLocal", "seccion", "zona", "red", "direccion", "telefono", "atendido"])}
              />
            )}

            {/* Tabs de colecciones dinámicas */}
            {tabsDinamicas.map(({ key }) => {
              if (tabActiva !== key) return null;
              const cfg = coleccionesConfig.find((c) => c.key === key);
              const campos = cfg?.campos ?? [];
              const items = extras?.[key] ?? [];
              const modoParticipacion = campos.includes("participacion");
              const claveEjePrimario = campos.includes("red") ? "red" : "tipo";
              const claveEje = campos.includes("distritoLocal") ? "distritoLocal" : "tipo";
              const camposExport = campos.filter((f) => !["nombre", "tipo", "pinColor", "visitado", "atendido", "seleccionado"].includes(f));
              return (
                <TabPanel
                  key={key}
                  open
                  items={items}
                  ejeSecundario={campos.includes("distritoLocal") ? "Por Distrito Local" : "Por Tipo"}
                  claveEje={claveEje}
                  claveEjePrimario={claveEjePrimario}
                  modoParticipacion={modoParticipacion}
                  onExportar={() => exportarCSV(items, `Reporte_${key}`, camposExport)}
                />
              );
            })}
          </>
        )}
      </div>
    </div>
  );
};

export default StatsModal;
