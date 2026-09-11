/* eslint-disable react-hooks/refs */
/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable react-hooks/immutability */
import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import { useMapStore } from "../../store/mapStore";
import { useObrasStore } from "../../store/obrasStore";
import { useAuthStore } from "../../store/authStore";
import { getObras, deleteObra } from "../../services/obrasService";
import { getMarcadoresTodos, deleteMarcador } from "../../services/marcadoresService";
import { useToast } from "../ui/Toast";
import { ROLES, COLORES_MARCADOR } from "../../config";

// Colores de PP por año
const PIN_COLORS_ANIO = {
  2023: "#f59e0b",
  2024: "#3b82f6",
  2025: "#10b981",
  2026: "#a855f7",
};
const PIN_DEFAULT = "#94a3b8";

// SVG de pin coloreado
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

// Dimensiones base del pin de imagen
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

// ── Popups ──────────────────────────────────────────────────────────────────

const crearHTMLPopupPP = (obra, role) => {
  const { id, nombre, tipo, anio, coords, creadoPor, fechaCreacion } = obra;
  const googleUrl = `https://www.google.com/maps/dir/?api=1&destination=${coords.lat},${coords.lng}`;
  const canEdit = role === ROLES.ADMIN || role === ROLES.EDITOR;
  const botonesEdicion = canEdit
    ? `<button class="pin-btn pin-edit" data-id="${id}" data-capa="pp">✏️ Editar</button>
       <button class="pin-btn pin-delete" data-id="${id}" data-capa="pp">🗑️ Borrar</button>`
    : "";
  return `
    <div class="pin-popup">
      <div class="pin-popup-header">Obra P.P. ${anio}</div>
      <div class="pin-popup-body">
        <div class="pin-popup-row"><span class="pin-key">Nombre</span><span class="pin-val">${nombre}</span></div>
        <div class="pin-popup-row"><span class="pin-key">Intervención</span><span class="pin-val">${tipo}</span></div>
      </div>
      <div class="pin-popup-actions">
        <a href="${googleUrl}" target="_blank" class="pin-btn pin-route">🗺️ Ruta</a>
        ${botonesEdicion}
      </div>
      <div class="pin-traceability">Registrado por <span>${creadoPor || "Sistema"}</span><br>${fechaCreacion || ""}</div>
    </div>
  `;
};

const CAPA_LABELS = {
  rural: "Rural",
  top100: "Top 100 Urbano",
  general: "General",
};

const crearHTMLPopupMarcador = (m, role) => {
  const { id, capa, nombre, tipo, distritoLocal, seccion, zonaElectoral, referencia, detalles, coords, creadoPor, fechaCreacion } = m;
  const googleUrl = `https://www.google.com/maps/dir/?api=1&destination=${coords.lat},${coords.lng}`;
  const canEdit = role === ROLES.ADMIN || role === ROLES.EDITOR;
  const botonesEdicion = canEdit
    ? `<button class="pin-btn pin-edit" data-id="${id}" data-capa="${capa}">✏️ Editar</button>
       <button class="pin-btn pin-delete" data-id="${id}" data-capa="${capa}">🗑️ Borrar</button>`
    : "";
  const dlRow = distritoLocal
    ? `<div class="pin-popup-row"><span class="pin-key">Distrito</span><span class="pin-val">${distritoLocal}</span></div>`
    : "";
  const secRow = seccion
    ? `<div class="pin-popup-row"><span class="pin-key">Sección</span><span class="pin-val">${seccion}</span></div>`
    : "";
  const zonaRow = zonaElectoral
    ? `<div class="pin-popup-row"><span class="pin-key">Zona</span><span class="pin-val">${zonaElectoral}</span></div>`
    : "";
  const refRow = referencia
    ? `<div class="pin-popup-row"><span class="pin-key">Referencia</span><span class="pin-val">${referencia}</span></div>`
    : "";
  const detRow = detalles
    ? `<div class="pin-popup-row"><span class="pin-key">Detalles</span><span class="pin-val">${detalles}</span></div>`
    : "";
  return `
    <div class="pin-popup">
      <div class="pin-popup-header">${CAPA_LABELS[capa] ?? capa}</div>
      <div class="pin-popup-body">
        ${dlRow}${secRow}${zonaRow}${refRow}${detRow}
      </div>
      <div class="pin-popup-actions">
        <a href="${googleUrl}" target="_blank" class="pin-btn pin-route">🗺️ Ruta</a>
        ${botonesEdicion}
      </div>
      <div class="pin-traceability">Registrado por <span>${creadoPor || "Sistema"}</span><br>${fechaCreacion || ""}</div>
    </div>
  `;
};

// ── Componente ───────────────────────────────────────────────────────────────

const PinLayer = ({ reloadTrigger, onReload }) => {
  const {
    mapInstance,
    aniosVisibles,
    filtroTipo,
    marcadoresVisibles,
    filtrosDL,
  } = useMapStore();
  const { openModalEditar, setObras } = useObrasStore();
  const { role, user } = useAuthStore();
  const toast = useToast();
  const marcadoresRef = useRef([]);   // { marker, capa, anio, dl }
  const todosRef = useRef([]);        // todos los objetos cargados
  const imagePinEls = useRef([]);

  const escalaParaZoom = (zoom) =>
    Math.max(0.3, Math.min(1.25, 0.38 + (zoom - 10) * 0.117));

  const aplicarTamanos = () => {
    if (!mapInstance) return;
    const scale = escalaParaZoom(mapInstance.getZoom());
    imagePinEls.current.forEach((el) => aplicarDimensionesPin(el, scale));
  };

  useEffect(() => {
    if (!mapInstance) return;
    mapInstance.on("zoom", aplicarTamanos);
    return () => mapInstance.off("zoom", aplicarTamanos);
  }, [mapInstance, aplicarTamanos]);

  // ── Cargar todos los marcadores ───────────────────────────────────────────
  useEffect(() => {
    if (!mapInstance) return;

    const cargar = async () => {
      marcadoresRef.current.forEach(({ marker }) => marker.remove());
      marcadoresRef.current = [];
      imagePinEls.current = [];

      try {
        const [obras, extras] = await Promise.all([
          getObras(),
          getMarcadoresTodos(),
        ]);

        // Guardar obras PP en el store para StatsModal
        setObras(obras);
        todosRef.current = [
          ...obras.map((o) => ({ ...o, capa: "pp" })),
          ...extras,
        ];

        todosRef.current.forEach((item) => {
          const { capa, anio, distritoLocal, pinImageUrl, coords } = item;

          // Ignorar documentos sin coordenadas válidas (ej. placeholders de Firebase Console)
          if (!coords?.lat || !coords?.lng) return;

          // Color del pin
          let pinColor;
          if (capa === "pp") {
            pinColor = PIN_COLORS_ANIO[anio] || PIN_DEFAULT;
          } else {
            pinColor = COLORES_MARCADOR[capa] || PIN_DEFAULT;
          }

          const el = pinImageUrl
            ? crearElementoPinImagen(pinImageUrl)
            : crearElementoPin(pinColor);

          el.dataset.capa = capa;
          el.dataset.anio = anio || "";
          el.dataset.dl = distritoLocal || "";
          el.dataset.tipo = (item.tipo || "")
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "");
          el.dataset.id = item.id;

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

        aplicarFiltros();
      } catch (err) {
        console.error(err);
        toast("Error al cargar los marcadores.", "error");
      }
    };

    cargar();
  }, [mapInstance, reloadTrigger, role]);

  // ── Aplicar filtros de visibilidad ────────────────────────────────────────
  const aplicarFiltros = () => {
    const filtroLimpio =
      filtroTipo === "all"
        ? "all"
        : filtroTipo.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

    marcadoresRef.current.forEach(({ marker, capa, anio, dl }) => {
      const el = marker.getElement();
      const tipoPin = el.dataset.tipo;

      const visible = capa === "pp"
        ? (aniosVisibles[anio] !== false) && (filtroLimpio === "all" || tipoPin.includes(filtroLimpio))
        : (marcadoresVisibles[capa] !== false) &&
          (capa === "rural" || capa === "top100" ? filtrosDL[capa]?.[dl] !== false : true);

      el.style.display = visible ? "" : "none";
    });
  };

  useEffect(() => {
    aplicarFiltros();
  }, [aniosVisibles, filtroTipo, marcadoresVisibles, filtrosDL, marcadoresRef.current.length]);

  // ── Eventos de editar/borrar desde popups ─────────────────────────────────
  useEffect(() => {
    const handler = async (e) => {
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

        window.__llenarFormularioObra?.({
          nombre: item.nombre,
          tipo: item.tipo,
          anio: item.anio,
          distritoLocal: item.distritoLocal ?? "",
          seccion: item.seccion ?? "",
          zonaElectoral: item.zonaElectoral ?? "",
          referencia: item.referencia ?? "",
          detalles: item.detalles ?? "",
          capa,
          pinImageUrl: item.pinImageUrl ?? null,
          pinImagePath: item.pinImagePath ?? null,
        });

        openModalEditar(id, coords, capa);
        document.querySelector(".maplibregl-popup")?.remove();
      }
    };

    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [role, user]);

  return null;
};

export default PinLayer;
