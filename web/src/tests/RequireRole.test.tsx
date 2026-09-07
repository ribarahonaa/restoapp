import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "../auth/AuthContext.js";
import { RequireRole } from "../components/RequireRole.js";
import * as authClient from "../auth/authClient.js";

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <Routes>
          <Route path="/admin/login" element={<div>LOGIN</div>} />
          <Route path="/admin" element={<div>ADMIN_HOME</div>} />
          <Route
            path="/admin/super"
            element={
              <RequireRole roles={["superadmin"]}>
                <div>SUPER_ONLY</div>
              </RequireRole>
            }
          />
        </Routes>
      </AuthProvider>
    </MemoryRouter>
  );
}

beforeEach(() => {
  localStorage.clear();
  authClient.clearSession();
  vi.restoreAllMocks();
});

describe("RequireRole", () => {
  it("redirige a login si no hay sesión", async () => {
    vi.spyOn(authClient, "hasRefreshToken").mockReturnValue(false);
    renderAt("/admin/super");
    expect(await screen.findByText("LOGIN")).toBeInTheDocument();
  });

  it("redirige a /admin si el rol no aplica", async () => {
    vi.spyOn(authClient, "hasRefreshToken").mockReturnValue(true);
    vi.spyOn(authClient, "me").mockResolvedValue({ id: "u1", email: "g@d.cl", name: "G", role: "admin_general", preferredLang: "es", avatarUrl: null });
    renderAt("/admin/super");
    expect(await screen.findByText("ADMIN_HOME")).toBeInTheDocument();
  });

  it("muestra el contenido si el rol aplica", async () => {
    vi.spyOn(authClient, "hasRefreshToken").mockReturnValue(true);
    vi.spyOn(authClient, "me").mockResolvedValue({ id: "u1", email: "s@d.cl", name: "S", role: "superadmin", preferredLang: "es", avatarUrl: null });
    renderAt("/admin/super");
    expect(await screen.findByText("SUPER_ONLY")).toBeInTheDocument();
  });
});
