/**
 * parsearCSV.js
 * Parsea el archivo DGO_AYUN_2025.csv del INE y retorna
 * un array de objetos listos para importar a Firestore.
 *
 * ── Estructura de columnas de votos (posiciones 17-33) ──────────────────────
 *
 *  Col 17  PAN           — votos individuales en logo PAN
 *  Col 18  PRI           — votos individuales en logo PRI
 *  Col 19  PVEM          — votos individuales en logo PVEM
 *  Col 20  PT            — votos individuales en logo PT
 *  Col 21  MC            — Movimiento Ciudadano
 *  Col 22  MORENA        — votos individuales en logo MORENA
 *  Col 23  PESD          — partido menor
 *  Col 24  PV            — partido menor
 *  Col 25  PER           — partido menor
 *  Col 26  CAND_IND_EDRH — candidatura independiente
 *  Col 27  C_PVEM_PT_MORENA — boleta de coalición PVEM+PT+MORENA
 *  Col 28  C_PVEM_PT        — sub-coalición
 *  Col 29  C_PVEM_MORENA    — sub-coalición
 *  Col 30  C_PT_MORENA      — sub-coalición
 *  Col 31  CC_PAN_PRI    — boleta de coalición PAN+PRI
 *  Col 32  NO_REGISTRADAS
 *  Col 33  NULOS
 *
 * ── Regla de agregación (INE para elecciones de coalición) ──────────────────
 *
 *  En Durango 2025 la elección municipal es esencialmente:
 *    CC_PAN_PRI  vs  C_PVEM_PT_MORENA  vs  MC
 *
 *  Los electores pueden marcar el logo individual de PAN/PRI  →  cuenta para CC_PAN_PRI
 *  Los electores pueden marcar el logo individual de PVEM/PT/MORENA  →  cuenta para C_PVEM_PT_MORENA
 *  Por eso los votos se agregan así:
 *
 *    PAN   = PAN + PRI + CC_PAN_PRI
 *    MORENA = PVEM + PT + MORENA + C_PVEM_PT_MORENA + C_PVEM_PT + C_PVEM_MORENA + C_PT_MORENA
 *    MC    = MC
 *    OTROS  = PESD + PV + PER + CAND_IND_EDRH + NO_REGISTRADAS
 *    NULOS  = NULOS
 */

const limpiarNumero = (val) => {
  if (!val) return 0;
  const str = String(val).replace(/'/g, "").trim();
  if (str === "Sin dato" || str === "Ilegible" || str === "N/A" || str === "")
    return 0;
  const n = parseInt(str, 10);
  return isNaN(n) ? 0 : n;
};

const limpiarTexto = (val) => {
  if (!val) return "";
  return String(val).replace(/^'/, "").replace(/^"|"$/g, "").trim();
};

/**
 * Parsea el contenido del CSV y retorna array de casillas con resultados.
 * @param {string} contenido — texto completo del archivo CSV
 * @returns {{ casillas: Array, errores: Array, resumen: Object }}
 */
export const parsearCSVCasillas = (contenido) => {
  const lineas = contenido
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  // Encontrar la línea del header (contiene CLAVE_CASILLA)
  const idxHeader = lineas.findIndex((l) => l.startsWith("CLAVE_CASILLA"));
  if (idxHeader === -1) {
    return {
      casillas: [],
      errores: ["No se encontró la cabecera del CSV."],
      resumen: {},
    };
  }

  // Parsear header y construir mapa nombre → índice de columna
  const headers = parsearLinea(lineas[idxHeader]);
  const idx = {};
  headers.forEach((h, i) => {
    idx[h.trim()] = i;
  });

  const casillas = [];
  const errores = [];
  let omitidas = 0;

  for (let i = idxHeader + 1; i < lineas.length; i++) {
    const linea = lineas[i];
    // Saltar líneas vacías, resúmenes del INE o encabezados repetidos
    if (!linea || linea.startsWith("AYUNTAMIENTOS") || linea.startsWith('"'))
      continue;

    const cols = parsearLinea(linea);
    if (cols.length < 10) {
      omitidas++;
      continue;
    }

    const claveCasilla = limpiarTexto(cols[idx["CLAVE_CASILLA"]]);
    const idMunicipioRaw = limpiarTexto(cols[idx["ID_MUNICIPIO"]]);
    // Normalizar '005' → '5' para coincidir con MUNICIPIOS en config
    const idMunicipio = String(parseInt(idMunicipioRaw, 10) || idMunicipioRaw);
    const municipio = limpiarTexto(cols[idx["MUNICIPIO"]]);
    const seccion = limpiarTexto(cols[idx["SECCION"]]);
    const idCasilla = limpiarTexto(cols[idx["ID_CASILLA"]]);
    const tipoCasilla = limpiarTexto(cols[idx["TIPO_CASILLA"]]);
    const ubicacion = limpiarTexto(cols[idx["UBICACION_CASILLA"]]);
    const listaNominal = limpiarNumero(cols[idx["LISTA_NOMINAL"]]);
    const contabilizada = limpiarTexto(cols[idx["CONTABILIZADA"]]);

    // Omitir filas sin sección válida o tipo "A" (actas especiales sin casilla real)
    if (!seccion || seccion === "N/A" || tipoCasilla === "A") {
      omitidas++;
      continue;
    }

    // ── Votos individuales por logo de partido ──────────────────────────────
    const vPAN = limpiarNumero(cols[idx["PAN"]]);
    const vPRI = limpiarNumero(cols[idx["PRI"]]);
    const vPVEM = limpiarNumero(cols[idx["PVEM"]]);
    const vPT = limpiarNumero(cols[idx["PT"]]);
    const vMC = limpiarNumero(cols[idx["MC"]]);
    const vMORENA = limpiarNumero(cols[idx["MORENA"]]);

    // ── Boletas de coalición ────────────────────────────────────────────────
    const vCC_PAN_PRI = limpiarNumero(cols[idx["CC_PAN_PRI"]]);
    const vC_PVEM_PT_MORENA = limpiarNumero(cols[idx["C_PVEM_PT_MORENA"]]);
    const vC_PVEM_PT = limpiarNumero(cols[idx["C_PVEM_PT"]]);
    const vC_PVEM_MORENA = limpiarNumero(cols[idx["C_PVEM_MORENA"]]);
    const vC_PT_MORENA = limpiarNumero(cols[idx["C_PT_MORENA"]]);

    // ── Partidos menores / sin registro ────────────────────────────────────
    const vPESD = limpiarNumero(cols[idx["PESD"]]);
    const vPV = limpiarNumero(cols[idx["PV"]]);
    const vPER = limpiarNumero(cols[idx["PER"]]);
    const vCAND_IND = limpiarNumero(cols[idx["CAND_IND_EDRH"]]);
    const vNO_REG = limpiarNumero(cols[idx["NO_REGISTRADAS"]]);
    const vNULOS = limpiarNumero(cols[idx["NULOS"]]);

    // ── Votos sin agregar — columnas originales del CSV ───────────────────
    const votosPartido = {
      // Individuales de partido
      PAN: vPAN,
      PRI: vPRI,
      PVEM: vPVEM,
      PT: vPT,
      MC: vMC,
      MORENA: vMORENA,
      PESD: vPESD,
      PV: vPV,
      PER: vPER,
      CAND_IND_EDRH: vCAND_IND,
      // Boletas de coalición
      CC_PAN_PRI: vCC_PAN_PRI,
      C_PVEM_PT_MORENA: vC_PVEM_PT_MORENA,
      C_PVEM_PT: vC_PVEM_PT,
      C_PVEM_MORENA: vC_PVEM_MORENA,
      C_PT_MORENA: vC_PT_MORENA,
      // Sin registro y nulos
      NO_REGISTRADAS: vNO_REG,
      NULOS: vNULOS,
    };

    const totalVotos = Object.values(votosPartido).reduce((a, b) => a + b, 0);

    casillas.push({
      // Identificación
      clave_casilla: claveCasilla,
      id_municipio: idMunicipio,
      municipio: municipio,
      seccion: seccion,
      id_casilla: idCasilla,
      tipo: tipoCasilla,
      ubicacion: ubicacion,
      lista_nominal: listaNominal,
      contabilizada: contabilizada === "1",

      // Coordenadas — se calculan desde los archivos .pbf
      coords: null,

      // Resultados
      votos: votosPartido,
      total_votos: totalVotos,
    });
  }

  const resumen = {
    total: casillas.length,
    omitidas,
    municipios: [...new Set(casillas.map((c) => c.municipio))].length,
    secciones: [...new Set(casillas.map((c) => c.seccion))].length,
  };

  return { casillas, errores, resumen };
};

/**
 * Parsea una línea CSV respetando campos entre comillas.
 */
const parsearLinea = (linea) => {
  const resultado = [];
  let actual = "";
  let enComillas = false;

  for (let i = 0; i < linea.length; i++) {
    const c = linea[i];
    if (c === '"' && !enComillas) {
      enComillas = true;
      continue;
    }
    if (c === '"' && enComillas) {
      enComillas = false;
      continue;
    }
    if (c === "," && !enComillas) {
      resultado.push(actual);
      actual = "";
      continue;
    }
    actual += c;
  }
  resultado.push(actual);
  return resultado;
};
