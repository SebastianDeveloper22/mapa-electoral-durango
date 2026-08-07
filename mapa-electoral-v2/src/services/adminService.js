import {
  collection, getDocs, addDoc, doc,
  updateDoc, deleteDoc, query, where,
} from 'firebase/firestore';
import { db } from './firebase';

const COL = 'roles';

export const getUsuarios = async () => {
  const snap = await getDocs(collection(db, COL));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
};

export const addUsuario = async (email, rol) => {
  // Verificar si ya existe
  const snap = await getDocs(query(collection(db, COL), where('email', '==', email)));
  if (!snap.empty) throw new Error('ALREADY_EXISTS');
  await addDoc(collection(db, COL), { email, rol });
};

export const updateRol = async (id, rol) => {
  await updateDoc(doc(db, COL, id), { rol });
};

export const deleteUsuario = async (id) => {
  await deleteDoc(doc(db, COL, id));
};
