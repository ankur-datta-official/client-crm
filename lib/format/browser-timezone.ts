"use client";

import { useState } from "react";
import { DEFAULT_TIMEZONE } from "@/lib/format/datetime";

export function getBrowserTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || DEFAULT_TIMEZONE;
  } catch {
    return DEFAULT_TIMEZONE;
  }
}

export function useBrowserTimeZone() {
  const [timeZone] = useState(getBrowserTimeZone);

  return timeZone;
}
