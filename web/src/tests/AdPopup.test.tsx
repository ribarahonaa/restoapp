import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import "../i18n/index.js";
import i18n from "../i18n/index.js";
import { AdPopup } from "../components/AdPopup.js";
import * as client from "../api/client.js";

beforeEach(async () => {
  await i18n.changeLanguage("es");
  vi.restoreAllMocks();
  sessionStorage.clear();
});

const ad = { id: "a1", businessId: "b1", branchId: null, title: "Gran Promo", description: "desc", imageUrl: null, startsAt: "x", endsAt: "y", distance: 100 };

describe("AdPopup", () => {
  it("muestra el popup la primera vez y no la segunda (sessionStorage)", async () => {
    vi.spyOn(client, "getPopupAd").mockResolvedValue(ad as never);
    const { unmount } = render(<AdPopup lat={-33.4} lng={-70.6} />);
    expect(await screen.findByText("Gran Promo")).toBeInTheDocument();
    unmount();
    // segunda vez: ya está marcado en sessionStorage → no se muestra
    render(<AdPopup lat={-33.4} lng={-70.6} />);
    await waitFor(() => {});
    expect(screen.queryByText("Gran Promo")).not.toBeInTheDocument();
  });

  it("no renderiza nada si no hay popup", async () => {
    vi.spyOn(client, "getPopupAd").mockResolvedValue(null);
    render(<AdPopup lat={-33.4} lng={-70.6} />);
    await waitFor(() => {});
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
