import { PrismaClient } from "@prisma/client";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not set.");
}

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: connectionString,
    },
  },
});

async function main() {
  const users = await prisma.user.findMany({
    where: {
      password_hash: {
        not: null,
      },
      accounts: {
        none: {
          providerId: "credential",
        },
      },
    },
    select: {
      id: true,
      password_hash: true,
    },
  });

  if (users.length === 0) {
    console.log("No legacy credential users need backfilling.");
    return;
  }

  const now = new Date();

  await prisma.$transaction(
    users.map((user) =>
      prisma.account.create({
        data: {
          id: crypto.randomUUID(),
          userId: user.id,
          accountId: user.id,
          providerId: "credential",
          password: user.password_hash,
          createdAt: now,
          updatedAt: now,
        },
      }),
    ),
  );

  console.log(`Backfilled ${users.length} Better Auth credential account(s).`);
}

main()
  .catch((error) => {
    console.error("Backfill failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
