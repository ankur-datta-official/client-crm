import { NextResponse } from "next/server";
import type { ValidationIssue } from "@/lib/validation";

type SuccessPayload<T> = {
  success: true;
  data: T;
  message?: string;
};

type ErrorPayload = {
  success: false;
  error: {
    message: string;
    code?: string;
    details?: unknown;
  };
};

export function successResponse<T>(data: T, init?: ResponseInit & { message?: string }) {
  const payload: SuccessPayload<T> = {
    success: true,
    data,
    message: init?.message,
  };

  return NextResponse.json(payload, init);
}

export function errorResponse(
  message = "Internal server error",
  init?: ResponseInit & { code?: string; details?: unknown },
) {
  const payload: ErrorPayload = {
    success: false,
    error: {
      message,
      code: init?.code,
      details: init?.details,
    },
  };

  return NextResponse.json(payload, {
    status: init?.status ?? 500,
    headers: init?.headers,
  });
}

export function unauthorizedResponse(message = "Authentication required") {
  return errorResponse(message, {
    status: 401,
    code: "UNAUTHORIZED",
  });
}

export function forbiddenResponse(message = "You do not have access to this resource") {
  return errorResponse(message, {
    status: 403,
    code: "FORBIDDEN",
  });
}

export function notFoundResponse(message = "Resource not found") {
  return errorResponse(message, {
    status: 404,
    code: "NOT_FOUND",
  });
}

export function validationErrorResponse(
  errors: ValidationIssue[],
  message = "Validation failed",
) {
  return errorResponse(message, {
    status: 422,
    code: "VALIDATION_ERROR",
    details: errors,
  });
}
