import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import { useAuthStore } from './store/authStore';
import LoginScreen from './components/auth/LoginScreen';
import { ToastContainer } from './components/ui/Toast';

// Lazy imports para no bloquear el bundle inicial
import App from './App';
import ElectoralPage from './pages/ElectoralPage';

// ── Spinner compartido ───────────────────────────────────────────────────────
const LoadingScreen = () => (
  <div className="w-screen h-screen flex items-center justify-center bg-[#0f172a]">
    <div className="flex flex-col items-center gap-3">
      <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      <p className="text-slate-400 text-sm animate-pulse">Verificando sesión...</p>
    </div>
  </div>
);

// ── Ruta protegida genérica ──────────────────────────────────────────────────
const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuthStore();

  if (loading) return <LoadingScreen />;
  if (!user)   return <LoginScreen />;

  return children;
};

// ── AppRouter ────────────────────────────────────────────────────────────────
const AppRouter = () => {
  // Inicializa el listener de Firebase Auth una sola vez para toda la app
  useAuth();

  return (
    <>
      <Routes>
        {/* Módulo PP (mapa de obras) */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <App />
            </ProtectedRoute>
          }
        />

        {/* Módulo Electoral */}
        <Route
          path="/electoral"
          element={
            <ProtectedRoute>
              <ElectoralPage />
            </ProtectedRoute>
          }
        />

        {/* Cualquier otra ruta redirige a / */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      {/* Toast global — disponible en cualquier ruta */}
      <ToastContainer />
    </>
  );
};

export default AppRouter;
