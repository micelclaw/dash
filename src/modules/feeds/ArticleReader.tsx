import { useState } from 'react';
import { ExternalLink, Star, BookmarkPlus, FileText, Sparkles, Eye, EyeOff, Loader2 } from 'lucide-react';
import { useFeedsStore, type RssArticle } from '@/stores/feeds.store';
import DOMPurify from 'dompurify';

export function ArticleReader() {
  const articles = useFeedsStore(s => s.articles);
  const activeArticleId = useFeedsStore(s => s.activeArticleId);
  const toggleRead = useFeedsStore(s => s.toggleRead);
  const toggleFavorite = useFeedsStore(s => s.toggleFavorite);
  const fetchFullText = useFeedsStore(s => s.fetchFullText);
  const summarizeArticle = useFeedsStore(s => s.summarizeArticle);
  const feeds = useFeedsStore(s => s.feeds);

  const [fetchingFull, setFetchingFull] = useState(false);
  const [summarizing, setSummarizing] = useState(false);

  const article = articles.find(a => a.id === activeArticleId);
  if (!article) {
    return (
      <div className="flex items-center justify-center h-full text-[var(--text-muted)] text-sm">
        Select an article to read
      </div>
    );
  }

  const feed = feeds.find(f => f.id === article.feed_id);

  const handleFetchFull = async () => {
    setFetchingFull(true);
    try { await fetchFullText(article.id); } finally { setFetchingFull(false); }
  };

  const handleSummarize = async () => {
    setSummarizing(true);
    try { await summarizeArticle(article.id); } finally { setSummarizing(false); }
  };

  const isYoutube = article.media_type === 'video/youtube';
  const isPodcast = article.media_type?.startsWith('audio/');
  const youtubeId = isYoutube ? extractYoutubeId(article.media_url || article.url) : null;

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[var(--border)] space-y-2">
        <h1 className="text-lg font-semibold text-[var(--text)] leading-tight">{article.title}</h1>
        <div className="flex items-center gap-2 text-xs text-[var(--text-dim)]">
          {article.author && <span>{article.author}</span>}
          {article.author && feed && <span>·</span>}
          {feed && <span>{feed.title}</span>}
          {article.published_at && (
            <>
              <span>·</span>
              <span>{new Date(article.published_at).toLocaleDateString('es', { year: 'numeric', month: 'short', day: 'numeric' })}</span>
            </>
          )}
        </div>

        {/* Action bar */}
        <div className="flex items-center gap-1 flex-wrap">
          <ActionButton
            icon={article.is_read ? <EyeOff size={14} /> : <Eye size={14} />}
            label={article.is_read ? 'Mark unread' : 'Mark read'}
            onClick={() => toggleRead(article.id, !article.is_read)}
          />
          <ActionButton
            icon={<Star size={14} className={article.is_favorite ? 'fill-[var(--amber)] text-[var(--amber)]' : ''} />}
            label={article.is_favorite ? 'Unfavorite' : 'Favorite'}
            onClick={() => toggleFavorite(article.id)}
          />
          <a
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 px-2 py-1 text-xs text-[var(--text-dim)] hover:text-[var(--text)] hover:bg-[var(--surface-hover)] rounded"
          >
            <ExternalLink size={14} /> Original
          </a>
          {!article.full_text_fetched && !isYoutube && (
            <ActionButton
              icon={fetchingFull ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
              label="Fetch full text"
              onClick={handleFetchFull}
              disabled={fetchingFull}
            />
          )}
          {!article.ai_summary && (
            <ActionButton
              icon={summarizing ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
              label="Summarize"
              onClick={handleSummarize}
              disabled={summarizing}
            />
          )}
        </div>
      </div>

      {/* AI Summary */}
      {article.ai_summary && (
        <div className="mx-4 mt-3 p-3 rounded border border-[var(--amber-dim)] bg-[var(--amber-dim)]">
          <p className="text-xs font-medium text-[var(--amber)] mb-1 flex items-center gap-1">
            <Sparkles size={12} /> AI Summary
          </p>
          <p className="text-sm text-[var(--text)] whitespace-pre-wrap">{article.ai_summary}</p>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 px-4 py-4">
        {/* YouTube embed */}
        {isYoutube && youtubeId && (
          <div className="mb-4">
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${youtubeId}`}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="w-full aspect-video rounded-lg"
            />
          </div>
        )}

        {/* Podcast player */}
        {isPodcast && article.media_url && (
          <div className="mb-4 p-3 rounded-lg bg-[var(--surface)] border border-[var(--border)]">
            <audio controls preload="none" className="w-full h-10">
              <source src={article.media_url} type={article.media_type || 'audio/mpeg'} />
            </audio>
            {article.media_duration && (
              <p className="text-xs text-[var(--text-dim)] mt-1">{formatDuration(article.media_duration)}</p>
            )}
          </div>
        )}

        {/* Article body */}
        {article.content_html ? (
          <div
            className="prose prose-invert prose-sm max-w-none
              prose-headings:text-[var(--text)] prose-p:text-[var(--text-dim)]
              prose-a:text-[var(--amber)] prose-a:no-underline hover:prose-a:underline
              prose-img:rounded-lg prose-img:max-w-full"
            dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(article.content_html) }}
          />
        ) : article.summary ? (
          <div className="text-sm text-[var(--text-dim)] whitespace-pre-wrap">
            {article.summary}
            {!article.full_text_fetched && !isYoutube && (
              <button
                onClick={handleFetchFull}
                disabled={fetchingFull}
                className="block mt-4 text-[var(--amber)] hover:underline text-xs disabled:opacity-50"
              >
                {fetchingFull ? 'Fetching...' : 'Fetch full article'}
              </button>
            )}
          </div>
        ) : (
          <p className="text-sm text-[var(--text-muted)]">No content available</p>
        )}
      </div>
    </div>
  );
}

function ActionButton({ icon, label, onClick, disabled }: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      className="inline-flex items-center gap-1 px-2 py-1 text-xs text-[var(--text-dim)] hover:text-[var(--text)] hover:bg-[var(--surface-hover)] rounded disabled:opacity-50"
      onClick={onClick}
      disabled={disabled}
      title={label}
    >
      {icon} {label}
    </button>
  );
}

function extractYoutubeId(url: string): string | null {
  const match = url.match(/[?&]v=([\w-]+)/) || url.match(/youtu\.be\/([\w-]+)/) || url.match(/embed\/([\w-]+)/);
  return match?.[1] ?? null;
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m}:${s.toString().padStart(2, '0')}`;
}
