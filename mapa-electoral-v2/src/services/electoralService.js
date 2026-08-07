import { db } from "./firebase";
import {
  collection,
  addDoc,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  getDoc,
  query,
  where,
  onSnapshot,
  orderBy,
  writeBatch,
  serverTimestamp,
} from "firebase/firestore";

// ── Nombres de colecciones ───────────────────────────────────────────────────
const COL_ELECCIONES = "elecciones";
const COL_CASILLAS = "casillas";
const COL_RESULTADOS = "resultados";

// ── ELECCIONES ───────────────────────────────────────────────────────────────

/**
 * Retorna todas las elecciones ordenadas por año descendente.
 * @returns {Promise<Array>}
 */
export const getElecciones = async () => {
  // Sin orderBy para no requerir índice compuesto en Firestore
  const snap = await getDocs(collection(db, COL_ELECCIONES));
  const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  // Ordenar en cliente por año descendente
  return docs.sort((a, b) => (b.anio ?? 0) - (a.anio ?? 0));
};

/**
 * Retorna la elección marcada como activa, o null si no existe ninguna.
 * @returns {Promise<Object|null>}
 */
export const getEleccionActiva = async () => {
  const q = query(collection(db, COL_ELECCIONES), where("activa", "==", true));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...d.data() };
};

/**
 * Crea una nueva elección.
 * @param {Object} data  - { nombre, tipo, anio, descripcion?, ... }
 * @returns {Promise<string>} id del documento creado
 */
export const createEleccion = async (data) => {
  const ref = await addDoc(collection(db, COL_ELECCIONES), {
    ...data,
    activa: data.activa ?? false,
    creadoEn: serverTimestamp(),
    actualizadoEn: serverTimestamp(),
  });
  return ref.id;
};

/**
 * Actualiza campos de una elección existente.
 * @param {string} id
 * @param {Object} data
 */
export const updateEleccion = async (id, data) => {
  const ref = doc(db, COL_ELECCIONES, id);
  await updateDoc(ref, {
    ...data,
    actualizadoEn: serverTimestamp(),
  });
};

/**
 * Elimina una elección por id.
 * @param {string} id
 */
export const deleteEleccion = async (id) => {
  await deleteDoc(doc(db, COL_ELECCIONES, id));
};

/**
 * Establece una elección como activa usando un batch:
 * 1. Desactiva todas las elecciones existentes.
 * 2. Activa la seleccionada.
 * @param {string} id
 */
export const setEleccionActiva = async (id) => {
  const batch = writeBatch(db);

  // Desactivar todas
  const allSnap = await getDocs(collection(db, COL_ELECCIONES));
  allSnap.docs.forEach((d) => {
    batch.update(d.ref, { activa: false, actualizadoEn: serverTimestamp() });
  });

  // Activar la seleccionada
  const targetRef = doc(db, COL_ELECCIONES, id);
  batch.update(targetRef, { activa: true, actualizadoEn: serverTimestamp() });

  await batch.commit();
};

// ── CASILLAS ─────────────────────────────────────────────────────────────────

/**
 * Elimina TODAS las casillas y resultados de una elección.
 * Útil para reimportar un CSV desde cero sin duplicados.
 * @param {string} eleccionId
 * @returns {Promise<{casillas: number, resultados: number}>}
 */
export const limpiarCasillasEleccion = async (eleccionId) => {
  const [casillaSnap, resultadoSnap] = await Promise.all([
    getDocs(
      query(
        collection(db, COL_CASILLAS),
        where("eleccion_id", "==", eleccionId),
      ),
    ),
    getDocs(
      query(
        collection(db, COL_RESULTADOS),
        where("eleccion_id", "==", eleccionId),
      ),
    ),
  ]);

  const allDocs = [...casillaSnap.docs, ...resultadoSnap.docs];
  const BATCH_SIZE = 400;

  for (let i = 0; i < allDocs.length; i += BATCH_SIZE) {
    const batch = writeBatch(db);
    allDocs.slice(i, i + BATCH_SIZE).forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }

  return { casillas: casillaSnap.size, resultados: resultadoSnap.size };
};

/**
 * Retorna todas las casillas de una elección.
 * @param {string} eleccionId
 * @returns {Promise<Array>}
 */
export const getCasillas = async (eleccionId) => {
  const q = query(
    collection(db, COL_CASILLAS),
    where("eleccion_id", "==", eleccionId),
  );
  const snap = await getDocs(q);
  const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  // Ordenar en cliente para no requerir índice compuesto
  return docs.sort((a, b) =>
    String(a.seccion ?? "").localeCompare(String(b.seccion ?? "")),
  );
};

/**
 * Crea una nueva casilla.
 * @param {Object} data - { eleccion_id, seccion, tipo, lat, lng, municipio?, ... }
 * @returns {Promise<string>} id del documento creado
 */
export const createCasilla = async (data) => {
  const ref = await addDoc(collection(db, COL_CASILLAS), {
    ...data,
    creadoEn: serverTimestamp(),
    actualizadoEn: serverTimestamp(),
  });
  return ref.id;
};

/**
 * Actualiza campos de una casilla existente.
 * @param {string} id
 * @param {Object} data
 */
export const updateCasilla = async (id, data) => {
  const ref = doc(db, COL_CASILLAS, id);
  await updateDoc(ref, {
    ...data,
    actualizadoEn: serverTimestamp(),
  });
};

/**
 * Elimina una casilla por id.
 * @param {string} id
 */
export const deleteCasilla = async (id) => {
  await deleteDoc(doc(db, COL_CASILLAS, id));
};

// ── RESULTADOS ────────────────────────────────────────────────────────────────

/**
 * Retorna todos los resultados de una elección.
 * @param {string} eleccionId
 * @returns {Promise<Array>}
 */
export const getResultados = async (eleccionId) => {
  const q = query(
    collection(db, COL_RESULTADOS),
    where("eleccion_id", "==", eleccionId),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
};

/**
 * Crea o actualiza el resultado de una casilla en una elección.
 * Si ya existe un documento para esa (casilla_id + eleccion_id), lo actualiza.
 * Si no existe, lo crea.
 *
 * @param {Object} data - { casilla_id, eleccion_id, votos: { PRI, PAN, MORENA, MC, OTROS, NULOS }, total_votos, ... }
 * @returns {Promise<string>} id del documento creado o actualizado
 */
export const upsertResultado = async (data) => {
  // Buscar si ya existe un resultado para esta casilla + elección
  const q = query(
    collection(db, COL_RESULTADOS),
    where("casilla_id", "==", data.casilla_id),
    where("eleccion_id", "==", data.eleccion_id),
  );
  const snap = await getDocs(q);

  if (!snap.empty) {
    // Actualizar el existente
    const existingRef = snap.docs[0].ref;
    await updateDoc(existingRef, {
      ...data,
      actualizadoEn: serverTimestamp(),
    });
    return existingRef.id;
  }

  // Crear nuevo
  const ref = await addDoc(collection(db, COL_RESULTADOS), {
    ...data,
    creadoEn: serverTimestamp(),
    actualizadoEn: serverTimestamp(),
  });
  return ref.id;
};

/**
 * Suscribe en tiempo real a los resultados de una elección.
 * Llama al callback cada vez que haya cambios.
 * Retorna la función de cancelación de la suscripción.
 *
 * @param {string}   eleccionId
 * @param {Function} callback - recibe Array<{id, ...datos}>
 * @returns {Function} unsubscribe
 */
export const suscribirResultados = (eleccionId, callback) => {
  const q = query(
    collection(db, COL_RESULTADOS),
    where("eleccion_id", "==", eleccionId),
  );

  const unsubscribe = onSnapshot(q, (snap) => {
    const resultados = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    callback(resultados);
  });

  return unsubscribe;
};
