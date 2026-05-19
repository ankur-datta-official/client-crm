"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Tabs } from "@/components/ui/tabs";

type TeamPageTabsProps = {
  currentTab: "members" | "invitations" | "roles";
  children: React.ReactNode;
  className?: string;
};

export function TeamPageTabs({ currentTab, children, className }: TeamPageTabsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function handleTabChange(nextTab: string) {
    if (nextTab !== "members" && nextTab !== "invitations" && nextTab !== "roles") {
      return;
    }

    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", nextTab);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <Tabs value={currentTab} onValueChange={handleTabChange} className={className}>
      {children}
    </Tabs>
  );
}
