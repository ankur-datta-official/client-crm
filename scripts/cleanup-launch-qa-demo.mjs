import {
  DEFAULT_TARGET_EMAIL,
  cleanupQaDataset,
  ensureQaWorkspace,
  getPrismaClient,
} from "./prelaunch-qa-lib.mjs";

const emailArg = process.argv.slice(2).find((item) => !item.startsWith("--")) ?? DEFAULT_TARGET_EMAIL;

const prisma = getPrismaClient();

try {
  const { organization } = await ensureQaWorkspace(prisma, emailArg);
  const result = await cleanupQaDataset(prisma, organization.id);

  console.log(`Cleaned QA workspace: ${organization.name}`);
  console.log(`Workspace ID: ${organization.id}`);
  console.log(`Deleted QA companies: ${result.deletedCompanies}`);
} finally {
  await prisma.$disconnect();
}
