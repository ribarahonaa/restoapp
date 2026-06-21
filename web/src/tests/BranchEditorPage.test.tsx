import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import "../i18n/index.js";
import i18n from "../i18n/index.js";
import { BranchEditorPage } from "../pages/admin/BranchEditorPage.js";
import * as owner from "../api/ownerClient.js";
import * as authCtx from "../auth/AuthContext.js";

const detail = {
  id: "b1", name: "Café Central", category: "cafe", address: "Plaza 1", lat: -33.43, lng: -70.65,
  phone: null, description: "Rico café", imageUrl: null, closedUntil: null, active: true,
  businessId: "biz", business: { id: "biz", name: "Grupo", plan: null },
  hours: [], menuItems: [], promotions: [], discountCodes: [],
};

function setup(role = "admin_general") {
  vi.spyOn(authCtx, "useAuth").mockReturnValue({
    user: { id: "u1", email: "o@d.cl", name: "Dueño", role, preferredLang: "es" },
    status: "authed", signIn: vi.fn(), signOut: vi.fn(),
  } as never);
  return render(
    <MemoryRouter initialEntries={["/admin/branches/b1"]}>
      <Routes>
        <Route path="/admin/branches/:id" element={<BranchEditorPage />} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(async () => {
  await i18n.changeLanguage("es");
  vi.restoreAllMocks();
  vi.spyOn(owner, "getOwnerBranch").mockResolvedValue(detail as never);
  vi.spyOn(owner, "replaceHours").mockResolvedValue([] as never);
});

describe("BranchEditorPage", () => {
  it("carga los datos y guarda los cambios", async () => {
    const update = vi.spyOn(owner, "updateBranch").mockResolvedValue({} as never);
    setup();
    const nameInput = (await screen.findByLabelText(/nombre/i)) as HTMLInputElement;
    expect(nameInput.value).toBe("Café Central");
    fireEvent.change(nameInput, { target: { value: "Café Nuevo" } });
    fireEvent.click(screen.getByRole("button", { name: /guardar/i }));
    await waitFor(() =>
      expect(update).toHaveBeenCalledWith("b1", expect.objectContaining({ name: "Café Nuevo" }))
    );
  });

  it("oculta el control de activar/desactivar para admin_sucursal", async () => {
    setup("admin_sucursal");
    await screen.findByLabelText(/nombre/i);
    expect(screen.queryByText(/desactivar local/i)).not.toBeInTheDocument();
  });
});
