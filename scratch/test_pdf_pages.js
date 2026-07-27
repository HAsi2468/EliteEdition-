const PDFDocument = require('pdfkit');
const fs = require('fs');

const doc = new PDFDocument({ margin: 30, size: 'A4', bufferPages: true });
const stream = fs.createWriteStream('test_output.pdf');
doc.pipe(stream);

doc.text('Hello World', 30, 50);

const pages = doc.bufferedPageRange();
console.log('Pages count before footer:', pages.count);

for (let i = 0; i < pages.count; i++) {
  doc.switchToPage(i);
  doc.fillColor('#6b21a8').fontSize(8).font('Helvetica')
    .text(`Page ${i + 1} of ${pages.count} — Elite Digital Prints Fabric Challan Report`, 30, 795, { width: 535, align: 'center', lineBreak: false });
}

console.log('Pages count after footer:', doc.bufferedPageRange().count);

doc.end();
