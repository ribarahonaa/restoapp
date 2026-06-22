import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import "../i18n/index.js";
import i18n from "../i18n/index.js";
import { CreateBranchPage } from "../pages/admin/CreateBranchPage.js";
import * as owner from "../api/ownerClient.js";

const summaries = [{ id: "b1", name: "L", category: "cafe", address: "x", active: true, closedUntil: null, imageUrl: null, businessId: "biz", businessName: "G", plan: { maxPromos: 1, maxMenuItems: 10, maxBranches: 5 }, counts: { menuItems: 0, promotions: 0 } }];

beforeEach(async () => {
  await i18n.changeLanguage("es");
  vi.restoreAllMocks();
  vi.spyOn(owner, "listBranches").mockResolvedValue(summaries as never);
});

describe("CreateBranchPage", () => {
  it("crea una sucursal en el business del dueño", async () => {
    const create = vi.spyOn(owner, "createBranch").mockResolvedValue({ id: "bNew" } as never);
    render(
      <MemoryRouter>
        <CreateBranchPage />
      </MemoryRouter>
    );
    await screen.findByLabelText(/nombre/i);
    fireEvent.change(screen.getByLabelText(/nombre/i), { target: { value: "Nueva" } });
    fireEvent.change(screen.getByLabelText(/dirección/i), { target: { value: "Calle 1" } });
    fireEvent.click(screen.getByRole("button", { name: /crear sucursal/i }));
    await waitFor(() =>
      expect(create).toHaveBeenCalledWith(expect.objectContaining({ businessId: "biz", name: "Nueva", address: "Calle 1" }))
    );
  });

  it("muestra solicitar upgrade si excede el límite", async () => {
    vi.spyOn(owner, "createBranch").mockRejectedValue(new owner.LimitError("plan_limit_branches"));
    render(
      <MemoryRouter>
        <CreateBranchPage />
      </MemoryRouter>
    );
    await screen.findByLabelText(/nombre/i);
    fireEvent.change(screen.getByLabelText(/nombre/i), { target: { value: "N" } });
    fireEvent.change(screen.getByLabelText(/dirección/i), { target: { value: "C" } });
    fireEvent.click(screen.getByRole("button", { name: /crear sucursal/i }));
    await waitFor(() => expect(screen.getByText(/límite/i)).toBeInTheDocument());
  });
});
