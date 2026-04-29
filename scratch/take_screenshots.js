const { chromium } = require('@playwright/test');
const fs = require('fs');

const outputDir = 'C:\\Users\\colds\\.gemini\\antigravity\\brain\\f8fb9f01-be64-4dee-aa00-5a85b92b7c66';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 1080 } });
  
  console.log('Taking screenshot: weekly_report.png');
  await page.goto('http://localhost:3000/admin/reports/weekly/new', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${outputDir}\\weekly_report.png`, fullPage: true });

  console.log('Taking screenshot: monthly_report.png');
  await page.goto('http://localhost:3000/admin/reports/monthly/new', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${outputDir}\\monthly_report.png`, fullPage: true });

  console.log('Taking screenshot: annual_report.png');
  await page.goto('http://localhost:3000/admin/reports/annual/new', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${outputDir}\\annual_report.png`, fullPage: true });

  console.log('Taking screenshot: parent_dashboard.png');
  await page.goto('http://localhost:3000/parent', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${outputDir}\\parent_dashboard.png`, fullPage: true });

  console.log('Taking screenshot: admin_dashboard.png');
  await page.goto('http://localhost:3000/admin', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${outputDir}\\admin_dashboard.png`, fullPage: true });

  await browser.close();
  console.log('Done.');
})();
