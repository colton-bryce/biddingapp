const express = require('express');
const http    = require('http');
const { Server } = require('socket.io');
const path    = require('path');
const db      = require('./db');

const PORT      = process.env.PORT      || 3001;
const ADMIN_PIN = process.env.ADMIN_PIN || '1234';

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, { cors: { origin: '*' } });

app.use(express.json());
app.use(express.static(path.join(__dirname, 'client', 'dist')));

const broadcast = (event, data) => io.emit(event, data);

// ── Auth ──────────────────────────────────────────────────────────────────────

app.post('/api/auth', (req, res) => {
  res.json({ success: req.body.pin === ADMIN_PIN });
});

// ── Items ─────────────────────────────────────────────────────────────────────

app.get('/api/items', (req, res) => {
  // Optional filter: ?ended=true|false
  const { ended } = req.query;
  let items = db.getItemsWithBids();
  if (ended === 'true')  items = items.filter((i) => i.ended);
  if (ended === 'false') items = items.filter((i) => !i.ended);
  res.json(items);
});

// Mark an item's auction as ended — snapshots the winner so bids can later be deleted safely
app.post('/api/items/:id/end', (req, res) => {
  const id   = Number(req.params.id);
  const item = db.items.find((i) => i.id === id);
  if (!item)    return res.status(404).json({ error: 'Item not found' });
  if (item.ended) return res.status(400).json({ error: 'Auction is already ended' });

  const itemBids = db.bids.filter((b) => b.item_id === id);
  let winner_customer_id = null, winner_name = null, winning_amount = null;

  if (itemBids.length > 0) {
    const top      = itemBids.reduce((a, b) => (b.amount > a.amount ? b : a));
    const customer = db.customers.find((c) => c.customer_id === top.customer_id);
    winner_customer_id = top.customer_id;
    winner_name        = customer?.name || top.customer_id;
    winning_amount     = top.amount;
  }

  const updated = db.update('items', id, {
    ended: true,
    ended_at: new Date().toISOString(),
    winner_customer_id,
    winner_name,
    winning_amount,
  });

  broadcast('items:changed', null);
  res.json(updated);
});

app.post('/api/items', (req, res) => {
  const { name, description, starting_bid } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Item name is required' });

  const item = db.insert('items', {
    name:        name.trim(),
    description: (description || '').trim(),
    starting_bid: parseFloat(starting_bid) || 0,
  });
  broadcast('items:changed', null);
  res.status(201).json(item);
});

app.put('/api/items/:id', (req, res) => {
  const { name, description, starting_bid } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Item name is required' });

  const updated = db.update('items', Number(req.params.id), {
    name:        name.trim(),
    description: (description || '').trim(),
    starting_bid: parseFloat(starting_bid) || 0,
  });
  if (!updated) return res.status(404).json({ error: 'Item not found' });
  broadcast('items:changed', null);
  res.json(updated);
});

app.delete('/api/items/:id', (req, res) => {
  const id      = Number(req.params.id);
  const cascade = req.query.cascade === 'true';

  const bidIds = db.bids.filter((b) => b.item_id === id).map((b) => b.id);

  if (bidIds.length > 0 && !cascade) {
    return res.status(400).json({ error: 'Cannot delete an item that has bids. Remove all bids first.' });
  }

  bidIds.forEach((bid_id) => db.remove('bids', bid_id));
  db.remove('items', id);
  broadcast('items:changed', null);
  broadcast('bids:changed', null);
  res.json({ success: true, bids_removed: bidIds.length });
});

// ── Customers ─────────────────────────────────────────────────────────────────

app.get('/api/customers', (req, res) => {
  res.json(db.getCustomersWithCounts());
});

// Self-registration: assigns the next available numeric Bidder ID automatically
app.post('/api/customers/register', (req, res) => {
  const { name } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Name is required' });

  const existingIds = new Set(db.customers.map((c) => c.customer_id));
  let num = 1;
  while (existingIds.has(String(num).padStart(3, '0'))) num++;
  const customer_id = String(num).padStart(3, '0');

  const customer = db.insert('customers', { customer_id, name: name.trim() });
  customer.bid_count = 0;
  broadcast('customers:changed', null);
  res.status(201).json(customer);
});

// Look up a single customer by bidder ID (for sign-in)
app.get('/api/customers/lookup/:customer_id', (req, res) => {
  const customer = db.customers.find(
    (c) => c.customer_id === req.params.customer_id.trim().toUpperCase()
  );
  if (!customer) return res.status(404).json({ error: 'Bidder ID not found' });
  res.json(customer);
});

app.post('/api/customers', (req, res) => {
  const { customer_id, name } = req.body;
  if (!customer_id?.trim()) return res.status(400).json({ error: 'Customer ID is required' });
  if (!name?.trim())        return res.status(400).json({ error: 'Customer name is required' });

  const cid = customer_id.trim().toUpperCase();

  if (db.customers.find((c) => c.customer_id === cid)) {
    return res.status(400).json({ error: `Customer ID "${cid}" is already registered` });
  }

  const customer = db.insert('customers', { customer_id: cid, name: name.trim() });
  customer.bid_count = 0;
  broadcast('customers:changed', null);
  res.status(201).json(customer);
});

app.put('/api/customers/:id', (req, res) => {
  const { name } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Customer name is required' });

  const updated = db.update('customers', Number(req.params.id), { name: name.trim() });
  if (!updated) return res.status(404).json({ error: 'Customer not found' });
  broadcast('customers:changed', null);
  res.json(updated);
});

app.delete('/api/customers/:id', (req, res) => {
  const id       = Number(req.params.id);
  const customer = db.customers.find((c) => c.id === id);
  if (!customer) return res.status(404).json({ error: 'Customer not found' });

  // Cascade: remove all bids placed by this customer, then remove the customer
  const bidIds = db.bids.filter((b) => b.customer_id === customer.customer_id).map((b) => b.id);
  bidIds.forEach((bid_id) => db.remove('bids', bid_id));
  db.remove('customers', id);
  broadcast('customers:changed', null);
  broadcast('items:changed', null);   // refresh highest-bid display
  broadcast('bids:changed', null);
  res.json({ success: true, bids_removed: bidIds.length });
});

// ── Bids ──────────────────────────────────────────────────────────────────────

app.get('/api/bids', (req, res) => {
  res.json(db.getBidsJoined(req.query.item_id, req.query.customer_id));
});

app.post('/api/bids', (req, res) => {
  const { item_id, customer_id, amount } = req.body;
  if (!item_id || !customer_id || !amount) {
    return res.status(400).json({ error: 'item_id, customer_id, and amount are all required' });
  }

  const item = db.items.find((i) => i.id === Number(item_id));
  if (!item) return res.status(404).json({ error: 'Item not found' });

  const cid      = String(customer_id).trim().toUpperCase();
  const customer = db.customers.find((c) => c.customer_id === cid);
  if (!customer) {
    return res.status(404).json({
      error: `Customer ID "${cid}" is not registered. Please register this customer first.`,
    });
  }

  const bidAmount = parseFloat(amount);
  if (isNaN(bidAmount) || bidAmount <= 0) {
    return res.status(400).json({ error: 'Bid amount must be a positive number' });
  }

  if (item.starting_bid > 0 && bidAmount < item.starting_bid) {
    return res.status(400).json({
      error: `Bid must be at least the starting bid of $${item.starting_bid.toFixed(2)}`,
    });
  }

  const itemBids = db.bids.filter((b) => b.item_id === item.id);
  if (itemBids.length > 0) {
    const highest = Math.max(...itemBids.map((b) => b.amount));
    if (bidAmount <= highest) {
      return res.status(400).json({
        error: `Bid must be higher than the current high bid of $${highest.toFixed(2)}`,
      });
    }
  }

  const bid = db.insert('bids', { item_id: item.id, customer_id: cid, amount: bidAmount });
  const joined = {
    ...bid,
    item_name:     item.name,
    customer_name: customer.name,
  };

  broadcast('bid:placed',   joined);
  broadcast('items:changed', null);
  res.status(201).json(joined);
});

app.delete('/api/bids/:id', (req, res) => {
  db.remove('bids', Number(req.params.id));
  broadcast('bids:changed',  null);
  broadcast('items:changed', null);
  res.json({ success: true });
});

// ── Stats ─────────────────────────────────────────────────────────────────────

app.get('/api/stats', (req, res) => {
  res.json(db.getStats());
});

// ── Fallback ──────────────────────────────────────────────────────────────────

app.get('*', (req, res) => {
  const idx = path.join(__dirname, 'client', 'dist', 'index.html');
  res.sendFile(idx, (err) => {
    if (err) {
      res.status(200).send(`
        <h2 style="font-family:sans-serif;padding:2rem;color:#333">
          One-time setup required — run this command in the Bidding App folder:<br><br>
          <code style="background:#f0f0f0;padding:.5rem 1rem;border-radius:4px;font-size:1rem">npm run build</code>
        </h2>
      `);
    }
  });
});

// ── Socket.io ─────────────────────────────────────────────────────────────────

io.on('connection', (socket) => {
  console.log(`  + Client connected    [${socket.id}]`);
  socket.on('disconnect', () => console.log(`  - Client disconnected [${socket.id}]`));
});

// ── Start ─────────────────────────────────────────────────────────────────────

server.listen(PORT, '0.0.0.0', () => {
  let localIP = 'YOUR_LOCAL_IP';
  try {
    const nets = require('os').networkInterfaces();
    for (const name of Object.keys(nets)) {
      for (const net of nets[name]) {
        if (net.family === 'IPv4' && !net.internal) { localIP = net.address; break; }
      }
    }
  } catch {}

  console.log(`
╔══════════════════════════════════════════════╗
║         Silent Auction — Server Ready        ║
╠══════════════════════════════════════════════╣
║  Local:    http://localhost:${PORT}             ║
║  Network:  http://${localIP}:${PORT}          ║
║  Admin PIN: ${ADMIN_PIN}                            ║
╠══════════════════════════════════════════════╣
║  Share the Network URL with tablet devices   ║
╚══════════════════════════════════════════════╝
`);
});
