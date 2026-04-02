import Sidebar from "../../components/ui/Sidebar";
import TopBar from "../../components/ui/TopBar";
import { Outlet } from "react-router-dom";
import { useState, useEffect } from "react";
import { useTheme } from "../hooks/useTheme";

export default function MainLayout() {
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("user")) || null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    const syncUser = () => {
      try {
        const updatedUser = JSON.parse(localStorage.getItem("user"));
        setUser(updatedUser || null);
      } catch {
        setUser(null);
      }
    };

    window.addEventListener("userUpdated", syncUser);
    return () => {
      window.removeEventListener("userUpdated", syncUser);
    };
  }, []);

  useTheme();

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar
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