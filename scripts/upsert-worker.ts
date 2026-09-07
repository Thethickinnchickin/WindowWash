import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function optionalPositiveInt(name: string, fallback: number) {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }

  const parsed = Number.parseInt(raw, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }

  return parsed;
}

async function main() {
  const email = process.env.WORKER_EMAIL?.trim().toLowerCase();
  const password = process.env.WORKER_PASSWORD;
  const name = process.env.WORKER_NAME?.trim();
  const serviceState = process.env.WORKER_SERVICE_STATE?.trim().toUpperCase() || null;
  const dailyJobCapacity = optionalPositiveInt("WORKER_DAILY_JOB_CAPACITY", 8);
  const deactivateOthers = process.env.DEACTIVATE_OTHER_WORKERS === "true";

  if (!email) {
    throw new Error("WORKER_EMAIL is required");
  }

  if (!name) {
    throw new Error("WORKER_NAME is required");
  }

  if (!password || password.length < 8) {
    throw new Error("WORKER_PASSWORD must be at least 8 characters");
  }

  const existing = await prisma.user.findUnique({
    where: { email },
    select: { role: true },
  });

  if (existing && existing.role !== "worker") {
    throw new Error(`Cannot convert existing ${existing.role} user ${email} into a worker`);
  }

  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.user.upsert({
    where: { email },
    create: {
      email,
      name,
      passwordHash,
      role: "worker",
      isActive: true,
      serviceState,
      dailyJobCapacity,
    },
    update: {
      name,
      passwordHash,
      isActive: true,
      serviceState,
      dailyJobCapacity,
    },
  });

  if (deactivateOthers) {
    await prisma.user.updateMany({
      where: {
        role: "worker",
        email: {
          not: email,
        },
      },
      data: {
        isActive: false,
      },
    });
  }

  console.log(`Worker user ready: ${email}`);
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
