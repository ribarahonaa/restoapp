import { Routes, Route, Navigate } from "react-router-dom";
import { HomePage } from "./pages/HomePage.js";
import { BranchDetailPage } from "./pages/BranchDetailPage.js";
import { LoginPage } from "./pages/admin/LoginPage.js";
import { OwnerBranchesPage } from "./pages/admin/OwnerBranchesPage.js";
import { BranchEditorPage } from "./pages/admin/BranchEditorPage.js";
import { CreateBranchPage } from "./pages/admin/CreateBranchPage.js";
import { AdminLayout } from "./components/admin/AdminLayout.js";
import { RequireRole } from "./components/RequireRole.js";
import { SaBusinessesPage } from "./pages/admin/sa/SaBusinessesPage.js";
import { SaAdsPage } from "./pages/admin/sa/SaAdsPage.js";
import { SaRequestsPage } from "./pages/admin/sa/SaRequestsPage.js";

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
                <Route path="" element={<Navigate to="/admin/branches" replace />} />
                <Route path="branches" element={<OwnerBranchesPage />} />
                <Route path="branches/new" element={<CreateBranchPage />} />
                <Route path="branches/:id" element={<BranchEditorPage />} />
                <Route path="superadmin/businesses" element={<RequireRole roles={["superadmin"]}><SaBusinessesPage /></RequireRole>} />
                <Route path="superadmin/ads" element={<RequireRole roles={["superadmin"]}><SaAdsPage /></RequireRole>} />
                <Route path="superadmin/requests" element={<RequireRole roles={["superadmin"]}><SaRequestsPage /></RequireRole>} />
              </Routes>
            </AdminLayout>
          </RequireRole>
        }
      />
    </Routes>
  );
}
