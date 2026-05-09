"use client";

import { LogOut } from "lucide-react";
import { signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { getClientAuthProvider } from "@/lib/auth/provider";

type SwitchAccountButtonProps = {
  redirectTo: string;
  className?: string;
};

export function SwitchAccountButton({ redirectTo, className }: SwitchAccountButtonProps) {
  const router = useRouter();

  async function handleClick() {
    const provider = getClientAuthProvider();

    if (provider === "betterauth") {
      await authClient.signOut();
      router.push(redirectTo);
      router.refresh();
      return;
    }

    if (provider === "nextauth") {
      await signOut({ redirect: false });
      router.push(redirectTo);
      router.refresh();
      return;
    }

    router.push(redirectTo);
  }

  return (
    <Button type="button" variant="outline" className={className} onClick={handleClick}>
      <LogOut className="mr-2 h-4 w-4" />
      Switch account
    </Button>
  );
}
