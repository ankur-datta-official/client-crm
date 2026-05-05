"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { THEME_STORAGE_KEY, type ResolvedTheme, type ThemePreference, isThemePreference, resolveTheme } from "@/lib/theme";

type ThemeContextValue = {
  theme: ThemePreference;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: ThemePreference) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function getSystemPreference() {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function getStoredThemePreference(): ThemePreference {
  if (typeof window === "undefined") {
    return "system";
  }

  const rootTheme = document.documentElement.dataset.theme;

  if (isThemePreference(rootTheme)) {
    return rootTheme;
  }

  const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
  return isThemePreference(storedTheme) ? storedTheme : "system";
}

function applyTheme(preference: ThemePreference) {
  const resolved = resolveTheme(preference, getSystemPreference());
  const root = document.documentElement;

  root.dataset.theme = preference;
  root.dataset.resolvedTheme = resolved;
  root.classList.toggle("dark", resolved === "dark");
  root.style.colorScheme = resolved;

  return resolved;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemePreference>(() => getStoredThemePreference());
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() => {
    if (typeof window === "undefined") {
      return "light";
    }

    return resolveTheme(getStoredThemePreference(), getSystemPreference());
  });

  useEffect(() => {
    applyTheme(theme);
    const media = window.matchMedia("(prefers-color-scheme: dark)");

    const handleSystemChange = () => {
      const currentTheme = isThemePreference(document.documentElement.dataset.theme)
        ? (document.documentElement.dataset.theme as ThemePreference)
        : getStoredThemePreference();

      setResolvedTheme(applyTheme(currentTheme));
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== THEME_STORAGE_KEY || !isThemePreference(event.newValue)) {
        return;
      }

      setThemeState(event.newValue);
      setResolvedTheme(applyTheme(event.newValue));
    };

    media.addEventListener("change", handleSystemChange);
    window.addEventListener("storage", handleStorage);

    return () => {
      media.removeEventListener("change", handleSystemChange);
      window.removeEventListener("storage", handleStorage);
    };
  }, [theme]);

  function setTheme(nextTheme: ThemePreference) {
    window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    setThemeState(nextTheme);
    setResolvedTheme(applyTheme(nextTheme));
  }

  const value = useMemo(
    () => ({
      theme,
      resolvedTheme,
      setTheme,
    }),
    [resolvedTheme, theme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider.");
  }

  return context;
}
