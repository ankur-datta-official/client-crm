import type { ZodError } from "zod";

export type ValidationIssue = {
  field: string;
  message: string;
};

export function formatZodError(error: ZodError): ValidationIssue[] {
  return error.issues.map((issue) => ({
    field: issue.path.join(".") || "root",
    message: issue.message,
  }));
}

export function getFirstValidationMessage(error: ZodError, fallback = "Invalid input") {
  return formatZodError(error)[0]?.message ?? fallback;
}
