import { useState, useEffect, useCallback } from 'react';

function fmt(n) {
  if (n == null) return '—';
  return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ── End Auction Modal ─────────────────────────────────────────────────────────

function EndAuctionModal({ item, onClose, onEnded }) {
  const [bids, setBids]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [ending, setEnding]   = useState(false);
  const [error, setError]     = useState('');

  useEffect(() => {
    fetch(`/api/bids?item_id=${item.id}`)
      .then((r) => r.json())
      .then((data) => { setBids(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [item.id]);

  const winner = bids[0]; // sorted highest first

  const handleEnd = async () => {
    setEnding(true);
    setError('');
    try {
      const res  = await fetch(`/api/items/${item.id}/end`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      onEnded();
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setEnding(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="card w-full max-w-md overflow-hidden">
        <div className="bg-indigo-700 px-6 py-4 text-white">
          <div className="text-xs font-semibold uppercase tracking-wide text-indigo-300 mb-0.5">End Auction</div>
          <h2 className="text-lg font-bold leading-snug">{item.name}</h2>
        </div>

        <div className="p-6 space-y-5">
          {loading ? (
            <div className="text-center py-8 text-slate-400">Loading bids…</div>
          ) : winner ? (
            <>
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">🏆 Winner</div>
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-amber-400 text-white flex items-center justify-center text-xl font-bold shrink-0">
                    {winner.customer_name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="font-bold text-slate-800 text-lg">{winner.customer_name}</div>
                    <div className="text-sm text-slate-500 font-mono">#{winner.customer_id}</div>
                  </div>
                  <div className="ml-auto text-right shrink-0">
                    <div className="text-2xl font-bold text-amber-600">{fmt(winner.amount)}</div>
                    <div className="text-xs text-slate-500">Winning bid</div>
                  </div>
                </div>
              </div>

              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">
                  All Bids ({bids.length})
                </div>
                <div className="divide-y divide-slate-100 rounded-lg border border-slate-200 overflow-hidden max-h-48 overflow-y-auto">
                  {bids.map((bid, i) => (
                    <div key={bid.id} className={`flex items-center justify-between px-4 py-2.5 text-sm ${i === 0 ? 'bg-amber-50' : 'bg-white'}`}>
                      <div className="flex items-center gap-2">
                        {i === 0 && <span className="text-amber-500">🏆</span>}
                        <span className={i === 0 ? 'font-semibold text-slate-800' : 'text-slate-600'}>{bid.customer_name}</span>
                        <span className="text-xs text-slate-400 font-mono">#{bid.customer_id}</span>
                      </div>
                      <span className={i === 0 ? 'font-bold text-amber-600' : 'text-slate-600'}>{fmt(bid.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-8">
              <div className="text-4xl mb-3">📭</div>
              <p className="font-medium text-slate-700">No bids were placed</p>
              <p className="text-sm text-slate-400 mt-1">This item will be moved to Finished Auctions.</p>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3">{error}</div>
          )}

          <p className="text-xs text-slate-400 text-center">
            Ending the auction closes bidding and moves this item to the Finished tab.
          </p>

          <div className="flex gap-3">
            <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button
              onClick={handleEnd}
              disabled={ending}
              className="btn bg-amber-500 hover:bg-amber-600 text-white flex-1 focus:ring-amber-400"
            >
              {ending ? 'Ending…' : '🏁 Confirm End Auction'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Item Form ─────────────────────────────────────────────────────────────────

function ItemForm({ item, onSave, onCancel }) {
  const [name, setName]               = useState(item?.name || '');
  const [description, setDescription] = useState(item?.description || '');
  const [startingBid, setStartingBid] = useState(item?.starting_bid || '');
  const [error, setError]             = useState('');
  const [loading, setLoading]         = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const url    = item ? `/api/items/${item.id}` : '/api/items';
      const method = item ? 'PUT' : 'POST';
      const res    = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ name: name.trim(), description: description.trim(), starting_bid: parseFloat(startingBid) || 0 }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      onSave();
    } catch {
      setError('Network error.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="card p-5 space-y-4">
      <h3 className="font-semibold text-slate-800">{item ? 'Edit Item' : 'Add New Item'}</h3>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Item Name *</label>
        <input type="text" value={name} onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Weekend Getaway Package" className="input" required autoFocus />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)}
          placeholder="Optional description of the item…"
          rows={3} className="input resize-none" />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Starting Bid ($)</label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>
          <input type="number" value={startingBid} onChange={(e) => setStartingBid(e.target.value)}
            min="0" step="0.01" placeholder="0.00" className="input pl-7" />
        </div>
        <p className="text-xs text-slate-400 mt-1">Leave empty or 0 for an open starting bid</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3">{error}</div>
      )}

      <div className="flex gap-3">
        <button type="button" onClick={onCancel} className="btn-secondary flex-1">Cancel</button>
        <button type="submit" disabled={loading || !name.trim()} className="btn-primary flex-1">
          {loading ? 'Saving…' : item ? 'Save Changes' : 'Add Item'}
        </button>
      </div>
    </form>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function AdminItems({ socket }) {
  const [items, setItems]         = useState([]);
  const [editing, setEditing]     = useState(null);
  const [endingItem, setEndingItem] = useState(null);  // item whose auction is being ended
  const [error, setError]         = useState('');

  const fetchItems = useCallback(async () => {
    const res  = await fetch('/api/items?ended=false');
    const data = await res.json();
    setItems(data);
  }, []);

  useEffect(() => {
    fetchItems();
    socket.on('items:changed', fetchItems);
    return () => socket.off('items:changed', fetchItems);
  }, [socket, fetchItems]);

  const handleDelete = async (item) => {
    if (!confirm(`Delete "${item.name}"? This cannot be undone.`)) return;
    setError('');
    const res  = await fetch(`/api/items/${item.id}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) setError(data.error);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-800">Auction Items</h2>
          <p className="text-sm text-slate-500">{items.length} item{items.length !== 1 ? 's' : ''}</p>
        </div>
        {editing == null && (
          <button onClick={() => setEditing('new')} className="btn-primary">
            + Add Item
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3">{error}</div>
      )}

      {editing === 'new' && (
        <ItemForm
          onSave={() => { setEditing(null); fetchItems(); }}
          onCancel={() => setEditing(null)}
        />
      )}

      {items.length === 0 && editing == null ? (
        <div className="text-center py-16 text-slate-400">
          <div className="text-5xl mb-3">📦</div>
          <p className="font-medium">No items yet</p>
          <p className="text-sm mt-1">Add your first auction item above.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.id}>
              {editing?.id === item.id ? (
                <ItemForm
                  item={item}
                  onSave={() => { setEditing(null); fetchItems(); }}
                  onCancel={() => setEditing(null)}
                />
              ) : (
                <div className="card p-4 flex flex-col sm:flex-row sm:items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-slate-800 truncate">{item.name}</div>
                    {item.description && (
                      <div className="text-sm text-slate-500 mt-0.5 line-clamp-1">{item.description}</div>
                    )}
                    <div className="flex flex-wrap gap-3 mt-2 text-xs text-slate-500">
                      <span>Starting: <strong>{item.starting_bid > 0 ? fmt(item.starting_bid) : 'Open'}</strong></span>
                      <span>High bid: <strong className="text-indigo-600">{item.highest_bid != null ? fmt(item.highest_bid) : '—'}</strong></span>
                      <span>{item.bid_count} bid{item.bid_count !== 1 ? 's' : ''}</span>
                      {item.highest_bidder_name && (
                        <span>Leader: <strong>{item.highest_bidder_name} ({item.highest_bidder_id})</strong></span>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2 shrink-0 flex-wrap sm:flex-nowrap">
                    <button
                      onClick={() => setEndingItem(item)}
                      className="btn bg-amber-500 hover:bg-amber-600 text-white text-sm py-1.5 px-3 focus:ring-amber-400"
                      title="Close bidding and view winner"
                    >
                      🏁 End Auction
                    </button>
                    <button
                      onClick={() => setEditing(item)}
                      className="btn-secondary text-sm py-1.5 px-3"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(item)}
                      disabled={item.bid_count > 0}
                      title={item.bid_count > 0 ? 'Use End Auction to delete items with bids' : 'Delete item'}
                      className="btn-danger text-sm py-1.5 px-3"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {endingItem && (
        <EndAuctionModal
          item={endingItem}
          onClose={() => setEndingItem(null)}
          onEnded={() => { setEndingItem(null); fetchItems(); }}
        />
      )}
    </div>
  );
}
