import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";

export function AdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [loggingOut, setLoggingOut] = useState(false);

  const isOwner = user?.role === "owner";

  const handleLogout = async () => {
    setLoggingOut(true);
    await logout();
    navigate("/admin/login", { replace: true });
  };

  return (
    <div className="admin-root">
      <aside className="admin-sidebar">
        <div className="admin-brand">테이블오더</div>
        <div className="admin-store">
          {user?.storeName} <span className="muted">({user?.storeCode})</span>
        </div>
        <nav className="admin-nav">
          <NavLink to="/admin/dashboard">주문 대시보드</NavLink>
          <NavLink to="/admin/tables">테이블 관리</NavLink>
          {isOwner && <NavLink to="/admin/menus">메뉴 관리</NavLink>}
          {isOwner && <NavLink to="/admin/sales">매출</NavLink>}
          {isOwner && <NavLink to="/admin/inventory">재고</NavLink>}
        </nav>
        <div className="admin-user-box">
          <div>
            {user?.username}
            <span className="role">{isOwner ? "Owner" : "Staff"}</span>
          </div>
          <button
            className="btn btn-sm"
            style={{ marginTop: 10, width: "100%" }}
            onClick={handleLogout}
            disabled={loggingOut}
          >
            {loggingOut ? "로그아웃 중…" : "로그아웃"}
          </button>
        </div>
      </aside>
      <main className="admin-main">
        <Outlet />
      </main>
    </div>
  );
}
