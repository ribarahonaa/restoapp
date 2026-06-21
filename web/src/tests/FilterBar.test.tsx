// web/src/tests/FilterBar.test.tsx
import { describe, it, expect, vi, beforeAll } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import "../i18n/index.js";
import { FilterBar } from "../components/FilterBar.js";
import type { Purpose } from "../api/types.js";
import i18n from "../i18n/index.js";

beforeAll(() => {
  i18n.changeLanguage("en");
});

const purposes: Purpose[] = [
  { slug: "lunch", labelEs: "Almuerzo", labelEn: "Lunch", labelPt: "Almoço" },
];

describe("FilterBar", () => {
  it("llama onChange al activar promo", () => {
    const onChange = vi.fn();
    render(
      <FilterBar value={{ promo: false, open: false }} purposes={purposes} onChange={onChange} />
    );
    fireEvent.click(screen.getByLabelText(/promo/i));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ promo: true }));
  });

  it("llama onChange al elegir categoría", () => {
    const onChange = vi.fn();
    render(
      <FilterBar value={{ promo: false, open: false }} purposes={purposes} onChange={onChange} />
    );
    fireEvent.click(screen.getByRole("button", { name: /^bar$/i }));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ category: "bar" }));
  });
});
