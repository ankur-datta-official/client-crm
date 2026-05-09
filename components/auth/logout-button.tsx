"use client";

import { LogOut } from "lucide-react";
import { signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { getClientAuthProvider } from "@/lib/auth/provider";

export function LogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    const provider = getClientAuthProvider();

    if (provider === "betterauth") {
      await authClient.signOut();
      router.push("/auth/login");
      router.refresh();
      return;
    }

    if (provider === "nextauth") {
      await signOut({
        redirect: false,
      });
      router.push("/auth/login");
      router.refresh();
      return;
    }

    router.push("/auth/login");
  }

  return (
    <Button variant="outline" size="icon" onClick={handleLogout} aria-label="Sign out">
      <LogOut />
      <span className="sr-only">Sign out</span>
    </Button>
  );
}
