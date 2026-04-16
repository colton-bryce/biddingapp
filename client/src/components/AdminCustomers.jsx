import { useState, useEffect, useCallback } from 'react';

function fmt(n) {
  if (n == null) return '—';
  return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ── Place Bid Modal ───────────────────────────────────────────────────────────

function PlaceBidModal({ customer, items, onClose, onSuccess }) {
  const [itemId, setItemId]   = useState('');
  const [amount, setAmount]   = useState('');
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);

  const selectedItem = items.find((i) => i.id === Number(itemId));

  const minBid = selectedItem
    ? selectedItem.highest_bid != null
      ? selectedItem.highest_bid + 0.01
      : (selectedItem.starting_bid > 0 ? selectedItem.starting_bid : 0.01)
    : 0.01;

  // Reset amount when item changes
  useEffect(() => { setAmount(''); setError(''); }, [itemId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res  = await fetch('/api/bids', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ item_id: Number(itemId), customer_id: customer.customer_id, amount: parseFloat(amount) }),
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
        {/* Header */}
        <div className="flex items-start justify-between mb-5">
          <div>
            <h2 className="text-lg font-bold text-slate-800">Place Bid</h2>
            <p className="text-sm text-slate-500">On behalf of a customer</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-2xl leading-none">&times;</button>
        </div>

        {/* Customer badge */}
        <div className="flex items-center gap-3 bg-indigo-50 border border-indigo-100 rounded-lg px-4 py-3 mb-5">
          <div className="w-9 h-9 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-sm shrink-0">
            {customer.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="text-xs text-slate-500">Bidding for</div>
            <div className="font-semibold text-slate-800">{customer.name}</div>
            <div className="text-xs text-slate-400 font-mono">#{customer.customer_id}</div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Item selector */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Auction Item *</label>
            <select
              value={itemId}
              onChange={(e) => setItemId(e.target.value)}
              className="input"
              required
              autoFocus
            >
              <option value="">Select an item…</option>
              {items.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}{item.highest_bid != null ? ` — high: ${fmt(item.highest_bid)}` : ' — no bids yet'}
                </option>
              ))}
            </select>
          </div>

          {/* Current bid info for selected item */}
          {selectedItem && (
            <div className="bg-slate-50 rounded-lg p-3 grid grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-slate-500">Starting Bid</div>
                <div className="font-semibold">{selectedItem.starting_bid > 0 ? fmt(selectedItem.starting_bid) : 'Open'}</div>
              </div>
              <div>
                <div className="text-slate-500">Current High</div>
                <div className="font-semibold text-indigo-600">
                  {selectedItem.highest_bid != null
                    ? `${fmt(selectedItem.highest_bid)} by ${selectedItem.highest_bidder_name}`
                    : 'No bids yet'}
                </div>
              </div>
            </div>
          )}

          {/* Amount */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Bid Amount *</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">$</span>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                min={minBid}
                step="0.01"
                placeholder={selectedItem ? minBid.toFixed(2) : '0.00'}
                className="input pl-7"
                disabled={!itemId}
                required
              />
            </div>
            {selectedItem && (
              <p className="text-xs text-slate-500 mt-1">Minimum: {fmt(minBid)}</p>
            )}
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={loading || !itemId || !amount} className="btn-primary flex-1">
              {loading ? 'Placing…' : 'Place Bid'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Customer Form ─────────────────────────────────────────────────────────────

function CustomerForm({ customer, onSave, onCancel }) {
  const [customerId, setCustomerId] = useState(customer?.customer_id || '');
  const [name, setName]             = useState(customer?.name || '');
  const [error, setError]           = useState('');
  const [loading, setLoading]       = useState(false);
  const isNew = !customer;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const url    = isNew ? '/api/customers' : `/api/customers/${customer.id}`;
      const method = isNew ? 'POST' : 'PUT';
      const body   = isNew
        ? { customer_id: customerId.trim().toUpperCase(), name: name.trim() }
        : { name: name.trim() };

      const res  = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
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
      <h3 className="font-semibold text-slate-800">{isNew ? 'Register New Customer' : 'Edit Customer'}</h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Customer ID *</label>
          {isNew ? (
            <>
              <input
                type="text"
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value.toUpperCase())}
                placeholder="e.g. A101"
                className="input uppercase"
                required
                autoFocus
              />
              <p className="text-xs text-slate-400 mt-1">Unique ID used on bid sheets</p>
            </>
          ) : (
            <div className="input bg-slate-100 text-slate-500 cursor-not-allowed select-none">
              {customer.customer_id}
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Full Name *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Jane Smith"
            className="input"
            required
            autoFocus={!isNew}
          />
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3">{error}</div>
      )}

      <div className="flex gap-3">
        <button type="button" onClick={onCancel} className="btn-secondary flex-1">Cancel</button>
        <button type="submit" disabled={loading || !name.trim() || (isNew && !customerId.trim())} className="btn-primary flex-1">
          {loading ? 'Saving…' : isNew ? 'Register Customer' : 'Save Changes'}
        </button>
      </div>
    </form>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function AdminCustomers({ socket }) {
  const [customers, setCustomers] = useState([]);
  const [items, setItems]         = useState([]);
  const [editing, setEditing]     = useState(null);
  const [biddingFor, setBiddingFor] = useState(null);  // customer to bid for
  const [search, setSearch]       = useState('');
  const [error, setError]         = useState('');
  const [toast, setToast]         = useState(null);

  const fetchCustomers = useCallback(async () => {
    const res  = await fetch('/api/customers');
    const data = await res.json();
    setCustomers(data);
  }, []);

  const fetchItems = useCallback(async () => {
    const res  = await fetch('/api/items');
    const data = await res.json();
    setItems(data);
  }, []);

  useEffect(() => {
    fetchCustomers();
    fetchItems();
    socket.on('customers:changed', fetchCustomers);
    socket.on('items:changed',     fetchItems);
    socket.on('bid:placed',        fetchItems);  // update highest bids in item list
    return () => {
      socket.off('customers:changed', fetchCustomers);
      socket.off('items:changed',     fetchItems);
      socket.off('bid:placed',        fetchItems);
    };
  }, [socket, fetchCustomers, fetchItems]);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  };

  const handleDelete = async (customer) => {
    const bidNote = customer.bid_count > 0
      ? ` This will also delete their ${customer.bid_count} bid${customer.bid_count !== 1 ? 's' : ''}.`
      : '';
    if (!confirm(`Remove "${customer.name}" (${customer.customer_id})?${bidNote} This cannot be undone.`)) return;
    setError('');
    const res  = await fetch(`/api/customers/${customer.id}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) setError(data.error);
  };

  const handleBidSuccess = (bid) => {
    setBiddingFor(null);
    showToast(`Bid of $${Number(bid.amount).toFixed(2)} placed for ${bid.customer_name} on "${bid.item_name}"`);
    fetchCustomers();
  };

  const filtered = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.customer_id.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-5">
      {/* Toast */}
      {toast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-xl shadow-xl bg-emerald-600 text-white text-sm font-medium">
          ✓ {toast}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-800">Customers</h2>
          <p className="text-sm text-slate-500">{customers.length} registered</p>
        </div>
        {editing == null && (
          <button onClick={() => setEditing('new')} className="btn-primary">
            + Register Customer
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3">{error}</div>
      )}

      {editing === 'new' && (
        <CustomerForm
          onSave={() => { setEditing(null); fetchCustomers(); }}
          onCancel={() => setEditing(null)}
        />
      )}

      {customers.length > 4 && editing == null && (
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or ID…"
          className="input"
        />
      )}

      {filtered.length === 0 && editing == null ? (
        <div className="text-center py-16 text-slate-400">
          <div className="text-5xl mb-3">👤</div>
          <p className="font-medium">{search ? 'No matches found' : 'No customers yet'}</p>
          {!search && <p className="text-sm mt-1">Register your first customer above.</p>}
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-4 py-3 font-semibold text-slate-600">Customer ID</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600">Name</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600 hidden sm:table-cell">Bids</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((customer) =>
                editing?.id === customer.id ? (
                  <tr key={customer.id}>
                    <td colSpan={4} className="p-4">
                      <CustomerForm
                        customer={customer}
                        onSave={() => { setEditing(null); fetchCustomers(); }}
                        onCancel={() => setEditing(null)}
                      />
                    </td>
                  </tr>
                ) : (
                  <tr key={customer.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-mono font-semibold text-indigo-700">{customer.customer_id}</td>
                    <td className="px-4 py-3 text-slate-800">{customer.name}</td>
                    <td className="px-4 py-3 text-slate-500 hidden sm:table-cell">{customer.bid_count}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={() => setBiddingFor(customer)}
                          className="btn-success text-xs py-1 px-2.5"
                          title="Place a bid on behalf of this customer"
                        >
                          Place Bid
                        </button>
                        <button
                          onClick={() => setEditing(customer)}
                          className="btn-secondary text-xs py-1 px-2.5"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(customer)}
                          className="btn-danger text-xs py-1 px-2.5"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </div>
      )}

      {biddingFor && (
        <PlaceBidModal
          customer={biddingFor}
          items={items}
          onClose={() => setBiddingFor(null)}
          onSuccess={handleBidSuccess}
        />
      )}
    </div>
  );
}
