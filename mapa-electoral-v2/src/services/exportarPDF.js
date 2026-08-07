import jsPDF from "jspdf";

// ── Paleta ────────────────────────────────────────────────────────────────
const rgb = (hex) => [
  parseInt(hex.slice(1, 3), 16),
  parseInt(hex.slice(3, 5), 16),
  parseInt(hex.slice(5, 7), 16),
];

const GRIS_HEADER = rgb("#6b7280");
const AZUL_CHIP_BG = rgb("#dbeafe");
const AZUL_CHIP_TX = rgb("#1e40af");
const AZUL_LABEL = rgb("#0369a1");
const BLANCO = [255, 255, 255];
const GRIS_FONDO = rgb("#f0f6ff");
const GRIS_CARD = rgb("#e4eefe");
const GRIS_DIV = rgb("#bfdbfe");
const NEGRO_TX = rgb("#0f172a");
const GRIS_TX_PIE = rgb("#4a6080");
const AMARILLO = rgb("#f59e0b");
const ZONA_COLOR = rgb("#f59e0b");
const ZONA_TXT = rgb("#78350f");
const BORDE_EXT = rgb("#1e293b");

// ── Página: oficio landscape ──────────────────────────────────────────────
const W = 330;
const H = 216;
const MARGEN = 10;

// ── Alturas fijas ─────────────────────────────────────────────────────────
const MARGEN_SUP = 8; // margen blanco antes del header (evita recorte al imprimir en oficio)
const MARGEN_INF = 6; // margen blanco después de la franja de info (ya no hay pie de página)
const HEADER_H = 16;
const GAP_TOP = 1; // header → mapa
const GAP_MID = 2; // mapa → info
const META_H = 12; // fila de metadatos

const CARD_HDR_H = 6;
const CARD_CHI_H = 7;
const CARD_GAP = 2;
const PER_ZONA_H = CARD_HDR_H + CARD_CHI_H + CARD_GAP; // 15 mm

function calcInfoH(tipo, zonas) {
  if (tipo === "seccion") return META_H + 3;
  const n = zonas?.length ?? 0;
  return META_H + n * PER_ZONA_H + 3;
}

// ── 1. Captura HD del canvas ──────────────────────────────────────────────
/**
 * Captura el canvas de MapLibre en alta resolución usando setPixelRatio.
 *
 * El canvas nativo suele estar en 1280×720 px (~110 DPI al imprimir en oficio).
 * Subiendo el pixelRatio 3× obtenemos ~3840×2160 px (~296 DPI) sin cambiar la vista.
 * Tras capturar se restaura el ratio original.
 */
async function capturarMapaHD(mapInstance) {
  return new Promise((resolve) => {
    if (!mapInstance) {
      resolve(null);
      return;
    }

    const canvasActual = mapInstance.getCanvas();
    const anchoActual = canvasActual.width || 1280;

    // Factor para alcanzar ≥ 3500 px (suficiente para ~270 DPI en oficio)
    const factor = Math.min(Math.ceil(3500 / anchoActual), 4);
    const tieneSetRatio = typeof mapInstance.setPixelRatio === "function";
    const ratioOriginal =
      mapInstance.getPixelRatio?.() ?? window.devicePixelRatio ?? 1;

    const restaurar = () => {
      if (tieneSetRatio) {
        try {
          mapInstance.setPixelRatio(ratioOriginal);
        } catch {
          /* noop */
        }
      }
    };

    const capturar = () => {
      try {
        const dataUrl = mapInstance.getCanvas().toDataURL("image/jpeg", 0.94);
        restaurar();
        resolve(dataUrl);
      } catch {
        restaurar();
        resolve(null);
      }
    };

    try {
      if (tieneSetRatio && factor > 1) {
        mapInstance.setPixelRatio(ratioOriginal * factor);
      }
      mapInstance.once("render", capturar);
      mapInstance.triggerRepaint();
    } catch {
      // Fallback sin escalado
      mapInstance.once("render", capturar);
      mapInstance.triggerRepaint();
    }
  });
}

// ── 2. Helpers de dibujo ──────────────────────────────────────────────────

/** Pastilla blanca de una sola línea (usada en la esquina sup. derecha del header). */
function dibujarPildoraHeader(doc, text, rightX, headerY, headerH) {
  const h = 8;
  const y = headerY + (headerH - h) / 2;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  let fontSize = 10.5;
  const maxW = W - MARGEN * 2 - 90; // deja espacio para el nombre de la dependencia
  doc.setFontSize(fontSize);
  while (doc.getTextWidth(text) > maxW && fontSize > 6.5) {
    fontSize -= 0.5;
    doc.setFontSize(fontSize);
  }
  const paddingX = 5;
  const w = Math.max(38, doc.getTextWidth(text) + paddingX * 2);
  const x = rightX - w;

  doc.setFillColor(...BLANCO);
  doc.roundedRect(x, y, w, h, h / 2, h / 2, "F");
  doc.setDrawColor(...BORDE_EXT);
  doc.setLineWidth(0.5);
  doc.roundedRect(x, y, w, h, h / 2, h / 2, "S");
  doc.setTextColor(...NEGRO_TX);
  doc.text(text, x + w / 2, y + h / 2 + fontSize * 0.14, { align: "center" });

  return { x, w };
}

/**
 * Pastilla blanca centrada dentro de un área (usada para el nombre de la
 * dependencia, esquina sup. izquierda). Misma "cápsula" con marco que la
 * de la zona, alineada a la izquierda y con fuente más grande.
 */
function dibujarPildoraDependencia(doc, text, areaX, areaW, headerY, headerH) {
  const h = 10.5;
  const y = headerY + (headerH - h) / 2;
  const paddingX = 6;

  doc.setFont("helvetica", "bold");
  let fontSize = 15;
  doc.setFontSize(fontSize);
  const maxTextW = areaW - paddingX * 2;
  while (doc.getTextWidth(text) > maxTextW && fontSize > 8) {
    fontSize -= 0.5;
    doc.setFontSize(fontSize);
  }

  const w = Math.min(areaW, doc.getTextWidth(text) + paddingX * 2);
  const x = areaX;

  doc.setFillColor(...BLANCO);
  doc.roundedRect(x, y, w, h, h / 2, h / 2, "F");
  doc.setDrawColor(...BORDE_EXT);
  doc.setLineWidth(0.5);
  doc.roundedRect(x, y, w, h, h / 2, h / 2, "S");
  doc.setTextColor(...NEGRO_TX);
  doc.text(text, x + w / 2, y + h / 2 + fontSize * 0.14, { align: "center" });

  return { x, w };
}

/** Etiqueta rectangular gris (p. ej. "TIPO: MULTIZONAS"). Devuelve el ancho ocupado. */
function dibujarTag(doc, x, y, text, h = 6.5) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  const paddingX = 3.5;
  const textW = doc.getTextWidth(text);
  const w = textW + paddingX * 2;

  doc.setFillColor(...GRIS_HEADER);
  doc.roundedRect(x, y, w, h, 1.4, 1.4, "F");
  doc.setTextColor(...BLANCO);
  doc.text(text, x + w / 2, y + h / 2 + 1.4, { align: "center" });

  return w;
}

function dibujarChips(doc, secciones, startX, startY, chipAreaW) {
  const CHIP_W = 19,
    CHIP_H = 5.8,
    GAP = 2;
  const perRow = Math.floor((chipAreaW + GAP) / (CHIP_W + GAP));
  if (perRow <= 0 || secciones.length === 0) return;

  const mostrar = secciones.slice(0, perRow);
  const resto = secciones.length - mostrar.length;

  mostrar.forEach((sec, i) => {
    const cx = startX + i * (CHIP_W + GAP);
    doc.setFillColor(...AZUL_CHIP_BG);
    doc.roundedRect(cx, startY, CHIP_W, CHIP_H, 1.5, 1.5, "F");
    doc.setDrawColor(...GRIS_DIV);
    doc.setLineWidth(0.3);
    doc.roundedRect(cx, startY, CHIP_W, CHIP_H, 1.5, 1.5, "S");
    doc.setTextColor(...AZUL_CHIP_TX);
    doc.setFontSize(6.5);
    doc.setFont("helvetica", "bold");
    doc.text(String(sec), cx + CHIP_W / 2, startY + 4, { align: "center" });
  });

  if (resto > 0) {
    const cx = startX + mostrar.length * (CHIP_W + GAP);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(6.5);
    doc.setTextColor(...GRIS_TX_PIE);
    doc.text(`+${resto} más`, cx + 1, startY + 4);
  }
}

function dibujarCardZona(doc, x, y, cardW, zNum, zSecs) {
  const BAR_W = 5;
  const totalCardH = CARD_HDR_H + CARD_CHI_H;

  doc.setFillColor(...GRIS_CARD);
  doc.roundedRect(x, y, cardW, totalCardH, 2, 2, "F");

  doc.setFillColor(...ZONA_COLOR);
  doc.roundedRect(x, y, BAR_W + 1, totalCardH, 2, 2, "F");
  doc.rect(x + 2, y, BAR_W - 1, totalCardH, "F");

  doc.setDrawColor(...GRIS_DIV);
  doc.setLineWidth(0.35);
  doc.line(x + BAR_W + 3, y + CARD_HDR_H, x + cardW - 2, y + CARD_HDR_H);

  const hdrY = y + CARD_HDR_H / 2 + 1.5;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...ZONA_TXT);
  doc.text(`ZONA ${zNum}`, x + BAR_W + 4, hdrY);

  const secCount = zSecs?.length ?? 0;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...GRIS_TX_PIE);
  doc.text(`${secCount > 0 ? secCount : "—"} secc.`, x + cardW - 3, hdrY, {
    align: "right",
  });

  const chipY = y + CARD_HDR_H + (CARD_CHI_H - 5.8) / 2;
  const chipX = x + BAR_W + 4;
  const chipW = cardW - BAR_W - 7;

  if (secCount > 0) {
    dibujarChips(doc, zSecs, chipX, chipY, chipW);
  } else {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(7);
    doc.setTextColor(180, 140, 50);
    doc.text("Sin secciones cargadas", chipX, chipY + 4);
  }
}

// ── 3. Función principal ──────────────────────────────────────────────────

/**
 * Exporta PDF oficio landscape (330×216 mm).
 * El mapa se captura tal como lo dejó el usuario (sin auto-posicionamiento).
 * La captura se hace a 3× resolución para lograr ~270-300 DPI en impresión.
 *
 * @param {object}            opts
 * @param {object}            opts.mapInstance
 * @param {'seccion'|'zona'}  opts.tipo
 * @param {string}            opts.numero        — sección
 * @param {Array}             opts.zonas         — [{numero, secciones}]
 * @param {string}            opts.municipioNombre
 * @param {string}            opts.dependencia   — nombre/siglas de la dependencia (esquina sup. izq.)
 * @param {Function}          opts.onProgress
 */
export async function exportarCartografiaPDF({
  mapInstance,
  tipo = "seccion",
  numero = "",
  zonas = [],
  municipioNombre = "",
  dependencia = "",
  onProgress,
}) {
  onProgress?.(5);

  const zonasData = tipo === "zona" ? zonas : [];
  const esMultiZona = zonasData.length > 1;

  // ── Layout ────────────────────────────────────────────────────────────
  const infoH = calcInfoH(tipo, zonasData);
  const headerY = MARGEN_SUP;
  const mapY = headerY + HEADER_H + GAP_TOP;
  const mapH =
    H - MARGEN_SUP - HEADER_H - GAP_TOP - GAP_MID - infoH - MARGEN_INF;
  const infoY = mapY + mapH + GAP_MID;

  // ── Captura HD (el usuario ya posicionó el mapa) ──────────────────────
  const mapaImg = await capturarMapaHD(mapInstance);
  onProgress?.(50);

  // ── Crear documento ───────────────────────────────────────────────────
  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: [H, W],
  });

  doc.setFillColor(...BLANCO);
  doc.rect(0, 0, W, H, "F");

  // ══ HEADER ═══════════════════════════════════════════════════════════════════
  doc.setFillColor(...GRIS_HEADER);
  doc.rect(0, headerY, W, HEADER_H, "F");

  doc.setFillColor(...AMARILLO);
  doc.rect(0, headerY + HEADER_H - 1.5, W, 1.5, "F");

  // Pastilla blanca (esquina sup. derecha): "ZONA: 39 - 53 - 60" / "SECCIÓN: 123"
  const pillTexto =
    tipo === "zona"
      ? esMultiZona
        ? `ZONA: ${zonasData.map((z) => z.numero).join(" - ")}`
        : `ZONA: ${zonasData[0]?.numero ?? numero}`
      : `SECCIÓN: ${numero}`;
  const pill = dibujarPildoraHeader(
    doc,
    pillTexto,
    W - MARGEN,
    headerY,
    HEADER_H,
  );

  // Nombre de la dependencia (esquina sup. izquierda), alineada a la
  // izquierda y con el mismo tipo de marco que la pastilla de zona
  const depTexto = (dependencia || "DEPENDENCIA").toUpperCase();
  const depAreaX = MARGEN;
  const depAreaW = pill.x - MARGEN - 6;
  dibujarPildoraDependencia(doc, depTexto, depAreaX, depAreaW, headerY, HEADER_H);

  onProgress?.(60);

  // ══ MAPA ══════════════════════════════════════════════════════════════
  const mapAreaW = W - MARGEN * 2;

  if (mapaImg) {
    const canvas = mapInstance?.getCanvas();
    const cW = canvas?.width || 1280;
    const cH = canvas?.height || 720;
    const ratio = cW / cH;

    let imgW = mapAreaW;
    let imgH = imgW / ratio;
    if (imgH > mapH) {
      imgH = mapH;
      imgW = imgH * ratio;
    }

    const imgX = MARGEN + (mapAreaW - imgW) / 2;
    const imgY = mapY + (mapH - imgH) / 2;

    doc.setDrawColor(...GRIS_DIV);
    doc.setLineWidth(0.4);
    doc.rect(imgX - 0.5, imgY - 0.5, imgW + 1, imgH + 1, "S");
    doc.addImage(mapaImg, "JPEG", imgX, imgY, imgW, imgH, "mapimg", "NONE");
  } else {
    doc.setFillColor(230, 238, 250);
    doc.rect(MARGEN, mapY, mapAreaW, mapH, "F");
    doc.setTextColor(...GRIS_TX_PIE);
    doc.setFontSize(9);
    doc.setFont("helvetica", "italic");
    doc.text(
      "No se pudo capturar la imagen del mapa.",
      W / 2,
      mapY + mapH / 2,
      { align: "center" },
    );
  }

  onProgress?.(78);

  // ══ FRANJA DE INFORMACIÓN ════════════════════════════════════════════
  doc.setFillColor(...GRIS_FONDO);
  doc.rect(0, infoY, W, infoH, "F");

  doc.setDrawColor(...GRIS_DIV);
  doc.setLineWidth(0.8);
  doc.line(0, infoY, W, infoY);

  const CX = MARGEN + 3;
  const metaCenterY = infoY + META_H / 2;

  // Tag "TIPO: …" + separador + contador ("ZONAS: 3", "SECCIONES: 8", "MUNICIPIO: …")
  let tagTexto;
  let valorLabel;
  let valorTexto;

  if (tipo === "seccion") {
    tagTexto = "TIPO: SECCIÓN";
    if (municipioNombre) {
      valorLabel = "MUNICIPIO";
      valorTexto = municipioNombre;
    } else {
      valorLabel = "SECCIÓN";
      valorTexto = String(numero);
    }
  } else if (esMultiZona) {
    tagTexto = "TIPO: MULTIZONAS";
    valorLabel = "ZONAS";
    valorTexto = String(zonasData.length);
  } else {
    tagTexto = "TIPO: ZONA";
    valorLabel = "SECCIONES";
    valorTexto = String(zonasData[0]?.secciones?.length ?? 0);
  }

  const tagH = 6.5;
  const tagY = metaCenterY - tagH / 2;
  const tagW = dibujarTag(doc, CX, tagY, tagTexto, tagH);

  const dividerX = CX + tagW + 6;
  doc.setDrawColor(...GRIS_DIV);
  doc.setLineWidth(0.4);
  doc.line(dividerX, infoY + 3, dividerX, infoY + META_H - 3);

  const labelX = dividerX + 6;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(...AZUL_LABEL);
  doc.text(`${valorLabel}:`, labelX, metaCenterY + 1.3);
  const labelW = doc.getTextWidth(`${valorLabel}: `);
  doc.setFontSize(11);
  doc.setTextColor(...AZUL_CHIP_TX);
  doc.text(valorTexto, labelX + labelW + 2, metaCenterY + 1.3);

  // Cards de zonas (solo tipo "zona")
  if (tipo === "zona") {
    doc.setDrawColor(...GRIS_DIV);
    doc.setLineWidth(0.4);
    const CXEND = W - MARGEN - 3;
    doc.line(CX - 3, infoY + META_H, CXEND + 3, infoY + META_H);

    const cardW = CXEND - CX + 3;
    let cardY = infoY + META_H + 1;

    zonasData.forEach(({ numero: zNum, secciones: zSecs }) => {
      dibujarCardZona(doc, CX, cardY, cardW, zNum, zSecs ?? []);
      cardY += PER_ZONA_H;
    });
  }

  onProgress?.(92);
  onProgress?.(98);

  // ══ GUARDAR ═══════════════════════════════════════════════════════════
  let fileName;
  if (tipo === "seccion") {
    fileName = `seccion_${numero}_cartografia.pdf`;
  } else if (esMultiZona) {
    fileName = `multizona_${zonasData.map((z) => z.numero).join("-")}_cartografia.pdf`;
  } else {
    fileName = `zona_${zonasData[0]?.numero ?? numero}_cartografia.pdf`;
  }
  doc.save(fileName);

  onProgress?.(100);
}
