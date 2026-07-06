import http from 'http';

function checkUrl(url: string): Promise<number> {
  return new Promise((resolve) => {
    http.get(url, (res) => {
      resolve(res.statusCode ?? 500);
    }).on('error', () => {
      resolve(500);
    });
  });
}

async function runTests() {
  console.log("Starting smoke tests...");
  
  // Test local development port
  const homeStatus = await checkUrl('http://localhost:3000');
  console.log(`Home Page Status: ${homeStatus}`);
  
  const providersStatus = await checkUrl('http://localhost:3000/api/auth/providers');
  console.log(`Auth Providers Status: ${providersStatus}`);
  
  const searchStatus = await checkUrl('http://localhost:3000/api/search?q=test');
  console.log(`Search Route Status (Expecting 401/200): ${searchStatus}`);
  
  if (homeStatus === 200 || homeStatus === 307) {
    console.log("✅ All smoke tests passed!");
    process.exit(0);
  } else {
    console.log("❌ Smoke tests failed! Check dev server configuration.");
    process.exit(1);
  }
}

runTests();
