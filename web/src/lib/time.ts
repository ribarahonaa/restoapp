// El horario de los locales se define en hora de Chile (America/Santiago),
// igual que el cálculo de "abierto ahora" del backend. Para mostrar el
// horario de "hoy" hay que usar el día de la semana en esa zona, no el del
// navegador (que puede estar en otro huso).
const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

const santiagoWeekdayFmt = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Santiago",
  weekday: "short",
});

// Día de la semana en Chile: 0=domingo .. 6=sábado.
export function santiagoWeekday(date: Date = new Date()): number {
  return WEEKDAY_INDEX[santiagoWeekdayFmt.format(date)] ?? date.getDay();
}
