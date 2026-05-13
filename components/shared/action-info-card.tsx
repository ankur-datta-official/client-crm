type ActionItem = {
  label: string;
  href: string | null;
};

type ActionInfoCardProps = {
  title: string;
  items: ActionItem[];
  emptyLabel?: string | null;
};

export function ActionInfoCard({ title, items, emptyLabel = "-" }: ActionInfoCardProps) {
  const visibleItems = items.filter((item) => item.label.trim().length > 0);

  return (
    <div className="rounded-md border p-3">
      <p className="text-xs font-medium uppercase text-muted-foreground">{title}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {visibleItems.length === 0 ? (
          <p className="text-sm">{emptyLabel}</p>
        ) : (
          visibleItems.map((item, index) =>
            item.href ? (
              <a
                key={`${item.label}-${index}`}
                href={item.href}
                target={item.href.startsWith("https://") ? "_blank" : undefined}
                rel={item.href.startsWith("https://") ? "noreferrer" : undefined}
                className="inline-flex min-h-10 items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 transition hover:border-emerald-300 hover:bg-emerald-100 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-200 dark:hover:bg-emerald-500/20"
              >
                {item.label}
              </a>
            ) : (
              <span
                key={`${item.label}-${index}`}
                className="inline-flex min-h-10 items-center rounded-full border border-border bg-muted/30 px-3 py-2 text-sm"
              >
                {item.label}
              </span>
            ),
          )
        )}
      </div>
    </div>
  );
}
