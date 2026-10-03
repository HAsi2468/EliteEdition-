import React, { useMemo } from 'react';
import createDOMPurify from 'dompurify';

export interface SafeHtmlProps extends React.HTMLAttributes<HTMLElement> {
  /**
   * The untrusted HTML string to sanitize and render.
   */
  html?: string | null;
  /**
   * CSS class name to attach to wrapper container.
   */
  className?: string;
  /**
   * Underlying HTML tag / component to render. Default: 'div'.
   */
  as?: React.ElementType;
  /**
   * Whether to include HTML table tags in the allowlist. Default: false.
   */
  allowTables?: boolean;
  /**
   * Optional custom styling.
   */
  style?: React.CSSProperties;
}

export const BASE_ALLOWED_TAGS = [
  'p', 'b', 'i', 'em', 'strong', 'a', 'ul', 'ol', 'li',
  'h1', 'h2', 'h3', 'code', 'pre', 'blockquote',
] as const;

export const TABLE_TAGS = ['table', 'thead', 'tbody', 'tr', 'th', 'td'] as const;

export const ALLOWED_ATTRIBUTES = ['href', 'target', 'rel', 'title', 'class'] as const;

export const FORBIDDEN_TAGS = [
  'script', 'iframe', 'object', 'embed', 'style', 'meta', 'link',
  'applet', 'frame', 'frameset', 'form', 'input', 'button', 'select', 'textarea'
] as const;

export const FORBIDDEN_ATTRIBUTES = [
  'onload', 'onerror', 'onclick', 'onmouseover', 'onmouseout',
  'onkeydown', 'onkeypress', 'onkeyup', 'onfocus', 'onblur',
  'onchange', 'onsubmit', 'onreset', 'onselect', 'onscroll',
  'style', 'formaction', 'srcset', 'data-*'
] as const;

// Create DOMPurify instance with fallback for SSR environments
const getPurifyInstance = () => {
  if (typeof window !== 'undefined') {
    return typeof createDOMPurify === 'function' ? createDOMPurify(window) : createDOMPurify;
  }
  // SSR / Node fallback
  try {
    return typeof createDOMPurify === 'function' ? createDOMPurify() : createDOMPurify;
  } catch {
    return null;
  }
};

const purifyInstance = getPurifyInstance();

// Configure DOMPurify hook to enforce secure links
if (purifyInstance && typeof purifyInstance.addHook === 'function') {
  purifyInstance.addHook('afterSanitizeAttributes', (node) => {
    if (node.tagName === 'A') {
      const href = node.getAttribute('href') || '';
      const lower = href.toLowerCase().trim();

      // Block dangerous pseudo-protocols
      if (
        lower.startsWith('javascript:') ||
        lower.startsWith('data:') ||
        lower.startsWith('vbscript:') ||
        lower.startsWith('blob:') ||
        lower.startsWith('file:') ||
        lower.startsWith('//')
      ) {
        node.removeAttribute('href');
        return;
      }

      // Automatically enforce target="_blank" and rel="noopener noreferrer" on external links
      if (lower.startsWith('http://') || lower.startsWith('https://')) {
        node.setAttribute('target', '_blank');
        node.setAttribute('rel', 'noopener noreferrer');
      }
    }
  });
}

/**
 * Enterprise Rich Text Sanitizer Component
 * Zero-leak rendering primitive ensuring untrusted markup cannot execute arbitrary scripts.
 */
export const SafeHtml: React.FC<SafeHtmlProps> = ({
  html,
  className = '',
  as: Component = 'div',
  allowTables = false,
  style = {},
  ...rest
}) => {
  const sanitizedMarkup = useMemo(() => {
    if (!html || typeof html !== 'string') return '';

    if (!purifyInstance || !purifyInstance.sanitize) {
      // Defense-in-depth fallback if DOMPurify is unavailable: plain text entity escape
      return html
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;');
    }

    const allowedTags: string[] = allowTables
      ? [...BASE_ALLOWED_TAGS, ...TABLE_TAGS]
      : [...BASE_ALLOWED_TAGS];

    return purifyInstance.sanitize(html, {
      ALLOWED_TAGS: allowedTags,
      ALLOWED_ATTR: [...ALLOWED_ATTRIBUTES],
      ALLOW_DATA_ATTR: false,
      FORBID_TAGS: [...FORBIDDEN_TAGS],
      FORBID_ATTR: [...FORBIDDEN_ATTRIBUTES],
      USE_PROFILES: { html: true },
      RETURN_DOM: false,
      RETURN_DOM_FRAGMENT: false,
    }) as string;
  }, [html, allowTables]);

  return (
    <Component
      {...rest}
      className={`safe-html-container ${className}`.trim()}
      style={style}
      dangerouslySetInnerHTML={{ __html: sanitizedMarkup }}
    />
  );
};
