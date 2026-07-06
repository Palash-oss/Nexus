#!/bin/bash
# Setup database schema and initialize helper functions
echo "Running Prisma DB Push..."
npx prisma db push --accept-data-loss --schema=apps/web/prisma/schema.prisma

echo "Initializing PL/pgSQL cosine_similarity helper..."
PGPASSWORD="admin" psql -U postgres -h localhost -d nexus -c "
CREATE OR REPLACE FUNCTION cosine_similarity(a double precision[], b double precision[])
RETURNS double precision AS \$\$
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
\$\$ LANGUAGE plpgsql IMMUTABLE;
"

echo "Database initialization complete! ✅"
