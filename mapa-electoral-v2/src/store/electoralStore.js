import { create } from 'zustand';

export const useElectoralStore = create((set) => ({
  // ── Elecciones ─────────────────────────────────────────────────────────────
  elecciones: [],
  eleccionActiva: null, // elección seleccionada para ver en el mapa

  setElecciones: (arr) => set({ elecciones: arr }),

  setEleccionActiva: (eleccion) => set({ eleccionActiva: eleccion }),

  // ── Casillas ───────────────────────────────────────────────────────────────
  casillas: [],

  setCasillas: (arr) => set({ casillas: arr }),

  // ── Resultados ─────────────────────────────────────────────────────────────
  // Mapa: { [casilla_id]: { id, votos: {...}, total_votos, ganador, ... } }
  resultados: {},

  /**
   * Reemplaza todos los resultados convirtiendo el array plano
   * en un mapa indexado por casilla_id.
   * @param {Array} arr
   */
  setResultados: (arr) =>
    set({
      resultados: arr.reduce((acc, r) => {
        acc[r.casilla_id] = r;
        return acc;
      }, {}),
    }),

  /**
   * Actualiza o inserta un resultado individual en el mapa.
   * @param {string} casilla_id
   * @param {Object} resultado
   */
  updateResultado: (casilla_id, resultado) =>
    set((state) => ({
      resultados: {
        ...state.resultados,
        [casilla_id]: resultado,
      },
    })),

  // ── UI — Vista del mapa electoral ──────────────────────────────────────────
  // 'ganador' | 'participacion' | 'calor'
  vistaElectoral: 'ganador',

  setVistaElectoral: (v) => set({ vistaElectoral: v }),

  // ── Modal captura de votos ─────────────────────────────────────────────────
  modalCapturaOpen: false,
  casillaSeleccionada: null,

  openModalCaptura: (casilla) =>
    set({ modalCapturaOpen: true, casillaSeleccionada: casilla }),

  closeModalCaptura: () =>
    set({ modalCapturaOpen: false, casillaSeleccionada: null }),

  // ── Modal nueva casilla ────────────────────────────────────────────────────
  modalNuevaCasillaOpen: false,
  coordsNuevaCasilla: null,

  openModalNuevaCasilla: (coords) =>
    set({ modalNuevaCasillaOpen: true, coordsNuevaCasilla: coords }),

  closeModalNuevaCasilla: () =>
    set({ modalNuevaCasillaOpen: false, coordsNuevaCasilla: null }),
}));
