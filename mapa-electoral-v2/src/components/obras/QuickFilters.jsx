import { useMapStore } from "../../store/mapStore";

const FILTROS = [
  { value: "all", label: "Todas" },
  { value: "Agua Potable", label: "💧 Agua" },
  { value: "Pavimentación", label: "🛣️ Pavimentación" },
  { value: "Electrificación", label: "⚡ Electrificación" },
  { value: "Drenaje", label: "🔧 Drenaje" },
];

const QuickFilters = () => {
  const { filtroTipo, setFiltroTipo } = useMapStore();

  return (
    <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 px-3 py-2 bg-[#1e293b]/90 backdrop-blur-sm border border-[#334155] rounded-2xl shadow-xl overflow-x-auto max-w-[90vw]">
      {FILTROS.map(({ value, label }) => (
        <button
          key={value}
          onClick={() => setFiltroTipo(value)}
          className={`whitespace-nowrap text-xs font-medium px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
            filtroTipo === value
              ? "bg-blue-600 text-white"
              : "text-slate-300 hover:bg-[#334155]"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
};

export default QuickFilters;
