import { CircleOff, Mail, MessageCircleMore } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

const SUPPORT_EMAIL = "support@crm.mugnee.com";
const SUPPORT_WHATSAPP_LABEL = "+8801958645415";
const SUPPORT_WHATSAPP_LINK = "https://wa.me/8801958645415";

export default function AccountInactivePage() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-[linear-gradient(180deg,#f8fbff_0%,#f5f7fb_48%,#eef4f7_100%)] px-4 py-8 dark:bg-[linear-gradient(180deg,#020617_0%,#0f172a_52%,#111827_100%)]">
      <div className="w-full max-w-xl rounded-[28px] border border-white/90 bg-white/95 p-8 text-center shadow-[0_30px_90px_-40px_rgba(15,23,42,0.24)] dark:border-slate-800/80 dark:bg-slate-950/95 dark:shadow-[0_30px_90px_-40px_rgba(2,6,23,0.82)]">
        <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-300">
          <CircleOff className="size-8" />
        </div>
        <h1 className="mt-6 text-3xl font-semibold tracking-tight text-slate-950 dark:text-slate-50">
          Account inactive
        </h1>
        <p className="mt-3 text-base leading-7 text-slate-600 dark:text-slate-300">
          Your user ID has been marked as deactive or inactive. To reactivate your account, please contact our support team and share your correct account details.
        </p>

        <div className="mt-6 space-y-3 rounded-3xl border border-slate-200/80 bg-slate-50/85 p-5 text-left dark:border-slate-800 dark:bg-slate-900/75">
          <div className="flex items-start gap-3">
            <Mail className="mt-0.5 size-4 text-teal-600 dark:text-teal-300" />
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Email support</p>
              <a className="text-sm text-primary hover:underline" href={`mailto:${SUPPORT_EMAIL}`}>
                {SUPPORT_EMAIL}
              </a>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <MessageCircleMore className="mt-0.5 size-4 text-emerald-600 dark:text-emerald-300" />
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">WhatsApp support</p>
              <a className="text-sm text-primary hover:underline" href={SUPPORT_WHATSAPP_LINK} target="_blank" rel="noreferrer">
                {SUPPORT_WHATSAPP_LABEL}
              </a>
            </div>
          </div>
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Button asChild variant="outline">
            <Link href="/auth/login">Back to sign in</Link>
          </Button>
          <Button asChild>
            <a href={`mailto:${SUPPORT_EMAIL}`}>Contact support</a>
          </Button>
        </div>
      </div>
    </div>
  );
}
