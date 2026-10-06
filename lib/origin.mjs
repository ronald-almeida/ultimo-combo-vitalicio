// Compare parsed origins, retaining an explicit allowlist of trusted sites.
export function normalizeOrigin(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const url = new URL(value.trim());
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null;
    return url.origin;
  } catch { return null; }
}

export function allowedOrigins(env = process.env) {
  const configured = [env.APP_ORIGIN, ...(env.APP_ORIGINS || '').split(',')].filter(value => value?.trim());
  // Local fallback is only used when no public origin has been configured.
  return new Set((configured.length ? configured : [`http://localhost:${env.PORT || 3000}`])
    .map(normalizeOrigin).filter(Boolean));
}

export function isAllowedOrigin(value, allowed) {
  const origin = normalizeOrigin(value);
  return origin !== null && allowed.has(origin);
}
