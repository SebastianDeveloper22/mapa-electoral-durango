import { useEffect, useRef, useCallback } from "react";
import maplibregl from "maplibre-gl";
import { useMapStore } from "../../store/mapStore";
import { useObrasStore } from "../../store/obrasStore";
import { useAuthStore } from "../../store/authStore";
import { getObras, deleteObra } from "../../services/obrasService";
import { useToast } from "../ui/Toast";
import { ROLES } from "../../config";

// Colores por año
const PIN_COLORS = {
  2023: "#f59e0b", // Ámbar
  2024: "#3b82f6", // Azul
  2025: "#10b981", // Esmeralda
  2026: "#a855f7", // Púrpura
};
const PIN_DEFAULT = "#94a3b8";

// SVG de pin coloreado — el color se inyecta dinámicamente
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

/**
 * Pin de color SVG clásico (sin imagen personalizada).
 */
const crearElementoPin = (anio) => {
  const color = PIN_COLORS[anio] || PIN_DEFAULT;
  const el = document.createElement("div");
  el.style.cssText =
    "width:28px; height:36px; cursor:pointer; user-select:none;";
  const inner = document.createElement("div");
  inner.style.cssText = `
    width: 28px; height: 36px;
    filter: drop-shadow(0 3px 5px rgba(0,0,0,0.45));
    transition: transform 0.15s ease;
    transform-origin: bottom center;
  `;
  inner.innerHTML = pinSVG(color);
  el.appendChild(inner);
  el.addEventListener("mouseenter", () => {
    inner.style.transform = "scale(1.3)";
  });
  el.addEventListener("mouseleave", () => {
    inner.style.transform = "scale(1)";
  });
  return el;
};

// Dimensiones base del pin de imagen (a zoom 14)
const PIN_IMG_BASE = {
  size: 88, // lado del cuadro en px
  triH: 13, // altura del triángulo
  pad: 6, // padding interior del logo
  radius: 12, // border-radius
  border: 2.5, // grosor del borde
};

const BORDER_COLOR = "#2d3a4a";

/**
 * Aplica las dimensiones calculadas a un elemento pin de imagen.
 * Se llama al crearlo y en cada evento zoom del mapa.
 */
const aplicarDimensionesPin = (el, scale) => {
  const s = Math.max(0.3, Math.min(1.25, scale));
  const sz = Math.round(PIN_IMG_BASE.size * s);
  const th = Math.max(5, Math.round(PIN_IMG_BASE.triH * s));
  const pd = Math.max(3, Math.round(PIN_IMG_BASE.pad * s));
  const rr = Math.max(5, Math.round(PIN_IMG_BASE.radius * s));
  const bw = Math.max(1.5, PIN_IMG_BASE.border * s).toFixed(1);

  // Wrapper
  el.style.width = `${sz}px`;
  el.style.height = `${sz + th}px`;

  // Card
  const card = el.querySelector(".obra-pin-card");
  if (card) {
    card.style.width = `${sz}px`;
    card.style.height = `${sz}px`;
    card.style.padding = `${pd}px`;
    card.style.borderRadius = `${rr}px`;
    card.style.borderWidth = `${bw}px`;
  }

  // Triángulo
  const tri = el.querySelector(".obra-pin-tri");
  if (tri) {
    tri.style.borderLeftWidth = `${th - 2}px`;
    tri.style.borderRightWidth = `${th - 2}px`;
    tri.style.borderTopWidth = `${th}px`;
  }
};

/**
 * Crea el elemento DOM del pin de imagen.
 * Las dimensiones reales cambian con el zoom — anchor:'bottom' hace que
 * el triángulo siempre apunte al punto correcto sin cálculos extra.
 */
const crearElementoPinImagen = (imageUrl) => {
  const { size: SZ, triH: TH } = PIN_IMG_BASE;

  const el = document.createElement("div");
  el.style.cssText = [
    `width: ${SZ}px`,
    `height: ${SZ + TH}px`,
    "cursor: pointer",
    "user-select: none",
    "display: flex",
    "flex-direction: column",
    "align-items: center",
  ].join("; ");

  const card = document.createElement("div");
  card.className = "obra-pin-card";
  card.style.cssText = [
    `width: ${SZ}px`,
    `height: ${SZ}px`,
    "background: #ffffff",
    `border: ${PIN_IMG_BASE.border}px solid ${BORDER_COLOR}`,
    `border-radius: ${PIN_IMG_BASE.radius}px`,
    "box-shadow: 0 4px 14px rgba(0,0,0,0.45), 0 1px 3px rgba(0,0,0,0.3)",
    "overflow: hidden",
    `padding: ${PIN_IMG_BASE.pad}px`,
    "box-sizing: border-box",
    "display: flex",
    "align-items: center",
    "justify-content: center",
    "transition: transform 0.12s ease", // solo para hover
  ].join("; ");

  const imgEl = document.createElement("img");
  imgEl.src = imageUrl;
  imgEl.style.cssText =
    "width:100%; height:100%; object-fit:contain; display:block;";
  imgEl.draggable = false;
  card.appendChild(imgEl);

  const tri = document.createElement("div");
  tri.className = "obra-pin-tri";
  tri.style.cssText = [
    "width: 0",
    "height: 0",
    `border-left: ${TH - 2}px solid transparent`,
    `border-right: ${TH - 2}px solid transparent`,
    `border-top: ${TH}px solid ${BORDER_COLOR}`,
    "margin-top: -1px",
    "filter: drop-shadow(0 2px 3px rgba(0,0,0,0.25))",
  ].join("; ");

  el.appendChild(card);
  el.appendChild(tri);

  // Hover: solo escala el contenido visual, no afecta al anclaje del marcador
  el.addEventListener("mouseenter", () => {
    card.style.transform = "scale(1.1)";
  });
  el.addEventListener("mouseleave", () => {
    card.style.transform = "scale(1)";
  });

  return el;
};

const crearHTMLPopup = (obra, role) => {
  const { id, nombre, tipo, anio, coords, creadoPor, fechaCreacion } = obra;
  const googleUrl = `https://www.google.com/maps/dir/?api=1&destination=${coords.lat},${coords.lng}`;
  const canEdit = role === ROLES.ADMIN || role === ROLES.EDITOR;

  const botonesEdicion = canEdit
    ? `
    <button class="pin-btn pin-edit" data-id="${id}">✏️ Editar</button>
    <button class="pin-btn pin-delete" data-id="${id}">🗑️ Borrar</button>
  `
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

const PinLayer = ({ reloadTrigger, onReload }) => {
  const { mapInstance, aniosVisibles, filtroTipo } = useMapStore();
  const { openModalEditar, setObras } = useObrasStore();
  const { role, user } = useAuthStore();
  const toast = useToast();
  const marcadoresRef = useRef([]);
  const obrasRef = useRef([]);
  const imagePinEls = useRef([]); // elementos DOM de pines de imagen

  // ── Escala dinámica: cambia dimensiones REALES del elemento ─────────────────
  // Interpolación lineal: zoom 10 → ×0.38 · zoom 13 → ×0.73 · zoom 16 → ×1.08
  // Como los marcadores usan anchor:'bottom', MapLibre aplica
  // translate(-50%,-100%) sobre el tamaño REAL del DOM → el triángulo
  // siempre apunta al punto correcto sin cálculos adicionales.
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

  // ── Cargar y dibujar pines ───────────────────────────────────────────────────
  useEffect(() => {
    if (!mapInstance) return;

    const cargar = async () => {
      // Limpiar marcadores e imagen-pins anteriores
      marcadoresRef.current.forEach((m) => m.remove());
      marcadoresRef.current = [];
      imagePinEls.current = [];

      try {
        const obras = await getObras();
        obrasRef.current = obras;
        setObras(obras);

        obras.forEach((obra) => {
          // Usar pin de imagen si la obra tiene una asignada
          const el = obra.pinImageUrl
            ? crearElementoPinImagen(obra.pinImageUrl)
            : crearElementoPin(obra.anio);

          el.dataset.anio = obra.anio;
          el.dataset.tipo = (obra.tipo || "")
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "");
          el.dataset.id = obra.id;

          // Pines de imagen: registrar y aplicar tamaño según zoom actual
          if (obra.pinImageUrl) {
            aplicarDimensionesPin(el, escalaParaZoom(mapInstance.getZoom()));
            imagePinEls.current.push(el);
          }

          const popup = new maplibregl.Popup({
            offset: 25,
            closeButton: false,
            maxWidth: "280px",
          }).setHTML(crearHTMLPopup(obra, role));

          // anchor:'bottom' → MapLibre ancla la PUNTA del triángulo al lat/lng
          const markerOpts = obra.pinImageUrl
            ? { element: el, anchor: "bottom" }
            : { element: el };

          const marker = new maplibregl.Marker(markerOpts)
            .setLngLat([obra.coords.lng, obra.coords.lat])
            .setPopup(popup)
            .addTo(mapInstance);

          marcadoresRef.current.push(marker);
        });

        aplicarFiltros();
      } catch (err) {
        console.error(err);
        toast("Error al cargar las obras.", "error");
      }
    };

    cargar();
  }, [mapInstance, reloadTrigger, role]);

  // Aplicar filtros de año y tipo
  const aplicarFiltros = () => {
    const filtroLimpio =
      filtroTipo === "all"
        ? "all"
        : filtroTipo
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "");

    marcadoresRef.current.forEach((marker) => {
      const el = marker.getElement();
      const anioPin = el.dataset.anio;
      const tipoPin = el.dataset.tipo;

      const pasaAnio = aniosVisibles[anioPin] !== false;
      const pasaTipo = filtroLimpio === "all" || tipoPin.includes(filtroLimpio);

      el.style.display = pasaAnio && pasaTipo ? "" : "none";
    });
  };

  useEffect(() => {
    aplicarFiltros();
  }, [aniosVisibles, filtroTipo, marcadoresRef.current.length]);

  // Delegar eventos de editar/borrar desde los popups
  useEffect(() => {
    const handler = async (e) => {
      // BORRAR
      if (e.target.classList.contains("pin-delete")) {
        const id = e.target.dataset.id;
        if (!confirm("¿Eliminar esta obra? Quedará registro en auditoría."))
          return;
        try {
          await deleteObra(id, user?.email || "Desconocido");
          toast("Obra eliminada y enviada a la papelera.", "success");
          // Cerrar popup activo
          document.querySelector(".maplibregl-popup")?.remove();
          onReload?.();
        } catch {
          toast("Error al eliminar la obra.", "error");
        }
      }

      // EDITAR
      if (e.target.classList.contains("pin-edit")) {
        const id = e.target.dataset.id;
        const obra = obrasRef.current.find((o) => o.id === id);
        if (!obra) return;

        const marker = marcadoresRef.current.find(
          (m) => m.getElement().dataset.id === id,
        );
        const coords = marker ? marker.getLngLat() : obra.coords;

        // Pre-llenar formulario
        window.__llenarFormularioObra?.({
          nombre: obra.nombre,
          tipo: obra.tipo,
          anio: obra.anio,
          pinImageUrl: obra.pinImageUrl ?? null,
          pinImagePath: obra.pinImagePath ?? null,
        });

        openModalEditar(id, coords);
        document.querySelector(".maplibregl-popup")?.remove();
      }
    };

    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [role, user]);

  return null; // Este componente no renderiza JSX propio — actúa sobre el mapa
};

export default PinLayer;
