"use client";

import { useEffect } from "react";
import { DEFAULT_TIMEZONE } from "@/lib/format/datetime";

function getBrowserTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || DEFAULT_TIMEZONE;
  } catch {
    return DEFAULT_TIMEZONE;
  }
}

export function BrowserTimeZoneSync() {
  useEffect(() => {
    const timeZone = getBrowserTimeZone();
    document.documentElement.dataset.timezone = timeZone;
    document.cookie = `crm_timezone=${encodeURIComponent(timeZone)}; path=/; max-age=31536000; samesite=lax`;
  }, []);

  return null;
}
