import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;

  if (!email) {
    throw new Error("ADMIN_EMAIL is required");
  }

  if (!password || password.length < 8) {
    throw new Error("ADMIN_PASSWORD must be at least 8 characters");
  }

  const name = process.env.ADMIN_NAME?.trim() || email;
  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.user.upsert({
    where: { email },
    create: {
      email,
      name,
      passwordHash,
      role: "admin",
      isActive: true,
    },
    update: {
      name,
      passwordHash,
      role: "admin",
      isActive: true,
    },
  });

  console.log(`Admin user ready: ${email}`);
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
