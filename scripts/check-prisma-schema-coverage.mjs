import fs from "node:fs";
import path from "node:path";

const rootDir = process.cwd();
const migrationsDir = path.join(rootDir, "supabase", "migrations");
const schemaPath = path.join(rootDir, "prisma", "schema.prisma");

const sqlTables = collectSqlTables(migrationsDir);
const prismaModels = collectPrismaModels(schemaPath);

const missingModels = [...sqlTables].filter((table) => !prismaModels.has(table)).sort();
const coveredModels = [...sqlTables].filter((table) => prismaModels.has(table)).sort();

console.log("Prisma schema coverage");
console.log(`SQL tables discovered: ${sqlTables.size}`);
console.log(`Prisma mapped tables: ${prismaModels.size}`);
console.log(`Covered tables: ${coveredModels.length}`);
console.log(`Missing Prisma models: ${missingModels.length}`);

if (missingModels.length > 0) {
  console.log("");
  console.log("Missing Prisma models:");
  for (const table of missingModels) {
    console.log(`- ${table}`);
  }
}

if (missingModels.length > 0) {
  process.exitCode = 1;
}

function collectSqlTables(dirPath) {
  const tables = new Set();

  if (!fs.existsSync(dirPath)) {
    return tables;
  }

  for (const fileName of fs.readdirSync(dirPath)) {
    if (!fileName.endsWith(".sql")) {
      continue;
    }

    const content = fs.readFileSync(path.join(dirPath, fileName), "utf8");
    const matches = content.matchAll(/create table if not exists public\.([a-z_]+)/gi);
    for (const match of matches) {
      tables.add(match[1]);
    }
  }

  return tables;
}

function collectPrismaModels(filePath) {
  const content = fs.readFileSync(filePath, "utf8");
  const tables = new Set();

  const mapMatches = content.matchAll(/@@map\("([a-z_]+)"\)/g);
  for (const match of mapMatches) {
    tables.add(match[1]);
  }

  return tables;
}
