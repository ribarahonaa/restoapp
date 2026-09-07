import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Drawer } from "../components/Drawer.js";

describe("Drawer", () => {
  it("no renderiza contenido cuando cerrado", () => {
    render(<Drawer open={false} onClose={() => {}}><p>hola</p></Drawer>);
    expect(screen.queryByText("hola")).toBeNull();
  });
  it("muestra contenido y cierra con overlay + Escape", () => {
    const onClose = vi.fn();
    render(<Drawer open onClose={onClose}><p>hola</p></Drawer>);
    expect(screen.getByText("hola")).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });
});
