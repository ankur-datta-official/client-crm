export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-dvh bg-[linear-gradient(180deg,#f8fbff_0%,#f5f7fb_48%,#eef4f7_100%)] dark:bg-[linear-gradient(180deg,#020617_0%,#0f172a_52%,#111827_100%)]">
      <div className="grid min-h-dvh lg:h-dvh lg:grid-cols-[1.08fr_0.92fr]">
        <section className="relative hidden overflow-hidden border-r border-slate-200/70 px-8 py-7 lg:flex lg:min-h-0 lg:flex-col lg:justify-center dark:border-slate-800/80">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(45,212,191,0.22),transparent_34%),radial-gradient(circle_at_bottom_left,rgba(14,165,233,0.18),transparent_30%),linear-gradient(180deg,rgba(255,255,255,0.94),rgba(248,250,252,0.9))] dark:bg-[radial-gradient(circle_at_top_left,rgba(45,212,191,0.16),transparent_30%),radial-gradient(circle_at_bottom_left,rgba(14,165,233,0.18),transparent_28%),linear-gradient(180deg,rgba(2,6,23,0.98),rgba(15,23,42,0.96))]" />
          <div className="relative">
            <div className="inline-flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white/90 px-4 py-3 shadow-sm dark:border-slate-800 dark:bg-slate-950/85">
              <div className="flex size-11 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#0f766e,#14b8a6)] text-lg font-semibold text-white shadow-[0_16px_30px_-18px_rgba(20,184,166,0.75)]">
                CR
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Client CRM</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Sales workspace platform</p>
              </div>
            </div>

            <div className="mt-8 max-w-2xl space-y-5">
              <div className="inline-flex items-center rounded-full border border-teal-200/80 bg-white/85 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-teal-700 shadow-sm dark:border-teal-500/20 dark:bg-teal-500/10 dark:text-teal-200">
                Premium CRM Workspace
              </div>
              <h1 className="max-w-2xl text-4xl font-semibold leading-[1.08] tracking-tight text-slate-950 xl:text-[2.8rem] dark:text-slate-50">
                Close deals with a CRM workspace that feels clean, fast, and premium.
              </h1>
              <p className="max-w-xl text-base leading-7 text-slate-600 dark:text-slate-300">
                Manage leads, meetings, follow-ups, reporting, and team accountability from one polished workspace built for daily momentum.
              </p>
            </div>

            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              {[
                { label: "Pipeline visibility", detail: "Track every stage clearly." },
                { label: "Meeting discipline", detail: "Turn talks into action." },
                { label: "Team reporting", detail: "Keep progress measurable." },
              ].map((item) => (
                <div key={item.label} className="rounded-[24px] border border-white/90 bg-white/82 p-4 shadow-[0_18px_40px_-28px_rgba(15,23,42,0.16)] dark:border-slate-800/80 dark:bg-slate-950/76 dark:shadow-[0_18px_40px_-28px_rgba(2,6,23,0.7)]">
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{item.label}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">{item.detail}</p>
                </div>
              ))}
            </div>
            <div className="mt-6 hidden flex-wrap items-center gap-3 rounded-[24px] border border-white/90 bg-white/82 px-5 py-4 shadow-[0_18px_40px_-28px_rgba(15,23,42,0.16)] dark:border-slate-800/80 dark:bg-slate-950/76 dark:shadow-[0_18px_40px_-28px_rgba(2,6,23,0.7)] 2xl:inline-flex">
              {["Focused workflow", "Cleaner handoffs", "Real-time visibility"].map((item) => (
                <div key={item} className="rounded-full border border-slate-200/80 bg-slate-50/90 px-4 py-2 text-sm font-medium text-slate-700 dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-200">
                  {item}
                </div>
              ))}
            </div>
          </div>
        </section>
        <section className="relative flex min-h-dvh items-start justify-center overflow-y-auto px-4 py-5 sm:px-6 sm:py-6 lg:min-h-0 lg:px-8 lg:py-8">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(20,184,166,0.08),transparent_28%)] dark:bg-[radial-gradient(circle_at_top,rgba(20,184,166,0.09),transparent_24%)]" />
          <div className="relative w-full max-w-[27rem] self-start py-2 xl:max-w-md">{children}</div>
        </section>
      </div>
    </main>
  );
}
