export const getRole = (user) => {
  // If coordinator has multiple roles
  if (Array.isArray(user?.roles) && user.roles.length > 0) {
    return localStorage.getItem("activeRole") || user.roles[0];
  }

  // Fallback for student / admin
  return user?.role || "student";
};