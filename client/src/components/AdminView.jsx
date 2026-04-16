import { useState, useEffect } from 'react';
import AdminItems from './AdminItems.jsx';
import AdminCustomers from './AdminCustomers.jsx';
import AdminBids from './AdminBids.jsx';
import FinishedAuctions from './FinishedAuctions.jsx';

function StatCard({ label, value, sub, color }) {
  return (
    <div className="card p-4 flex flex-col gap-1">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`text-3xl font-bold ${color || 'text-slate-800'}`}>{value}</div>
      {sub && <div className="text-xs text-slate-400">{sub}</div>}
    </div>
  );
}

const TABS = [
  { id: 'items',     label: '📦 Items' },
  { id: 'customers', label: '👤 Customers' },
  { id: 'bids',      label: '📋 Bid History' },
  { id: 'finished',  label: '🏁 Finished' },
];

export default function AdminView({ socket }) {
  const [tab, setTab]         = useState('items');
  const [stats, setStats]     = useState(null);
  const [finishedCount, setFinishedCount] = useState(0);

  const fetchStats = async () => {
    try {
      const res  = await fetch('/api/stats');
      const data = await res.json();
      setStats(data);
    } catch {}
  };

  const fetchFinishedCount = async () => {
    try {
      const res  = await fetch('/api/items?ended=true');
      const data = await res.json();
      setFinishedCount(data.length);
    } catch {}
  };

  useEffect(() => {
    fetchStats();
    fetchFinishedCount();
    socket.on('items:changed',     () => { fetchStats(); fetchFinishedCount(); });
    socket.on('customers:changed', fetchStats);
    socket.on('bid:placed',        fetchStats);
    socket.on('bids:changed',      fetchStats);
    return () => {
      socket.off('items:changed');
      socket.off('customers:changed');
      socket.off('bid:placed');
      socket.off('bids:changed');
    };
  }, [socket]);

  const fmt$ = (n) => '$' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      {/* Stats overview */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Active Items"   value={stats.total_items}     />
          <StatCard label="Customers"      value={stats.total_customers} />
          <StatCard label="Total Bids"     value={stats.total_bids}      />
          <StatCard
            label="Total Value"
            value={fmt$(stats.total_value)}
            sub={`across ${stats.items_with_bids} item${stats.items_with_bids !== 1 ? 's' : ''}`}
            color="text-indigo-600"
          />
        </div>
      )}

      {/* Tab navigation */}
      <div className="flex border-b border-slate-200 -mb-4 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`relative shrink-0 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              tab === t.id
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {t.label}
            {/* Badge on Finished tab when there are ended items */}
            {t.id === 'finished' && finishedCount > 0 && (
              <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 text-xs font-bold rounded-full bg-amber-500 text-white">
                {finishedCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="pt-2">
        {tab === 'items'     && <AdminItems        socket={socket} />}
        {tab === 'customers' && <AdminCustomers    socket={socket} />}
        {tab === 'bids'      && <AdminBids         socket={socket} />}
        {tab === 'finished'  && <FinishedAuctions  socket={socket} />}
      </div>
    </div>
  );
}
