import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "../i18n/index.js";
import i18n from "../i18n/index.js";
import { MenuManager } from "../components/admin/MenuManager.js";
import * as owner from "../api/ownerClient.js";
import type { OwnerBranchDetail } from "../api/ownerTypes.js";

beforeEach(async () => {
  await i18n.changeLanguage("es");
  vi.restoreAllMocks();
});

function branchWith(menuCount: number, max: number | null): OwnerBranchDetail {
  return {
    id: "b1", name: "L", category: "cafe", address: "x", lat: 0, lng: 0, phone: null, description: null,
    imageUrl: null, closedUntil: null, active: true, businessId: "biz",
    business: { id: "biz", name: "G", plan: max == null ? null : { id: "p", name: "Free", maxPromos: 1, maxMenuItems: max, maxBranches: 1 } },
    hours: [],
    menuItems: Array.from({ length: menuCount }, (_, i) => ({ id: `m${i}`, name: `Item ${i}`, description: null, price: "1000", category: null, imageUrl: null })),
    promotions: [], discountCodes: [],
  };
}

describe("MenuManager", () => {
  it("crea un ítem y recarga", async () => {
    const create = vi.spyOn(owner, "createMenuItem").mockResolvedValue({ id: "mX" } as never);
    const onChange = vi.fn();
    render(<MenuManager branch={branchWith(1, 10)} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText(/nombre del ítem/i), { target: { value: "Latte" } });
    fireEvent.change(screen.getByLabelText(/precio/i), { target: { value: "3000" } });
    fireEvent.click(screen.getByRole("button", { name: /agregar ítem/i }));
    await waitFor(() => expect(create).toHaveBeenCalledWith("b1", expect.objectContaining({ name: "Latte", price: 3000 })));
    expect(onChange).toHaveBeenCalled();
  });

  it("al topar el límite muestra solicitar upgrade y oculta el form de agregar", () => {
    render(<MenuManager branch={branchWith(10, 10)} onChange={vi.fn()} />);
    expect(screen.getByText(/límite/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /solicitar upgrade/i })).toBeInTheDocument();
    expect(screen.queryByLabelText(/nombre del ítem/i)).not.toBeInTheDocument();
  });

  it("elimina un ítem", async () => {
    const del = vi.spyOn(owner, "deleteMenuItem").mockResolvedValue(undefined as never);
    const onChange = vi.fn();
    render(<MenuManager branch={branchWith(1, 10)} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: /eliminar/i }));
    await waitFor(() => expect(del).toHaveBeenCalledWith("b1", "m0"));
    expect(onChange).toHaveBeenCalled();
  });
});
