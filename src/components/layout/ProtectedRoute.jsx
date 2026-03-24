import { Navigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

export default function ProtectedRoute({ children, roles }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  // Not logged in
  if (!user) {
    return <Navigate to="/" replace />;
  }

  // Role protection
  if (roles && roles.length > 0) {

    const userRoles = user.roles || [];

    const allowed = userRoles.some(role =>
      roles.includes(role)
    );

    if (!allowed) {
      return <Navigate to="/" replace />;
    }

  }

  return children;
}