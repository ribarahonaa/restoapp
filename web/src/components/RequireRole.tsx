import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.js";
import type { Role } from "../auth/authClient.js";

export function RequireRole({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const { user, status } = useAuth();
  if (status === "loading") {
    return <div className="grid h-screen place-items-center text-mute">…</div>;
  }
  if (!user) return <Navigate to="/admin/login" replace />;
  if (!roles.includes(user.role)) return <Navigate to="/admin" replace />;
  return <>{children}</>;
}
