import { useEffect, useState } from 'react';
import { Rss, Star, ChevronDown, ChevronRight, Plus, RefreshCw, Trash2, MoreVertical, FileUp } from 'lucide-react';
import { useFeedsStore, type RssFeed } from '@/stores/feeds.store';
import { AddFeedDialog } from './AddFeedDialog';
import { OpmlDialog } from './OpmlDialog';

export function FeedsSidebar() {
  const feeds = useFeedsStore(s => s.feeds);
  const categories = useFeedsStore(s => s.categories);
  const viewMode = useFeedsStore(s => s.viewMode);
  const totalUnread = useFeedsStore(s => s.totalUnread);
  const unreadByFeed = useFeedsStore(s => s.unreadByFeed);
  const setViewMode = useFeedsStore(s => s.setViewMode);
  const fetchFeeds = useFeedsStore(s => s.fetchFeeds);
  const fetchCategories = useFeedsStore(s => s.fetchCategories);
  const fetchUnreadCounts = useFeedsStore(s => s.fetchUnreadCounts);

  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showOpmlDialog, setShowOpmlDialog] = useState(false);
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchFeeds();
    fetchCategories();
    fetchUnreadCounts();
  }, []);

  // Group feeds by category
  const grouped = new Map<string, RssFeed[]>();
  const uncategorized: RssFeed[] = [];
  for (const feed of feeds) {
    if (feed.category) {
      if (!grouped.has(feed.category)) grouped.set(feed.category, []);
      grouped.get(feed.category)!.push(feed);
    } else {
      uncategorized.push(feed);
    }
  }

  const toggleCategory = (cat: string) => {
    setCollapsedCategories(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  return (
    <div className="flex flex-col h-full bg-[var(--surface)] border-r border-[var(--border)]">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--border)]">
        <span className="text-sm font-medium text-[var(--text)]">Feeds</span>
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => setShowOpmlDialog(true)}
            className="p-1 rounded hover:bg-[var(--surface-hover)] text-[var(--text-dim)] hover:text-[var(--text)]"
            title="Import / Export OPML"
          >
            <FileUp size={14} />
          </button>
          <button
            onClick={() => setShowAddDialog(true)}
            className="p-1 rounded hover:bg-[var(--surface-hover)] text-[var(--text-dim)] hover:text-[var(--text)]"
            title="Add feed"
          >
            <Plus size={16} />
          </button>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto py-1">
        {/* All Articles */}
        <SidebarItem
          icon={<Rss size={15} />}
          label="All Articles"
          badge={totalUnread || undefined}
          active={viewMode === 'all'}
          onClick={() => setViewMode('all')}
        />

        {/* Favorites */}
        <SidebarItem
          icon={<Star size={15} />}
          label="Favorites"
          active={viewMode === 'favorites'}
          onClick={() => setViewMode('favorites')}
        />

        {/* Separator */}
        <div className="mx-3 my-2 border-t border-[var(--border)]" />

        {/* Categories */}
        {Array.from(grouped.entries()).map(([category, categoryFeeds]) => {
          const collapsed = collapsedCategories.has(category);
          const catUnread = categoryFeeds.reduce((sum, f) => sum + (unreadByFeed[f.id] || 0), 0);

          return (
            <div key={category}>
              <button
                className="flex items-center w-full px-3 py-1.5 text-xs font-medium text-[var(--text-dim)] hover:text-[var(--text)] uppercase tracking-wider"
                onClick={() => toggleCategory(category)}
              >
                {collapsed ? <ChevronRight size={12} className="mr-1" /> : <ChevronDown size={12} className="mr-1" />}
                <span className="flex-1 text-left">{category}</span>
                {catUnread > 0 && (
                  <span className="text-[10px] bg-[var(--amber-dim)] text-[var(--amber)] px-1.5 rounded-full">{catUnread}</span>
                )}
              </button>
              {!collapsed && categoryFeeds.map(feed => (
                <FeedItem
                  key={feed.id}
                  feed={feed}
                  active={viewMode === feed.id}
                  unread={unreadByFeed[feed.id] || 0}
                  onClick={() => setViewMode(feed.id)}
                />
              ))}
            </div>
          );
        })}

        {/* Uncategorized feeds */}
        {uncategorized.length > 0 && (
          <>
            {grouped.size > 0 && <div className="mx-3 my-1 border-t border-[var(--border)]" />}
            {uncategorized.map(feed => (
              <FeedItem
                key={feed.id}
                feed={feed}
                active={viewMode === feed.id}
                unread={unreadByFeed[feed.id] || 0}
                onClick={() => setViewMode(feed.id)}
              />
            ))}
          </>
        )}

        {/* Empty state */}
        {feeds.length === 0 && (
          <div className="px-4 py-8 text-center text-[var(--text-dim)] text-sm">
            <Rss size={32} className="mx-auto mb-2 opacity-30" />
            <p>No feeds yet</p>
            <button
              onClick={() => setShowAddDialog(true)}
              className="mt-2 text-[var(--amber)] hover:underline text-xs"
            >
              Subscribe to your first feed
            </button>
          </div>
        )}
      </div>

      {showAddDialog && <AddFeedDialog onClose={() => setShowAddDialog(false)} />}
      {showOpmlDialog && <OpmlDialog onClose={() => setShowOpmlDialog(false)} />}
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────

function SidebarItem({ icon, label, badge, active, onClick }: {
  icon: React.ReactNode;
  label: string;
  badge?: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={`flex items-center gap-2 w-full px-3 py-1.5 text-sm rounded-none
        ${active ? 'bg-[var(--amber-dim)] text-[var(--amber)]' : 'text-[var(--text-dim)] hover:bg-[var(--surface-hover)] hover:text-[var(--text)]'}`}
      onClick={onClick}
    >
      {icon}
      <span className="flex-1 text-left truncate">{label}</span>
      {badge !== undefined && badge > 0 && (
        <span className="text-[10px] bg-[var(--amber-dim)] text-[var(--amber)] px-1.5 rounded-full min-w-[18px] text-center">
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </button>
  );
}

function FeedItem({ feed, active, unread, onClick }: {
  feed: RssFeed;
  active: boolean;
  unread: number;
  onClick: () => void;
}) {
  const unsubscribe = useFeedsStore(s => s.unsubscribe);
  const refreshFeed = useFeedsStore(s => s.refreshFeed);
  const [showMenu, setShowMenu] = useState(false);

  return (
    <div className="relative group">
      <button
        className={`flex items-center gap-2 w-full px-3 pl-6 py-1.5 text-sm
          ${active ? 'bg-[var(--amber-dim)] text-[var(--amber)]' : 'text-[var(--text-dim)] hover:bg-[var(--surface-hover)] hover:text-[var(--text)]'}`}
        onClick={onClick}
      >
        {feed.icon_url ? (
          <img src={feed.icon_url} alt="" className="w-4 h-4 rounded" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
        ) : (
          <Rss size={14} className="opacity-50" />
        )}
        <span className="flex-1 text-left truncate">{feed.title}</span>
        {unread > 0 && (
          <span className="text-[10px] bg-[var(--amber-dim)] text-[var(--amber)] px-1.5 rounded-full min-w-[18px] text-center">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
        {feed.error_count > 0 && (
          <span className="text-[var(--error)] text-[10px]" title={feed.last_error || 'Error'}>!</span>
        )}
      </button>

      {/* Context menu trigger */}
      <button
        className="absolute right-1 top-1/2 -translate-y-1/2 p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-[var(--surface-hover)] text-[var(--text-dim)]"
        onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
      >
        <MoreVertical size={12} />
      </button>

      {showMenu && (
        <div className="absolute right-0 top-full z-50 bg-[var(--card)] border border-[var(--border)] rounded shadow-lg py-1 min-w-[140px]">
          <button
            className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-[var(--text-dim)] hover:bg-[var(--surface-hover)] hover:text-[var(--text)]"
            onClick={() => { refreshFeed(feed.id); setShowMenu(false); }}
          >
            <RefreshCw size={12} /> Refresh
          </button>
          <button
            className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-[var(--error)] hover:bg-[var(--surface-hover)]"
            onClick={() => { unsubscribe(feed.id); setShowMenu(false); }}
          >
            <Trash2 size={12} /> Unsubscribe
          </button>
        </div>
      )}
    </div>
  );
}
