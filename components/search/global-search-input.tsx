"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { GlobalSearchResults } from "./global-search-results";
import type { GlobalSearchResults as GlobalSearchResultsShape } from "@/lib/search/global-search";

type GlobalSearchInputProps = {
  className?: string;
  inputClassName?: string;
  resultsClassName?: string;
};

export function GlobalSearchInput({
  className,
  inputClassName,
  resultsClassName,
}: GlobalSearchInputProps) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GlobalSearchResultsShape | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const trimmedQuery = query.trim();

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (trimmedQuery.length < 2) {
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(async () => {
      try {
        setIsLoading(true);
        const response = await fetch(`/api/search?q=${encodeURIComponent(trimmedQuery)}`, {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error("Search failed.");
        }

        const payload = (await response.json()) as GlobalSearchResultsShape;
        setResults(payload);
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setResults(null);
        }
      } finally {
        setIsLoading(false);
      }
    }, 250);

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [trimmedQuery]);

  function handleSubmit() {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      return;
    }

    setOpen(false);
    router.push(`/search?q=${encodeURIComponent(trimmed)}`);
  }

  return (
    <div ref={containerRef} className={cn("relative hidden w-full max-w-2xl md:block", className)}>
      <div className="flex w-full items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 shadow-sm transition-all duration-200 focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-ring/15 dark:border-slate-800 dark:bg-slate-950/90">
        <Search className="size-4 text-muted-foreground" />
        <Input
          value={query}
          onChange={(event) => {
            const nextQuery = event.target.value;
            setQuery(nextQuery);
            if (nextQuery.trim().length < 2) {
              setResults(null);
              setIsLoading(false);
            }
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setOpen(false);
            }

            if (event.key === "Enter") {
              event.preventDefault();
              handleSubmit();
            }
          }}
          aria-label="Search CRM records"
          className={cn("h-10 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0", inputClassName)}
          placeholder="Search companies, contacts, meetings, follow-ups..."
        />
      </div>
      <GlobalSearchResults
        query={query}
        results={results}
        isLoading={isLoading}
        open={open}
        onResultClick={() => setOpen(false)}
        className={resultsClassName}
      />
    </div>
  );
}
