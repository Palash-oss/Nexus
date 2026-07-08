const { PrismaClient } = require("@prisma/client");
const db = new PrismaClient();

async function main() {
  try {
    const total = await db.document.count();
    const bySource = await db.document.groupBy({
      by: ["source"],
      _count: { id: true }
    });
    console.log("Total documents in database:", total);
    console.log("By source:", JSON.stringify(bySource, null, 2));
  } catch (error) {
    console.error("Database query failed:", error);
  } finally {
    await db.$disconnect();
  }
}

main();
