import {
  collection,
  addDoc,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  getDoc,
} from "firebase/firestore";
import { db } from "./firebase";
import { subirImagenPin, eliminarImagenPin, subirFoto } from "./obrasService";

const PAPELERA = "papelera";

// Colecciones por tipo de capa
const COLECCIONES = {
  rural: "marcadores_rural",
  top100: "marcadores_top100",
  general: "marcadores_generales",
  capital: "marcadores_capital",
  municipios: "marcadores_municipios",
};

const fechaFormato = () =>
  new Date().toLocaleDateString("es-MX", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

// ── Obtener marcadores ────────────────────────────────────────────────────────

export const getMarcadores = async (capa) => {
  const col = COLECCIONES[capa];
  if (!col) throw new Error(`Capa desconocida: ${capa}`);
  const snap = await getDocs(collection(db, col));
  return snap.docs
    .map((d) => ({ id: d.id, capa, ...d.data() }))
    .filter((d) => !d._placeholder); // ignorar documento inicial de Firebase Console
};

export const getMarcadoresTodos = async () => {
  const resultados = await Promise.all(
    Object.keys(COLECCIONES).map((capa) => getMarcadores(capa))
  );
  return resultados.flat();
};

// ── Crear marcador ────────────────────────────────────────────────────────────

export const createMarcador = async ({
  capa,
  nombre,
  tipo,
  distritoLocal,
  seccion,
  zonaElectoral,
  referencia,
  participacion,
  detalles,
  pinColor,
  seleccionado,
  coords,
  userEmail,
  pinImageUrl,
  pinImagePath,
  fotoUrl,
  fotoPath,
}) => {
  const col = COLECCIONES[capa];
  if (!col) throw new Error(`Capa desconocida: ${capa}`);
  await addDoc(collection(db, col), {
    nombre,
    tipo,
    distritoLocal: distritoLocal ?? null,
    seccion: seccion ?? null,
    zonaElectoral: zonaElectoral ?? null,
    referencia: referencia ?? null,
    participacion: participacion ?? null,
    detalles: detalles ?? null,
    pinColor: pinColor ?? null,
    seleccionado: seleccionado ?? false,
    coords: { lat: coords.lat, lng: coords.lng },
    creadoPor: userEmail,
    fechaCreacion: fechaFormato(),
    pinImageUrl: pinImageUrl ?? null,
    pinImagePath: pinImagePath ?? null,
    fotoUrl: fotoUrl ?? null,
    fotoPath: fotoPath ?? null,
  });
};

// ── Actualizar marcador ───────────────────────────────────────────────────────

export const updateMarcador = async ({
  capa,
  id,
  nombre,
  tipo,
  distritoLocal,
  seccion,
  zonaElectoral,
  referencia,
  participacion,
  detalles,
  pinColor,
  seleccionado,
  coords,
  userEmail,
  pinImageUrl,
  pinImagePath,
  fotoUrl,
  fotoPath,
}) => {
  const col = COLECCIONES[capa];
  if (!col) throw new Error(`Capa desconocida: ${capa}`);
  await updateDoc(doc(db, col, id), {
    nombre,
    tipo,
    distritoLocal: distritoLocal ?? null,
    seccion: seccion ?? null,
    zonaElectoral: zonaElectoral ?? null,
    referencia: referencia ?? null,
    participacion: participacion ?? null,
    detalles: detalles ?? null,
    pinColor: pinColor ?? null,
    seleccionado: seleccionado ?? false,
    coords: { lat: coords.lat, lng: coords.lng },
    ultimaEdicionPor: userEmail,
    fechaEdicion: fechaFormato(),
    pinImageUrl: pinImageUrl ?? null,
    pinImagePath: pinImagePath ?? null,
    fotoUrl: fotoUrl ?? null,
    fotoPath: fotoPath ?? null,
  });
};

// ── Eliminar marcador (con papelera) ──────────────────────────────────────────

export const deleteMarcador = async (capa, id, userEmail) => {
  const col = COLECCIONES[capa];
  if (!col) throw new Error(`Capa desconocida: ${capa}`);
  const ref_ = doc(db, col, id);
  const snap = await getDoc(ref_);
  if (snap.exists()) {
    const data = snap.data();
    if (data.pinImagePath) await eliminarImagenPin(data.pinImagePath);
    if (data.fotoPath) await eliminarImagenPin(data.fotoPath);
    await addDoc(collection(db, PAPELERA), {
      ...data,
      capa,
      coleccionOrigen: col,
      borradoPor: userEmail,
      fechaBorrado: fechaFormato(),
    });
  }
  await deleteDoc(ref_);
};

export { subirImagenPin, eliminarImagenPin, subirFoto };
