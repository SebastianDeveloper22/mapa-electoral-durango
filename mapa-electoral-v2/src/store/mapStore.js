import { create } from 'zustand';
import { ANIOS, DISTRITOS_LOCALES } from '../config';

// Estado inicial de filtros DL para rural y top100
const dlInicial = DISTRITOS_LOCALES.reduce((acc, dl) => ({ ...acc, [dl]: true }), {});

export const useMapStore = create((set) => ({
  // Instancia del mapa
  mapInstance: null,
  setMapInstance: (map) => set({ mapInstance: map }),

  // Capas cartográficas activas
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

  // Visibilidad de capas de marcadores adicionales
  marcadoresVisibles: {
    rural: true,
    top100: true,
    general: true,
  },
  toggleMarcador: (capa) =>
    set((state) => ({
      marcadoresVisibles: {
        ...state.marcadoresVisibles,
        [capa]: !state.marcadoresVisibles[capa],
      },
    })),

  // Filtros por Distrito Local (solo para rural y top100)
  filtrosDL: {
    rural: { ...dlInicial },
    top100: { ...dlInicial },
  },
  toggleDL: (capa, dl) =>
    set((state) => ({
      filtrosDL: {
        ...state.filtrosDL,
        [capa]: {
          ...state.filtrosDL[capa],
          [dl]: !state.filtrosDL[capa][dl],
        },
      },
    })),

  // Filtro rápido por tipo de obra (PP)
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
