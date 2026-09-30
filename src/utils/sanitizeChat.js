/**
 * Chat Message Sanitization Utility (Stored XSS & Injection Prevention)
 */

const DANGEROUS_PATTERNS = [
  /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
  /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi,
  /<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi,
  /<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi,
  /<link\b[^>]*>/gi,
  /<meta\b[^>]*>/gi,
  /on\w+\s*=\s*(?:'[^']*'|"[^"]*"|[^\s>]+)/gi,
  /href\s*=\s*(?:'javascript:[^']*'|"javascript:[^"]*"|javascript:[^\s>]+)/gi,
  /src\s*=\s*(?:'javascript:[^']*'|"javascript:[^"]*"|javascript:[^\s>]+)/gi,
  /javascript\s*:[^\s"'>]*/gi,
  /data:\s*text\/html/gi,
  /vbscript\s*:[^\s"'>]*/gi
];

/**
 * Sanitize plain or rich-text chat message strings
 * @param {string} text - Raw input content
 * @param {number} maxLength - Maximum allowable length (default: 10000)
 * @returns {string} Sanitized text
 */
function sanitizeChatMessage(text, maxLength = 10000) {
  if (typeof text !== 'string') return '';

  let sanitized = text.trim();

  // Strip dangerous tags and script injections
  DANGEROUS_PATTERNS.forEach(pattern => {
    sanitized = sanitized.replace(pattern, '');
  });

  // Basic HTML entity encoding for raw tags while keeping readable text
  sanitized = sanitized
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Truncate to maximum permissible character length
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
  }

  return sanitized;
}

/**
 * Validate attachment metadata to block malicious executables and oversized payloads
 * @param {Object} attachment
 * @returns {{ valid: boolean, error?: string }}
 */
function validateAttachment(attachment) {
  if (!attachment || typeof attachment !== 'object') {
    return { valid: true };
  }

  const FORBIDDEN_EXTENSIONS = [
    '.exe', '.bat', '.cmd', '.sh', '.bash', '.php', '.phtml',
    '.cgi', '.pl', '.py', '.js', '.vbs', '.msi', '.jar', '.scr'
  ];

  const fileName = String(attachment.fileName || attachment.name || '').toLowerCase();
  for (const ext of FORBIDDEN_EXTENSIONS) {
    if (fileName.endsWith(ext)) {
      return {
        valid: false,
        error: `Executable file extension (${ext}) is blocked for security reasons.`
      };
    }
  }

  // Max 50MB per chat attachment
  const fileSize = Number(attachment.fileSize || attachment.size || 0);
  if (fileSize > 50 * 1024 * 1024) {
    return {
      valid: false,
      error: 'File size exceeds maximum allowable limit (50 MB).'
    };
  }

  return { valid: true };
}

module.exports = {
  sanitizeChatMessage,
  validateAttachment
};
