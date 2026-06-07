import type { Availability } from '@partselect/types';

export function price(p: number | null, currency?: string | null): string {
  if (p == null) return 'Call for price';
  return `${currency === 'USD' || !currency ? '$' : currency + ' '}${p.toFixed(2)}`;
}

export function availabilityStyle(a: Availability): { label: string; cls: string } {
  switch (a) {
    case 'InStock':
      return { label: 'In Stock', cls: 'bg-ok-bg text-ok' };
    case 'OnOrder':
      return { label: 'On Order', cls: 'bg-warn-bg text-warn' };
    case 'SpecialOrder':
      return { label: 'Special Order', cls: 'bg-warn-bg text-warn' };
    default:
      return { label: 'Check availability', cls: 'bg-brand-tealTint text-brand-teal' };
  }
}

/** Tiny, safe markdown → HTML for assistant bubbles: headings, bold, inline code,
 *  links, ordered/unordered lists, horizontal rules, paragraphs. */
export function miniMarkdown(src: string): string {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const inline = (t: string) =>
    esc(t)
      .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer" class="ps-link">$1</a>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*([^*\n]+)\*/g, '<em>$1</em>')
      .replace(/`([^`]+)`/g, '<code>$1</code>');

  const lines = src.split('\n');
  let html = '';
  let list: 'ol' | 'ul' | null = null;
  const closeList = () => {
    if (list) {
      html += `</${list}>`;
      list = null;
    }
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    const h = line.match(/^(#{1,4})\s+(.*)/);
    const bq = line.match(/^>\s?(.*)/);
    const ol = line.match(/^\s*\d+\.\s+(.*)/);
    const ul = line.match(/^\s*[-*]\s+(.*)/);
    if (h) {
      closeList();
      html += `<div class="ps-h ps-h${h[1].length}">${inline(h[2])}</div>`;
    } else if (/^---+$/.test(line) || /^___+$/.test(line)) {
      closeList();
      html += '<hr class="ps-hr"/>';
    } else if (bq) {
      closeList();
      html += `<blockquote class="ps-bq">${inline(bq[1])}</blockquote>`;
    } else if (ol) {
      if (list !== 'ol') {
        closeList();
        html += '<ol>';
        list = 'ol';
      }
      html += `<li>${inline(ol[1])}</li>`;
    } else if (ul) {
      if (list !== 'ul') {
        closeList();
        html += '<ul>';
        list = 'ul';
      }
      html += `<li>${inline(ul[1])}</li>`;
    } else if (line.trim() === '') {
      closeList();
    } else {
      closeList();
      html += `<p>${inline(line)}</p>`;
    }
  }
  closeList();
  return html;
}
