import { createContext, useContext, useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import api from "./api";
const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(!!localStorage.getItem("token"));
  useEffect(() => {
    if (!localStorage.getItem("token")) return;
    api.get("/auth/me").then((r) => setUser(r.data)).catch(() => localStorage.removeItem("token")).finally(() => setLoading(false));
  }, []);
  const login = async (email, password) => {
    const { data } = await api.post("/auth/login", { email, password });
    localStorage.setItem("token", data.token); setUser(data.user);
  };
  const logout = () => { localStorage.removeItem("token"); setUser(null); };
  return <Ctx.Provider value={{ user, loading, login, logout }}>{children}</Ctx.Provider>;
}
export function Protected({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="p-8">Chargement…</div>;
  return user ? children : <Navigate to="/login" replace />;
}
