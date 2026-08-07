import { create } from 'zustand';
import { ANIOS } from '../config';

export const useMapStore = create((set) => ({
  // Instancia del mapa
  mapInstance: null,
  setMapInstance: (map) => set({ mapInstance: map }),

  // Capas activas
  layersVisible: {
    municipio: false,
    'distrito-fed': false,
    'distrito-local': false,
    zona: false,
    seccion: false,
    colonia: false,
    manzana: false,
  },
  toggleLayer: (layerId) =>
    set((state) => ({
      layersVisible: {
        ...state.layersVisible,
        [layerId]: !state.layersVisible[layerId],
      },
    })),

  // Etiquetas globales
  labelsVisible: true,
  toggleLabels: () => set((state) => ({ labelsVisible: !state.labelsVisible })),

  // Años de PP visibles
  aniosVisibles: ANIOS.reduce((acc, a) => ({ ...acc, [a]: true }), {}),
  toggleAnio: (anio) =>
    set((state) => ({
      aniosVisibles: {
        ...state.aniosVisibles,
        [anio]: !state.aniosVisibles[anio],
      },
    })),

  // Filtro rápido por tipo de obra
  filtroTipo: 'all',
  setFiltroTipo: (tipo) => set({ filtroTipo: tipo }),

  // Modo satélite
  isSatellite: false,
  toggleSatellite: () => set((state) => ({ isSatellite: !state.isSatellite })),

  // Menú de capas abierto
  layerMenuOpen: false,
  toggleLayerMenu: () => set((state) => ({ layerMenuOpen: !state.layerMenuOpen })),
  closeLayerMenu: () => set({ layerMenuOpen: false }),
}));
