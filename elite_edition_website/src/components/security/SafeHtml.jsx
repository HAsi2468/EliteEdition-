import React, { useMemo } from 'react';
import DOMPurify from 'dompurify';

const BASE_ALLOWED_TAGS = [
  'p', 'b', 'i', 'em', 'strong', 'a', 'ul', 'ol', 'li',
  'h1', 'h2', 'h3', 'code', 'pre', 'blockquote', 'span', 'br'
];

const TABLE_TAGS = ['table', 'thead', 'tbody', 'tr', 'th', 'td'];

const ALLOWED_ATTRIBUTES = ['href', 'target', 'rel', 'title', 'class'];

// Register DOMPurify Hook to Enforce Safe Anchors and strip dangerous protocols
if (typeof DOMPurify !== 'undefined' && DOMPurify.addHook) {
  DOMPurify.addHook('afterSanitizeAttributes', (node) => {
    if (node.tagName === 'A') {
      const href = node.getAttribute('href') || '';

      if (href.startsWith('http://') || href.startsWith('https://')) {
        node.setAttribute('target', '_blank');
        node.setAttribute('rel', 'noopener noreferrer');
      }

      const lower = href.toLowerCase();
      if (
        lower.startsWith('javascript:') ||
        lower.startsWith('data:') ||
        lower.startsWith('vbscript:')
      ) {
        node.removeAttribute('href');
      }
    }
  });
}

export const SafeHtml = ({
  html,
  className = '',
  as: Component = 'div',
  allowTables = false,
  style = {},
  ...rest
}) => {
  const sanitizedMarkup = useMemo(() => {
    if (!html) return '';

    const allowedTags = allowTables
      ? [...BASE_ALLOWED_TAGS, ...TABLE_TAGS]
      : BASE_ALLOWED_TAGS;

    return DOMPurify.sanitize(html, {
      ALLOWED_TAGS: allowedTags,
      ALLOWED_ATTR: ALLOWED_ATTRIBUTES,
      ALLOW_DATA_ATTR: false,
      FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'style', 'meta', 'link'],
      FORBID_ATTR: [
        'onload', 'onerror', 'onclick', 'onmouseover', 'onfocus', 'onblur',
        'style', 'formaction', 'srcset'
      ],
      USE_PROFILES: { html: true },
      RETURN_DOM: false,
      RETURN_DOM_FRAGMENT: false,
    });
  }, [html, allowTables]);

  return (
    <Component
      {...rest}
      className={`safe-html-container ${className}`}
      style={style}
      dangerouslySetInnerHTML={{ __html: sanitizedMarkup }}
    />
  );
};
