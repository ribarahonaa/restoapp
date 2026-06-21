// web/src/tests/FilterBar.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import "../i18n/index.js";
import { FilterBar } from "../components/FilterBar.js";
import type { Purpose } from "../api/types.js";

const purposes: Purpose[] = [
  { slug: "lunch", labelEs: "Almuerzo", labelEn: "Lunch", labelPt: "Almoço" },
];

describe("FilterBar", () => {
  it("llama onChange al activar promo", () => {
    const onChange = vi.fn();
    render(
      <FilterBar value={{ promo: false, open: false, radius: 5000 }} purposes={purposes} onChange={onChange} />
    );
    fireEvent.click(screen.getByLabelText(/promo/i));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ promo: true }));
  });

  it("llama onChange al elegir categoría", () => {
    const onChange = vi.fn();
    render(
      <FilterBar value={{ promo: false, open: false, radius: 5000 }} purposes={purposes} onChange={onChange} />
    );
    fireEvent.change(screen.getByLabelText(/category/i), { target: { value: "bar" } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ category: "bar" }));
  });
});
