export function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
}

export function stripMarkdown(md: string): string {
  return md
    .replace(/#{1,6}\s/g, '')
    .replace(/\*\*|__/g, '')
    .replace(/\*|_/g, '')
    .replace(/`{1,3}[^`]*`{1,3}/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/!\[.*?\]\(.*?\)/g, '')
    .trim();
}

export function getPreview(content: string, format: string, maxLength = 80): string {
  const text = format === 'html' ? stripHtml(content) : stripMarkdown(content);
  const firstLine = text.split('\n').find(l => l.trim()) || '';
  return firstLine.length > maxLength ? firstLine.slice(0, maxLength) + '...' : firstLine;
}
