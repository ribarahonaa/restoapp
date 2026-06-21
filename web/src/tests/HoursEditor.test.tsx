import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "../i18n/index.js";
import i18n from "../i18n/index.js";
import { HoursEditor } from "../components/admin/HoursEditor.js";
import * as owner from "../api/ownerClient.js";

beforeEach(async () => {
  await i18n.changeLanguage("es");
  vi.restoreAllMocks();
});

describe("HoursEditor", () => {
  it("guarda solo los días marcados como abiertos", async () => {
    const replace = vi.spyOn(owner, "replaceHours").mockResolvedValue([] as never);
    render(
      <HoursEditor
        branchId="b1"
        initial={[{ id: "h1", weekday: 1, openTime: "09:00", closeTime: "18:00" }]}
      />
    );
    // el día 1 (lunes) viene abierto desde initial; guardar debe enviarlo
    fireEvent.click(screen.getByRole("button", { name: /guardar horarios/i }));
    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith(
        "b1",
        expect.arrayContaining([{ weekday: 1, openTime: "09:00", closeTime: "18:00" }])
      )
    );
    // y NO debe incluir días no marcados (longitud 1)
    expect(replace.mock.calls[0][1]).toHaveLength(1);
  });
});
