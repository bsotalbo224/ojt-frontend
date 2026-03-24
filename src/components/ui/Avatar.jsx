import { useState } from "react";
import { User } from "lucide-react";

const SIZE_MAP = {
  sm: { box: "w-8 h-8", icon: 14 },
  md: { box: "w-9 h-9", icon: 16 },
  lg: { box: "w-12 h-12", icon: 22 },
  xl: { box: "w-16 h-16", icon: 28 },
};

const getInitials = (name) => {
  if (!name || !name.trim()) return null;
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

export default function Avatar({ name = "", src = "", size = "md", className = "" }) {
  const [imgError, setImgError] = useState(false);

  const { box, icon } = SIZE_MAP[size] ?? SIZE_MAP.md;
  const initials = getInitials(name);
  const showImage = src && !imgError;

  const base = `${box} rounded-full flex-shrink-0 overflow-hidden ${className}`;

  if (showImage) {
    return (
      <img
        src={src}
        alt={name || "Avatar"}
        onError={() => setImgError(true)}
        className={`${base} object-cover object-center`}
      />
    );
  }

  return (
    <div
      style={{
        backgroundColor: `rgb(var(--avatar-bg))`,
        color: `rgb(var(--avatar-icon))`
      }}
      className={`${base} flex items-center justify-center select-none`}
      title={name || undefined}
      aria-label={initials ? `${name} avatar` : "Avatar"}
    >
      <User size={icon} strokeWidth={2} />
    </div>
  );
}