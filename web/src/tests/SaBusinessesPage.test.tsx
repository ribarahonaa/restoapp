import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import "../i18n/index.js";
import i18n from "../i18n/index.js";
import { SaBusinessesPage } from "../pages/admin/sa/SaBusinessesPage.js";
import * as sa from "../api/saClient.js";
import * as owner from "../api/ownerClient.js";

beforeEach(async () => {
  await i18n.changeLanguage("es");
  vi.restoreAllMocks();
  vi.spyOn(owner, "listPlans").mockResolvedValue([{ id: "p1", name: "Free", maxBranches: 1, maxPromos: 1, maxMenuItems: 10 }] as never);
});

const data = [
  { id: "biz1", name: "Grupo Demo", plan: { id: "p1", name: "Pro", maxBranches: 5, maxPromos: 100, maxMenuItems: 500 }, owner: { id: "u1", email: "o@d.cl", name: "Dueño" }, branches: [{ id: "br1", name: "Local Centro", category: "cafe", active: true }] },
];

describe("SaBusinessesPage", () => {
  it("muestra empresas con su dueño y sucursales", async () => {
    vi.spyOn(sa, "listBusinesses").mockResolvedValue(data as never);
    render(<MemoryRouter><SaBusinessesPage /></MemoryRouter>);
    expect(await screen.findByText("Grupo Demo")).toBeInTheDocument();
    expect(screen.getByText(/o@d\.cl/)).toBeInTheDocument();
    expect(screen.getByText("Local Centro")).toBeInTheDocument();
  });

  it("crea una sucursal en la empresa", async () => {
    vi.spyOn(sa, "listBusinesses").mockResolvedValue(data as never);
    const create = vi.spyOn(sa, "createSaBranch").mockResolvedValue({ id: "brNew" } as never);
    render(<MemoryRouter><SaBusinessesPage /></MemoryRouter>);
    await screen.findByText("Grupo Demo");
    fireEvent.click(screen.getByRole("button", { name: /\+ sucursal/i }));
    fireEvent.change(screen.getByLabelText(/nombre de la sucursal/i), { target: { value: "Suc Nueva" } });
    fireEvent.change(screen.getByLabelText(/dirección/i), { target: { value: "Calle 1" } });
    fireEvent.click(screen.getByRole("button", { name: /^crear sucursal$/i }));
    await waitFor(() => expect(create).toHaveBeenCalledWith("biz1", expect.objectContaining({ name: "Suc Nueva" })));
  });
});
