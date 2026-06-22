import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "../i18n/index.js";
import i18n from "../i18n/index.js";
import { DiscountsManager } from "../components/admin/DiscountsManager.js";
import * as owner from "../api/ownerClient.js";
import * as authCtx from "../auth/AuthContext.js";
import type { OwnerBranchDetail } from "../api/ownerTypes.js";

function branch(): OwnerBranchDetail {
  return {
    id: "b1", name: "L", category: "cafe", address: "x", lat: 0, lng: 0, phone: null, description: null,
    imageUrl: null, closedUntil: null, active: true, businessId: "biz",
    business: { id: "biz", name: "G", plan: null },
    hours: [], menuItems: [], promotions: [],
    discountCodes: [{ id: "d0", code: "OLD", type: "percent", value: "10", startsAt: "2026-01-01T00:00:00.000Z", endsAt: "2026-12-01T00:00:00.000Z", branchId: "b1", active: true }],
  };
}
function mockAuth(role: string) {
  vi.spyOn(authCtx, "useAuth").mockReturnValue({ user: { id: "u", email: "e", name: "n", role, preferredLang: "es" }, status: "authed", signIn: vi.fn(), signOut: vi.fn() } as never);
}

beforeEach(async () => {
  await i18n.changeLanguage("es");
  vi.restoreAllMocks();
});

describe("DiscountsManager", () => {
  it("admin_general puede elegir alcance cadena y crear", async () => {
    mockAuth("admin_general");
    const create = vi.spyOn(owner, "createDiscount").mockResolvedValue({ id: "dX" } as never);
    const onChange = vi.fn();
    render(<DiscountsManager branch={branch()} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText(/código/i), { target: { value: "VERANO" } });
    fireEvent.change(screen.getByLabelText(/valor/i), { target: { value: "20" } });
    fireEvent.change(screen.getByLabelText(/desde/i), { target: { value: "2026-07-01T00:00" } });
    fireEvent.change(screen.getByLabelText(/hasta/i), { target: { value: "2026-08-01T00:00" } });
    fireEvent.click(screen.getByRole("button", { name: /crear código/i }));
    await waitFor(() => expect(create).toHaveBeenCalledWith("b1", expect.objectContaining({ code: "VERANO", value: 20 })));
    expect(onChange).toHaveBeenCalled();
  });

  it("edita un código de descuento existente", async () => {
    mockAuth("admin_general");
    const update = vi.spyOn(owner, "updateDiscount").mockResolvedValue({ id: "d0" } as never);
    const onChange = vi.fn();
    render(<DiscountsManager branch={branch()} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: /editar/i }));
    fireEvent.change(screen.getByLabelText(/código/i), { target: { value: "NUEVO" } });
    fireEvent.click(screen.getByRole("button", { name: /guardar cambios/i }));
    await waitFor(() => expect(update).toHaveBeenCalledWith("b1", "d0", expect.objectContaining({ code: "NUEVO" })));
    expect(onChange).toHaveBeenCalled();
  });

  it("admin_sucursal NO ve la opción de alcance cadena", () => {
    mockAuth("admin_sucursal");
    render(<DiscountsManager branch={branch()} onChange={vi.fn()} />);
    expect(screen.queryByLabelText(/alcance/i)).not.toBeInTheDocument();
  });
});
