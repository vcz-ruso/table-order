import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./AuthContext";
import type { Role } from "../lib/types";

/** 로그인 필요. 미인증 시 로그인 화면으로 이동. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) {
    return <div className="admin-loading">불러오는 중…</div>;
  }
  if (!user) {
    return <Navigate to="/admin/login" replace state={{ from: location.pathname }} />;
  }
  return <>{children}</>;
}

/** 특정 역할만 접근 가능. 권한 없으면 안내 메시지 표시. */
export function RequireRole({ role, children }: { role: Role; children: ReactNode }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/admin/login" replace />;
  if (user.role !== role) {
    return (
      <div className="admin-forbidden" role="alert">
        <h2>권한이 없습니다</h2>
        <p>이 기능은 Manager 계정만 사용할 수 있습니다.</p>
      </div>
    );
  }
  return <>{children}</>;
}
