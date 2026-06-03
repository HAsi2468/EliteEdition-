// src/polyfills/crypto.js
// Ensure Node's built‑in crypto is loaded even after bundling
if (typeof globalThis.crypto === 'undefined') {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const nodeCrypto = require('crypto');
    globalThis.crypto = nodeCrypto;
}
