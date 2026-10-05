import { createContext, useContext, useState } from "react";

const defaultUser = {
  id: "default-user",
  email: "demo@printflow.com",
  name: "Utilisateur",
  role: "admin"
};

const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(defaultUser);

  const login = async () => {
    setUser(defaultUser);
  };
  const logout = () => {
    setUser(defaultUser);
  };

  return (
    <Ctx.Provider value={{ user, loading: false, login, logout }}>
      {children}
    </Ctx.Provider>
  );
}

export function Protected({ children }) {
  return children;
}
