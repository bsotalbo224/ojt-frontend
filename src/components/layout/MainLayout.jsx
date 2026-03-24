import Sidebar from "../../components/ui/Sidebar";
import TopBar from "../../components/ui/TopBar";
import { Outlet } from "react-router-dom";
import { useState, useEffect } from "react";
import { useTheme } from "../hooks/useTheme";

export default function MainLayout({ role }) {
  // Seed from localStorage — DashboardSelect writes correct role-specific user
  // before navigating here, so this initial read is always up-to-date.
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("user")) || null;
    } catch {
      return null;
    }
  });

  // Re-sync user state when DashboardSelect or SettingsPage dispatches
  // "roleChanged" or "themeUpdated" after updating localStorage.
  useEffect(() => {
    const syncUser = () => {
      try {
        const updatedUser = JSON.parse(localStorage.getItem("user"));
        setUser(updatedUser || null);
      } catch {
        setUser(null);
      }
    };
    window.addEventListener("roleChanged",  syncUser);
    window.addEventListener("userUpdated", syncUser);
    return () => {
      window.removeEventListener("roleChanged",  syncUser);
      window.removeEventListener("userUpdated", syncUser);
    };
  }, []);

  useTheme();

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden">

      {/* Sidebar receives the full user object so it can derive
          name, department, and role label based on activeRole itself. */}
      <Sidebar
        role={role}
        user={user}
        isOpen={isSidebarOpen}
        setIsOpen={setIsSidebarOpen}
      />

      <div className="flex-1 bg-white flex flex-col overflow-hidden">
        <TopBar
          onMenuClick={() => setIsSidebarOpen(true)}
          user={user}
        />

        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}