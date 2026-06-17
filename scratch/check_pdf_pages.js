const fs = require('fs');
const path = require('path');

const pdfPath = '/Users/harshitsidapara/.gemini/antigravity-ide/brain/76392cec-3e0d-4953-829b-f88b8c97d6bc/live_verified_sales.pdf';
if (!fs.existsSync(pdfPath)) {
  console.log('PDF file not found!');
  process.exit(1);
}

const content = fs.readFileSync(pdfPath, 'utf-8');
const pageCountMatch = content.match(/\/Count\s+(\d+)/);
console.log('PDF File size:', fs.statSync(pdfPath).size, 'bytes');
console.log('Page count matches:', pageCountMatch ? pageCountMatch[0] : 'None found');
console.log('Has Logo reference:', content.includes('Logo.png') || content.includes('/I0') || content.includes('/Image'));
