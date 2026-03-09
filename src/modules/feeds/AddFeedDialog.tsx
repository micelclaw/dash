import { useState } from 'react';
import { X, Search, Loader2, Rss } from 'lucide-react';
import { api } from '@/services/api';
import { useFeedsStore } from '@/stores/feeds.store';

interface DiscoveredFeed {
  feed_url: string;
  title: string;
  description?: string;
  content_type: 'blog' | 'youtube' | 'podcast';
  site_url?: string;
}

export function AddFeedDialog({ onClose }: { onClose: () => void }) {
  const [url, setUrl] = useState('');
  const [discovering, setDiscovering] = useState(false);
  const [subscribing, setSubscribing] = useState(false);
  const [discovered, setDiscovered] = useState<DiscoveredFeed[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState('');

  const subscribe = useFeedsStore(s => s.subscribe);
  const categories = useFeedsStore(s => s.categories);

  const handleDiscover = async () => {
    if (!url.trim()) return;
    setDiscovering(true);
    setError(null);
    setDiscovered(null);
    try {
      const res = await api.post<{ data: DiscoveredFeed[] }>('/feeds/discover', { url: url.trim() });
      setDiscovered(res.data);
      if (res.data.length === 0) setError('No feeds found at this URL');
    } catch (err: any) {
      setError(err.message || 'Discovery failed');
    } finally {
      setDiscovering(false);
    }
  };

  const handleSubscribe = async (feedUrl: string) => {
    setSubscribing(true);
    setError(null);
    try {
      await subscribe(feedUrl, category || undefined);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Subscribe failed');
    } finally {
      setSubscribing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-[var(--card)] border border-[var(--border)] rounded-lg shadow-xl w-full max-w-md mx-4"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
          <h3 className="text-sm font-medium text-[var(--text)]">Add Feed</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-[var(--surface-hover)] text-[var(--text-dim)]">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-3">
          {/* URL input */}
          <div className="flex gap-2">
            <input
              type="url"
              value={url}
              onChange={e => setUrl(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleDiscover()}
              placeholder="Enter website or feed URL..."
              className="flex-1 px-3 py-2 text-sm bg-[var(--surface)] border border-[var(--border)] rounded text-[var(--text)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--amber)]"
              autoFocus
            />
            <button
              onClick={handleDiscover}
              disabled={discovering || !url.trim()}
              className="px-3 py-2 text-sm bg-[var(--amber)] text-black rounded font-medium hover:bg-[var(--amber-hover)] disabled:opacity-50"
            >
              {discovering ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
            </button>
          </div>

          {/* Category */}
          <select
            value={category}
            onChange={e => setCategory(e.target.value)}
            className="w-full px-3 py-2 text-sm bg-[var(--surface)] border border-[var(--border)] rounded text-[var(--text)] focus:outline-none focus:border-[var(--amber)]"
          >
            <option value="">No category</option>
            {categories.map(c => (
              <option key={c.id} value={c.name}>{c.name}</option>
            ))}
          </select>

          {/* Error */}
          {error && (
            <p className="text-xs text-[var(--error)]">{error}</p>
          )}

          {/* Discovered feeds */}
          {discovered && discovered.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-[var(--text-dim)]">{discovered.length} feed(s) found:</p>
              {discovered.map((feed, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 p-2 rounded border border-[var(--border)] hover:border-[var(--amber)] cursor-pointer"
                  onClick={() => !subscribing && handleSubscribe(feed.feed_url)}
                >
                  <Rss size={16} className="text-[var(--amber)] shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-[var(--text)] truncate">{feed.title}</p>
                    <p className="text-xs text-[var(--text-dim)] truncate">{feed.feed_url}</p>
                  </div>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--surface)] text-[var(--text-dim)] uppercase">
                    {feed.content_type}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Quick subscribe (direct URL) */}
          {!discovered && (
            <button
              onClick={() => handleSubscribe(url.trim())}
              disabled={subscribing || !url.trim()}
              className="w-full py-2 text-sm bg-[var(--surface)] border border-[var(--border)] rounded text-[var(--text-dim)] hover:border-[var(--amber)] hover:text-[var(--text)] disabled:opacity-50"
            >
              {subscribing ? 'Subscribing...' : 'Subscribe directly (skip discovery)'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
