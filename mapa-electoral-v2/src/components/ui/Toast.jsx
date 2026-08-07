import { useState, useEffect, useCallback } from 'react';
import { create } from 'zustand';

// Store interno del toast
export const useToastStore = create((set) => ({
  toasts: [],
  addToast: (mensaje, tipo = 'info') => {
    const id = Date.now();
    set((state) => ({ toasts: [...state.toasts, { id, mensaje, tipo }] }));
    setTimeout(() => {
      set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
    }, 3500);
  },
}));

// Hook para usar fácilmente desde cualquier componente
export const useToast = () => useToastStore((s) => s.addToast);

const COLORES = {
  success: 'border-l-4 border-emerald-500 bg-emerald-500/10 text-emerald-300',
  error:   'border-l-4 border-red-500 bg-red-500/10 text-red-300',
  warning: 'border-l-4 border-amber-500 bg-amber-500/10 text-amber-300',
  info:    'border-l-4 border-blue-500 bg-blue-500/10 text-blue-300',
};

const ICONOS = {
  success: '✅',
  error:   '❌',
  warning: '⚠️',
  info:    'ℹ️',
};

export const ToastContainer = () => {
  const toasts = useToastStore((s) => s.toasts);

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`flex items-center gap-3 px-4 py-3 rounded-lg shadow-xl backdrop-blur-sm text-sm font-medium animate-fade-in-up ${COLORES[t.tipo] || COLORES.info}`}
        >
          <span>{ICONOS[t.tipo] || ICONOS.info}</span>
          <span>{t.mensaje}</span>
        </div>
      ))}
    </div>
  );
};
