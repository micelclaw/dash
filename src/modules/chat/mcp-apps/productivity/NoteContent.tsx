import DOMPurify from 'dompurify';
import type { Note } from '@/types/notes';
import PlainMarkdownRenderer from '@/components/markdown/PlainMarkdownRenderer';

export function NoteContent({ note }: { note: Pick<Note, 'content' | 'content_format'> }) {
 if (note.content_format === 'plain') return <div style={{ whiteSpace: 'pre-wrap' }}>{note.content}</div>;
 if (note.content_format === 'markdown') return <PlainMarkdownRenderer content={note.content} components={{ img: ({ alt }) => <span>[Imagen: {alt || 'adjunta'}]</span>, a: ({ children }) => <span>{children}</span> }} />;
 return <div dangerouslySetInnerHTML={{ __html: inertNoteHtml(note.content) }} />;
}

export function inertNoteHtml(content: string, keepEditorLinks = false): string {
 const html = DOMPurify.sanitize(content, { USE_PROFILES: { html: true }, FORBID_TAGS: ['style', 'form', 'input', 'button', 'select', 'textarea', 'option', 'optgroup', 'fieldset', 'legend', 'output', 'iframe', 'object', 'embed', 'video', 'audio', 'source', 'link', 'meta', 'base'], FORBID_ATTR: [...(keepEditorLinks ? [] : ['href']), 'src', 'srcset', 'action', 'formaction', 'background', 'ping', 'target', 'download', 'contenteditable', 'autofocus', 'tabindex', 'draggable'] });
 // CSS URLs can fetch even in otherwise inert HTML. Native CSP is a second boundary.
 const document = new DOMParser().parseFromString(html, 'text/html');
 for (const anchor of document.body.querySelectorAll('[href]')) {
  if (anchor.tagName !== 'A') { anchor.removeAttribute('href'); continue; }
  try { const url = new URL(anchor.getAttribute('href') || ''); if (!['http:', 'https:', 'mailto:'].includes(url.protocol) || url.username || url.password) anchor.removeAttribute('href'); }
  catch { anchor.removeAttribute('href'); }
 }
 for (const image of document.body.querySelectorAll('img')) {
  const placeholder = document.createElement('span'); placeholder.textContent = `[Imagen: ${image.getAttribute('alt') || 'adjunta'}]`; image.replaceWith(placeholder);
 }
 for (const element of document.body.querySelectorAll('[style]')) {
  const style = element.getAttribute('style') || '';
  element.setAttribute('style', style.split(';').filter(declaration => /^(?:color|background-color|font-weight|font-style|font-size|font-family|text-decoration|text-align|margin(?:-(?:left|right|top|bottom))?|padding(?:-(?:left|right|top|bottom))?|width|height|border(?:-collapse)?|vertical-align):\s*[\w\s#.,%"'-]+$/i.test(declaration.trim())).join(';'));
 }
 return document.body.innerHTML;
}
