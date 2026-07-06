const { PrismaClient } = require("@prisma/client");
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

// Load DATABASE_URL from apps/web/.env manually to ensure it's available to Node.js
try {
  const envPath = path.join(__dirname, "../apps/web/.env");
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, "utf8");
    const match = envContent.match(/DATABASE_URL=["']?([^"'\s]+)["']?/);
    if (match) {
      process.env.DATABASE_URL = match[1];
      console.log("Loaded DATABASE_URL from apps/web/.env");
    }
  }
} catch (e) {
  console.warn("Could not read apps/web/.env file:", e.message);
}

async function main() {
  console.log("Running Prisma DB Push...");
  try {
    // Run db push from the root context
    execSync("npx prisma db push --accept-data-loss --skip-generate --schema=apps/web/prisma/schema.prisma", { stdio: "inherit" });
  } catch (err) {
    console.error("Prisma db push failed:", err);
    process.exit(1);
  }

  console.log("Initializing PL/pgSQL cosine_similarity helper via Prisma...");
  const prisma = new PrismaClient();

  try {
    await prisma.$executeRawUnsafe(`
      CREATE OR REPLACE FUNCTION cosine_similarity(a double precision[], b double precision[])
      RETURNS double precision AS $$
      DECLARE
        dot_product double precision := 0;
        norm_a double precision := 0;
        norm_b double precision := 0;
        i integer;
      BEGIN
        IF array_length(a, 1) != array_length(b, 1) OR array_length(a, 1) IS NULL OR array_length(b, 1) IS NULL THEN
          RETURN 0;
        END IF;
        FOR i IN 1..array_length(a, 1) LOOP
          dot_product := dot_product + (a[i] * b[i]);
          norm_a := norm_a + (a[i] * a[i]);
          norm_b := norm_b + (b[i] * b[i]);
        END LOOP;
        IF norm_a = 0 OR norm_b = 0 THEN
          RETURN 0;
        END IF;
        RETURN dot_product / (sqrt(norm_a) * sqrt(norm_b));
      END;
      $$ LANGUAGE plpgsql IMMUTABLE;
    `);
    console.log("Database cosine_similarity helper function created/updated successfully! ✅");
  } catch (error) {
    console.error("Failed to create database helper function:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
