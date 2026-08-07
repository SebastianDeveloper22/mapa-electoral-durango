import { useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { auth, db } from '../services/firebase';
import { useAuthStore } from '../store/authStore';

const fetchUserRole = async (email) => {
  try {
    const q = query(collection(db, 'roles'), where('email', '==', email));
    const snap = await getDocs(q);
    if (!snap.empty) return snap.docs[0].data().rol;
    return 'lector';
  } catch {
    return 'lector';
  }
};

export const useAuth = () => {
  const { setUser, setRole, setLoading, clearAuth } = useAuthStore();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);

        let role = await fetchUserRole(firebaseUser.email);

        // En móviles, degradar editor/admin a lector
        const isMobile =
          window.innerWidth <= 768 ||
          /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
            navigator.userAgent
          );
        if (isMobile && (role === 'admin' || role === 'editor')) {
          role = 'lector';
        }

        setRole(role);
        setLoading(false);
      } else {
        clearAuth();
      }
    });

    return () => unsubscribe();
  }, []);
};
