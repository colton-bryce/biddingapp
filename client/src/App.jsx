import { useState, useEffect, useCallback } from 'react';
import { io } from 'socket.io-client';
import StaffView from './components/StaffView.jsx';
import AdminView from './components/AdminView.jsx';

const socket = io({ autoConnect: true });
const STORAGE_KEY = 'auction_user';

export default function App() {
  const [isAdmin, setIsAdmin]           = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinInput, setPinInput]         = useState('');
  const [pinError, setPinError]         = useState('');
  const [connected, setConnected]       = useState(false);

  // Current bidder identity
  const [currentUser, setCurrentUser]   = useState(null);   // { customer_id, name }
  const [showWelcome, setShowWelcome]   = useState(false);
  const [welcomeTab, setWelcomeTab]     = useState('register'); // 'register' | 'signin'
  const [regName, setRegName]           = useState('');
  const [signinId, setSigninId]         = useState('');
  const [welcomeError, setWelcomeError] = useState('');
  const [welcomeLoading, setWelcomeLoading] = useState(false);

  // Restore user from localStorage and verify the account still exists
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const user = JSON.parse(stored);
        fetch(`/api/customers/lookup/${user.customer_id}`)
          .then((r) => r.json())
          .then((data) => {
            if (data.customer_id) {
              setCurrentUser({ customer_id: data.customer_id, name: data.name });
            } else {
              localStorage.removeItem(STORAGE_KEY);
              setShowWelcome(true);
            }
          })
          .catch(() => setShowWelcome(true));
      } catch {
        localStorage.removeItem(STORAGE_KEY);
        setShowWelcome(true);
      }
    } else {
      setShowWelcome(true);
    }
  }, []);

  useEffect(() => {
    socket.on('connect',    () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));
    return () => { socket.off('connect'); socket.off('disconnect'); };
  }, []);

  const saveUser = (user) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    setCurrentUser(user);
    setShowWelcome(false);
    setRegName('');
    setSigninId('');
    setWelcomeError('');
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setWelcomeError('');
    setWelcomeLoading(true);
    try {
      const res  = await fetch('/api/customers/register', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ name: regName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setWelcomeError(data.error); return; }
      saveUser({ customer_id: data.customer_id, name: data.name });
    } catch {
      setWelcomeError('Connection error. Is the server running?');
    } finally {
      setWelcomeLoading(false);
    }
  };

  const handleSignIn = async (e) => {
    e.preventDefault();
    setWelcomeError('');
    setWelcomeLoading(true);
    try {
      const res  = await fetch(`/api/customers/lookup/${signinId.trim().toUpperCase()}`);
      const data = await res.json();
      if (!res.ok) { setWelcomeError(data.error); return; }
      saveUser({ customer_id: data.customer_id, name: data.name });
    } catch {
      setWelcomeError('Connection error. Is the server running?');
    } finally {
      setWelcomeLoading(false);
    }
  };

  const signOut = () => {
    localStorage.removeItem(STORAGE_KEY);
    setCurrentUser(null);
    setWelcomeTab('signin');
    setShowWelcome(true);
  };

  // ── Admin PIN ────────────────────────────────────────────────────────────────

  // onSuccess lets us reuse this from both the header modal and the welcome screen
  const verifyPin = useCallback(async (onSuccess) => {
    setPinError('');
    setWelcomeError('');
    try {
      const res  = await fetch('/api/auth', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ pin: pinInput }),
      });
      const data = await res.json();
      if (data.success) {
        setIsAdmin(true);
        setShowPinModal(false);
        setShowWelcome(false);
        setPinInput('');
        if (onSuccess) onSuccess();
      } else {
        const msg = 'Incorrect PIN. Try again.';
        setPinError(msg);
        setWelcomeError(msg);
        setPinInput('');
      }
    } catch {
      const msg = 'Connection error.';
      setPinError(msg);
      setWelcomeError(msg);
    }
  }, [pinInput]);

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="bg-indigo-700 text-white shadow-lg sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl" role="img" aria-label="gavel">🎯</span>
            <h1 className="text-xl font-bold tracking-tight">Silent Auction</h1>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* Connection indicator */}
            <span className="hidden sm:flex items-center gap-1.5 text-sm text-indigo-200">
              <span className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-400' : 'bg-red-400'}`} />
              {connected ? 'Live' : 'Offline'}
            </span>

            {/* Current user badge */}
            {currentUser && !isAdmin && (
              <div className="flex items-center gap-2">
                <span className="bg-indigo-600 rounded-lg px-3 py-1.5 text-sm">
                  <span className="text-indigo-300 text-xs mr-1">#{currentUser.customer_id}</span>
                  <span className="font-medium">{currentUser.name}</span>
                </span>
                <button
                  onClick={signOut}
                  className="text-indigo-300 hover:text-white text-xs underline underline-offset-2"
                  title="Sign out"
                >
                  Sign out
                </button>
              </div>
            )}

            {isAdmin ? (
              <div className="flex items-center gap-2">
                <span className="hidden sm:inline-flex items-center gap-1 bg-indigo-600 rounded-lg px-3 py-1.5 text-sm font-medium">
                  🔐 Admin Mode
                </span>
                <button
                  onClick={() => { setIsAdmin(false); setPinInput(''); setPinError(''); setWelcomeError(''); setWelcomeTab('admin'); setShowWelcome(true); }}
                  className="btn bg-indigo-600 hover:bg-indigo-500 text-white text-sm py-2"
                >
                  Exit Admin
                </button>
              </div>
            ) : (
              <button
                onClick={() => { setShowPinModal(true); setPinError(''); setPinInput(''); }}
                className="btn bg-indigo-600 hover:bg-indigo-500 text-white text-sm py-2"
              >
                🔐 Admin
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1">
        {isAdmin
          ? <AdminView socket={socket} />
          : <StaffView socket={socket} currentUser={currentUser} />
        }
      </main>

      <footer className="py-3 text-center text-xs text-slate-400 border-t border-slate-200">
        Silent Auction Management · All bids update in real time
      </footer>

      {/* ── Welcome / Sign-in Modal ────────────────────────────────────────── */}
      {showWelcome && !isAdmin && (
        <div className="fixed inset-0 bg-indigo-900/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="card p-8 w-full max-w-sm">
            <div className="text-center mb-6">
              <div className="text-4xl mb-2">🎯</div>
              <h2 className="text-xl font-bold text-slate-800">Welcome!</h2>
              <p className="text-slate-500 text-sm mt-1">
                {welcomeTab === 'admin' ? 'Sign in to manage the auction' : 'Set up your bidder identity to get started'}
              </p>
            </div>

            {/* Tabs */}
            <div className="flex rounded-lg bg-slate-100 p-1 mb-6">
              {[['register', 'New Bidder'], ['signin', 'Sign In'], ['admin', 'Admin']].map(([id, label]) => (
                <button
                  key={id}
                  onClick={() => { setWelcomeTab(id); setWelcomeError(''); setPinInput(''); }}
                  className={`flex-1 py-2 text-xs sm:text-sm font-medium rounded-md transition-all ${
                    welcomeTab === id ? 'bg-white shadow text-slate-800' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {welcomeTab === 'register' && (
              <form onSubmit={handleRegister} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Your Name</label>
                  <input
                    type="text"
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    placeholder="e.g. Jane Smith"
                    className="input"
                    autoFocus
                    required
                  />
                  <p className="text-xs text-slate-400 mt-1">You'll be assigned a Bidder ID automatically</p>
                </div>
                {welcomeError && <p className="text-red-600 text-sm">{welcomeError}</p>}
                <button type="submit" disabled={welcomeLoading || !regName.trim()} className="btn-primary w-full">
                  {welcomeLoading ? 'Registering…' : 'Register & Start Bidding'}
                </button>
              </form>
            )}

            {welcomeTab === 'signin' && (
              <form onSubmit={handleSignIn} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Your Bidder ID</label>
                  <input
                    type="text"
                    value={signinId}
                    onChange={(e) => setSigninId(e.target.value.toUpperCase())}
                    placeholder="e.g. 042"
                    className="input text-center text-xl font-mono tracking-widest uppercase"
                    autoFocus
                    required
                  />
                  <p className="text-xs text-slate-400 mt-1">Enter the number from when you registered</p>
                </div>
                {welcomeError && <p className="text-red-600 text-sm">{welcomeError}</p>}
                <button type="submit" disabled={welcomeLoading || !signinId.trim()} className="btn-primary w-full">
                  {welcomeLoading ? 'Looking up…' : 'Sign In'}
                </button>
              </form>
            )}

            {welcomeTab === 'admin' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Admin PIN</label>
                  <input
                    type="password"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={8}
                    placeholder="••••"
                    value={pinInput}
                    onChange={(e) => setPinInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && verifyPin()}
                    autoFocus
                    className="input text-center text-2xl tracking-widest"
                  />
                </div>
                {welcomeError && <p className="text-red-600 text-sm">{welcomeError}</p>}
                <button
                  onClick={() => verifyPin()}
                  disabled={!pinInput}
                  className="btn-primary w-full"
                >
                  Sign In as Admin
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Admin PIN Modal ────────────────────────────────────────────────── */}
      {showPinModal && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setShowPinModal(false); }}
        >
          <div className="card p-8 w-full max-w-sm">
            <div className="text-center mb-6">
              <div className="text-4xl mb-2">🔐</div>
              <h2 className="text-xl font-bold text-slate-800">Admin Access</h2>
              <p className="text-slate-500 text-sm mt-1">Enter your 4-digit PIN</p>
            </div>

            <input
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={8}
              placeholder="PIN"
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && verifyPin()}
              autoFocus
              className="input text-center text-2xl tracking-widest mb-4"
            />

            {pinError && <p className="text-red-600 text-sm text-center mb-4">{pinError}</p>}

            <div className="flex gap-3">
              <button onClick={() => setShowPinModal(false)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={verifyPin} disabled={!pinInput} className="btn-primary flex-1">Enter</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
