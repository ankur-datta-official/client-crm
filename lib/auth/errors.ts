export function getAuthErrorMessage(message: string) {
  const normalized = message.toLowerCase();

  if (normalized.includes("invalid login credentials")) {
    return "Invalid email or password. Please check your credentials and try again.";
  }

  if (normalized.includes("credentialssignin") || normalized.includes("invalid email or password")) {
    return "Invalid email or password. Please check your credentials and try again.";
  }

  if (normalized.includes("email not confirmed")) {
    return "Please confirm your email before signing in.";
  }

  if (normalized.includes("already registered") || normalized.includes("user already registered")) {
    return "An account already exists for this email. Please sign in instead.";
  }

  if (normalized.includes("user already exists") || normalized.includes("use another email")) {
    return "An account already exists for this email. Please sign in instead.";
  }

  if (normalized.includes("invalid password") || normalized.includes("invalid email or password")) {
    return "Invalid email or password. Please check your credentials and try again.";
  }

  if (normalized.includes("password")) {
    return "Please use a stronger password with at least 8 characters.";
  }

  if (normalized.includes("rate limit")) {
    return "Too many attempts. Please wait a moment and try again.";
  }

  return message || "Something went wrong. Please try again.";
}

export function getWorkspaceErrorMessage(message: string) {
  const normalized = message.toLowerCase();

  if (normalized.includes("starter subscription plan is missing")) {
    return "Starter plan is missing. Run the seed SQL file before creating a workspace.";
  }

  if (normalized.includes("authentication is required") || normalized.includes("jwt")) {
    return "Your session expired. Please sign in again before creating a workspace.";
  }

  if (normalized.includes("function") && normalized.includes("does not exist")) {
    return "Workspace setup function is missing. Run the core schema SQL file for this environment.";
  }

  if (normalized.includes("permission denied")) {
    return "Database permissions are not ready. Re-run the core schema SQL file and check access policies.";
  }

  return message || "Workspace creation failed. Please try again.";
}
