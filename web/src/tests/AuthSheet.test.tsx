import { it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import i18n from "../i18n/index.js";
import { AuthSheet } from "../components/auth/AuthSheet.js";
import { AuthProvider } from "../auth/AuthContext.js";
import * as authClient from "../auth/authClient.js";

beforeEach(async () => { await i18n.changeLanguage("es"); vi.restoreAllMocks(); });

it("registra creando cuenta y cierra el modal", async () => {
  vi.spyOn(authClient, "register").mockResolvedValue({ id: "u1", email: "a@a.cl", name: "Ana", role: "usuario", preferredLang: "es", avatarUrl: null });
  const onClose = vi.fn();
  render(<AuthProvider><AuthSheet open onClose={onClose} /></AuthProvider>);
  fireEvent.click(screen.getByRole("tab", { name: /crear cuenta/i }));
  fireEvent.change(screen.getByPlaceholderText("Nombre"), { target: { value: "Ana" } });
  fireEvent.change(screen.getByPlaceholderText("Correo"), { target: { value: "a@a.cl" } });
  fireEvent.change(screen.getByPlaceholderText("Contraseña"), { target: { value: "secret123" } });
  fireEvent.click(screen.getByRole("button", { name: /crear cuenta/i }));
  await waitFor(() => expect(onClose).toHaveBeenCalled());
});
