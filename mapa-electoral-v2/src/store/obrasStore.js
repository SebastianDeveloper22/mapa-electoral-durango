import { create } from 'zustand';

export const useObrasStore = create((set) => ({
  obras: [],
  setObras: (obras) => set({ obras }),

  // Datos de marcadores adicionales cargados por PinLayer (evita doble fetch en StatsModal)
  // null = todavía no cargado; objeto = ya cargado (aunque esté vacío)
  extras: null,
  setExtras: (extras) => set({ extras }),

  // Datos del marcador que se está editando (reemplaza window.__llenarFormularioObra)
  marcadorEditando: null,
  setMarcadorEditando: (data) => set({ marcadorEditando: data }),

  // Modal de nueva/editar marcador (cualquier capa)
  modalOpen: false,
  editandoId: null,
  editandoCapa: null,   // 'pp' | 'rural' | 'top100' | 'general'
  coordsTemporales: null,

  openModalNuevo: (coords) =>
    set({ modalOpen: true, editandoId: null, editandoCapa: null, coordsTemporales: coords }),
  openModalEditar: (id, coords, capa) =>
    set({ modalOpen: true, editandoId: id, editandoCapa: capa ?? 'pp', coordsTemporales: coords }),
  closeModal: () =>
    set({ modalOpen: false, editandoId: null, editandoCapa: null, coordsTemporales: null }),
}));
