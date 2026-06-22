import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "../i18n/index.js";
import i18n from "../i18n/index.js";
import { PromotionsManager } from "../components/admin/PromotionsManager.js";
import * as owner from "../api/ownerClient.js";
import type { OwnerBranchDetail } from "../api/ownerTypes.js";

beforeEach(async () => {
  await i18n.changeLanguage("es");
  vi.restoreAllMocks();
});

function branchWith(promoCount: number, max: number): OwnerBranchDetail {
  return {
    id: "b1", name: "L", category: "cafe", address: "x", lat: 0, lng: 0, phone: null, description: null,
    imageUrl: null, closedUntil: null, active: true, businessId: "biz",
    business: { id: "biz", name: "G", plan: { id: "p", name: "Free", maxPromos: max, maxMenuItems: 10, maxBranches: 1 } },
    hours: [], menuItems: [],
    promotions: Array.from({ length: promoCount }, (_, i) => ({ id: `p${i}`, title: `Promo ${i}`, description: null, imageUrl: null, startsAt: "2026-01-01T00:00:00.000Z", endsAt: "2026-12-01T00:00:00.000Z", active: true })),
    discountCodes: [],
  };
}

describe("PromotionsManager", () => {
  it("crea una promo", async () => {
    const create = vi.spyOn(owner, "createPromotion").mockResolvedValue({ id: "pX" } as never);
    const onChange = vi.fn();
    render(<PromotionsManager branch={branchWith(0, 5)} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText(/título/i), { target: { value: "2x1" } });
    fireEvent.change(screen.getByLabelText(/desde/i), { target: { value: "2026-07-01T10:00" } });
    fireEvent.change(screen.getByLabelText(/hasta/i), { target: { value: "2026-07-31T23:00" } });
    fireEvent.click(screen.getByRole("button", { name: /agregar promo/i }));
    await waitFor(() => expect(create).toHaveBeenCalledWith("b1", expect.objectContaining({ title: "2x1" })));
    expect(onChange).toHaveBeenCalled();
  });

  it("edita una promo existente", async () => {
    const update = vi.spyOn(owner, "updatePromotion").mockResolvedValue({ id: "p0" } as never);
    const onChange = vi.fn();
    render(<PromotionsManager branch={branchWith(1, 5)} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: /editar/i }));
    fireEvent.change(screen.getByLabelText(/título/i), { target: { value: "Nuevo Título" } });
    fireEvent.click(screen.getByRole("button", { name: /guardar cambios/i }));
    await waitFor(() => expect(update).toHaveBeenCalledWith("b1", "p0", expect.objectContaining({ title: "Nuevo Título" })));
    expect(onChange).toHaveBeenCalled();
  });

  it("al topar el límite muestra solicitar upgrade", () => {
    render(<PromotionsManager branch={branchWith(1, 1)} onChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: /solicitar upgrade/i })).toBeInTheDocument();
  });
});
