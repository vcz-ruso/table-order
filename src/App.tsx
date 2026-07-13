import { Navigate, Route, Routes } from "react-router-dom";
import { CustomerHome } from "./routes/customer/CustomerHome";
import { AdminHome } from "./routes/admin/AdminHome";

export function App() {
  return (
    <Routes>
      {/* 기본 화면은 고객용 메뉴 화면 */}
      <Route path="/" element={<Navigate to="/customer" replace />} />
      <Route path="/customer/*" element={<CustomerHome />} />
      <Route path="/admin/*" element={<AdminHome />} />
    </Routes>
  );
}
