/**
 * Allowlist HTML sanitizer for TipTap blog content.
 * Strips scripts, event handlers, and dangerous URLs.
 */
const ALLOWED_TAGS = new Set([
  'p',
  'br',
  'strong',
  'b',
  'em',
  'i',
  'u',
  's',
  'strike',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'blockquote',
  'ul',
  'ol',
  'li',
  'a',
  'img',
  'figure',
  'figcaption',
  'table',
  'thead',
  'tbody',
  'tr',
  'th',
  'td',
  'hr',
  'pre',
  'code',
  'span',
  'div',
  'mark',
  'sub',
  'sup',
  'label',
  'input',
]);

const ALLOWED_ATTRS: Record<string, Set<string>> = {
  a: new Set(['href', 'title', 'rel', 'target', 'class']),
  img: new Set(['src', 'alt', 'title', 'width', 'height', 'loading', 'class']),
  td: new Set(['colspan', 'rowspan', 'style', 'class']),
  th: new Set(['colspan', 'rowspan', 'style', 'class']),
  span: new Set(['style', 'class', 'contenteditable']),
  p: new Set(['style', 'class']),
  h1: new Set(['style', 'class']),
  h2: new Set(['style', 'class']),
  h3: new Set(['style', 'class']),
  h4: new Set(['style', 'class']),
  h5: new Set(['style', 'class']),
  h6: new Set(['style', 'class']),
  div: new Set(['style', 'class', 'data-type']),
  mark: new Set(['style', 'class']),
  blockquote: new Set(['style', 'class']),
  code: new Set(['class']),
  pre: new Set(['class']),
  table: new Set(['class']),
  figure: new Set(['class']),
  ul: new Set(['class', 'data-type']),
  ol: new Set(['class', 'start', 'type']),
  li: new Set(['class', 'style', 'data-type', 'data-checked']),
  label: new Set(['contenteditable']),
  input: new Set(['type', 'checked', 'disabled']),
};

function isSafeUrl(url: string, allowDataImage = false) {
  const u = (url || '').trim().toLowerCase();
  if (!u) return false;
  if (u.startsWith('#')) return true;
  if (u.startsWith('/')) return true;
  if (u.startsWith('https://') || u.startsWith('http://')) return true;
  if (allowDataImage && u.startsWith('data:image/')) return true;
  if (u.startsWith('mailto:')) return true;
  return false;
}

function sanitizeStyle(style: string) {
  // Allow color / highlight / align / font-size (TipTap TextStyle)
  return style
    .split(';')
    .map((p) => p.trim())
    .filter(Boolean)
    .filter((part) => {
      if (/expression|url\s*\(|javascript|@import|<|>/i.test(part)) {
        return false;
      }
      if (/^(color|background-color|text-align)\s*:/i.test(part)) {
        return true;
      }
      if (/^font-size\s*:/i.test(part)) {
        const value = part.split(':').slice(1).join(':').trim();
        // e.g. 14px, 1.125rem, 18pt
        return (
          value.length > 0 &&
          value.length <= 24 &&
          /^\d+(\.\d+)?(px|rem|em|pt)$/i.test(value)
        );
      }
      return false;
    })
    .join('; ');
}

export function sanitizeBlogHtml(input: string): string {
  if (!input || typeof input !== 'string') return '';
  let html = input
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '');

  // Remove tags not in allowlist (keep inner text for unknown tags)
  html = html.replace(
    /<\/?([a-zA-Z0-9]+)(\s[^>]*)?>/g,
    (full, tagName: string, attrs = '') => {
      const tag = tagName.toLowerCase();
      const closing = full.startsWith('</');
      if (!ALLOWED_TAGS.has(tag)) return '';
      if (closing) return `</${tag}>`;

      const allowed = ALLOWED_ATTRS[tag] || new Set<string>();
      const kept: string[] = [];
      const attrRe =
        /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g;
      let m: RegExpExecArray | null;
      while ((m = attrRe.exec(attrs))) {
        const name = m[1].toLowerCase();
        const value = m[2] ?? m[3] ?? m[4] ?? '';
        if (name.startsWith('on')) continue;
        if (!allowed.has(name)) continue;
        if (name === 'href' || name === 'src') {
          if (!isSafeUrl(value, name === 'src')) continue;
        }
        if (name === 'style') {
          const safe = sanitizeStyle(value);
          if (safe) kept.push(`style="${safe}"`);
          continue;
        }
        if (name === 'type' && tag === 'input' && value !== 'checkbox') {
          continue;
        }
        if (name === 'checked' || name === 'disabled') {
          if (tag === 'input') kept.push(name);
          continue;
        }
        if (name === 'data-checked') {
          kept.push(`data-checked="${value === 'true' ? 'true' : 'false'}"`);
          continue;
        }
        if (name === 'data-type') {
          const safe = String(value).replace(/[^a-zA-Z0-9_-]/g, '');
          if (safe) kept.push(`data-type="${safe}"`);
          continue;
        }
        if (name === 'target' && value !== '_blank') continue;
        if (name === 'rel') {
          kept.push('rel="noopener noreferrer"');
          continue;
        }
        const escaped = String(value)
          .replace(/&/g, '&amp;')
          .replace(/"/g, '&quot;')
          .replace(/</g, '&lt;');
        kept.push(`${name}="${escaped}"`);
      }
      if (tag === 'a' && !kept.some((k) => k.startsWith('rel='))) {
        if (kept.some((k) => k.startsWith('target='))) {
          kept.push('rel="noopener noreferrer"');
        }
      }
      return kept.length ? `<${tag} ${kept.join(' ')}>` : `<${tag}>`;
    },
  );

  return html.trim().slice(0, 500_000);
}

export function estimateReadingMinutes(html: string): number {
  const text = (html || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const words = text ? text.split(' ').length : 0;
  return Math.max(1, Math.ceil(words / 180));
}
