import { useState, useEffect } from "react";
import { THEMES } from "../themes/themes";

// ─────────────────────────────────────────────────────────────────────────────
// getThemeByRole
// Always reads fresh from localStorage — no stale closure values.
// ─────────────────────────────────────────────────────────────────────────────
const getThemeByRole = () => {
  try {
    const role = localStorage.getItem("activeRole");
    const user = JSON.parse(localStorage.getItem("user"));

    // ADMIN always uses default school theme
    if (role === "admin") return "green";

    const theme = user?.department?.theme;

    return THEMES[theme] ? theme : "green";
  } catch {
    return "green";
  }
};

export function useTheme() {
  const [theme, setTheme] = useState("green");

  // Increment this to force the theme effect to re-run after a role switch.
  // Using a counter means the effect dependency is explicit and React will
  // always re-apply even if the theme key string happens to be the same value.
  const [refresh, setRefresh] = useState(0);

  const applyTheme = (themeKey) => {
    const resolvedKey = THEMES[themeKey] ? themeKey : "green";
    const vars = THEMES[resolvedKey].vars;
    const root = document.documentElement;
    Object.entries(vars).forEach(([key, value]) => {
      root.style.setProperty(key, value);
    });
    setTheme(resolvedKey);
  };

  // ── Listen for role/theme change events ───────────────────────────────────
  // Both "themeUpdated" (settings save) and "roleChanged" (dashboard switch)
  // increment the counter, which triggers the apply effect below.
  // A single event name would be cleaner, but supporting both ensures nothing
  // breaks if either dispatch exists anywhere in the codebase.
  useEffect(() => {
    const handle = () => setRefresh((prev) => prev + 1);

    window.addEventListener("userUpdated", handle);
    window.addEventListener("roleChanged", handle);
    window.addEventListener("storage", handle); // cross-tab

    return () => {
      window.removeEventListener("userUpdated", handle);
      window.removeEventListener("roleChanged", handle);
      window.removeEventListener("storage", handle);
    };
  }, []);

  // ── Apply theme on mount AND whenever refresh increments ─────────────────
  // Separating the listener (above) from the apply (here) means applyTheme
  // is never a stale dependency — it re-runs cleanly on every trigger.
  useEffect(() => {
    applyTheme(getThemeByRole());
  }, [refresh]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    theme,
    setTheme: applyTheme,
    themes: THEMES,
  };
}