import { useEffect, useRef } from "react";
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

Chart.register(
  ArcElement,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Title,
  DoughnutController,
  BarController,
);

// Hash determinista para generar colores únicos por string
const strHash = (s) => {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h = h & h;
  }
  return Math.abs(h);
};
const colorFromStr = (s) => {
  const h = strHash(s) % 360;
  const sat = (strHash(s) % 15) + 65;
  const lit = (strHash(s) % 20) + 50;
  return `hsl(${h},${sat}%,${lit}%)`;
};

const normalizar = (t) =>
  (t || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const StatsModal = ({ open, onClose }) => {
  const { obras } = useObrasStore();
  const chartDonaRef = useRef(null);
  const chartBarraRef = useRef(null);
  const donaInstance = useRef(null);
  const barraInstance = useRef(null);

  useEffect(() => {
    if (!open || !obras.length) return;

    // Agrupar datos
    const porAnio = {};
    const porTipoKey = {};
    const tipoVisual = {};

    obras.forEach(({ anio, tipo }) => {
      const a = anio || "Sin Año";
      const tipoOrig = (tipo || "Sin Especificar").trim();
      const key = normalizar(tipoOrig);

      porAnio[a] = (porAnio[a] || 0) + 1;
      porTipoKey[key] = (porTipoKey[key] || 0) + 1;
      if (!tipoVisual[key])
        tipoVisual[key] = tipoOrig.charAt(0).toUpperCase() + tipoOrig.slice(1);
    });

    // Destruir instancias anteriores
    donaInstance.current?.destroy();
    barraInstance.current?.destroy();

    // Dona — por tipo
    const tipoKeys = Object.keys(porTipoKey);
    const tipoColors = tipoKeys.map(colorFromStr);

    donaInstance.current = new Chart(chartDonaRef.current, {
      type: "doughnut",
      data: {
        labels: tipoKeys.map((k) => tipoVisual[k]),
        datasets: [
          {
            data: tipoKeys.map((k) => porTipoKey[k]),
            backgroundColor: tipoColors,
            borderWidth: 0,
            hoverOffset: 4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          title: {
            display: true,
            text: "Por Tipo de Obra",
            color: "#94a3b8",
            font: { size: 11 },
          },
        },
      },
    });

    // Barras — por año
    const aniosOrdenados = Object.keys(porAnio).sort();
    barraInstance.current = new Chart(chartBarraRef.current, {
      type: "bar",
      data: {
        labels: aniosOrdenados,
        datasets: [
          {
            label: "Obras",
            data: aniosOrdenados.map((a) => porAnio[a]),
            backgroundColor: "#3b82f6",
            borderRadius: 4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          title: {
            display: true,
            text: "Por Año",
            color: "#94a3b8",
            font: { size: 11 },
          },
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: { color: "#94a3b8", stepSize: 1, font: { size: 10 } },
            grid: { color: "rgba(255,255,255,0.05)" },
          },
          x: {
            ticks: { color: "#e2e8f0", font: { weight: "bold", size: 10 } },
            grid: { display: false },
          },
        },
      },
    });

    // Leyenda custom
    const legendEl = document.getElementById("stats-legend");
    if (legendEl) {
      legendEl.innerHTML = tipoKeys
        .map(
          (k, i) => `
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:5px;">
          <div style="min-width:10px;height:10px;border-radius:2px;background:${tipoColors[i]}"></div>
          <span style="flex:1;font-size:11px;color:#e2e8f0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${tipoVisual[k]}</span>
          <span style="color:#94a3b8;font-size:11px;font-weight:bold;">${porTipoKey[k]}</span>
        </div>
      `,
        )
        .join("");
    }

    return () => {
      donaInstance.current?.destroy();
      barraInstance.current?.destroy();
    };
  }, [open, obras]);

  const exportarCSV = () => {
    let csv = "data:text/csv;charset=utf-8,\uFEFF";
    csv += "Nombre,Tipo,Año,Latitud,Longitud,Registrado Por,Fecha\n";
    obras.forEach(
      ({ nombre, tipo, anio, coords, creadoPor, fechaCreacion }) => {
        csv += `"${nombre || ""}","${tipo || ""}",${anio || ""},${coords?.lat || ""},${coords?.lng || ""},"${creadoPor || "Sistema"}","${fechaCreacion || ""}"\n`;
      },
    );
    const link = document.createElement("a");
    link.href = encodeURI(csv);
    link.download = `Reporte_Obras_${new Date().getFullYear()}.csv`;
    link.click();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-[#1e293b] border border-[#334155] rounded-2xl shadow-2xl p-6 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-base font-semibold text-white">
            📊 Resumen de Obras
          </h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white text-xl leading-none cursor-pointer"
          >
            ✖
          </button>
        </div>
        <p className="text-xs text-slate-400 mb-4">
          Análisis en tiempo real de la cartografía.
        </p>

        {obras.length === 0 ? (
          <p className="text-slate-400 text-sm text-center py-8">
            No hay obras registradas.
          </p>
        ) : (
          <>
            {/* Total */}
            <div className="flex items-center justify-between bg-sky-500/10 border-l-4 border-sky-500 rounded-lg px-4 py-3 mb-4">
              <span className="text-sky-400 text-sm font-medium">
                Total de Obras Mapeadas
              </span>
              <span className="text-white text-2xl font-bold">
                {obras.length}
              </span>
            </div>

            {/* Dona + leyenda */}
            <div className="flex gap-3 mb-4" style={{ height: "170px" }}>
              <div className="flex-1 relative">
                <canvas ref={chartDonaRef} />
              </div>
              <div
                id="stats-legend"
                className="w-2/5 overflow-y-auto pr-1"
                style={{ scrollbarWidth: "thin" }}
              />
            </div>

            {/* Barras */}
            <div className="relative mb-4" style={{ height: "160px" }}>
              <canvas ref={chartBarraRef} />
            </div>

            {/* Exportar */}
            <button
              onClick={exportarCSV}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold py-2.5 rounded-lg transition-colors cursor-pointer"
            >
              📥 Descargar a Excel (CSV)
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default StatsModal;
