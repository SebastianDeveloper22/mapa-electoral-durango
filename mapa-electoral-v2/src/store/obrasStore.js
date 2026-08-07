import { create } from 'zustand';

export const useObrasStore = create((set) => ({
  obras: [],
  setObras: (obras) => set({ obras }),

  // Modal de nueva/editar obra
  modalOpen: false,
  editandoId: null,
  coordsTemporales: null,

  openModalNuevo: (coords) => set({ modalOpen: true, editandoId: null, coordsTemporales: coords }),
  openModalEditar: (id, coords) => set({ modalOpen: true, editandoId: id, coordsTemporales: coords }),
  closeModal: () => set({ modalOpen: false, editandoId: null, coordsTemporales: null }),
}));
