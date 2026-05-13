import "server-only";

import nodemailer from "nodemailer";
import { z } from "zod";

const resendEnvSchema = z.object({
  apiKey: z.string().trim().min(1),
  from: z.string().trim().min(1),
});

const smtpEnvSchema = z.object({
  host: z.string().trim().min(1),
  port: z.coerce.number().int().positive(),
  user: z.string().trim().min(1).optional(),
  password: z.string().trim().min(1).optional(),
  from: z.string().trim().min(1),
});

export type SmtpAvailability =
  | { ok: true; provider: "resend"; env: z.infer<typeof resendEnvSchema> }
  | { ok: true; provider: "smtp"; env: z.infer<typeof smtpEnvSchema> }
  | { ok: false; reason: string };

export function getSmtpAvailability(): SmtpAvailability {
  const resend = resendEnvSchema.safeParse({
    apiKey: process.env.RESEND_API_KEY ?? "",
    from: process.env.RESEND_FROM_EMAIL ?? process.env.SMTP_FROM ?? "",
  });

  if (resend.success) {
    return {
      ok: true,
      provider: "resend",
      env: resend.data,
    };
  }

  const parsed = smtpEnvSchema.safeParse({
    host: process.env.SMTP_HOST ?? "",
    port: process.env.SMTP_PORT ?? "",
    user: process.env.SMTP_USER ?? "",
    password: process.env.SMTP_PASSWORD ?? "",
    from: process.env.SMTP_FROM ?? "",
  });

  if (!parsed.success) {
    return {
      ok: false,
      reason:
        "Email delivery is not configured yet. Set RESEND_API_KEY and RESEND_FROM_EMAIL, or configure SMTP_HOST, SMTP_PORT, and SMTP_FROM.",
    };
  }

  return {
    ok: true,
    provider: "smtp",
    env: parsed.data,
  };
}

export async function sendTransactionalEmail(input: {
  to: string;
  subject: string;
  html: string;
  text: string;
}) {
  const smtp = getSmtpAvailability();

  if (!smtp.ok) {
    throw new Error(smtp.reason);
  }

  if (smtp.provider === "resend") {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${smtp.env.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: smtp.env.from,
        to: [input.to],
        subject: input.subject,
        text: input.text,
        html: input.html,
      }),
    });

    if (!response.ok) {
      const payload = await response.text().catch(() => "");
      throw new Error(payload || `Resend email request failed with status ${response.status}.`);
    }

    return;
  }

  const transport = nodemailer.createTransport({
    host: smtp.env.host,
    port: smtp.env.port,
    secure: smtp.env.port === 465,
    requireTLS: smtp.env.port === 587,
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
    auth:
      smtp.env.user && smtp.env.password
        ? {
            user: smtp.env.user,
            pass: smtp.env.password,
          }
        : undefined,
    tls: {
      servername: smtp.env.host,
    },
  });

  await transport.sendMail({
    from: smtp.env.from,
    to: input.to,
    subject: input.subject,
    text: input.text,
    html: input.html,
  });
}
