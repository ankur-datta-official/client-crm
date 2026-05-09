import { Suspense } from "react";
import { AuthForm } from "@/components/auth/auth-form";
import { getAuthProvider } from "@/lib/auth/provider";

export default function RegisterPage() {
  return (
    <Suspense>
      <AuthForm mode="register" provider={getAuthProvider()} />
    </Suspense>
  );
}
