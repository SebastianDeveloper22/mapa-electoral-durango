import { useState, useEffect } from 'react';
import { useElectoralStore } from '../../store/electoralStore';
import { useAuthStore } from '../../store/authStore';
import { createCasilla } from '../../services/electoralService';
import { useToast } from '../ui/Toast';
import { MUNICIPIOS, TIPOS_CASILLA } from '../../config';

const NuevaCasillaModal = ({ onSaved }) => {
  const {
    modalNuevaCasillaOpen, coordsNuevaCasilla,
    eleccionActiva, closeModalNuevaCasilla,
  } = useElectoralStore();
  const { user } = useAuthStore();
  const toast = useToast();

  const [nombre, setNombre]             = useState('');
  const [seccion, setSeccion]           = useState('');
  const [tipo, setTipo]                 = useState('B');
  const [municipio, setMunicipio]       = useState('5');
  const [listaNominal, setListaNominal] = useState('');
  const [ubicacion, setUbicacion]       = useState('');
  const [saving, setSaving]             = useState(false);

  // Limpiar al abrir
  useEffect(() => {
    if (modalNuevaCasillaOpen) {
      setNombre(''); setSeccion(''); setTipo('B');
      setMunicipio('5'); setListaNominal(''); setUbicacion('');
    }
  }, [modalNuevaCasillaOpen]);

  if (!modalNuevaCasillaOpen || !coordsNuevaCasilla) return null;

  const handleSave = async () => {
    if (!seccion.trim()) {
      toast('El número de sección es obligatorio.', 'warning');
      return;
    }
    setSaving(true);
    try {
      await createCasilla({
        eleccion_id:    eleccionActiva.id,
        nombre:         nombre.trim() || `Casilla ${seccion} - ${tipo}`,
        seccion:        seccion.trim(),
        tipo,
        municipio,
        lista_nominal:  parseInt(listaNominal) || 0,
        ubicacion:      ubicacion.trim(),
        coords:         { lat: coordsNuevaCasilla.lat, lng: coordsNuevaCasilla.lng },
        creadoPor:      user?.email || 'Desconocido',
      });
      toast('Casilla registrada correctamente.', 'success');
      closeModalNuevaCasilla();
      onSaved?.();
    } catch (err) {
      console.error(err);
      toast('Error al guardar la casilla.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-[#1e293b] border border-[#334155] rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-[#334155]">
          <div>
            <h3 className="text-sm font-semibold text-white">📍 Nueva Casilla</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              {coordsNuevaCasilla.lat.toFixed(5)}, {coordsNuevaCasilla.lng.toFixed(5)}
            </p>
          </div>
          <button onClick={closeModalNuevaCasilla} className="text-slate-400 hover:text-white text-xl cursor-pointer">✖</button>
        </div>

        <div className="px-5 py-4 flex flex-col gap-3">
          {/* Sección — obligatorio */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5 uppercase tracking-wider">
              Sección Electoral <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={seccion}
              onChange={(e) => setSeccion(e.target.value)}
              placeholder="Ej. 0142"
              className="w-full bg-[#0f172a] border border-[#334155] text-white text-sm rounded-lg px-3 py-2.5 outline-none focus:border-blue-500 transition-colors placeholder:text-slate-600"
            />
          </div>

          {/* Nombre */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5 uppercase tracking-wider">
              Nombre / Descripción
            </label>
            <input
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej. Escuela Benito Juárez"
              className="w-full bg-[#0f172a] border border-[#334155] text-white text-sm rounded-lg px-3 py-2.5 outline-none focus:border-blue-500 transition-colors placeholder:text-slate-600"
            />
          </div>

          {/* Tipo + Municipio en fila */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5 uppercase tracking-wider">
                Tipo
              </label>
              <select
                value={tipo}
                onChange={(e) => setTipo(e.target.value)}
                className="w-full bg-[#0f172a] border border-[#334155] text-white text-sm rounded-lg px-3 py-2.5 outline-none focus:border-blue-500 cursor-pointer"
              >
                {TIPOS_CASILLA.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5 uppercase tracking-wider">
                Lista Nominal
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={listaNominal}
                onChange={(e) => setListaNominal(e.target.value.replace(/\D/g, ''))}
                placeholder="0"
                className="w-full bg-[#0f172a] border border-[#334155] text-white text-sm rounded-lg px-3 py-2.5 outline-none focus:border-blue-500 transition-colors placeholder:text-slate-600"
              />
            </div>
          </div>

          {/* Municipio */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5 uppercase tracking-wider">
              Municipio
            </label>
            <select
              value={municipio}
              onChange={(e) => setMunicipio(e.target.value)}
              className="w-full bg-[#0f172a] border border-[#334155] text-white text-sm rounded-lg px-3 py-2.5 outline-none focus:border-blue-500 cursor-pointer"
            >
              {MUNICIPIOS.filter((m) => m.value !== 'TODOS').map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>

          {/* Ubicación */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5 uppercase tracking-wider">
              Dirección / Referencia
            </label>
            <input
              type="text"
              value={ubicacion}
              onChange={(e) => setUbicacion(e.target.value)}
              placeholder="Ej. Calle Juárez 45, Col. Centro"
              className="w-full bg-[#0f172a] border border-[#334155] text-white text-sm rounded-lg px-3 py-2.5 outline-none focus:border-blue-500 transition-colors placeholder:text-slate-600"
            />
          </div>
        </div>

        {/* Acciones */}
        <div className="px-5 pb-5 flex gap-3">
          <button
            onClick={closeModalNuevaCasilla}
            className="flex-1 bg-[#334155] hover:bg-[#475569] text-slate-200 text-sm font-medium py-2.5 rounded-lg transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white text-sm font-semibold py-2.5 rounded-lg transition-colors cursor-pointer"
          >
            {saving ? 'Guardando...' : 'Registrar Casilla'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default NuevaCasillaModal;
