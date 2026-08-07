import {
  collection,
  addDoc,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  getDoc,
} from "firebase/firestore";
import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";
import { db, storage } from "./firebase";

const COL = "obras";
const PAPELERA = "papelera";

const fechaFormato = () =>
  new Date().toLocaleDateString("es-MX", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

// ── Imagen de pin ─────────────────────────────────────────────────────────────

/**
 * Sube una imagen PNG a Firebase Storage y devuelve { url, path }.
 * Se guarda en obras/pins/<timestamp>_<random>.png
 */
export const subirImagenPin = async (archivo) => {
  const ext = archivo.name.split(".").pop() || "png";
  const path = `obras/pins/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, archivo);
  const url = await getDownloadURL(storageRef);
  return { url, path };
};

/**
 * Elimina una imagen de Storage por su path.
 * No lanza error si el archivo ya no existe.
 */
export const eliminarImagenPin = async (path) => {
  if (!path) return;
  try {
    await deleteObject(ref(storage, path));
  } catch {
    // Si no existe, ignorar
  }
};

// ── CRUD de obras ─────────────────────────────────────────────────────────────

export const getObras = async () => {
  const snap = await getDocs(collection(db, COL));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
};

export const createObra = async ({
  nombre,
  tipo,
  anio,
  coords,
  userEmail,
  pinImageUrl,
  pinImagePath,
}) => {
  await addDoc(collection(db, COL), {
    nombre,
    tipo,
    anio,
    coords: { lat: coords.lat, lng: coords.lng },
    creadoPor: userEmail,
    fechaCreacion: fechaFormato(),
    pinImageUrl: pinImageUrl ?? null,
    pinImagePath: pinImagePath ?? null,
  });
};

export const updateObra = async ({
  id,
  nombre,
  tipo,
  anio,
  coords,
  userEmail,
  pinImageUrl,
  pinImagePath,
}) => {
  await updateDoc(doc(db, COL, id), {
    nombre,
    tipo,
    anio,
    coords: { lat: coords.lat, lng: coords.lng },
    ultimaEdicionPor: userEmail,
    fechaEdicion: fechaFormato(),
    pinImageUrl: pinImageUrl ?? null,
    pinImagePath: pinImagePath ?? null,
  });
};

export const deleteObra = async (id, userEmail) => {
  const ref_ = doc(db, COL, id);
  const snap = await getDoc(ref_);
  if (snap.exists()) {
    const data = snap.data();
    // Eliminar imagen de Storage si existe
    if (data.pinImagePath) await eliminarImagenPin(data.pinImagePath);
    // Mover a papelera
    await addDoc(collection(db, PAPELERA), {
      ...data,
      borradoPor: userEmail,
      fechaBorrado: fechaFormato(),
    });
  }
  await deleteDoc(ref_);
};
