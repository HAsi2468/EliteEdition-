/**
 * Unicode and Multi-Language File Helper
 * Provides universal filename decoding (handling latin1/ISO-8859-1 multipart headers)
 * and safe Unicode key sanitization for all languages (Gujarati, Hindi, Arabic, Chinese, Russian, etc.)
 */

/**
 * Decodes a raw multipart filename into genuine UTF-8 with full language support.
 * Busboy and standard multipart parsers often interpret UTF-8 header bytes as ISO-8859-1 (latin1).
 * This function detects and restores them cleanly, while preserving already valid UTF-8 strings.
 *
 * @param {string} rawName - The raw filename from req.file.originalname
 * @returns {string} - Clean decoded UTF-8 filename
 */
function decodeUnicodeFileName(rawName) {
  if (!rawName || typeof rawName !== 'string') return 'upload';
  let name = rawName;

  // 1. Detect if the string contains latin1 extended bytes (0x80 - 0xFF) from multipart headers
  try {
    if (/[\u0080-\u00FF]/.test(name)) {
      const converted = Buffer.from(name, 'latin1').toString('utf8');
      // Verify converted string is valid UTF-8 (no Unicode replacement character \uFFFD)
      if (!converted.includes('\uFFFD')) {
        name = converted;
      }
    }
  } catch (_) {}

  // 2. Unicode Normalization (NFC) - normalizes decomposed Unicode characters (e.g., from macOS)
  try {
    name = name.normalize('NFC');
  } catch (_) {}

  // 3. Remove leading/trailing spaces and control characters
  return name.replace(/[\x00-\x1F\x7F]/g, '').trim() || 'upload';
}

/**
 * Sanitizes a filename for Cloudflare R2 / S3 object keys and filesystem storage
 * while PRESERVING letters in ALL languages (Gujarati, Hindi, Arabic, Chinese, Emoji, etc.).
 *
 * It only strips illegal URL/filesystem characters: / \ ? % * : | " < > # and control chars.
 *
 * @param {string} name - Base name without extension
 * @returns {string} - Clean Unicode-safe name
 */
function sanitizeUnicodeKeyName(name) {
  if (!name || typeof name !== 'string') return 'file';
  // Strip dangerous path and URL delimiters
  let clean = name.replace(/[/\\?%*:|"<>#\x00-\x1F\x7F]/g, '_').trim();
  // Collapse whitespace
  clean = clean.replace(/\s+/g, ' ');
  return clean || 'file';
}

module.exports = {
  decodeUnicodeFileName,
  sanitizeUnicodeKeyName
};
