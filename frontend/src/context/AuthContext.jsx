import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { authApi } from "../api/endpoints";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(() => localStorage.getItem("borrowly_token"));
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem("borrowly_user");
    return raw ? JSON.parse(raw) : null;
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!token) return;
    authApi
      .me()
      .then((res) => {
        setUser(res.data.data.user);
        localStorage.setItem("borrowly_user", JSON.stringify(res.data.data.user));
      })
      .catch(() => {
        localStorage.removeItem("borrowly_token");
        localStorage.removeItem("borrowly_user");
        setToken(null);
        setUser(null);
      });
  }, [token]);

  const persist = (authToken, authUser) => {
    setToken(authToken);
    setUser(authUser);
    localStorage.setItem("borrowly_token", authToken);
    localStorage.setItem("borrowly_user", JSON.stringify(authUser));
  };

  const register = async (payload) => {
    setLoading(true);
    try {
      const res = await authApi.register(payload);
      persist(res.data.token, res.data.data.user);
      return res.data;
    } finally {
      setLoading(false);
    }
  };

  const login = async (payload) => {
    setLoading(true);
    try {
      const res = await authApi.login(payload);
      persist(res.data.token, res.data.data.user);
      return res.data;
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem("borrowly_token");
    localStorage.removeItem("borrowly_user");
  };

  const value = useMemo(
    () => ({
      token,
      user,
      loading,
      register,
      login,
      logout,
      setUser,
    }),
    [token, user, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
};
