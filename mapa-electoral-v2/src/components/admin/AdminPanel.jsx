import { useState, useEffect, useCallback } from "react";
import {
  getUsuarios,
  addUsuario,
  updateRol,
  deleteUsuario,
} from "../../services/adminService";
import { useToast } from "../ui/Toast";

const ROLES_OPCIONES = ["lector", "editor", "admin"];

const ROL_BADGE = {
  lector: "bg-slate-700 text-slate-300",
  editor: "bg-blue-900/60 text-blue-300",
  admin: "bg-purple-900/60 text-purple-300",
};

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const AdminPanel = ({ open, onClose }) => {
  const toast = useToast();

  const [usuarios, setUsuarios] = useState([]);
  const [loadingList, setLoadingList] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newRol, setNewRol] = useState("lector");
  const [adding, setAdding] = useState(false);

  // Cargar lista de usuarios
  const cargar = useCallback(async () => {
    setLoadingList(true);
    try {
      const data = await getUsuarios();
      setUsuarios(data);
    } catch {
      toast("Error al cargar usuarios.", "error");
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    if (open) cargar();
  }, [open]);

  // Agregar usuario
  const handleAdd = async () => {
    const email = newEmail.trim().toLowerCase();
    if (!emailRegex.test(email)) {
      toast("Ingresa un correo electrónico válido.", "warning");
      return;
    }
    setAdding(true);
    try {
      await addUsuario(email, newRol);
      toast(`Usuario "${email}" agregado como ${newRol}.`, "success");
      setNewEmail("");
      cargar();
    } catch (err) {
      if (err.message === "ALREADY_EXISTS") {
        toast(`"${email}" ya tiene acceso asignado.`, "warning");
      } else {
        toast("Error al agregar el usuario.", "error");
      }
    } finally {
      setAdding(false);
    }
  };

  // Cambiar rol
  const handleRolChange = async (id, rol) => {
    try {
      await updateRol(id, rol);
      setUsuarios((prev) => prev.map((u) => (u.id === id ? { ...u, rol } : u)));
      toast(`Rol actualizado a "${rol}".`, "success");
    } catch {
      toast("Error al actualizar el rol.", "error");
    }
  };

  // Eliminar usuario
  const handleDelete = async (id, email) => {
    if (!confirm(`¿Quitar el acceso a "${email}"?`)) return;
    try {
      await deleteUsuario(id);
      toast("Acceso eliminado correctamente.", "success");
      setUsuarios((prev) => prev.filter((u) => u.id !== id));
    } catch {
      toast("Error al eliminar el usuario.", "error");
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-[#1e293b] border border-[#334155] rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-[#334155] shrink-0">
          <div>
            <h3 className="text-base font-semibold text-white">
              🛡️ Gestión de Usuarios
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Controla quién tiene acceso al sistema y sus permisos.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white text-xl leading-none cursor-pointer transition-colors"
          >
            ✖
          </button>
        </div>

        {/* Agregar nuevo usuario */}
        <div className="px-6 py-4 border-b border-[#334155] shrink-0">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-3">
            Agregar acceso
          </p>
          <div className="flex gap-2">
            <input
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              placeholder="correo@dominio.com"
              className="flex-1 bg-[#0f172a] border border-[#334155] text-white text-sm rounded-lg px-3 py-2 outline-none focus:border-blue-500 transition-colors placeholder:text-slate-600"
            />
            <select
              value={newRol}
              onChange={(e) => setNewRol(e.target.value)}
              className="bg-[#0f172a] border border-[#334155] text-white text-sm rounded-lg px-2 py-2 outline-none focus:border-blue-500 cursor-pointer"
            >
              {ROLES_OPCIONES.map((r) => (
                <option key={r} value={r}>
                  {r.charAt(0).toUpperCase() + r.slice(1)}
                </option>
              ))}
            </select>
            <button
              onClick={handleAdd}
              disabled={adding}
              className="bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
            >
              {adding ? "⏳" : "+ Agregar"}
            </button>
          </div>
        </div>

        {/* Cabecera de la tabla */}
        <div className="flex items-center justify-between px-6 py-2 shrink-0">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Usuario
          </span>
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Rol / Acción
          </span>
        </div>

        {/* Lista de usuarios */}
        <div className="overflow-y-auto flex-1 px-6 pb-5">
          {loadingList ? (
            <p className="text-slate-400 text-sm text-center py-8 animate-pulse">
              Cargando usuarios...
            </p>
          ) : usuarios.length === 0 ? (
            <p className="text-slate-500 text-sm text-center py-8">
              No hay usuarios registrados.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {usuarios.map((u) => (
                <div
                  key={u.id}
                  className="flex items-center justify-between gap-3 bg-[#0f172a] border border-[#1e293b] rounded-xl px-4 py-3 hover:border-[#334155] transition-colors"
                >
                  {/* Email */}
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-slate-400 text-sm">📧</span>
                    <span className="text-slate-200 text-sm truncate">
                      {u.email}
                    </span>
                  </div>

                  {/* Rol + Borrar */}
                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={`text-xs font-semibold px-2 py-0.5 rounded-md ${ROL_BADGE[u.rol] || ROL_BADGE.lector}`}
                    >
                      {u.rol}
                    </span>
                    <select
                      value={u.rol}
                      onChange={(e) => handleRolChange(u.id, e.target.value)}
                      className="bg-[#1e293b] border border-[#334155] text-slate-300 text-xs rounded-lg px-2 py-1.5 outline-none focus:border-blue-500 cursor-pointer"
                    >
                      {ROLES_OPCIONES.map((r) => (
                        <option key={r} value={r}>
                          {r.charAt(0).toUpperCase() + r.slice(1)}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => handleDelete(u.id, u.email)}
                      className="text-red-400 hover:text-red-300 hover:bg-red-900/30 text-sm px-2 py-1.5 rounded-lg transition-colors cursor-pointer"
                      title="Quitar acceso"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminPanel;
