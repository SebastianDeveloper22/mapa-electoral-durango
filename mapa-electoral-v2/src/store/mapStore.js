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
  aniosVisibles: ANIOS.reduce((acc, a) => ({ ...acc, [a]: false }), {}),
  toggleAnio: (anio) =>
    set((state) => ({
      aniosVisibles: {
        ...state.aniosVisibles,
        [anio]: !state.aniosVisibles[anio],
      },
    })),

  // Visibilidad de capas de marcadores adicionales
  marcadoresVisibles: {
    rural: false,
    top100: false,
    general: false,
    capital: false,
    municipios: false,
    guardianes: false,
  },
  toggleMarcador: (capa) =>
    set((state) => ({
      marcadoresVisibles: {
        ...state.marcadoresVisibles,
        [capa]: !state.marcadoresVisibles[capa],
      },
    })),

  // Filtros por Distrito Local (rural, top100 y guardianes)
  filtrosDL: {
    rural: { ...dlInicial },
    top100: { ...dlInicial },
    guardianes: { ...dlInicial },
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

  // Filtro "solo seleccionados" por capa de Espectaculares
  filtroSeleccionado: {
    general: false,
    capital: false,
    municipios: false,
  },
  toggleFiltroSeleccionado: (capa) =>
    set((state) => ({
      filtroSeleccionado: {
        ...state.filtroSeleccionado,
        [capa]: !state.filtroSeleccionado[capa],
      },
    })),

  // Filtro "solo visitados" por capa Rural / Top 100
  filtroVisitado: {
    rural: false,
    top100: false,
  },
  toggleFiltroVisitado: (capa) =>
    set((state) => ({
      filtroVisitado: {
        ...state.filtroVisitado,
        [capa]: !state.filtroVisitado[capa],
      },
    })),

  // Filtro "solo atendidos" — Guardianes del Camino
  filtroAtendido: {
    guardianes: false,
  },
  toggleFiltroAtendido: (capa) =>
    set((state) => ({
      filtroAtendido: {
        ...state.filtroAtendido,
        [capa]: !state.filtroAtendido[capa],
      },
    })),

  // Filtro por Red — Guardianes del Camino ("" = todas)
  filtroRed: {
    guardianes: "",
  },
  setFiltroRed: (capa, red) =>
    set((state) => ({
      filtroRed: {
        ...state.filtroRed,
        [capa]: red,
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

  // Inicializar estado de filtros para una colección dinámica (idempotente)
  addColeccionDinamica: (config) =>
    set((state) => {
      const { key, campos = [] } = config;
      // No sobreescribir si ya existe
      if (key in state.marcadoresVisibles) return {};
      const conDL     = campos.includes("distritoLocal");
      const conVisit  = campos.includes("visitado");
      const conAtend  = campos.includes("atendido");
      const conSelec  = campos.includes("seleccionado");
      const conRed    = campos.includes("red");
      const dlInicial = DISTRITOS_LOCALES.reduce((acc, dl) => ({ ...acc, [dl]: true }), {});
      return {
        marcadoresVisibles: { ...state.marcadoresVisibles, [key]: false },
        filtrosDL:          conDL    ? { ...state.filtrosDL,          [key]: { ...dlInicial } } : state.filtrosDL,
        filtroVisitado:     conVisit ? { ...state.filtroVisitado,     [key]: false }            : state.filtroVisitado,
        filtroAtendido:     conAtend ? { ...state.filtroAtendido,     [key]: false }            : state.filtroAtendido,
        filtroSeleccionado: conSelec ? { ...state.filtroSeleccionado, [key]: false }            : state.filtroSeleccionado,
        filtroRed:          conRed   ? { ...state.filtroRed,          [key]: "" }               : state.filtroRed,
      };
    }),
}));
