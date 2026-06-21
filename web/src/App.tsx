import { Routes, Route } from "react-router-dom";
import { HomePage } from "./pages/HomePage.js";
import { BranchDetailPage } from "./pages/BranchDetailPage.js";
import { LoginPage } from "./pages/admin/LoginPage.js";
import { AdminHome } from "./pages/admin/AdminHome.js";
import { OwnerBranchesPage } from "./pages/admin/OwnerBranchesPage.js";
import { BranchEditorPage } from "./pages/admin/BranchEditorPage.js";
import { AdminLayout } from "./components/admin/AdminLayout.js";
import { RequireRole } from "./components/RequireRole.js";

const ADMIN_ROLES = ["superadmin", "admin_general", "admin_sucursal"] as const;

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/branch/:id" element={<BranchDetailPage />} />
      <Route path="/admin/login" element={<LoginPage />} />
      <Route
        path="/admin/*"
        element={
          <RequireRole roles={[...ADMIN_ROLES]}>
            <AdminLayout>
              <Routes>
                <Route path="" element={<AdminHome />} />
                <Route path="branches" element={<OwnerBranchesPage />} />
                <Route path="branches/:id" element={<BranchEditorPage />} />
              </Routes>
            </AdminLayout>
          </RequireRole>
        }
      />
    </Routes>
  );
}
