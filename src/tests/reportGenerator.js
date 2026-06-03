const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');

const resultsPath = path.join(__dirname, 'api_test_results.json');
const outputPath = path.join(__dirname, 'test_report.xlsx');

if (!fs.existsSync(resultsPath)) {
  console.error('Test results file not found:', resultsPath);
  process.exit(1);
}

const results = JSON.parse(fs.readFileSync(resultsPath, 'utf-8'));

const workbook = new ExcelJS.Workbook();
const sheet = workbook.addWorksheet('API Test Report');

// Header row
sheet.columns = [
  { header: 'Endpoint', key: 'endpoint', width: 30 },
  { header: 'Method', key: 'method', width: 10 },
  { header: 'Status', key: 'status', width: 10 },
  { header: 'Response Time (ms)', key: 'duration', width: 20 },
  { header: 'Passed', key: 'passed', width: 10 },
];

results.forEach((row) => {
  sheet.addRow({
    endpoint: row.endpoint,
    method: row.method,
    status: row.status,
    duration: row.duration,
    passed: row.passed ? 'YES' : 'NO',
  });
});

workbook.xlsx.writeFile(outputPath)
  .then(() => console.log('Test report generated at', outputPath))
  .catch((err) => {
    console.error('Failed to write XLSX report:', err);
    process.exit(1);
  });
