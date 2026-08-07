// Años de obras PP
export const ANIOS = ["2023", "2024", "2025", "2026"];
export const ANIO_DEFAULT = "2024";

// Roles del sistema
export const ROLES = {
  LECTOR: "lector",
  EDITOR: "editor",
  ADMIN: "admin",
};

// Municipios de Durango
export const MUNICIPIOS = [
  { value: "TODOS", label: "Todo el Estado" },
  { value: "1", label: "Canatlán" },
  { value: "2", label: "Canelas" },
  { value: "3", label: "Coneto de Comonfort" },
  { value: "4", label: "Cuencamé" },
  { value: "5", label: "Durango" },
  { value: "19", label: "El Oro" },
  { value: "7", label: "Gómez Palacio" },
  { value: "8", label: "Guadalupe Victoria" },
  { value: "9", label: "Guanaceví" },
  { value: "10", label: "Hidalgo" },
  { value: "11", label: "Indé" },
  { value: "12", label: "Lerdo" },
  { value: "13", label: "Mapimí" },
  { value: "14", label: "Mezquital" },
  { value: "15", label: "Nazas" },
  { value: "16", label: "Nombre de Dios" },
  { value: "17", label: "Nuevo Ideal" },
  { value: "18", label: "Ocampo" },
  { value: "20", label: "Otáez" },
  { value: "21", label: "Pánuco de Coronado" },
  { value: "22", label: "Peñón Blanco" },
  { value: "23", label: "Poanas" },
  { value: "24", label: "Pueblo Nuevo" },
  { value: "25", label: "Rodeo" },
  { value: "26", label: "San Bernardo" },
  { value: "27", label: "San Dimas" },
  { value: "28", label: "San Juan de Guadalupe" },
  { value: "29", label: "San Juan del Río" },
  { value: "30", label: "San Luis del Cordero" },
  { value: "31", label: "San Pedro del Gallo" },
  { value: "32", label: "Santa Clara" },
  { value: "33", label: "Santiago Papasquiaro" },
  { value: "6", label: "Simón Bolívar" },
  { value: "34", label: "Súchil" },
  { value: "35", label: "Tamazula" },
  { value: "36", label: "Tepehuanes" },
  { value: "37", label: "Tlahualilo" },
  { value: "38", label: "Topia" },
  { value: "39", label: "Vicente Guerrero" },
];

// Capas cartográficas
// Cada capa define:
//   color: color de la línea de borde
//   width: grosor de la línea
//   dash: [onPx, offPx] para línea punteada (null = sólida)
//   minZoom: zoom mínimo para renderizar la capa
//   labelField: campo del feature para etiquetar (null = sin etiqueta)
//   labelColor: color del texto de etiqueta
//   labelSize: tamaño del texto de etiqueta en px
//   labelMinZoom: zoom mínimo SOLO para las etiquetas (puede ser > minZoom)
export const CAPAS = [
  {
    // Límite municipal: naranja, línea gruesa, muy prominente
    id: "municipio",
    sourceLayer: "MUNICIPIO",
    color: "#f97316",
    width: 4.2,
    dash: null,
    minZoom: 10,
    labelField: "MUNICIPIO",
    labelColor: "#fed7aa",
    labelSize: 13,
    labelMinZoom: 10,
  },
  {
    // Distrito federal: rojo, línea punteada larga, media-gruesa
    id: "distrito-fed",
    sourceLayer: "DISTRITO_FEDERAL",
    color: "#ef4444",
    width: 3.0,
    dash: [6, 3],
    minZoom: 10,
    labelField: "DISTRITO_F",
    labelColor: "#fca5a5",
    labelSize: 11,
    labelMinZoom: 10,
  },
  {
    // Distrito local: púrpura, punteado corto, ligeramente más delgado
    id: "distrito-local",
    sourceLayer: "DISTRITO_LOCAL",
    color: "#a855f7",
    width: 2.3,
    dash: [3, 2],
    minZoom: 10,
    labelField: "DISTRITO_L",
    labelColor: "#d8b4fe",
    labelSize: 10,
    labelMinZoom: 11,
  },
  {
    // Zona: azul marino oscuro #000099
    id: "zona",
    sourceLayer: "ZONAS HECHAS",
    color: "#000099",
    width: 2.8,
    dash: null,
    minZoom: 10,
    labelField: "Zona",
    labelColor: "#8888ff",
    labelSize: 15,
    labelMinZoom: 11,
  },
  {
    // Sección: MAGENTA/ROSA — completamente distinto del amarillo de zonas
    id: "seccion",
    sourceLayer: "SECCION",
    color: "#f472b6",
    width: 1.6,
    dash: null,
    minZoom: 11,
    labelField: "SECCION",
    labelColor: "#fbcfe8",
    labelSize: 13,
    labelMinZoom: 13,
  },
  {
    id: "colonia",
    sourceLayer: "COLONIA",
    color: "#94a3b8",
    width: 0.65,
    dash: null,
    minZoom: 12,
    labelField: "NOMBRE",
    labelColor: "#cbd5e1",
    labelSize: 9,
    labelMinZoom: 13,
  },
  {
    id: "manzana",
    sourceLayer: "MANZANA",
    color: "#475569",
    width: 0.3,
    dash: null,
    minZoom: 14,
    labelField: null,
    labelColor: null,
    labelSize: null,
    labelMinZoom: null,
  },
];

// Centro del mapa (Durango capital)
export const MAP_CENTER = [-104.6531, 24.0277];
export const MAP_ZOOM = 12;

// Partidos políticos
// NOTA: En Durango 2025, PAN representa la alianza CC_PAN_PRI ("Va por Durango")
//       y MORENA representa la alianza C_PVEM_PT_MORENA ("Sigamos Haciendo Historia").
//       Los votos de PRI+PAN+CC_PAN_PRI se suman a PAN; los de PVEM+PT+MORENA
//       y todas sus sub-coaliciones se suman a MORENA.
export const PARTIDOS = [
  {
    clave: "PAN",
    nombre: "Alianza PAN-PRI (CC_PAN_PRI)",
    color: "#003f8a",
    colorLight: "#0052b4",
  },
  {
    clave: "MORENA",
    nombre: "Alianza PVEM-PT-MORENA",
    color: "#6b0f1a",
    colorLight: "#9b1a2a",
  },
  {
    clave: "MC",
    nombre: "Movimiento Ciudadano",
    color: "#f97316",
    colorLight: "#fb923c",
  },
  {
    clave: "OTROS",
    nombre: "Otros partidos",
    color: "#64748b",
    colorLight: "#94a3b8",
  },
  {
    clave: "NULOS",
    nombre: "Votos nulos",
    color: "#374151",
    colorLight: "#4b5563",
  },
];

// Tipos de elección
export const TIPOS_ELECCION = [
  { value: "presidencial", label: "Presidencial" },
  { value: "gubernatura", label: "Gubernatura" },
  { value: "diputado_fed", label: "Diputación Federal" },
  { value: "diputado_local", label: "Diputación Local" },
  { value: "municipio", label: "Presidencia Municipal" },
];

// Tipos de casilla
export const TIPOS_CASILLA = [
  { value: "B", label: "Básica" },
  { value: "C", label: "Contigua" },
  { value: "E", label: "Extraordinaria" },
  { value: "S", label: "Especial" },
];
