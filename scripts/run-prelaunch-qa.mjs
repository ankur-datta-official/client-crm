import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import {
  DEFAULT_TARGET_EMAIL,
  ensureQaWorkspace,
  getPrismaClient,
  seedQaDataset,
  validateQaDataset,
} from "./prelaunch-qa-lib.mjs";

const emailArg = process.argv.slice(2).find((item) => !item.startsWith("--")) ?? DEFAULT_TARGET_EMAIL;
const args = new Set(process.argv.slice(2));
const skipBuild = args.has("--skip-build");
const skipLint = args.has("--skip-lint");
const skipTypecheck = args.has("--skip-typecheck");

loadEnvFromDotEnvLocal();

const commandChecks = [
  { name: "Prisma migrate status", command: "npx prisma migrate status" },
  { name: "Schema parity", command: "npm run db:check-schema-parity" },
  { name: "Local data status", command: "npm run data:check:local" },
  ...(skipTypecheck ? [] : [{ name: "Typecheck", command: "npm run typecheck" }]),
  ...(skipLint ? [] : [{ name: "Lint", command: "npm run lint" }]),
  ...(skipBuild ? [] : [{ name: "Build", command: "npm run build" }]),
];

const prisma = getPrismaClient();

try {
  const startedAt = new Date();
  const reportDir = path.join(process.cwd(), "qa-reports");
  fs.mkdirSync(reportDir, { recursive: true });

  const commandResults = commandChecks.map(runCommand);
  const { user, organization } = await ensureQaWorkspace(prisma, emailArg);
  const seedResult = await seedQaDataset(prisma, {
    organizationId: organization.id,
    userId: user.id,
  });
  const validation = await validateQaDataset(prisma, organization.id);

  const passedAssertions = validation.assertions.filter((item) => item.ok);
  const failedAssertions = validation.assertions.filter((item) => !item.ok);
  const passedCommands = commandResults.filter((item) => item.ok);
  const blockedCommands = commandResults.filter((item) => item.blocked);
  const failedCommands = commandResults.filter((item) => !item.ok && !item.blocked);

  const manualChecks = [
    "Auth login/logout and workspace switching in browser",
    "Protected-route redirect behavior with real authenticated session",
    "Dashboard quick actions from visible task cards",
    "Meeting quick-done modal submission and UI refresh",
    "Document download/open flow against real stored files",
    "Global search UI results and keyboard behavior",
    "Export modal and downloaded file inspection",
    "Mobile layout sanity on dashboard, company, contact, meeting, and follow-up pages",
    "Role restriction checks using multiple real users",
    "Live-like deployment smoke checks outside the local environment",
  ];

  const summary = {
    startedAt: startedAt.toISOString(),
    finishedAt: new Date().toISOString(),
    targetEmail: user.email,
    workspace: {
      id: organization.id,
      name: organization.name,
    },
    seeded: seedResult.created,
    counts: validation.counts,
    automated: {
      passed: passedCommands.length + passedAssertions.length,
      failed: failedCommands.length + failedAssertions.length,
      blocked: blockedCommands.length + manualChecks.length,
    },
    commandResults,
    dataAssertions: validation.assertions,
    manualChecks,
    recommendation:
      failedCommands.length === 0 && failedAssertions.length === 0
        ? "Go with conditions"
        : "No-Go",
  };

  const stamp = startedAt.toISOString().replace(/[:.]/g, "-");
  const jsonPath = path.join(reportDir, `prelaunch-qa-${stamp}.json`);
  const mdPath = path.join(reportDir, `prelaunch-qa-${stamp}.md`);

  fs.writeFileSync(jsonPath, JSON.stringify(summary, null, 2));
  fs.writeFileSync(mdPath, renderMarkdown(summary));

  console.log(`QA report written: ${mdPath}`);
  console.log(`JSON report written: ${jsonPath}`);
  console.log(`Recommendation: ${summary.recommendation}`);
} finally {
  await prisma.$disconnect();
}

function loadEnvFromDotEnvLocal() {
  const envPath = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) {
    return;
  }

  const envLines = fs.readFileSync(envPath, "utf8").split("\n");
  for (const line of envLines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
      continue;
    }

    const index = trimmed.indexOf("=");
    const key = trimmed.slice(0, index).trim();
    const rawValue = trimmed.slice(index + 1).trim();
    if (!key) {
      continue;
    }

    const value = rawValue.replace(/^["']|["']$/g, "");
    process.env[key] = value;
  }
}

function runCommand(item) {
  const result = spawnSync(item.command, {
    shell: true,
    cwd: process.cwd(),
    encoding: "utf8",
    env: process.env,
  });

  return {
    name: item.name,
    command: item.command,
    ok: result.status === 0,
    blocked: result.error?.code === "EPERM",
    exitCode: result.status,
    stdout: (result.stdout ?? "").trim(),
    stderr: [
      (result.stderr ?? "").trim(),
      result.error?.message ? `Command spawn error: ${result.error.message}` : "",
    ].filter(Boolean).join(" ").trim(),
  };
}

function renderMarkdown(summary) {
  const lines = [];
  lines.push("# Pre-Launch QA Report");
  lines.push("");
  lines.push(`- Generated at: ${summary.finishedAt}`);
  lines.push(`- Target user: ${summary.targetEmail}`);
  lines.push(`- QA workspace: ${summary.workspace.name} (${summary.workspace.id})`);
  lines.push(`- Seed action: ${summary.seeded ? "Created fresh demo data" : "Reused existing demo data"}`);
  lines.push(`- Recommendation: ${summary.recommendation}`);
  lines.push("");
  lines.push("## Seeded Dataset");
  lines.push("");
  lines.push(`- Companies: ${summary.counts.companies}`);
  lines.push(`- Contacts: ${summary.counts.contacts}`);
  lines.push(`- Meetings: ${summary.counts.interactions}`);
  lines.push(`- Follow-ups: ${summary.counts.followups}`);
  lines.push(`- Documents: ${summary.counts.documents}`);
  lines.push(`- Help requests: ${summary.counts.helpRequests}`);
  lines.push("");
  lines.push("## Automated Checks");
  lines.push("");
  for (const item of summary.commandResults) {
    const status = item.blocked ? "Blocked" : item.ok ? "Passed" : "Failed";
    lines.push(`- ${status}: ${item.name}`);
    if (item.stderr) {
      lines.push(`  stderr: ${singleLine(item.stderr)}`);
    }
  }
  lines.push("");
  lines.push("## Data Assertions");
  lines.push("");
  for (const item of summary.dataAssertions) {
    lines.push(`- ${item.ok ? "Passed" : "Failed"}: ${item.key} - ${item.details}`);
  }
  lines.push("");
  lines.push("## Blocked / Manual Launch-Gate Checks");
  lines.push("");
  for (const item of summary.manualChecks) {
    lines.push(`- Blocked: ${item}`);
  }
  lines.push("");
  lines.push("## Severity Guide");
  lines.push("");
  lines.push("- P0: Launch blocker");
  lines.push("- P1: Critical workflow defect");
  lines.push("- P2: Data consistency or usability defect");
  lines.push("- P3: Polish issue");
  lines.push("");
  return `${lines.join("\n")}\n`;
}

function singleLine(value) {
  return value.replace(/\s+/g, " ").slice(0, 300);
}
