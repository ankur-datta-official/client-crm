import "server-only";

import nodemailer from "nodemailer";
import { z } from "zod";

const smtpEnvSchema = z.object({
  host: z.string().trim().min(1),
  port: z.coerce.number().int().positive(),
  user: z.string().trim().min(1).optional(),
  password: z.string().trim().min(1).optional(),
  from: z.string().trim().min(1),
});

export type SmtpAvailability =
  | { ok: true; env: z.infer<typeof smtpEnvSchema> }
  | { ok: false; reason: string };

export function getSmtpAvailability(): SmtpAvailability {
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
      reason: "SMTP is not configured yet. Set SMTP_HOST, SMTP_PORT, and SMTP_FROM to enable invitation emails.",
    };
  }

  return {
    ok: true,
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

  const transport = nodemailer.createTransport({
    host: smtp.env.host,
    port: smtp.env.port,
    secure: smtp.env.port === 465,
    auth:
      smtp.env.user && smtp.env.password
        ? {
            user: smtp.env.user,
            pass: smtp.env.password,
          }
        : undefined,
  });

  await transport.sendMail({
    from: smtp.env.from,
    to: input.to,
    subject: input.subject,
    text: input.text,
    html: input.html,
  });
}
