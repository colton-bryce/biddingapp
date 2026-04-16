import { useState, useEffect, useCallback } from 'react';

function fmt(n) {
  return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtTime(ts) {
  return new Date(ts + (ts.includes('Z') ? '' : 'Z')).toLocaleString('en-US', {
    month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
  });
}

export default function AdminBids({ socket }) {
  const [bids, setBids]           = useState([]);
  const [items, setItems]         = useState([]);
  const [customers, setCustomers] = useState([]);
  const [filterItem, setFilterItem]       = useState('');
  const [filterCustomer, setFilterCustomer] = useState('');
  const [loading, setLoading]     = useState(true);

  const fetchBids = useCallback(async () => {
    const params = new URLSearchParams();
    if (filterItem)     params.set('item_id',     filterItem);
    if (filterCustomer) params.set('customer_id', filterCustomer);
    const res  = await fetch(`/api/bids?${params}`);
    const data = await res.json();
    setBids(data);
    setLoading(false);
  }, [filterItem, filterCustomer]);

  const fetchMeta = useCallback(async () => {
    const [itemsRes, custRes] = await Promise.all([fetch('/api/items'), fetch('/api/customers')]);
    setItems(await itemsRes.json());
    setCustomers(await custRes.json());
  }, []);

  useEffect(() => {
    fetchMeta();
    socket.on('items:changed',    fetchMeta);
    socket.on('customers:changed', fetchMeta);
    return () => {
      socket.off('items:changed',    fetchMeta);
      socket.off('customers:changed', fetchMeta);
    };
  }, [socket, fetchMeta]);

  useEffect(() => {
    fetchBids();
    socket.on('bid:placed',   fetchBids);
    socket.on('bids:changed', fetchBids);
    return () => {
      socket.off('bid:placed',   fetchBids);
      socket.off('bids:changed', fetchBids);
    };
  }, [socket, fetchBids]);

  const handleDelete = async (bid) => {
    if (!confirm(`Delete this bid of ${fmt(bid.amount)} by ${bid.customer_name}?`)) return;
    await fetch(`/api/bids/${bid.id}`, { method: 'DELETE' });
  };

  // Highest bid per item (to highlight winners)
  const highestPerItem = bids.reduce((acc, bid) => {
    if (!acc[bid.item_id] || bid.amount > acc[bid.item_id]) acc[bid.item_id] = bid.amount;
    return acc;
  }, {});

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-slate-800">Bid History</h2>
        <p className="text-sm text-slate-500">{bids.length} bid{bids.length !== 1 ? 's' : ''} shown</p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <select
          value={filterItem}
          onChange={(e) => setFilterItem(e.target.value)}
          className="input sm:max-w-xs"
        >
          <option value="">All items</option>
          {items.map((it) => (
            <option key={it.id} value={it.id}>{it.name}</option>
          ))}
        </select>

        <select
          value={filterCustomer}
          onChange={(e) => setFilterCustomer(e.target.value)}
          className="input sm:max-w-xs"
        >
          <option value="">All customers</option>
          {customers.map((c) => (
            <option key={c.id} value={c.customer_id}>{c.name} ({c.customer_id})</option>
          ))}
        </select>

        {(filterItem || filterCustomer) && (
          <button
            onClick={() => { setFilterItem(''); setFilterCustomer(''); }}
            className="btn-secondary"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Highest bids summary — shown when viewing all items */}
      {!filterItem && !filterCustomer && items.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-slate-600 mb-2 uppercase tracking-wide">Current Leaders</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {items.map((item) => {
              const winBid = bids.find(
                (b) => b.item_id === item.id && b.amount === highestPerItem[item.id]
              );
              return (
                <div key={item.id} className={`card p-3 flex flex-col gap-1 ${winBid ? 'border-indigo-200' : ''}`}>
                  <div className="font-medium text-slate-800 text-sm truncate">{item.name}</div>
                  {winBid ? (
                    <>
                      <div className="text-indigo-600 font-bold text-lg">{fmt(winBid.amount)}</div>
                      <div className="text-xs text-slate-500">{winBid.customer_name} ({winBid.customer_id})</div>
                    </>
                  ) : (
                    <div className="text-slate-400 text-sm">No bids yet</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Bid table */}
      {loading ? (
        <div className="text-center py-8 text-slate-400">Loading…</div>
      ) : bids.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <div className="text-5xl mb-3">📋</div>
          <p className="font-medium">No bids found</p>
          {(filterItem || filterCustomer) && <p className="text-sm mt-1">Try removing filters.</p>}
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm min-w-[560px]">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-4 py-3 font-semibold text-slate-600">Item</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600">Customer</th>
                <th className="text-right px-4 py-3 font-semibold text-slate-600">Amount</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600 hidden sm:table-cell">Time</th>
                <th className="px-4 py-3 w-20" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {bids.map((bid) => {
                const isWinner = highestPerItem[bid.item_id] === bid.amount;
                return (
                  <tr key={bid.id} className={`hover:bg-slate-50 transition-colors ${isWinner ? 'bg-indigo-50/40' : ''}`}>
                    <td className="px-4 py-3 text-slate-800">
                      <div className="flex items-center gap-1.5">
                        {isWinner && <span title="Current high bid" className="text-indigo-500">★</span>}
                        <span className="truncate max-w-[150px] sm:max-w-xs">{bid.item_name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      <div>{bid.customer_name}</div>
                      <div className="text-xs text-slate-400 font-mono">{bid.customer_id}</div>
                    </td>
                    <td className={`px-4 py-3 text-right font-semibold ${isWinner ? 'text-indigo-600' : 'text-slate-800'}`}>
                      {fmt(bid.amount)}
                    </td>
                    <td className="px-4 py-3 text-slate-400 hidden sm:table-cell whitespace-nowrap">
                      {fmtTime(bid.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleDelete(bid)}
                        className="btn-danger text-xs py-1 px-2.5"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
