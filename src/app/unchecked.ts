// Reading values that came from outside (backend events, plugin files,
// saved state) before their shape is known: an object's fields, a
// non-empty string, a finite number. Anything else reads as empty. Pure.

export function fieldsOf(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
}

export function textOf(v: unknown): string | null {
  return typeof v === "string" && v ? v : null;
}

export function numberOf(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}
