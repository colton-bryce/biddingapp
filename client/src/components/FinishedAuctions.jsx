import { useState, useEffect, useCallback } from 'react';

function fmt(n) {
  if (n == null) return '—';
  return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(ts) {
  if (!ts) return '';
  return new Date(ts).toLocaleString('en-US', {
    month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
  });
}

export default function FinishedAuctions({ socket }) {
  const [items, setItems]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState('');

  const fetchItems = useCallback(async () => {
    try {
      const res  = await fetch('/api/items?ended=true');
      const data = await res.json();
      // Sort by ended_at descending (most recently ended first)
      data.sort((a, b) => (b.ended_at || '').localeCompare(a.ended_at || ''));
      setItems(data);
    } catch {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    fetchItems();
    socket.on('items:changed', fetchItems);
    return () => socket.off('items:changed', fetchItems);
  }, [socket, fetchItems]);

  const handleDelete = async (item) => {
    if (!confirm(`Permanently delete "${item.name}" and all its bids? This cannot be undone.`)) return;
    setError('');
    const res  = await fetch(`/api/items/${item.id}?cascade=true`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) setError(data.error);
  };

  if (loading) {
    return <div className="text-center py-16 text-slate-400">Loading…</div>;
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-slate-800">Finished Auctions</h2>
        <p className="text-sm text-slate-500">{items.length} completed item{items.length !== 1 ? 's' : ''}</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3">{error}</div>
      )}

      {items.length === 0 ? (
        <div className="text-center py-20 text-slate-400">
          <div className="text-6xl mb-4">🏁</div>
          <p className="text-lg font-medium">No finished auctions yet</p>
          <p className="text-sm mt-1">End an auction from the Items tab to see results here.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((item) => (
            <div key={item.id} className="card overflow-hidden">
              {/* Top stripe */}
              <div className="h-1 bg-gradient-to-r from-amber-400 to-amber-500" />

              <div className="p-5">
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="inline-flex items-center gap-1 text-xs font-semibold bg-slate-100 text-slate-500 rounded-full px-2.5 py-0.5">
                        🏁 Ended
                      </span>
                      {item.ended_at && (
                        <span className="text-xs text-slate-400">{fmtDate(item.ended_at)}</span>
                      )}
                    </div>
                    <h3 className="font-bold text-slate-800 text-lg mt-1 leading-snug">{item.name}</h3>
                    {item.description && (
                      <p className="text-sm text-slate-500 mt-0.5">{item.description}</p>
                    )}
                  </div>
                  <button
                    onClick={() => handleDelete(item)}
                    className="btn-danger text-xs py-1.5 px-3 shrink-0"
                    title="Delete this item and all its bids"
                  >
                    Delete
                  </button>
                </div>

                {item.winner_name ? (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-4">
                    {/* Avatar */}
                    <div className="w-12 h-12 rounded-full bg-amber-400 text-white flex items-center justify-center text-xl font-bold shrink-0">
                      {item.winner_name.charAt(0).toUpperCase()}
                    </div>

                    {/* Winner info */}
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-semibold uppercase tracking-wide text-amber-600 mb-0.5">🏆 Winner</div>
                      <div className="font-bold text-slate-800 text-base">{item.winner_name}</div>
                      <div className="text-xs text-slate-400 font-mono">#{item.winner_customer_id}</div>
                    </div>

                    {/* Winning amount */}
                    <div className="text-right shrink-0">
                      <div className="text-2xl font-bold text-amber-600">{fmt(item.winning_amount)}</div>
                      <div className="text-xs text-slate-500">
                        Winning bid · {item.bid_count} total
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-slate-50 rounded-xl p-4 flex items-center gap-3 text-slate-500">
                    <div className="text-2xl">📭</div>
                    <div>
                      <div className="font-medium text-slate-600">No bids placed</div>
                      <div className="text-xs text-slate-400">This item did not receive any bids</div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
