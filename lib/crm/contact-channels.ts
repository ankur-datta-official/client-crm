export function normalizeContactValue(value: unknown) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
}

export function dedupeContactValues(values: string[]) {
  const seen = new Set<string>();

  return values.filter((value) => {
    const key = value.toLowerCase();
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

export function normalizeContactValues(values: unknown[] | null | undefined) {
  if (!Array.isArray(values)) {
    return [];
  }

  return dedupeContactValues(
    values
      .map((value) => normalizeContactValue(value))
      .filter((value) => value.length > 0),
  );
}

export function normalizeEmailValues(values: unknown[] | null | undefined) {
  return normalizeContactValues(values).map((value) => value.toLowerCase());
}

export function buildContactValues(primaryValue: string | null | undefined, values: string[] | null | undefined) {
  return dedupeContactValues([
    ...normalizeContactValues(primaryValue ? [primaryValue] : []),
    ...normalizeContactValues(values ?? []),
  ]);
}

export function buildEmailValues(primaryValue: string | null | undefined, values: string[] | null | undefined) {
  return dedupeContactValues([
    ...normalizeEmailValues(primaryValue ? [primaryValue] : []),
    ...normalizeEmailValues(values ?? []),
  ]);
}

export function getPrimaryContactValue(values: string[] | null | undefined) {
  return values?.[0] ?? null;
}

export function formatContactValues(values: string[] | null | undefined) {
  if (!values || values.length === 0) {
    return null;
  }

  return values.join(", ");
}

export function normalizePhoneLinkValue(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const normalized = trimmed.replace(/[\s()-]+/g, "");
  const safeValue = normalized.replace(/(?!^\+)[^0-9]/g, "");

  if (!safeValue || !/^\+?[0-9]{5,20}$/.test(safeValue)) {
    return null;
  }

  return safeValue;
}

export function buildPhoneHref(value: string | null | undefined) {
  const normalized = normalizePhoneLinkValue(value);
  return normalized ? `tel:${normalized}` : null;
}

export function buildWhatsAppHref(value: string | null | undefined) {
  const normalized = normalizePhoneLinkValue(value);
  if (!normalized) {
    return null;
  }

  const whatsappNumber = normalized.replace(/^\+/, "");
  return `https://wa.me/${whatsappNumber}`;
}

export function normalizeEmailLinkValue(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) ? normalized : null;
}

export function buildEmailHref(value: string | null | undefined) {
  const normalized = normalizeEmailLinkValue(value);
  return normalized ? `mailto:${normalized}` : null;
}
