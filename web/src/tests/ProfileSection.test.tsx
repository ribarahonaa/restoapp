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

  it("cambiar contraseña con error no-invalid_password muestra el mensaje genérico (no wrongPassword)", async () => {
    vi.spyOn(profileClient, "changePassword").mockRejectedValue(new Error("HTTP 500"));
    render(<ProfileSection />);
    fireEvent.click(screen.getByRole("button", { name: /cambiar contraseña/i }));
    fireEvent.change(screen.getByPlaceholderText(/contraseña actual/i), { target: { value: "oldpass" } });
    fireEvent.change(screen.getByPlaceholderText(/nueva contraseña/i), { target: { value: "newpassword" } });
    fireEvent.click(screen.getByRole("button", { name: /guardar/i }));
    await waitFor(() => expect(screen.getByText("No se pudo guardar los cambios")).toBeInTheDocument());
    expect(screen.queryByText("La contraseña actual no es correcta")).not.toBeInTheDocument();
  });

  it("cambiar contraseña con invalid_password muestra el mensaje específico", async () => {
    vi.spyOn(profileClient, "changePassword").mockRejectedValue(new Error("invalid_password"));
    render(<ProfileSection />);
    fireEvent.click(screen.getByRole("button", { name: /cambiar contraseña/i }));
    fireEvent.change(screen.getByPlaceholderText(/contraseña actual/i), { target: { value: "oldpass" } });
    fireEvent.change(screen.getByPlaceholderText(/nueva contraseña/i), { target: { value: "newpassword" } });
    fireEvent.click(screen.getByRole("button", { name: /guardar/i }));
    await waitFor(() => expect(screen.getByText("La contraseña actual no es correcta")).toBeInTheDocument());
  });

  it("cambiar contraseña con validation_error muestra passwordTooShort (no wrongPassword)", async () => {
    vi.spyOn(profileClient, "changePassword").mockRejectedValue(new Error("validation_error"));
    render(<ProfileSection />);
    fireEvent.click(screen.getByRole("button", { name: /cambiar contraseña/i }));
    fireEvent.change(screen.getByPlaceholderText(/contraseña actual/i), { target: { value: "oldpass" } });
    fireEvent.change(screen.getByPlaceholderText(/nueva contraseña/i), { target: { value: "newpassx" } });
    fireEvent.click(screen.getByRole("button", { name: /guardar/i }));
    await waitFor(() =>
      expect(screen.getByText("La nueva contraseña debe tener al menos 8 caracteres")).toBeInTheDocument(),
    );
    expect(screen.queryByText("La contraseña actual no es correcta")).not.toBeInTheDocument();
  });

  it("cambiar contraseña con nueva contraseña corta no llama a la API y muestra passwordTooShort", async () => {
    const spy = vi.spyOn(profileClient, "changePassword");
    render(<ProfileSection />);
    fireEvent.click(screen.getByRole("button", { name: /cambiar contraseña/i }));
    fireEvent.change(screen.getByPlaceholderText(/contraseña actual/i), { target: { value: "oldpass" } });
    fireEvent.change(screen.getByPlaceholderText(/nueva contraseña/i), { target: { value: "short" } });
    fireEvent.click(screen.getByRole("button", { name: /guardar/i }));
    await waitFor(() =>
      expect(screen.getByText("La nueva contraseña debe tener al menos 8 caracteres")).toBeInTheDocument(),
    );
    expect(spy).not.toHaveBeenCalled();
  });

  it("editar nombre con falla de updateName muestra error genérico y deja el formulario abierto", async () => {
    vi.spyOn(profileClient, "updateName").mockRejectedValue(new Error("HTTP 500"));
    render(<ProfileSection />);
    fireEvent.click(screen.getByRole("button", { name: /editar nombre/i }));
    fireEvent.change(screen.getByDisplayValue("Ana"), { target: { value: "Ana2" } });
    fireEvent.click(screen.getByRole("button", { name: /guardar/i }));
    await waitFor(() => expect(screen.getByText("No se pudo guardar los cambios")).toBeInTheDocument());
    expect(screen.getByDisplayValue("Ana2")).toBeInTheDocument();
  });
});
