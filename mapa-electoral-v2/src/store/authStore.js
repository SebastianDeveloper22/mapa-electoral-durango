import { create } from 'zustand';

export const useAuthStore = create((set) => ({
  user: null,
  role: null,
  loading: true,

  setUser: (user) => set({ user }),
  setRole: (role) => set({ role }),
  setLoading: (loading) => set({ loading }),

  clearAuth: () => set({ user: null, role: null, loading: false }),
}));
