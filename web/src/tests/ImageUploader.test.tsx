import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "../i18n/index.js";
import i18n from "../i18n/index.js";
import { ImageUploader } from "../components/admin/ImageUploader.js";
import * as owner from "../api/ownerClient.js";

beforeEach(async () => {
  await i18n.changeLanguage("es");
  vi.restoreAllMocks();
});

describe("ImageUploader", () => {
  it("sube el archivo elegido y llama onChange con la url", async () => {
    vi.spyOn(owner, "uploadImage").mockResolvedValue("http://x/restoapp/foto.jpg");
    const onChange = vi.fn();
    render(<ImageUploader value={null} onChange={onChange} label="Imagen" />);
    const input = screen.getByLabelText(/imagen/i) as HTMLInputElement;
    const file = new File(["x"], "foto.jpg", { type: "image/jpeg" });
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => expect(onChange).toHaveBeenCalledWith("http://x/restoapp/foto.jpg"));
  });

  it("muestra preview cuando hay value", () => {
    render(<ImageUploader value="http://x/restoapp/y.jpg" onChange={() => {}} label="Imagen" />);
    expect(screen.getByRole("img")).toHaveAttribute("src", "http://x/restoapp/y.jpg");
  });
});
