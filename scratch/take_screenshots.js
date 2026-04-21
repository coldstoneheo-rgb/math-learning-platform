const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  
  const baseUrl = 'http://localhost:3000';
  
  try {
    console.log('Navigating to login...');
    await page.goto(`${baseUrl}/login`, { waitUntil: 'domcontentloaded' });
    
    console.log('Filling form...');
    await page.fill('input[type="email"]', 'teacher@test.com');
    await page.fill('input[type="password"]', 'test1234');
    await page.click('button[type="submit"]');
    
    console.log('Waiting for network/UI reaction...');
    await page.waitForTimeout(3000);
    
    console.log('Tracking current URL:', page.url());
    await page.screenshot({ path: 'scratch/login_attempt.png', fullPage: true });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await browser.close();
  }
})();
