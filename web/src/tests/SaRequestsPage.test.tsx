import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "../i18n/index.js";
import i18n from "../i18n/index.js";
import { SaRequestsPage } from "../pages/admin/sa/SaRequestsPage.js";
import * as sa from "../api/saClient.js";

beforeEach(async () => {
  await i18n.changeLanguage("es");
  vi.restoreAllMocks();
  vi.spyOn(sa, "listAdRequests").mockResolvedValue([] as never);
});

describe("SaRequestsPage", () => {
  it("lista y aprueba una solicitud de upgrade", async () => {
    vi.spyOn(sa, "listUpgradeRequests").mockResolvedValue([
      { id: "r1", status: "pending", note: null, createdAt: "x", business: { id: "b1", name: "Grupo Demo" }, requestedPlan: { id: "p", name: "Pro", maxBranches: 5 } },
    ] as never);
    const approve = vi.spyOn(sa, "approveUpgrade").mockResolvedValue({} as never);
    render(<SaRequestsPage />);
    expect(await screen.findByText(/Grupo Demo/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /aprobar/i }));
    await waitFor(() => expect(approve).toHaveBeenCalledWith("r1"));
  });
});
