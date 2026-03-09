import { useFeedsStore, type RssArticle } from '@/stores/feeds.store';
import { Star, Loader2 } from 'lucide-react';

export function ArticleList() {
  const articles = useFeedsStore(s => s.articles);
  const totalArticles = useFeedsStore(s => s.totalArticles);
  const loadingArticles = useFeedsStore(s => s.loadingArticles);
  const activeArticleId = useFeedsStore(s => s.activeArticleId);
  const selectArticle = useFeedsStore(s => s.selectArticle);
  const fetchArticles = useFeedsStore(s => s.fetchArticles);
  const feeds = useFeedsStore(s => s.feeds);

  const feedMap = new Map(feeds.map(f => [f.id, f]));

  const handleLoadMore = () => {
    if (articles.length < totalArticles) {
      fetchArticles(true);
    }
  };

  if (loadingArticles && articles.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-[var(--text-dim)]">
        <Loader2 size={20} className="animate-spin" />
      </div>
    );
  }

  if (articles.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-[var(--text-dim)] text-sm p-4 text-center">
        No articles found
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {articles.map(article => (
        <ArticleRow
          key={article.id}
          article={article}
          feedTitle={feedMap.get(article.feed_id)?.title || ''}
          active={article.id === activeArticleId}
          onClick={() => selectArticle(article.id)}
        />
      ))}

      {/* Load more */}
      {articles.length < totalArticles && (
        <button
          onClick={handleLoadMore}
          disabled={loadingArticles}
          className="px-4 py-3 text-xs text-center text-[var(--amber)] hover:bg-[var(--surface-hover)] disabled:opacity-50"
        >
          {loadingArticles ? 'Loading...' : `Load more (${articles.length}/${totalArticles})`}
        </button>
      )}
    </div>
  );
}

function ArticleRow({ article, feedTitle, active, onClick }: {
  article: RssArticle;
  feedTitle: string;
  active: boolean;
  onClick: () => void;
}) {
  const timeAgo = formatRelativeTime(article.published_at || article.fetched_at);

  return (
    <button
      className={`w-full text-left px-3 py-2.5 border-b border-[var(--border)] transition-colors
        ${active ? 'bg-[var(--amber-dim)]' : 'hover:bg-[var(--surface-hover)]'}
        ${!article.is_read ? '' : 'opacity-60'}`}
      onClick={onClick}
    >
      <div className="flex items-start gap-2">
        {/* Thumbnail */}
        {article.image_url && (
          <img
            src={article.image_url}
            alt=""
            className="w-14 h-10 rounded object-cover shrink-0 mt-0.5"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        )}

        <div className="flex-1 min-w-0">
          {/* Title */}
          <p className={`text-sm truncate ${!article.is_read ? 'font-medium text-[var(--text)]' : 'text-[var(--text-dim)]'}`}>
            {article.title}
          </p>

          {/* Meta */}
          <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-[var(--text-muted)]">
            <span className="truncate max-w-[120px]">{feedTitle}</span>
            <span>·</span>
            <span>{timeAgo}</span>
            {article.is_favorite && <Star size={10} className="text-[var(--amber)] fill-[var(--amber)]" />}
            {article.media_type?.includes('youtube') && (
              <span className="px-1 rounded bg-red-900/30 text-red-400">YT</span>
            )}
            {article.media_type?.includes('audio') && (
              <span className="px-1 rounded bg-purple-900/30 text-purple-400">Pod</span>
            )}
          </div>

          {/* Snippet */}
          {article.summary && (
            <p className="text-[11px] text-[var(--text-muted)] line-clamp-2 mt-0.5">
              {article.summary.substring(0, 150)}
            </p>
          )}
        </div>
      </div>
    </button>
  );
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'now';
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays < 7) return `${diffDays}d`;
  return date.toLocaleDateString('es', { month: 'short', day: 'numeric' });
}
