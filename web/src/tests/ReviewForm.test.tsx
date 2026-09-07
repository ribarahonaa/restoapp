import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import i18n from "../i18n/index.js";
import { ReviewForm } from "../components/ReviewForm.js";
import * as authCtx from "../auth/AuthContext.js";
import * as geoHook from "../hooks/useGeolocation.js";
import * as client from "../api/client.js";

function mockAuth(status: "authed" | "anon") {
  vi.spyOn(authCtx, "useAuth").mockReturnValue({
    user: status === "authed" ? { id: "u1", email: "a@a.cl", name: "Ana", role: "usuario", preferredLang: "es" } : null,
    status,
    signIn: vi.fn(),
    signUp: vi.fn(),
    signOut: vi.fn(),
  } as never);
}

const locate = vi.fn();

beforeEach(async () => {
  await i18n.changeLanguage("es");
  vi.restoreAllMocks();
  locate.mockReset();
});

describe("ReviewForm — estados de presencia", () => {
  it("sin GPS: muestra aviso y botón para ubicarse", () => {
    mockAuth("authed");
    vi.spyOn(geoHook, "useGeolocation").mockReturnValue({ status: "denied", locate } as never);
    render(<ReviewForm branchId="b1" onAdded={vi.fn()} />);
    expect(screen.getByText("Activa la ubicación para poder reseñar")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Ubicarme" }));
    expect(locate).toHaveBeenCalled();
  });

  it("no_checkin: muestra botón de check-in, hace check-in y reconsulta elegibilidad", async () => {
    mockAuth("authed");
    vi.spyOn(geoHook, "useGeolocation").mockReturnValue({ status: "ready", lat: -33.4, lng: -70.6, locate } as never);
    const eligSpy = vi
      .spyOn(client, "getReviewEligibility")
      .mockResolvedValueOnce({ eligible: false, reason: "no_checkin" })
      .mockResolvedValueOnce({ eligible: true });
    const checkInSpy = vi.spyOn(client, "checkIn").mockResolvedValue({ ok: true });

    render(<ReviewForm branchId="b1" onAdded={vi.fn()} />);

    const btn = await screen.findByRole("button", { name: "Estoy aquí (check-in)" });
    fireEvent.click(btn);

    await waitFor(() => expect(checkInSpy).toHaveBeenCalledWith("b1", -33.4, -70.6));
    await waitFor(() => expect(eligSpy).toHaveBeenCalledTimes(2));
    expect(await screen.findByText("Deja tu reseña")).toBeInTheDocument();
  });

  it("too_far: muestra mensaje y botón de check-in", async () => {
    mockAuth("authed");
    vi.spyOn(geoHook, "useGeolocation").mockReturnValue({ status: "ready", lat: -33.4, lng: -70.6, locate } as never);
    vi.spyOn(client, "getReviewEligibility").mockResolvedValue({ eligible: false, reason: "too_far" });

    render(<ReviewForm branchId="b1" onAdded={vi.fn()} />);

    expect(await screen.findByText("Acércate al local para hacer check-in")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Estoy aquí (check-in)" })).toBeInTheDocument();
  });

  it("too_soon: muestra minutos de espera", async () => {
    mockAuth("authed");
    vi.spyOn(geoHook, "useGeolocation").mockReturnValue({ status: "ready", lat: -33.4, lng: -70.6, locate } as never);
    const canReviewAt = new Date(Date.now() + 10 * 60_000).toISOString();
    vi.spyOn(client, "getReviewEligibility").mockResolvedValue({ eligible: false, reason: "too_soon", canReviewAt });

    render(<ReviewForm branchId="b1" onAdded={vi.fn()} />);

    expect(await screen.findByText(/Podrás reseñar en ~10 min/)).toBeInTheDocument();
  });

  it("eligible: muestra el formulario y envía la reseña con lat/lng", async () => {
    mockAuth("authed");
    vi.spyOn(geoHook, "useGeolocation").mockReturnValue({ status: "ready", lat: -33.4, lng: -70.6, locate } as never);
    vi.spyOn(client, "getReviewEligibility").mockResolvedValue({ eligible: true });
    const addReviewSpy = vi
      .spyOn(client, "addReview")
      .mockResolvedValue({ review: { id: "r1", authorName: "Ana", rating: 5, comment: null, createdAt: "now", verified: true }, ratingAvg: 5, ratingCount: 1 });
    const onAdded = vi.fn();

    render(<ReviewForm branchId="b1" onAdded={onAdded} />);

    await screen.findByText("Deja tu reseña");
    fireEvent.click(screen.getByLabelText("5"));
    fireEvent.submit(screen.getByRole("button", { name: "Publicar reseña" }).closest("form")!);

    await waitFor(() =>
      expect(addReviewSpy).toHaveBeenCalledWith("b1", { rating: 5, comment: undefined, lat: -33.4, lng: -70.6 })
    );
    await waitFor(() => expect(onAdded).toHaveBeenCalled());
  });
});
