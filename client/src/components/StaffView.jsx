import { useState, useEffect, useCallback } from 'react';

function fmt(n) {
  if (n == null) return '—';
  return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function BidModal({ item, currentUser, onClose, onSuccess }) {
  const [amount, setAmount]   = useState('');
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);

  const minBid = item.highest_bid != null
    ? item.highest_bid + 0.01
    : (item.starting_bid > 0 ? item.starting_bid : 0.01);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res  = await fetch('/api/bids', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          item_id:     item.id,
          customer_id: currentUser.customer_id,
          amount:      parseFloat(amount),
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      onSuccess(data);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="card p-6 w-full max-w-md">
        <div className="flex items-start justify-between mb-5">
          <div>
            <h2 className="text-lg font-bold text-slate-800">{item.name}</h2>
            <p className="text-sm text-slate-500">Place your bid</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-2xl leading-none">&times;</button>
        </div>

        {/* Current bid info */}
        <div className="bg-slate-50 rounded-lg p-4 mb-5 grid grid-cols-2 gap-3 text-sm">
          <div>
            <div className="text-slate-500">Starting Bid</div>
            <div className="font-semibold">{item.starting_bid > 0 ? fmt(item.starting_bid) : 'Open'}</div>
          </div>
          <div>
            <div className="text-slate-500">Current High</div>
            <div className="font-semibold text-indigo-600">
              {item.highest_bid != null ? fmt(item.highest_bid) : 'No bids yet'}
            </div>
          </div>
        </div>

        {/* Bidding as */}
        <div className="flex items-center gap-3 bg-indigo-50 border border-indigo-100 rounded-lg px-4 py-3 mb-5">
          <div className="w-9 h-9 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-sm shrink-0">
            {currentUser.name.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="text-xs text-slate-500">Bidding as</div>
            <div className="font-semibold text-slate-800 truncate">{currentUser.name}</div>
            <div className="text-xs text-slate-400">Bidder #{currentUser.customer_id}</div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Your Bid</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-lg">$</span>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                min={minBid}
                step="0.01"
                placeholder={minBid.toFixed(2)}
                className="input pl-8 text-lg"
                autoFocus
                required
              />
            </div>
            <p className="text-xs text-slate-500 mt-1">Minimum: {fmt(minBid)}</p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={loading || !amount} className="btn-primary flex-1">
              {loading ? 'Placing…' : 'Place Bid'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ItemCard({ item, currentUser, onBid }) {
  const hasHighBid  = item.highest_bid != null;
  const isMyTopBid  = hasHighBid && item.highest_bidder_id === currentUser?.customer_id;

  return (
    <div className={`card flex flex-col overflow-hidden hover:shadow-md transition-shadow ${isMyTopBid ? 'ring-2 ring-emerald-400' : ''}`}>
      <div className={`h-1.5 ${isMyTopBid ? 'bg-emerald-400' : hasHighBid ? 'bg-indigo-500' : 'bg-slate-200'}`} />

      <div className="p-5 flex flex-col flex-1">
        <div className="flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-bold text-slate-800 text-lg leading-snug">{item.name}</h3>
            {isMyTopBid && (
              <span className="shrink-0 text-xs font-semibold bg-emerald-100 text-emerald-700 rounded-full px-2 py-0.5">
                Your bid
              </span>
            )}
          </div>
          {item.description && (
            <p className="text-slate-500 text-sm mt-1 leading-relaxed">{item.description}</p>
          )}
        </div>

        <div className="mt-4 pt-4 border-t border-slate-100 space-y-3">
          <div className="flex justify-between items-center text-sm">
            <span className="text-slate-500">Starting bid</span>
            <span className="font-medium">{item.starting_bid > 0 ? fmt(item.starting_bid) : 'Open'}</span>
          </div>

          <div className={`rounded-lg p-3 ${isMyTopBid ? 'bg-emerald-50' : hasHighBid ? 'bg-indigo-50' : 'bg-slate-50'}`}>
            <div className="text-xs text-slate-500 mb-0.5">Current High Bid</div>
            <div className={`text-2xl font-bold ${isMyTopBid ? 'text-emerald-600' : hasHighBid ? 'text-indigo-600' : 'text-slate-400'}`}>
              {hasHighBid ? fmt(item.highest_bid) : 'No bids yet'}
            </div>
            {hasHighBid && (
              <div className="text-xs text-slate-500 mt-0.5">
                {isMyTopBid ? 'You are currently winning!' : `by ${item.highest_bidder_name}`}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">
              {item.bid_count} {item.bid_count === 1 ? 'bid' : 'bids'}
            </span>
            <button
              onClick={() => onBid(item)}
              className={`text-sm py-2 px-5 ${isMyTopBid ? 'btn-success' : 'btn-primary'}`}
            >
              {isMyTopBid ? 'Raise Bid' : 'Place Bid'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function StaffView({ socket, currentUser }) {
  const [items, setItems]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [biddingOn, setBiddingOn] = useState(null);
  const [toast, setToast]         = useState(null);

  const fetchItems = useCallback(async () => {
    try {
      const res  = await fetch('/api/items?ended=false');
      const data = await res.json();
      setItems(data);
    } catch {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    fetchItems();
    socket.on('items:changed', fetchItems);
    socket.on('bid:placed',    fetchItems);
    return () => {
      socket.off('items:changed', fetchItems);
      socket.off('bid:placed',    fetchItems);
    };
  }, [socket, fetchItems]);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const handleBidSuccess = (bid) => {
    setBiddingOn(null);
    showToast(`Bid of ${fmt(bid.amount)} placed!`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <div className="text-4xl mb-3 animate-pulse">🎯</div>
          <p className="text-slate-500">Loading auction items…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-20 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-xl shadow-xl text-white text-sm font-medium
          ${toast.type === 'success' ? 'bg-emerald-600' : 'bg-red-600'}`}>
          {toast.type === 'success' ? '✓' : '✗'} {toast.msg}
        </div>
      )}

      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-800">Auction Items</h2>
        <p className="text-slate-500 text-sm mt-1">
          {items.length} item{items.length !== 1 ? 's' : ''} · All bids update live
        </p>
      </div>

      {items.length === 0 ? (
        <div className="text-center py-24 text-slate-400">
          <div className="text-6xl mb-4">📦</div>
          <p className="text-lg font-medium">No items yet</p>
          <p className="text-sm mt-1">Ask an admin to add auction items.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((item) => (
            <ItemCard key={item.id} item={item} currentUser={currentUser} onBid={setBiddingOn} />
          ))}
        </div>
      )}

      {biddingOn && currentUser && (
        <BidModal
          item={biddingOn}
          currentUser={currentUser}
          onClose={() => setBiddingOn(null)}
          onSuccess={handleBidSuccess}
        />
      )}
    </div>
  );
}
