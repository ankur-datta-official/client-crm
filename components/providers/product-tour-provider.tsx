"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter } from "next/navigation";
import { CheckCircle2, ChevronLeft, ChevronRight, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { completeProductTour, markProductTourStarted, skipProductTour } from "@/lib/product-tour/actions";
import { PRODUCT_TOUR_STEPS } from "@/lib/product-tour/registry";
import type { ProductTourSession, ProductTourState, TourStep } from "@/lib/product-tour/types";
import { cn } from "@/lib/utils";

type ProductTourContextValue = {
  startTour: (mode?: "auto" | "manual") => void;
  isActive: boolean;
};

const ProductTourContext = createContext<ProductTourContextValue | null>(null);

const SESSION_STORAGE_KEY = "crm-product-tour-session";

const accentStyles: Record<TourStep["accent"], string> = {
  teal: "from-teal-500 to-emerald-500",
  sky: "from-sky-500 to-cyan-500",
  amber: "from-amber-500 to-orange-500",
  violet: "from-violet-500 to-fuchsia-500",
};

function readStoredSession(version: string) {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as ProductTourSession;
    if (parsed.version !== version || parsed.index < 0 || parsed.index >= PRODUCT_TOUR_STEPS.length) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeStoredSession(session: ProductTourSession | null) {
  if (typeof window === "undefined") {
    return;
  }

  if (!session) {
    window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
    return;
  }

  window.sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
}

export function ProductTourProvider({
  children,
  initialState,
}: {
  children: React.ReactNode;
  initialState: ProductTourState;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [mode, setMode] = useState<"auto" | "manual">("auto");
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [hasStarted, setHasStarted] = useState(false);
  const isHydrated = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  const step = PRODUCT_TOUR_STEPS[currentIndex];

  const clearSession = useCallback(() => {
    writeStoredSession(null);
  }, []);

  const beginTour = useCallback((nextMode: "auto" | "manual" = "manual", index = 0) => {
    setMode(nextMode);
    setCurrentIndex(index);
    setOpen(true);
    writeStoredSession({
      version: initialState.version,
      index,
      mode: nextMode,
    });

    if (!hasStarted) {
      setHasStarted(true);
      void markProductTourStarted().catch(() => undefined);
    }
  }, [hasStarted, initialState.version]);

  const closeTour = useCallback(() => {
    setOpen(false);
    setTargetRect(null);
    clearSession();
    setHasStarted(false);
  }, [clearSession]);

  const handleSkip = useCallback(() => {
    closeTour();
    void skipProductTour().catch(() => undefined);
  }, [closeTour]);

  const handleComplete = useCallback(() => {
    closeTour();
    void completeProductTour()
      .then(() => {
        toast.success("Tutorial completed. You can restart it anytime from your profile menu or Settings.");
      })
      .catch(() => undefined);
  }, [closeTour]);

  const goToIndex = useCallback((nextIndex: number) => {
    setCurrentIndex(nextIndex);
    writeStoredSession({
      version: initialState.version,
      index: nextIndex,
      mode,
    });
  }, [initialState.version, mode]);

  const handleNext = useCallback(() => {
    if (currentIndex >= PRODUCT_TOUR_STEPS.length - 1) {
      handleComplete();
      return;
    }
    goToIndex(currentIndex + 1);
  }, [currentIndex, goToIndex, handleComplete]);

  const handleBack = useCallback(() => {
    if (currentIndex === 0) {
      return;
    }
    goToIndex(currentIndex - 1);
  }, [currentIndex, goToIndex]);

  useEffect(() => {
    if (!isHydrated || open || hasStarted) {
      return;
    }

    const stored = readStoredSession(initialState.version);
    if (stored) {
      const frameId = window.requestAnimationFrame(() => beginTour(stored.mode, stored.index));
      return () => window.cancelAnimationFrame(frameId);
    }

    if (!initialState.shouldAutoStart) {
      return;
    }

    const frameId = window.requestAnimationFrame(() => beginTour("auto", 0));
    return () => window.cancelAnimationFrame(frameId);
  }, [beginTour, hasStarted, initialState.shouldAutoStart, initialState.version, isHydrated, open]);

  useEffect(() => {
    if (!open || !step) {
      return;
    }

    if (pathname !== step.route) {
      router.push(step.route);
      return;
    }

    let cancelled = false;
    let attempts = 0;
    let frameId = 0;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const updateRect = () => {
      if (cancelled) {
        return;
      }

      const element = document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`);
      if (!element) {
        if (attempts >= 15) {
          if (currentIndex < PRODUCT_TOUR_STEPS.length - 1) {
            goToIndex(currentIndex + 1);
          } else {
            setTargetRect(null);
          }
          return;
        }

        attempts += 1;
        timeoutId = setTimeout(updateRect, 180);
        return;
      }

      element.scrollIntoView({
        block: "center",
        inline: "nearest",
        behavior: attempts === 0 ? "smooth" : "auto",
      });

      frameId = window.requestAnimationFrame(() => {
        const rect = element.getBoundingClientRect();
        setTargetRect(rect);
      });
    };

    updateRect();

    const syncRect = () => {
      const element = document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`);
      if (!element) {
        return;
      }
      setTargetRect(element.getBoundingClientRect());
    };

    window.addEventListener("resize", syncRect);
    window.addEventListener("scroll", syncRect, true);

    return () => {
      cancelled = true;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      window.cancelAnimationFrame(frameId);
      window.removeEventListener("resize", syncRect);
      window.removeEventListener("scroll", syncRect, true);
    };
  }, [currentIndex, goToIndex, open, pathname, router, step]);

  const contextValue = useMemo<ProductTourContextValue>(() => ({
    startTour: (nextMode = "manual") => beginTour(nextMode, 0),
    isActive: open,
  }), [beginTour, open]);

  const cardStyle = useMemo(() => {
    const baseWidth = typeof window !== "undefined" && window.innerWidth < 640 ? 280 : 320;
    if (!targetRect) {
      return {
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        width: baseWidth,
      } as const;
    }

    const viewportWidth = typeof window !== "undefined" ? window.innerWidth : 1280;
    const viewportHeight = typeof window !== "undefined" ? window.innerHeight : 720;
    const fitsRight = targetRect.right + baseWidth + 28 < viewportWidth;
    const left = fitsRight
      ? Math.min(targetRect.right + 18, viewportWidth - baseWidth - 16)
      : Math.max(16, Math.min(targetRect.left, viewportWidth - baseWidth - 16));
    const top = targetRect.bottom + 18 < viewportHeight - 180
      ? targetRect.bottom + 14
      : Math.max(16, targetRect.top - 220);

    return {
      top,
      left,
      width: baseWidth,
    } as const;
  }, [targetRect]);

  return (
    <ProductTourContext.Provider value={contextValue}>
      {children}
      {isHydrated && open ? createPortal(
        <div className="pointer-events-none fixed inset-0 z-[90]">
          <div className="absolute inset-0 bg-slate-950/34 dark:bg-slate-950/52" />
          {targetRect ? (
            <div
              className="absolute rounded-[26px] border border-white/80 shadow-[0_0_0_9999px_rgba(15,23,42,0.18),0_0_0_2px_rgba(45,212,191,0.75)] dark:border-teal-300/80"
              style={{
                top: Math.max(8, targetRect.top - 10),
                left: Math.max(8, targetRect.left - 10),
                width: Math.min(window.innerWidth - 16, targetRect.width + 20),
                height: targetRect.height + 20,
              }}
            />
          ) : null}
          <div
            className="pointer-events-auto fixed rounded-[28px] border border-white/90 bg-white shadow-[0_28px_80px_-36px_rgba(15,23,42,0.28)] dark:border-slate-800/90 dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.98),rgba(2,6,23,0.96))] dark:shadow-[0_28px_80px_-36px_rgba(2,6,23,0.88)]"
            style={cardStyle}
          >
            <div className={cn("h-1.5 rounded-t-[28px] bg-gradient-to-r", accentStyles[step.accent])} />
            <div className="space-y-4 p-4 sm:p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-2">
                  <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                    <Sparkles className="size-3.5" />
                    Step {currentIndex + 1} of {PRODUCT_TOUR_STEPS.length}
                  </div>
                  <h3 className="text-base font-semibold text-slate-950 dark:text-slate-100">{step.title}</h3>
                  <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">{step.description}</p>
                </div>
                <button
                  type="button"
                  onClick={handleSkip}
                  className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-900 dark:hover:text-slate-200"
                  aria-label="Skip tutorial"
                >
                  <X className="size-4" />
                </button>
              </div>

              <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 px-3 py-2 text-xs leading-5 text-slate-500 dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-400">
                Keep it simple: watch where each core workflow lives, then use your profile menu later whenever you want a refresher.
              </div>

              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Button type="button" variant="ghost" size="sm" onClick={handleSkip}>
                    Skip
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={handleBack} disabled={currentIndex === 0}>
                    <ChevronLeft className="size-4" />
                    Back
                  </Button>
                </div>
                <Button type="button" size="sm" onClick={handleNext}>
                  {currentIndex === PRODUCT_TOUR_STEPS.length - 1 ? (
                    <>
                      Finish
                      <CheckCircle2 className="size-4" />
                    </>
                  ) : (
                    <>
                      Next
                      <ChevronRight className="size-4" />
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>,
        document.body,
      ) : null}
    </ProductTourContext.Provider>
  );
}

export function useProductTour() {
  const context = useContext(ProductTourContext);
  if (!context) {
    throw new Error("useProductTour must be used within a ProductTourProvider.");
  }
  return context;
}
