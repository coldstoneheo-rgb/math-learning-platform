const fs = require('fs');
const path = require('path');

const pagePath = path.join(__dirname, '..', 'src', 'app', 'page.tsx');

if (!fs.existsSync(pagePath)) {
  console.error("❌ Landing page file not found!");
  process.exit(1);
}

const content = fs.readFileSync(pagePath, 'utf8');

// 1. Check for 'use client' directive since ThemeToggle and useState are used
if (!content.includes("'use client'")) {
  console.error("❌ 'use client' directive is missing, which will crash ThemeToggle and tabs.");
  process.exit(1);
}

// 2. Check for ThemeToggle import and usage
if (!content.includes('ThemeToggle') || !content.includes('import { ThemeToggle }')) {
  console.error("❌ ThemeToggle is not imported or used correctly.");
  process.exit(1);
}

// 3. Scan for target links
const loginLinks = content.match(/href="\/login"/g) || [];
if (loginLinks.length === 0) {
  console.error("❌ No login button link targets found!");
  process.exit(1);
}

console.log(`✅ Basic validation passed. Found ${loginLinks.length} login links.`);
process.exit(0);
