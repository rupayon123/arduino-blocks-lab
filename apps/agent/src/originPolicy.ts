const defaultAllowedOrigins = [
  "https://rupayon123.github.io",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:4173",
  "http://127.0.0.1:4173"
];

function originFrom(value: string) {
  try {
    return new URL(value).origin;
  } catch {
    return undefined;
  }
}

function parseAllowedOrigins(value: string | undefined) {
  const raw = value?.trim() ? value.split(/[\s,]+/) : defaultAllowedOrigins;
  return new Set(raw.map(originFrom).filter((origin): origin is string => Boolean(origin)));
}

export const allowedOrigins = parseAllowedOrigins(process.env.ABL_ALLOWED_ORIGINS);

export function isAllowedOrigin(origin: string | undefined) {
  if (!origin) return false;
  const normalized = originFrom(origin);
  return Boolean(normalized && allowedOrigins.has(normalized));
}

export function allowedOriginList() {
  return [...allowedOrigins];
}
