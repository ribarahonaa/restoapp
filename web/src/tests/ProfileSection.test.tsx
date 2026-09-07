import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import i18n from "../i18n/index.js";
import { ProfileSection } from "../components/ProfileSection.js";
import * as profileClient from "../api/profileClient.js";
import type { Me } from "../auth/authClient.js";

const user: Me = { id: "u1", email: "a@a.cl", name: "Ana", role: "usuario", preferredLang: "es", avatarUrl: null };
vi.mock("../auth/AuthContext.js", () => ({
  useAuth: () => ({ user, status: "authed", refreshUser: vi.fn(), setUser: vi.fn() }),
}));

beforeEach(async () => { await i18n.changeLanguage("es"); vi.restoreAllMocks(); });

describe("ProfileSection", () => {
  it("editar nombre invoca updateName", async () => {
    const spy = vi.spyOn(profileClient, "updateName").mockResolvedValue({ ...user, name: "Ana2" });
    render(<ProfileSection />);
    fireEvent.click(screen.getByRole("button", { name: /editar nombre/i }));
    fireEvent.change(screen.getByDisplayValue("Ana"), { target: { value: "Ana2" } });
    fireEvent.click(screen.getByRole("button", { name: /guardar/i }));
    await waitFor(() => expect(spy).toHaveBeenCalledWith("Ana2"));
  });
});
