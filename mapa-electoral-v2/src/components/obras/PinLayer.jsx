import { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import maplibregl from "maplibre-gl";
import { useMapStore } from "../../store/mapStore";
import { useObrasStore } from "../../store/obrasStore";
import { useAuthStore } from "../../store/authStore";
import { useColeccionesStore } from "../../store/coleccionesStore";
import { getObras, deleteObra } from "../../services/obrasService";
import { getMarcadoresTodos, deleteMarcador } from "../../services/marcadoresService";
import { useToast } from "../ui/Toast";
import { ROLES, COLORES_MARCADOR } from "../../config";

// ── Escape HTML para evitar XSS en popups ────────────────────────────────────

const escHTML = (s) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

// ── Colores de PP por año ─────────────────────────────────────────────────────

const PIN_COLORS_ANIO = {
  2023: "#f59e0b",
  2024: "#3b82f6",
  2025: "#10b981",
  2026: "#a855f7",
};
const PIN_DEFAULT = "#94a3b8";

// ── SVG de pin coloreado ──────────────────────────────────────────────────────

const pinSVG = (color) => `
  <svg xmlns="http://www.w3.org/2000/svg" width="28" height="36" viewBox="0 0 28 36">
    <ellipse cx="14" cy="34" rx="5" ry="2" fill="rgba(0,0,0,0.25)"/>
    <path d="M14 0C8.48 0 4 4.48 4 10c0 7.5 10 22 10 22s10-14.5 10-22C24 4.48 19.52 0 14 0z"
      fill="${color}" />
    <path d="M14 1C8.76 1 5 5.01 5 10c0 7.1 9 20.5 9 20.5S23 17.1 23 10C23 5.01 19.24 1 14 1z"
      fill="none" stroke="rgba(255,255,255,0.35)" stroke-width="1.5"/>
    <circle cx="14" cy="10" r="4" fill="white" opacity="0.9"/>
  </svg>
`;

const crearElementoPin = (color) => {
  const el = document.createElement("div");
  el.style.cssText = "width:28px; height:36px; cursor:pointer; user-select:none;";
  const inner = document.createElement("div");
  inner.style.cssText = `
    width: 28px; height: 36px;
    filter: drop-shadow(0 3px 5px rgba(0,0,0,0.45));
    transition: transform 0.15s ease;
    transform-origin: bottom center;
  `;
  inner.innerHTML = pinSVG(color);
  el.appendChild(inner);
  el.addEventListener("mouseenter", () => { inner.style.transform = "scale(1.3)"; });
  el.addEventListener("mouseleave", () => { inner.style.transform = "scale(1)"; });
  return el;
};

// ── Pin de imagen ─────────────────────────────────────────────────────────────

const PIN_IMG_BASE = { size: 88, triH: 13, pad: 6, radius: 12, border: 2.5 };
const BORDER_COLOR = "#2d3a4a";

const aplicarDimensionesPin = (el, scale) => {
  const s = Math.max(0.3, Math.min(1.25, scale));
  const sz = Math.round(PIN_IMG_BASE.size * s);
  const th = Math.max(5, Math.round(PIN_IMG_BASE.triH * s));
  const pd = Math.max(3, Math.round(PIN_IMG_BASE.pad * s));
  const rr = Math.max(5, Math.round(PIN_IMG_BASE.radius * s));
  const bw = Math.max(1.5, PIN_IMG_BASE.border * s).toFixed(1);
  el.style.width = `${sz}px`;
  el.style.height = `${sz + th}px`;
  const card = el.querySelector(".obra-pin-card");
  if (card) {
    card.style.width = `${sz}px`;
    card.style.height = `${sz}px`;
    card.style.padding = `${pd}px`;
    card.style.borderRadius = `${rr}px`;
    card.style.borderWidth = `${bw}px`;
  }
  const tri = el.querySelector(".obra-pin-tri");
  if (tri) {
    tri.style.borderLeftWidth = `${th - 2}px`;
    tri.style.borderRightWidth = `${th - 2}px`;
    tri.style.borderTopWidth = `${th}px`;
  }
};

const crearElementoPinImagen = (imageUrl) => {
  const { size: SZ, triH: TH } = PIN_IMG_BASE;
  const el = document.createElement("div");
  el.style.cssText = [
    `width: ${SZ}px`, `height: ${SZ + TH}px`,
    "cursor: pointer", "user-select: none",
    "display: flex", "flex-direction: column", "align-items: center",
  ].join("; ");

  const card = document.createElement("div");
  card.className = "obra-pin-card";
  card.style.cssText = [
    `width: ${SZ}px`, `height: ${SZ}px`, "background: #ffffff",
    `border: ${PIN_IMG_BASE.border}px solid ${BORDER_COLOR}`,
    `border-radius: ${PIN_IMG_BASE.radius}px`,
    "box-shadow: 0 4px 14px rgba(0,0,0,0.45), 0 1px 3px rgba(0,0,0,0.3)",
    "overflow: hidden", `padding: ${PIN_IMG_BASE.pad}px`,
    "box-sizing: border-box", "display: flex",
    "align-items: center", "justify-content: center",
    "transition: transform 0.12s ease",
  ].join("; ");

  const imgEl = document.createElement("img");
  imgEl.src = imageUrl;
  imgEl.style.cssText = "width:100%; height:100%; object-fit:contain; display:block;";
  imgEl.draggable = false;
  card.appendChild(imgEl);

  const tri = document.createElement("div");
  tri.className = "obra-pin-tri";
  tri.style.cssText = [
    "width: 0", "height: 0",
    `border-left: ${TH - 2}px solid transparent`,
    `border-right: ${TH - 2}px solid transparent`,
    `border-top: ${TH}px solid ${BORDER_COLOR}`,
    "margin-top: -1px",
    "filter: drop-shadow(0 2px 3px rgba(0,0,0,0.25))",
  ].join("; ");

  el.appendChild(card);
  el.appendChild(tri);

  el.addEventListener("mouseenter", () => { card.style.transform = "scale(1.1)"; });
  el.addEventListener("mouseleave", () => { card.style.transform = "scale(1)"; });

  return el;
};

// ── Lightbox ──────────────────────────────────────────────────────────────────

const mostrarLightbox = (url) => {
  document.getElementById("pin-lightbox")?.remove();
  const overlay = document.createElement("div");
  overlay.id = "pin-lightbox";
  overlay.style.cssText =
    "position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.88);" +
    "display:flex;align-items:center;justify-content:center;cursor:zoom-out;";
  // Crear img via DOM para evitar XSS con innerHTML
  const img = document.createElement("img");
  img.src = url;
  img.style.cssText =
    "max-width:90vw;max-height:90vh;object-fit:contain;border-radius:10px;" +
    "box-shadow:0 8px 40px rgba(0,0,0,0.6);";
  img.draggable = false;
  overlay.appendChild(img);
  overlay.addEventListener("click", () => overlay.remove());
  document.body.appendChild(overlay);
};

// ── Popups ────────────────────────────────────────────────────────────────────

const crearHTMLPopupPP = (obra, role) => {
  const { id, nombre, tipo, anio, coords, creadoPor, fechaCreacion, fotoUrl } = obra;
  const googleUrl = `https://www.google.com/maps?q=${coords.lat},${coords.lng}`;
  const canEdit = role === ROLES.ADMIN || role === ROLES.EDITOR;
  const botonesEdicion = canEdit
    ? `<button class="pin-btn pin-edit" data-id="${escHTML(id)}" data-capa="pp">✏️ Editar</button>
       <button class="pin-btn pin-delete" data-id="${escHTML(id)}" data-capa="pp">🗑️ Borrar</button>`
    : "";
  const fotoThumb = fotoUrl
    ? `<img src="${escHTML(fotoUrl)}" class="pin-foto-thumb" data-foto="${escHTML(fotoUrl)}"
        style="width:100%;height:90px;object-fit:cover;border-radius:8px;margin-bottom:8px;cursor:zoom-in;display:block;" />`
    : "";
  return `
    <div class="pin-popup">
      <div class="pin-popup-header">Obra P.P. ${escHTML(anio)}</div>
      ${fotoThumb}
      <div class="pin-popup-body">
        <div class="pin-popup-row"><span class="pin-key">Nombre</span><span class="pin-val">${escHTML(nombre)}</span></div>
        <div class="pin-popup-row"><span class="pin-key">Intervención</span><span class="pin-val">${escHTML(tipo)}</span></div>
      </div>
      <div class="pin-popup-actions">
        <a href="${googleUrl}" target="_blank" class="pin-btn pin-route">🗺️ Ubicación</a>
        ${botonesEdicion}
      </div>
      <div class="pin-traceability">Registrado por <span>${escHTML(creadoPor || "Sistema")}</span><br>${escHTML(fechaCreacion || "")}</div>
    </div>
  `;
};

const CAPA_LABELS = {
  rural: "Rural",
  top100: "Top 100 Urbano",
  general: "Espectaculares Laguna",
  capital: "Espectaculares Capital",
  municipios: "Espectaculares Municipios",
  guardianes: "Guardianes del Camino",
};

const crearHTMLPopupMarcador = (m, role) => {
  const {
    id, capa, nombre, tipo, distritoLocal, seccion, zonaElectoral,
    referencia, participacion, detalles, coords, creadoPor, fechaCreacion, fotoUrl,
    direccion, telefono, zona, red, atendido,
  } = m;
  const googleUrl = `https://www.google.com/maps?q=${coords.lat},${coords.lng}`;
  const canEdit = role === ROLES.ADMIN || role === ROLES.EDITOR;
  const botonesEdicion = canEdit
    ? `<button class="pin-btn pin-edit" data-id="${escHTML(id)}" data-capa="${escHTML(capa)}">✏️ Editar</button>
       <button class="pin-btn pin-delete" data-id="${escHTML(id)}" data-capa="${escHTML(capa)}">🗑️ Borrar</button>`
    : "";
  const nombreRow = nombre
    ? `<div class="pin-popup-row"><span class="pin-key">Nombre</span><span class="pin-val">${escHTML(nombre)}</span></div>`
    : "";
  const tipoRow = tipo
    ? `<div class="pin-popup-row"><span class="pin-key">Tipo</span><span class="pin-val">${escHTML(tipo)}</span></div>`
    : "";
  const dlRow = distritoLocal
    ? `<div class="pin-popup-row"><span class="pin-key">Distrito</span><span class="pin-val">${escHTML(distritoLocal)}</span></div>`
    : "";
  const secRow = seccion
    ? `<div class="pin-popup-row"><span class="pin-key">Sección</span><span class="pin-val">${escHTML(seccion)}</span></div>`
    : "";
  const zonaRow = zonaElectoral
    ? `<div class="pin-popup-row"><span class="pin-key">Zona</span><span class="pin-val">${escHTML(zonaElectoral)}</span></div>`
    : "";
  const refRow = referencia
    ? `<div class="pin-popup-row"><span class="pin-key">Referencia</span><span class="pin-val">${escHTML(referencia)}</span></div>`
    : "";
  const partRow = participacion != null
    ? `<div class="pin-popup-row"><span class="pin-key">Participación</span><span class="pin-val">${Number(participacion).toFixed(1)}%</span></div>`
    : "";
  const detRow = detalles
    ? `<div class="pin-popup-row"><span class="pin-key">Detalles</span><span class="pin-val">${escHTML(detalles)}</span></div>`
    : "";
  const dirRow = direccion
    ? `<div class="pin-popup-row"><span class="pin-key">Dirección</span><span class="pin-val">${escHTML(direccion)}</span></div>`
    : "";
  const telRow = telefono
    ? `<div class="pin-popup-row"><span class="pin-key">Teléfono</span><span class="pin-val">${escHTML(telefono)}</span></div>`
    : "";
  const zonaRow2 = zona
    ? `<div class="pin-popup-row"><span class="pin-key">Zona</span><span class="pin-val">${escHTML(zona)}</span></div>`
    : "";
  const redRow = red
    ? `<div class="pin-popup-row"><span class="pin-key">Red</span><span class="pin-val">${escHTML(red)}</span></div>`
    : "";
  const atendidoRow = capa === "guardianes"
    ? `<div class="pin-popup-row"><span class="pin-key">Atendido</span><span class="pin-val">${atendido ? "Sí" : "No"}</span></div>`
    : "";
  const fotoThumb = fotoUrl
    ? `<img src="${escHTML(fotoUrl)}" class="pin-foto-thumb" data-foto="${escHTML(fotoUrl)}"
        style="width:100%;height:90px;object-fit:cover;border-radius:8px;margin-bottom:8px;cursor:zoom-in;display:block;" />`
    : "";
  return `
    <div class="pin-popup">
      <div class="pin-popup-header">${escHTML(CAPA_LABELS[capa] ?? capa)}</div>
      ${fotoThumb}
      <div class="pin-popup-body">
        ${nombreRow}${tipoRow}${dlRow}${secRow}${zonaRow}${refRow}${partRow}${detRow}${dirRow}${telRow}${zonaRow2}${redRow}${atendidoRow}
      </div>
      <div class="pin-popup-actions">
        <a href="${googleUrl}" target="_blank" class="pin-btn pin-route">🗺️ Ubicación</a>
        ${botonesEdicion}
      </div>
      <div class="pin-traceability">Registrado por <span>${escHTML(creadoPor || "Sistema")}</span><br>${escHTML(fechaCreacion || "")}</div>
    </div>
  `;
};

// ── Componente ────────────────────────────────────────────────────────────────

const PinLayer = ({ reloadTrigger, onReload }) => {
  const {
    mapInstance,
    aniosVisibles,
    filtroTipo,
    marcadoresVisibles,
    filtrosDL,
    filtroSeleccionado,
    filtroVisitado,
    filtroAtendido,
    filtroRed,
  } = useMapStore();
  const { openModalEditar, setObras, setMarcadorEditando, setExtras } = useObrasStore();
  const { role, user } = useAuthStore();
  const { coleccionesConfig } = useColeccionesStore();
  const isPresidente = role === ROLES.PRESIDENTE;
  const toast = useToast();

  // Ref para acceder a coleccionesConfig dentro de callbacks sin agregarlos como dep
  const coleccionesRef = useRef(coleccionesConfig);
  useEffect(() => { coleccionesRef.current = coleccionesConfig; }, [coleccionesConfig]);

  const marcadoresRef = useRef([]);   // { marker, capa, anio, dl }
  const todosRef = useRef([]);        // todos los objetos cargados
  const imagePinEls = useRef([]);

  const [cargando, setCargando] = useState(false);
  // Contador que incrementa en cada carga, garantizando que el efecto de
  // filtros se dispare aunque el número de marcadores sea igual al anterior.
  const [loadId, setLoadId] = useState(0);

  const escalaParaZoom = (zoom) =>
    Math.max(0.3, Math.min(1.25, 0.38 + (zoom - 10) * 0.117));

  const aplicarTamanos = useCallback(() => {
    if (!mapInstance) return;
    const scale = escalaParaZoom(mapInstance.getZoom());
    imagePinEls.current.forEach((el) => aplicarDimensionesPin(el, scale));
  }, [mapInstance]);

  useEffect(() => {
    if (!mapInstance) return;
    mapInstance.on("zoom", aplicarTamanos);
    return () => mapInstance.off("zoom", aplicarTamanos);
  }, [mapInstance, aplicarTamanos]);

  // ── Cargar todos los marcadores ─────────────────────────────────────────────
  useEffect(() => {
    if (!mapInstance) return;

    const cargar = async () => {
      marcadoresRef.current.forEach(({ marker }) => marker.remove());
      marcadoresRef.current = [];
      imagePinEls.current = [];
      setCargando(true);

      try {
        const [obras, extrasArr] = await Promise.all([
          getObras(),
          getMarcadoresTodos(),
        ]);

        // Guardar obras PP en el store para StatsModal
        setObras(obras);

        // Agrupar extras por capa y guardar en store (evita doble fetch en StatsModal)
        const extrasAgrupados = { rural: [], top100: [], general: [], capital: [], municipios: [], guardianes: [] };
        // Agregar claves para colecciones dinámicas
        coleccionesRef.current.forEach(({ key }) => { if (!extrasAgrupados[key]) extrasAgrupados[key] = []; });
        extrasArr.forEach((m) => {
          if (extrasAgrupados[m.capa] !== undefined) {
            extrasAgrupados[m.capa].push(m);
          } else {
            // capa dinámica aún no registrada en el ref (carga concurrente)
            extrasAgrupados[m.capa] = [m];
          }
        });
        setExtras(extrasAgrupados);

        todosRef.current = [
          ...obras.map((o) => ({ ...o, capa: "pp" })),
          ...extrasArr,
        ];

        todosRef.current.forEach((item) => {
          const { capa, anio, distritoLocal, pinImageUrl, coords } = item;

          // Ignorar documentos sin coordenadas válidas
          if (!coords?.lat || !coords?.lng) return;

          // Color del pin
          let pinColor;
          if (capa === "pp") {
            pinColor = PIN_COLORS_ANIO[anio] || PIN_DEFAULT;
          } else if (capa === "general" || capa === "capital" || capa === "municipios") {
            pinColor = item.pinColor || PIN_DEFAULT;
          } else if (COLORES_MARCADOR[capa]) {
            pinColor = COLORES_MARCADOR[capa];
          } else {
            // Capa dinámica: usar el color definido en la config
            const cfgDin = coleccionesRef.current.find((c) => c.key === capa);
            pinColor = (item.pinColor) || cfgDin?.color || PIN_DEFAULT;
          }

          const el = pinImageUrl
            ? crearElementoPinImagen(pinImageUrl)
            : crearElementoPin(pinColor);

          el.dataset.capa = capa;
          el.dataset.anio = anio || "";
          el.dataset.dl = distritoLocal || "";
          // Normalizar tipo y nombre para búsqueda sin distinción de acentos/mayúsculas
          el.dataset.tipo = (item.tipo || "")
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "");
          el.dataset.nombre = (item.nombre || "")
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "");
          el.dataset.id = item.id;
          el.dataset.seleccionado = item.seleccionado ? "1" : "0";
          el.dataset.visitado = item.visitado ? "1" : "0";
          el.dataset.atendido = item.atendido ? "1" : "0";
          el.dataset.red = (item.red || "")
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "");

          if (pinImageUrl) {
            aplicarDimensionesPin(el, escalaParaZoom(mapInstance.getZoom()));
            imagePinEls.current.push(el);
          }

          const htmlPopup = capa === "pp"
            ? crearHTMLPopupPP(item, role)
            : crearHTMLPopupMarcador(item, role);

          const popup = new maplibregl.Popup({
            offset: 25,
            closeButton: true,
            maxWidth: "280px",
          }).setHTML(htmlPopup);

          el.classList.add("pin-marcador");

          const markerOpts = pinImageUrl
            ? { element: el, anchor: "bottom" }
            : { element: el };

          const marker = new maplibregl.Marker(markerOpts)
            .setLngLat([coords.lng, coords.lat])
            .setPopup(popup)
            .addTo(mapInstance);

          marcadoresRef.current.push({ marker, capa, anio, dl: distritoLocal || "" });
        });

        // Incrementar siempre para que el efecto de filtros se dispare
        setLoadId((n) => n + 1);
      } catch (err) {
        console.error(err);
        toast("Error al cargar los marcadores.", "error");
      } finally {
        setCargando(false);
      }
    };

    cargar();
  }, [mapInstance, reloadTrigger, role]); // eslint-disable-line react-hooks/exhaustive-deps
  // Nota: setObras, setExtras, toast son referencias estables; aplicarFiltros
  // se ejecuta reactivamente via marcadoresCount, no como dep de carga.

  // ── Aplicar filtros de visibilidad ──────────────────────────────────────────
  const aplicarFiltros = useCallback(() => {
    const filtroLimpio =
      filtroTipo === "all"
        ? "all"
        : filtroTipo.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

    marcadoresRef.current.forEach(({ marker, capa, anio, dl }) => {
      const el = marker.getElement();
      const tipoPin = el.dataset.tipo;
      const esEspectacular = capa === "general" || capa === "capital" || capa === "municipios";

      let visible;
      if (capa === "pp") {
        visible =
          aniosVisibles[anio] !== false &&
          (filtroLimpio === "all" || tipoPin.includes(filtroLimpio));
      } else if (capa === "rural" || capa === "top100") {
        const soloVisitado = filtroVisitado[capa] === true;
        const estaVisitado = el.dataset.visitado === "1";
        visible =
          marcadoresVisibles[capa] !== false &&
          filtrosDL[capa]?.[dl] !== false &&
          (!soloVisitado || estaVisitado);
      } else if (esEspectacular) {
        if (isPresidente) { visible = false; }
        else {
          const soloSelec = filtroSeleccionado[capa] === true;
          const estaSelec = el.dataset.seleccionado === "1";
          visible = marcadoresVisibles[capa] !== false && (!soloSelec || estaSelec);
        }
      } else if (capa === "guardianes") {
        const soloAtendido = filtroAtendido[capa] === true;
        const estaAtendido = el.dataset.atendido === "1";
        const redFiltro = (filtroRed[capa] || "")
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "");
        const redPin = el.dataset.red;
        visible =
          marcadoresVisibles[capa] !== false &&
          filtrosDL[capa]?.[dl] !== false &&
          (!soloAtendido || estaAtendido) &&
          (!redFiltro || redPin === redFiltro);
      } else {
        // Capa dinámica
        const cfgDin = coleccionesRef.current.find((c) => c.key === capa);
        if (!cfgDin) { visible = false; }
        else if (cfgDin.ocultarPresidente && isPresidente) { visible = false; }
        else {
          const camposDin = cfgDin.campos ?? [];
          visible = marcadoresVisibles[capa] !== false;
          if (visible && camposDin.includes("distritoLocal")) {
            visible = filtrosDL[capa]?.[dl] !== false;
          }
          if (visible && camposDin.includes("visitado") && filtroVisitado[capa] === true) {
            visible = el.dataset.visitado === "1";
          }
          if (visible && camposDin.includes("atendido") && filtroAtendido[capa] === true) {
            visible = el.dataset.atendido === "1";
          }
          if (visible && camposDin.includes("seleccionado") && filtroSeleccionado[capa] === true) {
            visible = el.dataset.seleccionado === "1";
          }
          if (visible && camposDin.includes("red")) {
            const redFiltro = (filtroRed[capa] || "")
              .toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            if (redFiltro) visible = el.dataset.red === redFiltro;
          }
        }
      }

      el.style.display = visible ? "" : "none";
    });
  }, [aniosVisibles, filtroTipo, marcadoresVisibles, filtrosDL, filtroSeleccionado, filtroVisitado, filtroAtendido, filtroRed, isPresidente]);

  useEffect(() => {
    aplicarFiltros();
  }, [aplicarFiltros, loadId]);

  // ── Eventos de editar/borrar desde popups ───────────────────────────────────
  useEffect(() => {
    const handler = async (e) => {
      // Foto lightbox
      if (e.target.classList.contains("pin-foto-thumb")) {
        mostrarLightbox(e.target.dataset.foto);
        return;
      }

      const id = e.target.dataset?.id;
      const capa = e.target.dataset?.capa;
      if (!id || !capa) return;

      // BORRAR
      if (e.target.classList.contains("pin-delete")) {
        if (!confirm("¿Eliminar este marcador? Quedará registro en auditoría."))
          return;
        try {
          if (capa === "pp") {
            await deleteObra(id, user?.email || "Desconocido");
          } else {
            await deleteMarcador(capa, id, user?.email || "Desconocido");
          }
          toast("Marcador eliminado y enviado a la papelera.", "success");
          document.querySelector(".maplibregl-popup")?.remove();
          onReload?.();
        } catch {
          toast("Error al eliminar el marcador.", "error");
        }
      }

      // EDITAR
      if (e.target.classList.contains("pin-edit")) {
        const item = todosRef.current.find((o) => o.id === id && o.capa === capa);
        if (!item) return;

        const entry = marcadoresRef.current.find(
          (m) => m.marker.getElement().dataset.id === id
        );
        const coords = entry ? entry.marker.getLngLat() : item.coords;

        // Pasar datos al store en vez de usar window global
        setMarcadorEditando({
          nombre: item.nombre,
          tipo: item.tipo,
          anio: item.anio,
          distritoLocal: item.distritoLocal ?? "",
          seccion: item.seccion ?? "",
          zonaElectoral: item.zonaElectoral ?? "",
          referencia: item.referencia ?? "",
          participacion: item.participacion ?? null,
          detalles: item.detalles ?? "",
          capa,
          pinColor: item.pinColor ?? null,
          seleccionado: item.seleccionado ?? false,
          visitado: item.visitado ?? false,
          direccion: item.direccion ?? "",
          telefono: item.telefono ?? "",
          zona: item.zona ?? "",
          red: item.red ?? "",
          atendido: item.atendido ?? false,
          pinImageUrl: item.pinImageUrl ?? null,
          pinImagePath: item.pinImagePath ?? null,
          fotoUrl: item.fotoUrl ?? null,
          fotoPath: item.fotoPath ?? null,
        });

        openModalEditar(id, coords, capa);
        document.querySelector(".maplibregl-popup")?.remove();
      }
    };

    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [role, user, openModalEditar, setMarcadorEditando, toast, onReload]);

  // Spinner de carga via portal (PinLayer no tiene DOM propio)
  if (cargando) {
    return createPortal(
      <div className="fixed inset-0 z-40 pointer-events-none flex items-start justify-center pt-20">
        <div className="bg-[#1e293b]/90 border border-[#334155] text-slate-200 text-xs px-4 py-2 rounded-xl shadow-lg flex items-center gap-2">
          <div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          Cargando marcadores...
        </div>
      </div>,
      document.body
    );
  }

  return null;
};

export default PinLayer;
