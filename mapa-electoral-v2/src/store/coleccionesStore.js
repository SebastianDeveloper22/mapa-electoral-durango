import { create } from "zustand";

export const useColeccionesStore = create((set) => ({
  coleccionesConfig: [],
  loading: true,
  setColecciones: (arr) => set({ coleccionesConfig: arr, loading: false }),
  setLoading: (loading) => set({ loading }),
  addColeccion: (config) =>
    set((state) => ({
      coleccionesConfig: [...state.coleccionesConfig, config],
    })),
}));
