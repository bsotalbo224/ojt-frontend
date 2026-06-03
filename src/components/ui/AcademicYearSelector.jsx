import { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronDown, GraduationCap, Check, Settings2 } from "lucide-react";
import { getAcademicYears, getActiveAcademicYear, activateAcademicYear } from "../../api/academicYears";
import { useAuth } from "../../context/AuthContext";

const AcademicYearSelector = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isAdmin = user?.role === "admin";

  const [years, setYears] = useState([]);
  const [activeYear, setActiveYear] = useState(null);
  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState(false);

  const dropdownRef = useRef(null);

  const loadYears = useCallback(async () => {
    try {
      const [allRes, activeRes] = await Promise.all([
        getAcademicYears(),
        getActiveAcademicYear(),
      ]);
      if (allRes.data?.success) setYears(allRes.data.academicYears || []);
      if (activeRes.data?.success) setActiveYear(activeRes.data.academicYear || null);
    } catch (err) {
      console.error("Failed to load academic years:", err);
    }
  }, []);

  useEffect(() => {
    loadYears();
  }, [loadYears]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const handleSelect = async (year) => {
    if (switching || year.id === activeYear?.id) {
      setOpen(false);
      return;
    }
    try {
      setSwitching(true);
      await activateAcademicYear(year.id);
      const res = await getActiveAcademicYear();
      if (res.data?.success) setActiveYear(res.data.academicYear || null);
      window.dispatchEvent(new CustomEvent("academicYearChanged"));
    } catch (err) {
      console.error("Failed to activate academic year:", err);
    } finally {
      setSwitching(false);
      setOpen(false);
    }
  };

  const handleManage = () => {
    setOpen(false);
    navigate("/admin/academic-years");
  };

  const label = activeYear?.year_label ?? activeYear?.name ?? "Select Year";

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-haspopup="true"
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border transition-all text-sm font-medium"
        style={{
          borderColor: open
            ? `rgb(var(--primary-light))`
            : `rgb(var(--primary-light) / 0.35)`,
          color: `rgb(var(--primary-text))`,
          backgroundColor: open
            ? `rgb(var(--primary-light) / 0.1)`
            : "transparent",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = `rgb(var(--primary-light))`;
          e.currentTarget.style.backgroundColor = `rgb(var(--primary-light) / 0.08)`;
        }}
        onMouseLeave={(e) => {
          if (!open) {
            e.currentTarget.style.borderColor = `rgb(var(--primary-light) / 0.35)`;
            e.currentTarget.style.backgroundColor = "transparent";
          }
        }}
      >
        <GraduationCap size={15} style={{ color: `rgb(var(--primary-text))` }} />
        <span className="hidden sm:inline max-w-30 truncate">{label}</span>
        <ChevronDown
          size={13}
          className="transition-transform duration-200 shrink-0"
          style={{
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
            color: `rgb(var(--primary-text))`,
          }}
        />
      </button>

      {/* Dropdown */}
      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-3 w-60 bg-white border border-gray-100 rounded-2xl shadow-xl overflow-hidden z-50"
        >
          {/* Header */}
          <div
            style={{
              background: `linear-gradient(to right, rgb(var(--primary)), rgb(var(--primary-medium)))`,
            }}
            className="px-4 py-3 flex items-center gap-2"
          >
            <GraduationCap size={15} className="text-white shrink-0" />
            <span className="text-sm font-semibold text-white">Academic Year</span>
          </div>

          {/* Year List */}
          <ul className="max-h-56 overflow-y-auto py-1">
            {years.length === 0 ? (
              <li className="px-4 py-4 text-center text-xs text-gray-400">
                No academic years found.
              </li>
            ) : (
              years.map((year) => {
                const isActive = year.id === activeYear?.id;
                const yearLabel = year.year_label ?? year.name ?? `Year ${year.id}`;
                return (
                  <li key={year.id}>
                    <button
                      role="menuitem"
                      disabled={switching}
                      onClick={() => handleSelect(year)}
                      className="w-full text-left flex items-center justify-between px-4 py-2.5 text-sm transition-colors hover:bg-gray-50 disabled:opacity-50"
                      style={isActive ? { color: `rgb(var(--primary-text))` } : { color: "#374151" }}
                    >
                      <span className={isActive ? "font-semibold" : "font-medium"}>
                        {yearLabel}
                      </span>
                      {isActive && (
                        <Check
                          size={14}
                          strokeWidth={2.5}
                          style={{ color: `rgb(var(--primary-text))` }}
                          className="shrink-0"
                        />
                      )}
                    </button>
                  </li>
                );
              })
            )}
          </ul>

          {/* Manage (Admin only) */}
          {isAdmin && (
            <div className="border-t border-gray-100 px-2 py-1.5">
              <button
                role="menuitem"
                onClick={handleManage}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 rounded-xl transition-colors"
              >
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: `rgb(var(--primary-light) / 0.15)` }}
                >
                  <Settings2 size={13} style={{ color: `rgb(var(--primary-text))` }} />
                </div>
                Manage Academic Years
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AcademicYearSelector;