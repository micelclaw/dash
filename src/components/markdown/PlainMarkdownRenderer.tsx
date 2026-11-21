import { lazy, Suspense } from 'react';
import type { MarkdownRendererProps } from './MarkdownRenderer';

const PlainMarkdown = lazy(async () => {
 const [{ default: ReactMarkdown }, { default: remarkGfm }] = await Promise.all([import('react-markdown'), import('remark-gfm')]);
 return { default: ({ content, components }: MarkdownRendererProps) => <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>{content}</ReactMarkdown> };
});
/** Shared GFM entrypoint for surfaces that do not need the general highlighter bundle. */
export default function PlainMarkdownRenderer(props: MarkdownRendererProps) {
 return <Suspense fallback={<div style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{props.content}</div>}><PlainMarkdown {...props} /></Suspense>;
}
