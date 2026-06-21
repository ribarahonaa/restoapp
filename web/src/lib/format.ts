// Precio en pesos chilenos: "3500" -> "$3.500"
const clp = new Intl.NumberFormat("es-CL", { maximumFractionDigits: 0 });

export function formatPrice(price: string | number): string {
  const n = typeof price === "number" ? price : Number(price);
  if (Number.isNaN(n)) return String(price);
  return `$${clp.format(n)}`;
}
