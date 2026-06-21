import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import "../i18n/index.js";
import i18n from "../i18n/index.js";
import { OwnerBranchesPage } from "../pages/admin/OwnerBranchesPage.js";
import * as owner from "../api/ownerClient.js";

beforeEach(async () => {
  await i18n.changeLanguage("es");
  vi.restoreAllMocks();
});

const sample = [
  { id: "b1", name: "Café Central", category: "cafe", address: "Plaza 1", active: true, closedUntil: null, imageUrl: null, businessId: "biz", businessName: "Grupo", plan: { maxPromos: 100, maxMenuItems: 500, maxBranches: 5 }, counts: { menuItems: 3, promotions: 2 } },
  { id: "b2", name: "Bar Norte", category: "bar", address: "Norte 2", active: false, closedUntil: null, imageUrl: null, businessId: "biz", businessName: "Grupo", plan: null, counts: { menuItems: 0, promotions: 0 } },
];

describe("OwnerBranchesPage", () => {
  it("lista las sucursales del dueño", async () => {
    vi.spyOn(owner, "listBranches").mockResolvedValue(sample as never);
    render(
      <MemoryRouter>
        <OwnerBranchesPage />
      </MemoryRouter>
    );
    expect(await screen.findByText("Café Central")).toBeInTheDocument();
    expect(screen.getByText("Bar Norte")).toBeInTheDocument();
    // cada tarjeta enlaza al editor
    const links = screen.getAllByRole("link");
    expect(links.some((l) => l.getAttribute("href") === "/admin/branches/b1")).toBe(true);
  });

  it("muestra estado inactivo", async () => {
    vi.spyOn(owner, "listBranches").mockResolvedValue(sample as never);
    render(
      <MemoryRouter>
        <OwnerBranchesPage />
      </MemoryRouter>
    );
    await waitFor(() => expect(screen.getByText("Bar Norte")).toBeInTheDocument());
    expect(screen.getByText(/inactiv/i)).toBeInTheDocument();
  });
});
