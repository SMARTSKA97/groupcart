# 🚀 GroupCart Version 2.0.0 (V2) — In-Depth Technical Release Notes

This document provides a highly detailed, engineering-focused overview of the features, architectural enhancements, database designs, API schemas, and frontend/backend mechanisms introduced in **Version 2.0.0 (V2)** compared to the original **Version 1.0.0 (V1)**.

---

## 🏗️ 1. Database Architecture & Data Migration (MongoDB)

V1 stored all session data in a single local JSON file (`data/store.json`). In V2, the application is migrated to **MongoDB** using **Mongoose ODM** to support concurrency, data persistence, and multi-session historical storage.

### A. Mongoose Schema Definitions
All models define custom schemas and use custom-generated random alphanumeric IDs (via a helper `generateId()`), disabling virtual Mongoose identifiers using `{ id: false }`.

1. **`User`**
   * Fields: `id` (String, unique, indexed), `name` (String), `isAdmin` (Boolean, default false), `createdAt` (Date).
2. **`App`** (Delivery Platforms)
   * Fields: `id` (String, unique, indexed), `name` (String), `color` (String), `icon` (String).
3. **`Order`**
   * Fields: `id` (String, unique, indexed), `sessionId` (String, indexed), `userId` (String, indexed), `userName` (String), `appId` (String, indexed), `link` (String), `productName` (String), `qty` (Number, default 1), `estimatedPrice` (Number), `status` (String, default `'pending'`), `statusNote` (String), `statusUpdatedBy` (String), `statusUpdatedAt` (Date), `createdAt` (Date), `adminModified` (Boolean), `adminModifiedBy` (String), `adminModifiedAt` (Date), `isFavorite` (Boolean).
   * Enums: `status` values must be one of: `['pending', 'confirmed', 'out-of-stock', 'returned', 'not-delivered']`.
4. **`Bill`** (Final platform invoices)
   * Fields: `id` (String, unique, indexed), `sessionId` (String, indexed), `appId` (String), `actualAmount` (Number), `settledAt` (Date).
5. **`Session`**
   * Fields: `id` (String, unique, indexed), `name` (String), `active` (Boolean, default true), `createdAt` (Date), `settledAt` (Date), `status` (String, default `'adding'`), `splitMode` (String, default `'proportional'`), `customSplits` (Map of String -> Number), `freeDeliveryThresholds` (Map of String -> Number).
   * Enums: `status` is one of `['adding', 'locked', 'ordered', 'delivered', 'settled']`. `splitMode` is one of `['proportional', 'equal', 'custom']`.
6. **`Favorite`** (User starred items)
   * Fields: `id` (String, unique, indexed), `userId` (String, indexed), `appId` (String), `productName` (String), `estimatedPrice` (Number), `link` (String), `createdAt` (Date).
   * **Compound Unique Index**: To prevent duplicate favorites, we declare:
     ```javascript
     favoriteSchema.index({ userId: 1, appId: 1, productName: 1 }, { unique: true });
     ```
7. **`Payment`** (Transactions tracking)
   * Fields: `id` (String, unique, indexed), `sessionId` (String, indexed), `userId` (String, indexed), `userName` (String), `amount` (Number), `markedPaidAt` (Date), `confirmedByAdmin` (Boolean, default false), `confirmedAt` (Date), `confirmedBy` (String).
8. **`Settings`** (System properties)
   * Fields: `upiId` (String).

### B. Startup Migration Engine
To ensure frictionless upgrades from V1, `server.js` features an automatic startup migrator (`migrateData()`):
* Scans for a legacy `data/store.json` file.
* If present, reads it and translates all raw users, apps, settings, and orders into Mongoose model instances.
* Associates legacy orders with a default initial session, saves all documents into MongoDB, and clears or renames the legacy JSON file to prevent double-migration.

### C. MongoDB Collation & Query Safeguards
* **Case-Insensitive Login**: In `/api/auth/login`, queries perform a collation-aware case-insensitive query to prevent duplicate users (e.g. `bob` vs `Bob`):
  ```javascript
  let user = await User.findOne({ name: name.trim() }).collation({ locale: 'en', strength: 2 });
  ```
* **Split-Brain Resolution**: During simultaneous resets or active queries, queries fetching active sessions sort by `createdAt: -1` to guarantee clients are synced with the newest active session:
  ```javascript
  let session = await Session.findOne({ active: true }).sort({ createdAt: -1 });
  ```

---

## ⚡ 2. Real-Time Push Synchronisation: Server-Sent Events (SSE)

V2 replaces polling with a persistent **Server-Sent Events (SSE)** channel at `/api/events` to push updates in real-time to all connected user devices.

### A. Connection Lifecycle Management
* On connection, Express sets standard SSE headers (`text/event-stream`, `Connection: keep-alive`, `Cache-Control: no-cache`).
* The client's response handle is stored in a global `sseClients` Set.
* A listener handles disconnects (`req.on('close', ...)`) to delete the client, avoiding memory leaks.

### B. SSE Event Payload Mappings
Whenever database writes occur, `broadcastSSE(event, data)` stringifies payloads and dispatches them:

| Event Type | Payload Schema | Triggering Action |
| :--- | :--- | :--- |
| `order-added` | `{ order: OrderDocument }` | User adds a new product item |
| `order-updated` | `{ order: OrderDocument }` | User/Admin updates item quantity, link, or price |
| `order-removed` | `{ id: String }` | User deletes an item |
| `order-status-changed` | `{ id: String, status: String, statusNote: String, statusUpdatedBy: String, statusUpdatedAt: Date }` | Admin updates item status (e.g., Out of Stock) |
| `order-bulk-status-changed` | `{ appId: String, status: String, statusUpdatedBy: String }` | Admin confirms all items on an app in one click |
| `bill-updated` | `{ bill: BillDocument }` | Admin inputs or modifies final actual bill amount |
| `payment-updated` | `{ payment: PaymentDocument }` | User marks as paid / Admin confirms payment |
| `app-added` | `{ app: AppDocument }` | Admin adds a new delivery platform |
| `app-removed` | `{ id: String }` | Admin deletes a delivery platform |
| `session-reset` | `{ newSessionId: String }` | Admin resets session, creating a new round |
| `session-status-changed` | `{ status: String, sessionId: String }` | Session status changes (e.g., locked, settled) |
| `session-thresholds-updated` | `{ thresholds: Object, sessionId: String }` | Admin updates platform free delivery targets |
| `session-split-mode-updated` | `{ splitMode: String, customSplits: Object, sessionId: String }` | Split mode changes (proportional, equal, custom) |

---

## ⚖️ 3. Advanced Settlement & Split Engines

V2 introduces an extensive billing calculation suite supporting multiple group splitting behaviors:

### A. Proportional Split (with Smart Decimal Rounding)
Distributes actual platform final invoices proportionally based on each user's share of active estimated items. To resolve floating-point fraction mismatches, a smart rounding engine runs on the backend:
1. Calculates raw proportional decimal costs for each user.
2. Truncates each share (`Math.round()`) and aggregates the rounded sums.
3. Computes the discrepancy: `diff = bill.actualAmount - roundedSum`.
4. If there is a non-zero discrepancy, the engine identifies the user whose raw share had the highest fractional remainder (`frac = raw - Math.floor(raw)`) and adjusts their share by `diff` (adding/subtracting the final paisa).

### B. Equal Split
Divides the total actual platform bills equally among all active participants. If the division has a remainder:
* It distributes the remainder 1 rupee at a time starting from the first active user.
* To provide individual app-specific costs, each user's flat share is redistributed back to apps proportionally to their original estimated order ratio on that app.

### C. Custom Split
Allows the admin to input custom absolute rupee amounts for each user in the Admin Dashboard. The system validates and saves custom values into the `Session` document's `customSplits` map.

### D. Dynamic Settle Session Naming Modal
When changing status to "Settled", admins are prompted via a custom HTML/CSS modal. They can enter a custom session name (e.g. "Pizza Party"). If left empty, the server automatically generates a formatted timestamp in Indian Standard Time (IST):
`Session DD/MM/YYYY HH:MM` (e.g. `Session 14/06/2026 14:30`).

### E. Post-Settlement Warning Banners
* **Discount Banners**: Highlights proportional savings (e.g., `Blinkit: 12.5% off — saved ₹120.00 🎉`) or surcharges (`Zepto: 4% surcharge — extra ₹15.00`).
* **Bill Warnings**: If an item is marked "Out of Stock" or deleted *after* final bills are saved, the system displays a warning banner indicating the bill is out of sync and needs recalculation.

---

## 🚚 4. Delivery Progress Bars (Threshold Targets)

Admins can set free-delivery threshold targets (in rupees) per delivery platform.
* The frontend aggregates active items to compute the current app-specific order total.
* Renders a real-time progress bar under the Home tab.
* If the target is met, displays a completed status badge.
* If not, indicates the remaining amount needed to avoid delivery charges (e.g., `₹45 more needed`).

---

## ⭐ 5. Favorites Quick-Add Drawer

Under the "Mine" tab, users can toggle a drawer containing starred products:
* Click the star icon on any card to add/remove it from favorites.
* Tapping an item in the favorites drawer instantly places it into the active cart with pre-filled product parameters.

---

## 🌐 6. cheerio Product Scraper Fallback Hierarchy

The `/api/scrape-url` endpoint leverages `cheerio` to fetch and parse Swiggy, Blinkit, and Zepto product URLs. The parser executes a strict fallback hierarchy:
1. **JSON-LD Schema Extraction**: Inspects `<script type="application/ld+json">`. Loops through JSON blocks to find `@type === 'Product'` or `@graph` lists containing a `Product` schema. Extracts the `.name` and `.offers.price` or `.offers[0].price`.
2. **OpenGraph Meta Tags**: Searches `<meta property="og:title">` or `<meta name="twitter:title">` or `<title>`. Suffixes (e.g., ` | Blinkit`, ` - Zepto`) are automatically removed.
3. **Price Meta Fields**: Extracts from `product:price:amount`, `og:price:amount`, or `product:sale_price:amount`.
4. **DOM Rupee Scanner**: Scans all leaf DOM nodes matching the regular expressions `/^₹\s*(\d+(?:\.\d{1,2})?)$/` or `/^Rs\.?\s*(\d+(?:\.\d{1,2})?)$/`, choosing the minimum non-zero value.
5. **Raw Regex Backup**: Scans the raw HTML string using `/["']price["']\s*:\s*["']?(\d+(?:\.\d{1,2})?)["']?/i`.

* **Timeout Protection**: The fetch request incorporates a `AbortSignal.timeout(10000)` abort controller to prevent hanging backend scrapers.

---

## 📱 7. Service Worker & PWA Capabilities

* **API Cache Bypass**: The Service Worker `sw.js` cache version is bumped to `groupcart-cache-v4`. To prevent stale data, a bypass rule excludes all API routing paths from caching:
  ```javascript
  if (e.request.method !== 'GET' || !e.request.url.startsWith(self.location.origin) || e.request.url.includes('/api/')) {
    return;
  }
  ```
* **Install Prompts**: Intercepts `beforeinstallprompt` to display a custom PWA installation banner overlay with install and dismiss handlers.

---

## 🎨 8. SweetAlert2 Theme Integration

Native browser inputs (`confirm()`, `prompt()`) are replaced by theme-matching **SweetAlert2** popups. A global helper `SwalCustom.fire()` ensures dialog colors match the GroupCart dark purple aesthetic:
* Card background: `var(--bg-card, #16213e)`
* Primary Text: `var(--text-primary, #e8e8f0)`
* Confirm Button: `var(--accent-primary, #6c63ff)`
* Cancel Button: `var(--bg-input, #0e1628)`

---

## 🔐 9. Order Privacy Rules

To maintain confidentiality of individual orders:
* **Standard Users**: Detailed order cards are only visible for their own items. Others' orders are grouped by user and rendered as anonymous summary cards: `[User]'s Order — X items — ₹Y`. Link clicking and card editing are blocked (`cursor: default`).
* **Admin Users**: Organizers see all orders in full detail on the Home tab to verify and place final platform checkout carts.

---

## 💳 10. User Payments & Admin Confirmation Flow

V2 introduces an end-to-end payment status system:
1. **Invoice Calculation**: The Pay tab calculates the final split amounts.
2. **UPI QR & Deep Linking**: If the admin has set their UPI ID, the app renders:
   * Native deep-links for Google Pay, PhonePe, Paytm, BHIM, Slice, and CRED.
   * A dynamically generated QR Code from `api.qrserver.com` encoding the UPI address.
   * UPI remark note template: `DD/MM/YYYY - X items - Rs. Y`.
3. **Mark Paid**: The user clicks **I Have Paid** (submits to `/api/payments/mark-paid`, changing status to `Paid` [blue badge]).
4. **Admin Confirmation**: The Admin tab displays a **Confirm Payments** panel. The admin can verify the transaction and click **Confirm** (sets `confirmedByAdmin = true`, updates status badge to `Confirmed` [green badge]).

---

## 📦 11. Docker Build & CI/CD Enhancements
* **Dockerfile**: Deleted `COPY data/ ./data/` to keep container builds minimal, as legacy JSON fallback templates are no longer required.
* **docker-compose.yml (Default to GHCR)**: Configured default Compose file to deploy using the pre-built, production-ready GHCR container image and inline Nginx config. This enables a 100% self-contained one-liner setup without downloading project source code.
* **docker-compose.dev.yml**: Configured separate dev file to support local building/running from source code and mounting local reverse-proxy configs.
* **Automated GHCR Pipeline (GitHub Actions)**: Integrated GitHub Actions workflow `.github/workflows/docker-publish.yml` to build and push the Docker image to GitHub Container Registry (`ghcr.io/smartska97/groupcart`) automatically on push/merge to the `main` branch.
