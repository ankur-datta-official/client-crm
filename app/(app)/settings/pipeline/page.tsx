import { PipelineSettingsManager } from "@/components/crm/settings-manager";
import { PageHeader } from "@/components/shared/page-header";
import { getPipelineStages } from "@/lib/crm/queries";
import { requirePermission } from "@/lib/auth/session";

export default async function PipelineSettingsPage() {
  await requirePermission("settings.manage");
  const stages = await getPipelineStages(true);

  return (
    <div>
      <PageHeader
        title="Pipeline"
        description="Manage pipeline stages, order, colors, probabilities, and won/lost outcomes."
      />
      <PipelineSettingsManager
        stages={stages}
      />
    </div>
  );
}
