import { createContext, useContext, useEffect, useState } from "react";
import api from "../api/axios";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {

  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  /*
  =================================
  RESTORE SESSION ON PAGE REFRESH
  =================================
  */
  useEffect(() => {

    const storedUser = localStorage.getItem("user");
    const token = localStorage.getItem("token");

    if (storedUser && token) {
      try {

        const parsed = JSON.parse(storedUser);

        // ensure roles exists
        const normalizedUser = {
          ...parsed,
          roles: Array.isArray(parsed.roles) ? parsed.roles : []
        };

        setUser(normalizedUser);

      } catch {
        localStorage.removeItem("user");
        localStorage.removeItem("token");
      }
    }

    setLoading(false);

  }, []);

  /*
  =================================
  LOGIN
  =================================
  */
  const login = async (email, password) => {
    try {
      const res = await api.post("/auth/login", { email, password });

      if (!res.data.success) {
        return {
          success: false,
          message: res.data.message || "Invalid email or password"
        };
      }

      localStorage.setItem("token", res.data.token);
      localStorage.setItem("user", JSON.stringify(res.data.user));

      const normalizedUser = {
        ...res.data.user,
        roles: Array.isArray(res.data.user.roles) ? res.data.user.roles : []
      };

      localStorage.setItem("user", JSON.stringify(normalizedUser));
      setUser(normalizedUser);

      return {
        success: true,
        user: res.data.user
      };

    } catch (err) {

      const message =
        err.response?.data?.message ||
        "Invalid email or password";

      return {
        success: false,
        message
      };

    }
  };

  /*
  =================================
  LOGOUT
  =================================
  */
  const logout = () => {

    localStorage.removeItem("token");
    localStorage.removeItem("user");

    setUser(null);

  };

  /*
  =================================
  CONTEXT VALUE
  =================================
  */
  const value = {
    user,
    login,
    logout,
    loading,
    isAuthenticated: !!user
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

/*
=================================
CUSTOM HOOK
=================================
*/
export const useAuth = () => useContext(AuthContext);