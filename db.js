/**
 * Simple JSON file database — no native dependencies.
 * All data lives in auction-data.json.
 * Operations are synchronous in-memory; file is written after every mutation.
 */
const fs   = require('fs');
const path = require('path');

const FILE = path.join(__dirname, 'auction-data.json');

const EMPTY = { customers: [], items: [], bids: [], _seq: { customers: 0, items: 0, bids: 0 } };

function load() {
  try {
    return JSON.parse(fs.readFileSync(FILE, 'utf8'));
  } catch {
    return JSON.parse(JSON.stringify(EMPTY));
  }
}

function save(data) {
  fs.writeFileSync(FILE, JSON.stringify(data, null, 2), 'utf8');
}

let data = load();

function nextId(table) {
  data._seq[table] = (data._seq[table] || 0) + 1;
  return data._seq[table];
}

// ── Generic helpers ──────────────────────────────────────────────────────────

function findAll(table, predicate) {
  const rows = data[table] || [];
  return predicate ? rows.filter(predicate) : [...rows];
}

function findOne(table, predicate) {
  return (data[table] || []).find(predicate) || null;
}

function insert(table, record) {
  const row = { id: nextId(table), ...record, created_at: new Date().toISOString() };
  data[table].push(row);
  save(data);
  return row;
}

function update(table, id, fields) {
  const idx = data[table].findIndex((r) => r.id === id);
  if (idx === -1) return null;
  data[table][idx] = { ...data[table][idx], ...fields };
  save(data);
  return data[table][idx];
}

function remove(table, id) {
  const before = data[table].length;
  data[table] = data[table].filter((r) => r.id !== id);
  if (data[table].length !== before) save(data);
  return data[table].length !== before;
}

// ── Domain helpers ───────────────────────────────────────────────────────────

function getItemsWithBids() {
  const bids      = data.bids;
  const customers = data.customers;

  return data.items.map((item) => {
    const itemBids = bids.filter((b) => b.item_id === item.id);
    if (itemBids.length === 0) {
      return { ...item, highest_bid: null, highest_bidder_id: null, highest_bidder_name: null, bid_count: 0 };
    }
    const top      = itemBids.reduce((a, b) => (b.amount > a.amount ? b : a));
    const customer = customers.find((c) => c.customer_id === top.customer_id);
    return {
      ...item,
      highest_bid:          top.amount,
      highest_bidder_id:    top.customer_id,
      highest_bidder_name:  customer?.name || top.customer_id,
      bid_count:            itemBids.length,
    };
  });
}

function getBidsJoined(filterItemId, filterCustomerId) {
  let bids = [...data.bids];
  if (filterItemId)     bids = bids.filter((b) => b.item_id     === Number(filterItemId));
  if (filterCustomerId) bids = bids.filter((b) => b.customer_id === filterCustomerId);

  return bids
    .map((b) => {
      const item     = data.items.find((i) => i.id === b.item_id);
      const customer = data.customers.find((c) => c.customer_id === b.customer_id);
      return {
        ...b,
        item_name:     item?.name     || '(deleted)',
        customer_name: customer?.name || b.customer_id,
      };
    })
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

function getCustomersWithCounts() {
  return data.customers
    .map((c) => ({
      ...c,
      bid_count: data.bids.filter((b) => b.customer_id === c.customer_id).length,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function getStats() {
  const items     = data.items;
  const customers = data.customers;
  const bids      = data.bids;

  // Sum of highest bid per item
  const totalValue = items.reduce((acc, item) => {
    const itemBids = bids.filter((b) => b.item_id === item.id);
    if (itemBids.length === 0) return acc;
    return acc + Math.max(...itemBids.map((b) => b.amount));
  }, 0);

  const itemsWithBids = new Set(bids.map((b) => b.item_id)).size;

  return {
    total_items:     items.length,
    total_customers: customers.length,
    total_bids:      bids.length,
    items_with_bids: itemsWithBids,
    total_value:     totalValue,
  };
}

module.exports = {
  findAll, findOne, insert, update, remove,
  getItemsWithBids, getBidsJoined, getCustomersWithCounts, getStats,
  // expose raw data tables for direct lookups
  get customers() { return data.customers; },
  get items()     { return data.items; },
  get bids()      { return data.bids; },
};
