const ExcelJS = require('exceljs');
const path = require('path');

const filePath = path.join(__dirname, '../../Untitled spreadsheet-4.xlsx');

function cleanVal(cell) {
  if (!cell || cell.value === null || cell.value === undefined) return '';
  if (cell.value && typeof cell.value === 'object' && cell.value.result !== undefined) {
    const r = cell.value.result;
    return r === null || r === undefined ? '' : String(r).trim();
  }
  const strVal = String(cell.value).trim();
  return strVal === 'null' ? '' : strVal;
}

async function inspect() {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const sheet = workbook.worksheets[0];
  
  for (let i = 2; i <= sheet.rowCount; i++) {
    const row = sheet.getRow(i);
    const jobNo = cleanVal(row.getCell(1));
    if (jobNo === 'JOB-2474' || jobNo === 'JOB-2475' || jobNo === 'JOB-2626') {
      console.log(`\nRow ${i} (${jobNo}):`);
      row.eachCell((cell, colNum) => {
        console.log(`  Col ${colNum} (${sheet.getRow(1).getCell(colNum).value}): "${cleanVal(cell)}"`);
      });
    }
  }
}

inspect().catch(console.error);
