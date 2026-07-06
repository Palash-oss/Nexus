const { PrismaClient } = require("@prisma/client");
const fs = require("fs");
const path = require("path");

try {
  const envPath = path.join(__dirname, "../apps/web/.env");
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, "utf8");
    const match = envContent.match(/DATABASE_URL=["']?([^"'\s]+)["']?/);
    if (match) {
      process.env.DATABASE_URL = match[1];
    }
  }
} catch (e) {}

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    include: { accounts: true }
  });
  console.log("Users in DB:", JSON.stringify(users, null, 2));
}

main();
