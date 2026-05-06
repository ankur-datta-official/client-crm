(() => {
  const storageKey = "crm-theme-preference";
  const root = document.documentElement;
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  const stored = window.localStorage.getItem(storageKey);
  const preference = stored === "light" || stored === "dark" || stored === "system" ? stored : "system";
  const resolved = preference === "system" ? (media.matches ? "dark" : "light") : preference;

  root.dataset.theme = preference;
  root.dataset.resolvedTheme = resolved;
  root.classList.toggle("dark", resolved === "dark");
  root.style.colorScheme = resolved;
})();
