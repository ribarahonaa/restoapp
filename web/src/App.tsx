import { Routes, Route } from "react-router-dom";
import { HomePage } from "./pages/HomePage.js";
import { BranchDetailPage } from "./pages/BranchDetailPage.js";
import { LoginPage } from "./pages/admin/LoginPage.js";
import { AdminHome } from "./pages/admin/AdminHome.js";
import { RequireRole } from "./components/RequireRole.js";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/branch/:id" element={<BranchDetailPage />} />
      <Route path="/admin/login" element={<LoginPage />} />
      <Route
        path="/admin"
        element={
          <RequireRole roles={["superadmin", "admin_general", "admin_sucursal"]}>
            <AdminHome />
          </RequireRole>
        }
      />
    </Routes>
  );
}
