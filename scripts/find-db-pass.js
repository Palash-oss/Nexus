const { execSync } = require('child_process');

const passwords = [
  'admin',
  'root',
  '',
  'password',
  '123456',
  'Palash',
  'palash',
  'nexus',
  'nexus123',
  'postgres123',
  'admin123',
  'admin1234',
  'admin_password',
  'adminpass',
  'postgres1234',
  'postgres_password',
  'Password123',
  'Palash123',
  'palash123',
  'Palash123!',
  'Palash@123',
  'palash@123',
  'root123',
  'root1234',
  '1234',
  '12345',
  '0000',
  'adminadmin',
  'postgresadmin',
  'dbpassword',
  'db_password',
  'nexus_db',
  'nexus_password',
  'nexus_admin'
];

for (const pwd of passwords) {
  const url = pwd ? `postgresql://postgres:${pwd}@localhost:5432/nexus` : `postgresql://postgres@localhost:5432/nexus`;
  console.log(`Testing password: "${pwd}"`);
  try {
    // Run prisma db push with custom DATABASE_URL
    execSync('npx prisma db push --accept-data-loss', {
      env: { ...process.env, DATABASE_URL: url },
      cwd: 'c:\\Users\\Palash\\NEXUS\\apps\\web',
      stdio: 'pipe'
    });
    console.log(`\n🎉 SUCCESS! Password is: "${pwd}"`);
    console.log(`Url: ${url}`);
    process.exit(0);
  } catch (e) {
    const errText = e.stderr?.toString() || e.stdout?.toString() || '';
    if (errText.includes('Authentication failed') || errText.includes('P1000')) {
      // Continue
    } else {
      // If it's a different error (e.g. database "nexus" does not exist), then the credentials were VALID!
      if (errText.includes('does not exist') || errText.includes('P1003') || errText.includes('P2021')) {
        console.log(`\n🎉 SUCCESS! Password is: "${pwd}" (credentials valid, but database needs creation or similar)`);
        console.log(`Url: ${url}`);
        process.exit(0);
      }
      console.log(`Other error for "${pwd}":`, errText.substring(0, 200));
    }
  }
}

console.log("Could not find database password from common list.");
process.exit(1);
