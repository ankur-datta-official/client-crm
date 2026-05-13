import { logServerError } from "@/lib/errors";

type WhatsAppLookupResponse =
  | {
      numbers?: string[];
      matches?: Array<{ phoneNumber?: string; phone?: string; hasWhatsapp?: boolean; whatsapp?: boolean }>;
      found?: string | null;
    }
  | null
  | undefined;

function normalizePhoneForLookup(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const hasPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/[^\d+]/g, "").replace(/^\+/, "");
  const core = digits.replace(/\D/g, "");
  if (!core) {
    return null;
  }

  return hasPlus ? `+${core}` : core;
}

function uniquePhoneNumbers(values: string[]) {
  const seen = new Set<string>();
  const unique: string[] = [];

  for (const value of values) {
    const normalized = normalizePhoneForLookup(value);
    if (!normalized || seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    unique.push(normalized);
  }

  return unique;
}

function extractMatches(payload: WhatsAppLookupResponse) {
  const matches = new Set<string>();

  if (!payload) {
    return matches;
  }

  if (typeof payload.found === "string") {
    const normalized = normalizePhoneForLookup(payload.found);
    if (normalized) {
      matches.add(normalized);
    }
  }

  if (Array.isArray(payload.numbers)) {
    for (const item of payload.numbers) {
      const normalized = normalizePhoneForLookup(item);
      if (normalized) {
        matches.add(normalized);
      }
    }
  }

  if (Array.isArray(payload.matches)) {
    for (const item of payload.matches) {
      if (!item?.hasWhatsapp && !item?.whatsapp) {
        continue;
      }

      const normalized = normalizePhoneForLookup(item.phoneNumber ?? item.phone ?? "");
      if (normalized) {
        matches.add(normalized);
      }
    }
  }

  return matches;
}

export async function verifyWhatsAppNumbers(phoneNumbers: string[]) {
  const lookupUrl = process.env.WHATSAPP_LOOKUP_URL?.trim();
  const normalizedPhones = uniquePhoneNumbers(phoneNumbers);

  if (!lookupUrl || normalizedPhones.length === 0) {
    return new Set<string>();
  }

  try {
    const response = await fetch(lookupUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(process.env.WHATSAPP_LOOKUP_TOKEN
          ? { Authorization: `Bearer ${process.env.WHATSAPP_LOOKUP_TOKEN}` }
          : {}),
      },
      body: JSON.stringify({ phoneNumbers: normalizedPhones }),
      cache: "no-store",
    });

    if (!response.ok) {
      logServerError("whatsapp.lookup.http", new Error(`Lookup failed with status ${response.status}`), {
        status: response.status,
      });
      return new Set<string>();
    }

    const payload = (await response.json()) as WhatsAppLookupResponse;
    return extractMatches(payload);
  } catch (error) {
    logServerError("whatsapp.lookup.request", error);
    return new Set<string>();
  }
}

export function findFirstWhatsAppMatch(phoneNumbers: string[], verifiedNumbers: Set<string>) {
  for (const value of phoneNumbers) {
    const normalized = normalizePhoneForLookup(value);
    if (normalized && verifiedNumbers.has(normalized)) {
      return value;
    }
  }

  return null;
}
