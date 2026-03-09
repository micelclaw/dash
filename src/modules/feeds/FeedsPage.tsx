import { useEffect, useState } from 'react';
import { useFeedsStore } from '@/stores/feeds.store';
import { FeedsSidebar } from './FeedsSidebar';
import { ArticleList } from './ArticleList';
import { ArticleReader } from './ArticleReader';
import { Columns3, Columns2, CheckCheck, ArrowLeft, Menu } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-media-query';

type MobileView = 'list' | 'reader';

export function Component() {
  const layout = useFeedsStore(s => s.layout);
  const setLayout = useFeedsStore(s => s.setLayout);
  const fetchArticles = useFeedsStore(s => s.fetchArticles);
  const markAllRead = useFeedsStore(s => s.markAllRead);
  const viewMode = useFeedsStore(s => s.viewMode);
  const activeArticleId = useFeedsStore(s => s.activeArticleId);
  const selectArticle = useFeedsStore(s => s.selectArticle);
  const filters = useFeedsStore(s => s.filters);
  const setFilter = useFeedsStore(s => s.setFilter);
  const isMobile = useIsMobile();

  const [mobileView, setMobileView] = useState<MobileView>('list');
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);

  useEffect(() => {
    fetchArticles();
  }, []);

  // When article is selected on mobile, switch to reader
  useEffect(() => {
    if (isMobile && activeArticleId) {
      setMobileView('reader');
    }
  }, [activeArticleId, isMobile]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const store = useFeedsStore.getState();

      switch (e.key) {
        case 'j': {
          const idx = store.articles.findIndex(a => a.id === store.activeArticleId);
          if (idx < store.articles.length - 1) store.selectArticle(store.articles[idx + 1].id);
          break;
        }
        case 'k': {
          const idx = store.articles.findIndex(a => a.id === store.activeArticleId);
          if (idx > 0) store.selectArticle(store.articles[idx - 1].id);
          break;
        }
        case 's':
          if (store.activeArticleId) store.toggleFavorite(store.activeArticleId);
          break;
        case 'm':
          if (store.activeArticleId) {
            const article = store.articles.find(a => a.id === store.activeArticleId);
            if (article) store.toggleRead(store.activeArticleId, !article.is_read);
          }
          break;
        case 'v':
          if (store.activeArticleId) {
            const article = store.articles.find(a => a.id === store.activeArticleId);
            if (article) window.open(article.url, '_blank');
          }
          break;
        case 'Escape':
          if (isMobile && mobileView === 'reader') {
            setMobileView('list');
            store.selectArticle(null);
          }
          break;
      }

      if (e.shiftKey && e.key === 'A') {
        store.markAllRead(store.activeFeedId ? { feedId: store.activeFeedId } : undefined);
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isMobile, mobileView]);

  // ─── Mobile layout ──────────────────────────────────────
  if (isMobile) {
    return (
      <div className="flex flex-col h-full">
        {/* Mobile toolbar */}
        <div className="flex items-center gap-2 px-3 py-1.5 border-b border-[var(--border)] bg-[var(--surface)]">
          {mobileView === 'reader' ? (
            <button
              onClick={() => { setMobileView('list'); selectArticle(null); }}
              className="p-1 rounded hover:bg-[var(--surface-hover)] text-[var(--text-dim)]"
            >
              <ArrowLeft size={18} />
            </button>
          ) : (
            <button
              onClick={() => setShowMobileSidebar(!showMobileSidebar)}
              className="p-1 rounded hover:bg-[var(--surface-hover)] text-[var(--text-dim)]"
            >
              <Menu size={18} />
            </button>
          )}
          <input
            type="text"
            value={filters.search || ''}
            onChange={e => setFilter('search', e.target.value || undefined)}
            placeholder="Search..."
            className="flex-1 px-2 py-1 text-xs bg-transparent border border-[var(--border)] rounded text-[var(--text)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--amber)]"
          />
          <button
            onClick={() => markAllRead(viewMode !== 'all' && viewMode !== 'favorites' ? { feedId: viewMode } : undefined)}
            className="p-1 rounded hover:bg-[var(--surface-hover)] text-[var(--text-dim)]"
          >
            <CheckCheck size={16} />
          </button>
        </div>

        {/* Mobile sidebar overlay */}
        {showMobileSidebar && (
          <div className="fixed inset-0 z-40 flex" onClick={() => setShowMobileSidebar(false)}>
            <div className="w-[280px] h-full bg-[var(--surface)] shadow-xl" onClick={e => e.stopPropagation()}>
              <FeedsSidebar />
            </div>
            <div className="flex-1 bg-black/50" />
          </div>
        )}

        {/* Content */}
        <div className="flex-1 min-h-0 overflow-hidden">
          {mobileView === 'list' ? <ArticleList /> : <ArticleReader />}
        </div>
      </div>
    );
  }

  // ─── Desktop layout ─────────────────────────────────────
  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-[var(--border)] bg-[var(--surface)]">
        <input
          type="text"
          value={filters.search || ''}
          onChange={e => setFilter('search', e.target.value || undefined)}
          placeholder="Search articles..."
          className="flex-1 px-2 py-1 text-xs bg-transparent border border-[var(--border)] rounded text-[var(--text)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--amber)]"
        />

        <select
          value={filters.isRead === undefined ? '' : filters.isRead ? 'read' : 'unread'}
          onChange={e => {
            const v = e.target.value;
            setFilter('isRead', v === '' ? undefined : v === 'read');
          }}
          className="px-2 py-1 text-xs bg-[var(--surface)] border border-[var(--border)] rounded text-[var(--text-dim)]"
        >
          <option value="">All</option>
          <option value="unread">Unread</option>
          <option value="read">Read</option>
        </select>

        <select
          value={filters.contentType || ''}
          onChange={e => setFilter('contentType', e.target.value || undefined)}
          className="px-2 py-1 text-xs bg-[var(--surface)] border border-[var(--border)] rounded text-[var(--text-dim)]"
        >
          <option value="">All types</option>
          <option value="blog">Blog</option>
          <option value="youtube">YouTube</option>
          <option value="podcast">Podcast</option>
        </select>

        <button
          onClick={() => markAllRead(viewMode !== 'all' && viewMode !== 'favorites' ? { feedId: viewMode } : undefined)}
          className="p-1 rounded hover:bg-[var(--surface-hover)] text-[var(--text-dim)] hover:text-[var(--text)]"
          title="Mark all read (Shift+A)"
        >
          <CheckCheck size={16} />
        </button>

        <button
          onClick={() => setLayout(layout === 'three-column' ? 'two-column' : 'three-column')}
          className="p-1 rounded hover:bg-[var(--surface-hover)] text-[var(--text-dim)] hover:text-[var(--text)]"
          title={layout === 'three-column' ? 'Two column layout' : 'Three column layout'}
        >
          {layout === 'three-column' ? <Columns2 size={16} /> : <Columns3 size={16} />}
        </button>
      </div>

      {/* Main content */}
      <div className="flex flex-1 min-h-0">
        {layout === 'three-column' ? (
          <>
            <div className="w-[220px] shrink-0 border-r border-[var(--border)] overflow-hidden">
              <FeedsSidebar />
            </div>
            <div className="w-[320px] shrink-0 border-r border-[var(--border)] overflow-hidden">
              <ArticleList />
            </div>
            <div className="flex-1 overflow-hidden">
              <ArticleReader />
            </div>
          </>
        ) : (
          <>
            <div className="w-[400px] shrink-0 border-r border-[var(--border)] overflow-hidden">
              <ArticleList />
            </div>
            <div className="flex-1 overflow-hidden">
              <ArticleReader />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
