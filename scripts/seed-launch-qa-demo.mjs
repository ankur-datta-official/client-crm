import {
  DEFAULT_TARGET_EMAIL,
  ensureQaWorkspace,
  getPrismaClient,
  seedQaDataset,
} from "./prelaunch-qa-lib.mjs";

const args = new Set(process.argv.slice(2));
const emailArg = process.argv.slice(2).find((item) => !item.startsWith("--")) ?? DEFAULT_TARGET_EMAIL;
const activate = args.has("--activate");

const prisma = getPrismaClient();

try {
  const { user, organization } = await ensureQaWorkspace(prisma, emailArg, { activate });
  const result = await seedQaDataset(prisma, {
    organizationId: organization.id,
    userId: user.id,
  });

  console.log(`${result.created ? "Seeded" : "Reused"} QA workspace: ${organization.name}`);
  console.log(`Workspace ID: ${organization.id}`);
  console.log(`Owner: ${user.email}`);
  console.log(`Counts: ${JSON.stringify(result.counts, null, 2)}`);
  console.log(`Active workspace switched: ${activate ? "yes" : "no"}`);
} finally {
  await prisma.$disconnect();
}
