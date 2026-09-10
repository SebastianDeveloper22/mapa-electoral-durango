import { create } from 'zustand';

export const useObrasStore = create((set) => ({
  obras: [],
  setObras: (obras) => set({ obras }),

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
