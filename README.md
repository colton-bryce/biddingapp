# Silent Auction Manager

A real-time silent auction management app. Run it on one laptop — all tablets on the same Wi-Fi network connect automatically and see live bid updates.

## Quick Start

### 1. Install Node.js
Download from https://nodejs.org (LTS version). Verify it works:
```
node --version
npm --version
```

### 2. Install dependencies
Open a terminal in this folder and run:
```
npm run setup
```

### 3. Build the app
```
npm run build
```

### 4. Start the server
```
npm start
```

The server will print a URL like `http://192.168.1.x:3001` — share that with all the tablets.

---

## Development mode (hot reload)
```
npm run dev
```
Frontend runs on port 5173, backend on 3001. Changes to React code reload instantly.

---

## Admin access

- Default PIN: **1234**
- Click the **Admin** button in the top-right corner
- To change the PIN, start the server with:
  ```
  ADMIN_PIN=9876 npm start
  ```
  Or on Windows:
  ```
  set ADMIN_PIN=9876 && npm start
  ```

---

## Workflow for running an event

1. **Before the event:**
   - Add all auction items (name, description, starting bid) via Admin → Items
   - Register all customers and assign them paddle/bid numbers via Admin → Customers

2. **During the event:**
   - Staff use tablets to enter bids (customer ID + amount) on the Staff view
   - All devices update live automatically
   - Admins can monitor current leaders in Admin → Bid History

3. **Closing an item:**
   - The current highest bid is always visible on every device
   - Admin → Bid History shows the full history and current leaders per item

---

## Data

All data is stored in `auction.db` (SQLite file) in this folder. Back it up by copying the file. To reset for a new event, delete `auction.db` and restart the server.

---

## Accessing from tablets

Make sure all devices are on the **same Wi-Fi network** as the laptop running the server. The startup message will show the correct local IP address, e.g.:

```
Network:  http://192.168.1.45:3001
```

Type that URL into the tablet's browser. No app install needed.
