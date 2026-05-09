import { prisma } from "@/lib/prisma";

export type DueReminder = {
  id: string;
  organization_id: string;
  title: string;
  scheduled_at: string;
  assigned_user_id: string;
  assigned_email: string;
  assigned_name: string;
  company_name: string;
};

export async function getDueFollowupReminders(): Promise<DueReminder[]> {
  const now = new Date();

  const followups = await prisma.$queryRaw<any[]>`
    select
      f.id::text as id,
      f.organization_id::text as organization_id,
      f.title,
      f.scheduled_at,
      f.reminder_before_minutes,
      f.assigned_user_id::text as assigned_user_id,
      case when p.id is null then null else jsonb_build_object('id', p.id, 'full_name', p.full_name, 'email', p.email) end as profiles,
      case when c.id is null then null else jsonb_build_object('id', c.id, 'name', c.name) end as companies
    from public.followups f
    left join public.profiles p on p.id = f.assigned_user_id
    left join public.companies c on c.id = f.company_id
    where f.status = 'pending'
      and f.assigned_user_id is not null
  `;

  const dueReminders: DueReminder[] = [];

  for (const followup of followups) {
    const scheduledAt = new Date(followup.scheduled_at);
    const reminderBeforeMinutes = followup.reminder_before_minutes || 60;
    const reminderTime = new Date(scheduledAt.getTime() - reminderBeforeMinutes * 60000);

    if (reminderTime <= now) {
      const logs = await prisma.$queryRaw<Array<{ id: string }>>`
        select id::text as id
        from public.email_reminder_logs
        where followup_id = ${followup.id}::uuid
          and status = 'sent'
        limit 1
      `;

      if (logs.length === 0) {
        dueReminders.push({
          id: followup.id,
          organization_id: followup.organization_id,
          title: followup.title,
          scheduled_at: new Date(followup.scheduled_at).toISOString(),
          assigned_user_id: followup.assigned_user_id,
          assigned_email: followup.profiles?.email || "",
          assigned_name: followup.profiles?.full_name || "User",
          company_name: followup.companies?.name || "Company",
        });
      }
    }
  }

  return dueReminders;
}

export async function logEmailReminder(
  followupId: string,
  organizationId: string,
  userId: string,
  email: string,
  status: "sent" | "failed" | "skipped",
  errorMessage?: string,
) {
  await prisma.$executeRaw`
    insert into public.email_reminder_logs (
      organization_id,
      followup_id,
      user_id,
      email,
      status,
      provider,
      error_message,
      sent_at
    )
    values (
      ${organizationId}::uuid,
      ${followupId}::uuid,
      ${userId}::uuid,
      ${email},
      ${status},
      'foundation-stub',
      ${errorMessage ?? null},
      ${status === "sent" ? new Date().toISOString() : null}::timestamptz
    )
  `;
}

export async function sendFollowupReminderEmail(reminder: DueReminder): Promise<boolean> {
  const enabled = process.env.REMINDER_EMAIL_ENABLED === "true";

  if (!enabled) {
    console.log(`[Email Reminder Skipped] To: ${reminder.assigned_email}, Title: ${reminder.title}`);
    await logEmailReminder(reminder.id, reminder.organization_id, reminder.assigned_user_id, reminder.assigned_email, "skipped", "Email reminders are disabled in .env");
    return true;
  }

  try {
    console.log(`[Email Reminder Sent] To: ${reminder.assigned_email}, Subject: Reminder: ${reminder.title}`);
    await logEmailReminder(reminder.id, reminder.organization_id, reminder.assigned_user_id, reminder.assigned_email, "sent");
    return true;
  } catch (error: any) {
    console.error("Failed to send reminder email:", error);
    await logEmailReminder(reminder.id, reminder.organization_id, reminder.assigned_user_id, reminder.assigned_email, "failed", error.message);
    return false;
  }
}
