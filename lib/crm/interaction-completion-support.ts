import { cache } from "react";
import { prisma } from "@/lib/prisma";

export const hasInteractionCompletionSupport = cache(async () => {
  const rows = await prisma.$queryRaw<Array<{ exists: boolean }>>`
    select exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'interactions'
        and column_name = 'completed_at'
    ) as exists
  `;

  return Boolean(rows[0]?.exists);
});
