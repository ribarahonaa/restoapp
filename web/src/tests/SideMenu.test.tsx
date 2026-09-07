import { it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import i18n from "../i18n/index.js";
import { SideMenu } from "../components/SideMenu.js";
import { AuthProvider } from "../auth/AuthContext.js";

beforeEach(async () => { await i18n.changeLanguage("es"); vi.restoreAllMocks(); });

it("anónimo: muestra CTA de ingresar", () => {
  render(<AuthProvider><SideMenu open onClose={() => {}} /></AuthProvider>);
  expect(screen.getByRole("button", { name: /ingresar/i })).toBeInTheDocument();
});
