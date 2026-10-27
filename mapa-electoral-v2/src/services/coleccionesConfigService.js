import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  query,
  where,
} from "firebase/firestore";
import { db } from "./firebase";

const COL_CONFIG = "colecciones_config";
const COL_CUSTOM = "marcadores_custom";

// ── Configuraciones de colecciones ────────────────────────────────────────────

export const getColeccionesConfig = async () => {
  const snap = await getDocs(collection(db, COL_CONFIG));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
};

export const createColeccionConfig = async (config) => {
  // Verificar que el key no exista ya
  const q = query(collection(db, COL_CONFIG), where("key", "==", config.key));
  const snap = await getDocs(q);
  if (!snap.empty) throw new Error("KEY_EXISTS");
  await addDoc(collection(db, COL_CONFIG), config);
};

export const deleteColeccionConfig = async (id) => {
  await deleteDoc(doc(db, COL_CONFIG, id));
};

// ── Marcadores de colecciones dinámicas ──────────────────────────────────────

export const getMarcadoresCustom = async () => {
  const snap = await getDocs(collection(db, COL_CUSTOM));
  return snap.docs
    .map((d) => ({ id: d.id, capa: d.data().coleccion, ...d.data() }))
    .filter((d) => !d._placeholder);
};
