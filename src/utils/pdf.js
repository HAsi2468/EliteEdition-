/**
 * Reliable PDF Rendering & Streaming Helpers (BUG-016)
 * Buffers PDF chunks or pipelines cleanly, preventing premature socket termination
 * and "dest.on is not a function" errors.
 */
const { pipeline } = require('stream/promises');

async function sendPdfBuffered(res, filename, render) {
  const doc = render();
  const chunks = [];

  const done = new Promise((resolve, reject) => {
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  doc.end();
  const pdfBuffer = await done;

  const safeFilename = filename.replace(/[^\w.-]/g, '_');
  res.status(200)
    .type('application/pdf')
    .setHeader('Content-Disposition', `inline; filename="${safeFilename}"`);
  res.setHeader('Content-Length', String(pdfBuffer.length));
  res.end(pdfBuffer);
}

async function streamPdf(res, filename, render) {
  const doc = render();
  const safeFilename = filename.replace(/[^\w.-]/g, '_');
  res.status(200)
    .type('application/pdf')
    .setHeader('Content-Disposition', `inline; filename="${safeFilename}"`);

  const p = pipeline(doc, res);
  doc.end();
  await p;
}

module.exports = {
  sendPdfBuffered,
  streamPdf
};
