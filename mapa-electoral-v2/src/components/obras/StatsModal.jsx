/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable react-hooks/exhaustive-deps */
import { useEffect, useRef, useState } from "react";
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
import { getMarcadoresTodos } from "../../services/marcadoresService";

Chart.register(
  ArcElement, BarElement, CategoryScale, LinearScale,
  Tooltip, Title, DoughnutController, BarController,
);

const TABS = [
  { key: "pp",      label: "PP" },
  { key: "rural",   label: "Rural" },
  { key: "top100",  label: "Top 100" },
  { key: "general", label: "General" },
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

// ── Gráficas por tipo (dona) + eje secundario (barras) ──────────────────────

const useGraficas = (open, items, ejeSecundario, claveEje) => {
  const donaRef = useRef(null);
  const barraRef = useRef(null);
  const donaInst = useRef(null);
  const barraInst = useRef(null);

  useEffect(() => {
    if (!open || !items.length) return;

    const porTipoKey = {};
    const tipoVisual = {};
    const porEje = {};

    items.forEach((item) => {
      const tipoOrig = (item.tipo || "Sin Especificar").trim();
      const key = normalizar(tipoOrig);
      porTipoKey[key] = (porTipoKey[key] || 0) + 1;
      if (!tipoVisual[key])
        tipoVisual[key] = tipoOrig.charAt(0).toUpperCase() + tipoOrig.slice(1);

      const ejeVal = item[claveEje] || "Sin dato";
      porEje[ejeVal] = (porEje[ejeVal] || 0) + 1;
    });

    donaInst.current?.destroy();
    barraInst.current?.destroy();

    const tipoKeys = Object.keys(porTipoKey);
    const tipoColors = tipoKeys.map(colorFromStr);

    donaInst.current = new Chart(donaRef.current, {
      type: "doughnut",
      data: {
        labels: tipoKeys.map((k) => tipoVisual[k]),
        datasets: [{ data: tipoKeys.map((k) => porTipoKey[k]), backgroundColor: tipoColors, borderWidth: 0, hoverOffset: 4 }],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          title: { display: true, text: "Por Tipo", color: "#94a3b8", font: { size: 11 } },
        },
      },
    });

    const ejeOrdenado = Object.keys(porEje).sort();
    barraInst.current = new Chart(barraRef.current, {
      type: "bar",
      data: {
        labels: ejeOrdenado,
        datasets: [{ label: ejeSecundario, data: ejeOrdenado.map((k) => porEje[k]), backgroundColor: "#3b82f6", borderRadius: 4 }],
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

    const legendEl = document.getElementById("stats-legend");
    if (legendEl) {
      legendEl.innerHTML = tipoKeys.map((k, i) => `
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:5px;">
          <div style="min-width:10px;height:10px;border-radius:2px;background:${tipoColors[i]}"></div>
          <span style="flex:1;font-size:11px;color:#e2e8f0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${tipoVisual[k]}</span>
          <span style="color:#94a3b8;font-size:11px;font-weight:bold;">${porTipoKey[k]}</span>
        </div>
      `).join("");
    }

    return () => { donaInst.current?.destroy(); barraInst.current?.destroy(); };
  }, [open, items]);

  return { donaRef, barraRef };
};

// ── Panel de una pestaña ──────────────────────────────────────────────────────

const TabPanel = ({ open, items, ejeSecundario, claveEje, onExportar }) => {
  const { donaRef, barraRef } = useGraficas(open, items, ejeSecundario, claveEje);

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

      <div className="flex gap-3 mb-4" style={{ height: "170px" }}>
        <div className="flex-1 relative">
          <canvas ref={donaRef} />
        </div>
        <div id="stats-legend" className="w-2/5 overflow-y-auto pr-1" style={{ scrollbarWidth: "thin" }} />
      </div>

      <div className="relative mb-4" style={{ height: "160px" }}>
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

const StatsModal = ({ open, onClose }) => {
  const { obras } = useObrasStore();
  const [tabActiva, setTabActiva] = useState("pp");
  const [extras, setExtras] = useState({ rural: [], top100: [], general: [] });
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCargando(true);
    getMarcadoresTodos()
      .then((todos) => {
        setExtras({
          rural:   todos.filter((m) => m.capa === "rural"),
          top100:  todos.filter((m) => m.capa === "top100"),
          general: todos.filter((m) => m.capa === "general"),
        });
      })
      .catch(console.error)
      .finally(() => setCargando(false));
  }, [open]);

  const exportarCSV = (items, nombreArchivo, camposExtra = []) => {
    const cabecera = ["Nombre", "Tipo", ...camposExtra, "Latitud", "Longitud", "Registrado Por", "Fecha"];
    let csv = "data:text/csv;charset=utf-8,\uFEFF" + cabecera.join(",") + "\n";
    items.forEach((item) => {
      const extras_ = camposExtra.map((c) => `"${item[c] || ""}"`).join(",");
      csv += `"${item.nombre || ""}","${item.tipo || ""}",${extras_},${item.coords?.lat || ""},${item.coords?.lng || ""},"${item.creadoPor || "Sistema"}","${item.fechaCreacion || ""}"\n`;
    });
    const link = document.createElement("a");
    link.href = encodeURI(csv);
    link.download = `${nombreArchivo}_${new Date().getFullYear()}.csv`;
    link.click();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-[#1e293b] border border-[#334155] rounded-2xl shadow-2xl p-6 max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-base font-semibold text-white">📊 Resumen de Marcadores</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-xl leading-none cursor-pointer">✖</button>
        </div>
        <p className="text-xs text-slate-400 mb-4">Análisis en tiempo real por capa.</p>

        {/* Tabs */}
        <div className="flex gap-1 mb-4 bg-[#0f172a] p-1 rounded-lg">
          {TABS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setTabActiva(key)}
              className={`flex-1 text-xs font-medium py-1.5 rounded-md transition-colors cursor-pointer ${
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
                items={extras.rural}
                ejeSecundario="Por Distrito Local"
                claveEje="distritoLocal"
                onExportar={() => exportarCSV(extras.rural, "Reporte_Rural", ["distritoLocal", "seccion"])}
              />
            )}
            {tabActiva === "top100" && (
              <TabPanel
                open
                items={extras.top100}
                ejeSecundario="Por Distrito Local"
                claveEje="distritoLocal"
                onExportar={() => exportarCSV(extras.top100, "Reporte_Top100", ["distritoLocal", "seccion"])}
              />
            )}
            {tabActiva === "general" && (
              <TabPanel
                open
                items={extras.general}
                ejeSecundario="Por Tipo"
                claveEje="tipo"
                onExportar={() => exportarCSV(extras.general, "Reporte_General")}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default StatsModal;
