import { Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "../../auth/AuthContext";
import { RequireAuth, RequireRole } from "../../auth/guards";
import { AdminLayout } from "./AdminLayout";
import { LoginPage } from "./LoginPage";
import { DashboardPage } from "./DashboardPage";
import { TableManagePage } from "./TableManagePage";
import { MenuManagePage } from "./MenuManagePage";
import { SalesPage } from "./SalesPage";
import { InventoryPage } from "./InventoryPage";
import "./admin.css";

export function AdminHome() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="login" element={<LoginPage />} />
        <Route
          element={
            <RequireAuth>
              <AdminLayout />
            </RequireAuth>
          }
        >
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="tables" element={<TableManagePage />} />
          <Route
            path="menus"
            element={
              <RequireRole role="owner">
                <MenuManagePage />
              </RequireRole>
            }
          />
          <Route
            path="sales"
            element={
              <RequireRole role="owner">
                <SalesPage />
              </RequireRole>
            }
          />
          <Route
            path="inventory"
            element={
              <RequireRole role="owner">
                <InventoryPage />
              </RequireRole>
            }
          />
          <Route path="*" element={<Navigate to="dashboard" replace />} />
        </Route>
      </Routes>
    </AuthProvider>
  );
}
