import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../app/generated/prisma/client";
import bcrypt from "bcryptjs";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL ?? "" });
const prisma = new PrismaClient({ adapter });

async function seedUsers() {
  const defaultPassword = process.env.SEED_DEFAULT_PASSWORD ?? "Dev@12345!";
  const hash = await bcrypt.hash(defaultPassword, 12);

  const users = [
    { email: "admin@example.com", name: "Admin User", role: "ADMIN" as const },
    { email: "staff@example.com", name: "Staff User", role: "STAFF" as const },
    { email: "customer@example.com", name: "Customer User", role: "CUSTOMER" as const },
  ];

  for (const user of users) {
    await prisma.user.upsert({
      where: { email: user.email },
      update: { name: user.name, role: user.role, isActive: true },
      create: { ...user, passwordHash: hash, isActive: true },
    });
  }
}

seedUsers()
  .then(() => console.log("Seed complete"))
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
