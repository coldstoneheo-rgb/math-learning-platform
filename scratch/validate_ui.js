const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  
  const baseUrl = 'http://localhost:3000';
  const report = [];
  
  try {
    console.log('Logging in as admin/teacher...');
    await page.goto(`${baseUrl}/login`, { waitUntil: 'domcontentloaded' });
    await page.fill('input[type="email"]', 'teacher@test.com');
    await page.fill('input[type="password"]', 'test1234');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(2000);

    const checkPage = async (name, url, keywords) => {
      console.log(`Checking ${name} at ${url}...`);
      await page.goto(url, { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);
      const text = await page.evaluate(() => document.body.innerText);
      const html = await page.evaluate(() => document.body.innerHTML);
      
      const missing = [];
      const found = [];
      
      for (const kw of keywords) {
        if (text.includes(kw) || html.includes(kw)) {
          found.push(kw);
        } else {
          missing.push(kw);
        }
      }
      
      report.push(`[${missing.length === 0 ? 'X' : ' '}] ${name}`);
      report.push(`  - URL: ${url}`);
      report.push(`  - Found: ${found.join(', ')}`);
      if (missing.length > 0) report.push(`  - Missing: ${missing.join(', ')}`);
      report.push('');
      
      // Take screenshot
      await page.screenshot({ path: `scratch/${name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.png`, fullPage: true });
    };

    // We can also look at the component names in the react devtools or by checking if the class names or text exist.
    // For now we look for English names if they are part of classNames or Korean text if they are rendered.
    await checkPage('Weekly Report', `${baseUrl}/admin/reports/weekly/new`, ['모멘텀', '추이']); // 'MomentumGauge', 'HabitTrendChart' might be obfuscated in prod/dev but Korean text is safe
    await checkPage('Monthly Report', `${baseUrl}/admin/reports/monthly/new`, ['레이더', '취약점']); 
    await checkPage('Semi-annual Report', `${baseUrl}/admin/reports/semi-annual/new`, ['궤적', '프로필']);
    await checkPage('Annual Report', `${baseUrl}/admin/reports/annual/new`, ['성장 스토리']);
    await checkPage('Admin Dashboard', `${baseUrl}/admin`, ['학습 습관']);

    // Logout and login as parent
    console.log('Logging out...');
    await context.clearCookies();
    
    console.log('Logging in as parent...');
    await page.goto(`${baseUrl}/login`, { waitUntil: 'domcontentloaded' });
    await page.fill('input[type="email"]', 'parent@test.com');
    await page.fill('input[type="password"]', 'test1234');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(2000);

    await checkPage('Parent Dashboard', `${baseUrl}/parent`, ['8주', '리포트 카드', '추이']);

    console.log('--- TEST REPORT ---');
    console.log(report.join('\n'));
    fs.writeFileSync('scratch/test_report.txt', report.join('\n'));

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await browser.close();
  }
})();
