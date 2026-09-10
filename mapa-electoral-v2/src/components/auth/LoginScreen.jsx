import { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../../services/firebase';
import { useToast } from '../ui/Toast';

const ERRORES = {
  'auth/invalid-email': 'El correo electrónico no es válido.',
  'auth/user-not-found': 'No existe una cuenta con ese correo.',
  'auth/wrong-password': 'Contraseña incorrecta. Intenta de nuevo.',
  'auth/invalid-credential': 'Correo o contraseña incorrectos.',
  'auth/too-many-requests': 'Demasiados intentos fallidos. Espera unos minutos.',
  'auth/network-request-failed': 'Sin conexión a internet. Verifica tu red.',
  'auth/user-disabled': 'Esta cuenta ha sido deshabilitada.',
};

const LoginScreen = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  const handleLogin = async () => {
    if (!email || !password) {
      toast('Por favor, ingresa tu correo y contraseña.', 'warning');
      return;
    }
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      toast(ERRORES[err.code] || 'Error al iniciar sesión.', 'error');
      setLoading(false);
    }
  };

  const handleKeyDown = (e, next) => {
    if (e.key === 'Enter') next?.();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0f172a]"
        style={{ background: 'radial-gradient(ellipse at 60% 40%, #1e3a5f 0%, #0f172a 70%)' }}>
      <div className="w-full max-w-sm mx-4 bg-[#1e293b] border border-[#334155] rounded-2xl p-8 shadow-2xl">
        {/* Logo */}
        <div className="text-5xl text-center mb-4">🛰️</div>
        <h2 className="text-xl font-semibold text-center text-white mb-1">Bienvenido</h2>
        <p className="text-sm text-center text-slate-400 mb-6">
          Introduce tus credenciales para acceder al sistema.
        </p>

        {/* Email */}
        <div className="mb-4">
          <label className="block text-xs font-medium text-slate-300 mb-1.5 uppercase tracking-wider">
            Correo Electrónico
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => handleKeyDown(e, () => document.getElementById('login-pass')?.focus())}
            placeholder="usuario@dominio.com"
            autoComplete="email"
            className="w-full bg-[#0f172a] border border-[#334155] text-white rounded-lg px-4 py-2.5 text-sm outline-none focus:border-blue-500 transition-colors"
          />
        </div>

        {/* Password */}
        <div className="mb-6">
          <label className="block text-xs font-medium text-slate-300 mb-1.5 uppercase tracking-wider">
            Contraseña
          </label>
          <input
            id="login-pass"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => handleKeyDown(e, handleLogin)}
            placeholder="••••••••"
            autoComplete="current-password"
            className="w-full bg-[#0f172a] border border-[#334155] text-white rounded-lg px-4 py-2.5 text-sm outline-none focus:border-blue-500 transition-colors"
          />
        </div>

        {/* Botón */}
        <button
          onClick={handleLogin}
          disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white font-semibold py-2.5 rounded-lg transition-colors cursor-pointer"
        >
          {loading ? 'Verificando...' : 'Iniciar Sesión'}
        </button>

        <p className="text-center text-xs text-slate-500 mt-6">S.I.G. v2.0 | Estado de Durango</p>
      </div>
    </div>
  );
};

export default LoginScreen;
