import React, { createContext, useState, useEffect } from "react";
import api, { setAuthToken } from "./api";

export const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [token, setToken] = useState(localStorage.getItem("token"));
  const [user, setUser] = useState(JSON.parse(localStorage.getItem("user")) || null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (token) {
      setAuthToken(token);
      localStorage.setItem("token", token);
    } else {
      localStorage.removeItem("token");
      setAuthToken(null);
    }
  }, [token]);

  useEffect(() => {
    if (user) localStorage.setItem("user", JSON.stringify(user));
    else localStorage.removeItem("user");
  }, [user]);

  // helper login
  const login = async (phone, pin) => {
    const resp = await api.post("/login", { phone, pin });
    setToken(resp.data.token);
    setUser(resp.data.user);
    setAuthToken(resp.data.token);
    return resp.data;
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    setAuthToken(null);
    // keep localStorage today data for offline use if you want
  };

  return (
    <AuthContext.Provider value={{ token, user, login, logout, ready, setReady }}>
      {children}
    </AuthContext.Provider>
  );
}
