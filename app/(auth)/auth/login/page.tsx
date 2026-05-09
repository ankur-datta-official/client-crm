import { Suspense } from "react";
import { AuthForm } from "@/components/auth/auth-form";
import { getAuthProvider } from "@/lib/auth/provider";

export default function LoginPage() {
  return (
    <Suspense>
      <AuthForm mode="login" provider={getAuthProvider()} />
    </Suspense>
  );
}
