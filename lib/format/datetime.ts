export const DEFAULT_DATE_LOCALE = "en-GB";
export const DEFAULT_TIMEZONE = "Asia/Dhaka";

function toDate(value: Date | string | number) {
  return value instanceof Date ? value : new Date(value);
}

export function formatDateForTimeZone(value: Date | string | number, timeZone = DEFAULT_TIMEZONE) {
  return new Intl.DateTimeFormat(DEFAULT_DATE_LOCALE, {
    timeZone,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
    .format(toDate(value))
    .replace(/\//g, "-");
}

export function formatTimeForTimeZone(value: Date | string | number, timeZone = DEFAULT_TIMEZONE) {
  return new Intl.DateTimeFormat(DEFAULT_DATE_LOCALE, {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  }).format(toDate(value));
}

export function formatDateTimeForTimeZone(value: Date | string | number, timeZone = DEFAULT_TIMEZONE) {
  return `${formatDateForTimeZone(value, timeZone)}, ${formatTimeForTimeZone(value, timeZone)}`;
}

export function formatShortDateForTimeZone(value: Date | string | number, timeZone = DEFAULT_TIMEZONE) {
  return new Intl.DateTimeFormat(DEFAULT_DATE_LOCALE, {
    timeZone,
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(toDate(value));
}

export function formatMonthDayForTimeZone(value: Date | string | number, timeZone = DEFAULT_TIMEZONE) {
  return new Intl.DateTimeFormat(DEFAULT_DATE_LOCALE, {
    timeZone,
    day: "2-digit",
    month: "short",
  }).format(toDate(value));
}

export function formatMonthYearForTimeZone(value: Date | string | number, timeZone = DEFAULT_TIMEZONE) {
  return new Intl.DateTimeFormat(DEFAULT_DATE_LOCALE, {
    timeZone,
    month: "short",
    year: "2-digit",
  }).format(toDate(value));
}

export function formatDateBD(value: Date | string | number) {
  return formatDateForTimeZone(value, DEFAULT_TIMEZONE);
}

export function formatTimeBD(value: Date | string | number) {
  return formatTimeForTimeZone(value, DEFAULT_TIMEZONE);
}

export function formatDateTimeBD(value: Date | string | number) {
  return formatDateTimeForTimeZone(value, DEFAULT_TIMEZONE);
}

export function formatShortDateBD(value: Date | string | number) {
  return formatShortDateForTimeZone(value, DEFAULT_TIMEZONE);
}

export function formatMonthDayBD(value: Date | string | number) {
  return formatMonthDayForTimeZone(value, DEFAULT_TIMEZONE);
}

export function formatMonthYearBD(value: Date | string | number) {
  return formatMonthYearForTimeZone(value, DEFAULT_TIMEZONE);
}

export function formatDateLocal(value: Date | string | number) {
  return new Intl.DateTimeFormat(DEFAULT_DATE_LOCALE, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
    .format(toDate(value))
    .replace(/\//g, "-");
}

export function formatTimeLocal(value: Date | string | number) {
  return new Intl.DateTimeFormat(DEFAULT_DATE_LOCALE, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  }).format(toDate(value));
}

export function formatDateTimeLocal(value: Date | string | number) {
  return `${formatDateLocal(value)}, ${formatTimeLocal(value)}`;
}
