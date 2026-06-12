# 🛒 GroupCart

GroupCart is a sleek, mobile-first web application designed to make group ordering and bill splitting effortless. When ordering lunch, snacks, or groceries with friends or colleagues from apps like Zepto, Blinkit, Instamart, or Swiggy/Zomato, GroupCart helps you pool orders, apply platform discounts/surcharges accurately, and settle up easily.

---

## 🌟 Key Features

1. **Session Management & History**:
   - Save order rounds into dedicated sessions.
   - Admins can close/reset the active session, which archives it for future reference rather than deleting it.
   - Users and admins can select any historical session from a dropdown selector to check past orders.

2. **Order Privacy**:
   - To keep user purchases private, the **Home** ("All Orders") tab only shows the details of your own orders.
   - For other group members, it only displays the aggregated active order total per delivery platform (helpful to check if you have hit free-delivery or discount thresholds).
   - Only the Admin can view all order items on the backend Order Board to fulfill the group order.

3. **UPI Payment Integration**:
   - Admins can save their UPI ID in the settings.
   - When a bill is finalized, users see their exact calculated share in the **Pay** tab.
   - Users get a **"Pay via UPI App"** deep link (to open Google Pay, PhonePe, Paytm, etc. directly on their phone) and a dynamically generated **UPI QR Code** pre-filled with the exact amount and transaction remarks.

4. **Dynamic Settlement Engine**:
   - Allows the admin to input the final delivery bill for each platform.
   - Calculates proportional discounts, surcharges, and taxes automatically.
   - Performs smart rounding to match the actual bill to the paisa.
   - Click-to-copy summary generator for pasting results directly into chat groups.

5. **Server-Sent Events (SSE)**:
   - Real-time updates when users add items, update quantities, or admins change order statuses.

---

## 🛠️ Technology Stack

* **Frontend**: HTML5, Vanilla JavaScript, Mobile-first CSS
* **Backend**: Node.js, Express
* **Database**: MongoDB (Mongoose ODM)
* **Reverse Proxy**: Nginx (Alpine)
* **Containerization**: Docker & Docker Compose

---

## 🚀 Quick Start (Local & Multi-Device Setup)

The application is fully containerized and configured for local hosting and cross-device usage on your local network.

### Prerequisites
* [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running.

### Run with Docker Compose

1. Clone this repository and navigate to the project directory:
   ```bash
   cd e-shop
   ```

2. Build and run the containers:
   ```bash
   docker-compose up -d --build
   ```

3. Access the application:
   * On the **host machine**: [http://localhost](http://localhost) (or port `3000` directly: [http://localhost:3000](http://localhost:3000))

### Allow Multi-Device Access (Local Wi-Fi / LAN)
To access the app from your phone or other devices on the same local network:

1. **Find your host IP address** (run `ipconfig` on Windows or `ifconfig` on Mac/Linux). E.g., `10.176.100.97`.
2. **Open the port in Windows Firewall** (if hosting on Windows). Run this command in an administrator PowerShell terminal:
   ```powershell
   New-NetFirewallRule -DisplayName "Allow HTTP Port 80 Inbound" -Direction Inbound -LocalPort 80 -Protocol TCP -Action Allow
   New-NetFirewallRule -DisplayName "Allow HTTP Port 3000 Inbound" -Direction Inbound -LocalPort 3000 -Protocol TCP -Action Allow
   ```
3. **Ensure your Network Profile is Private**: Go to Settings > Network & internet > Ethernet/Wi-Fi and set the profile to **Private**.
4. **Access the App**: Navigate to `http://<YOUR-HOST-IP>` (or `http://<YOUR-HOST-IP>:3000`) on your mobile browser.

---

## 🔒 Security & Configuration

All system credentials, connection URIs, and administrative passwords have been externalized into environment variables to prevent accidental exposure of secrets:

* **Local Environment Setup**: Create a local `.env` file in the root directory (based on `.env.example`).
* **Environment Variables**:
  * `MONGO_USER`: Username for MongoDB root database administration.
  * `MONGO_PASSWORD`: Password for MongoDB root database administration.
  * `ADMIN_PASSWORD`: Administrative password for accessing the GroupCart Order Board and settling bills.
* **Volume Persistence**: MongoDB state is persisted in the named Docker volume `mongodb_data`, and Express data logs are saved in the host's `./data` directory.

---

## 🏗️ Step-by-Step Implementation & Architecture Plan

Here is the structured sequence of steps taken to design, build, and secure the GroupCart application:

### Step 1: Environment Externalization & Directory Isolation
* Created `.gitignore` to strictly exclude local `.env` files, node packages, database volumes (`data/`), and operational build logs.
* Initialized `.env.example` as a template for other developers to populate local environment overrides securely.

### Step 2: Database Layer & Schema Definitions
* Established Mongoose ODM connection utilizing the configured `MONGO_URI` variable (with a robust local fallback URI).
* Defined schemas for:
  * `User`: Stores user names and identifiers.
  * `Session`: Tracks active and archived ordering sessions with properties `id`, `name`, `active`, and timestamps.
  * `Settings`: Holds global admin-controlled attributes (such as the settlement `upiId`).
  * `Order`: Relates items to a user, platform, and session.
  * `Bill`: Relates platform final costs to a session.
* Built automatic startup migration logic that gathers legacy records without a `sessionId` and associates them with the default active session.

### Step 3: Backend REST APIs & Event Streams (SSE)
* Created routing rules in `server.js` to manage session transitions, settings, order insertion, and price updating.
* Developed the `/api/session/reset` transaction which deactivates the current session, archives it under an admin-chosen name, and initializes a blank active session.
* Configured Server-Sent Events (SSE) on `/api/events` to push real-time changes to connected devices when items are created, modified, or settled.

### Step 4: UI Design & Session History Controls
* Designed a responsive, mobile-first, tabbed Single Page Application (SPA).
* Added a **Session Selector** dropdown in the navigation bar. Selecting historical sessions switches the entire app to a read-only state, disabling modifications while retrieving old records.
* Created distinct admin controls in the Admin panel to configure settings (UPI ID), reset sessions, confirm pending items, and input final bills.

### Step 5: Advanced Security & Order Privacy
* Modified the core UI rendering engine in `public/js/user.js` to show detailed item information only for the logged-in user.
* Enabled aggregated sum totals on platform headers for all other group members. This preserves individual item privacy while informing group members of current delivery thresholds.
* Restricted the full Order Board item visibility to the Admin console dashboard.

### Step 6: UPI App chooser & Dynamic QR Generation
* Designed a custom payment deep-linking grid supporting multiple apps (Google Pay, PhonePe, Paytm, BHIM, Slice, CRED) and a fallback system deep link.
* Prevented default-app association hijacks (e.g. WhatsApp auto-opening UPI links on some devices).
* Integrated dynamic client-side QR code generation using `api.qrserver.com` pre-filled with the exact payment amount and metadata (Remarks format: `DD/MM/YYYY - X items - Rs. Y`).

### Step 7: PWA Web Share Target Integration (Android)
* Configured `manifest.json` containing PWA metadata and defined `share_target` properties to receive text/URL payloads.
* Created a Service Worker (`sw.js`) implementing static caching. Built proxy content-type verification to prevent proxy/ngrok warning screens from corrupting cached files.
* Wrote a sharing parser in `public/js/app.js` that intercepts incoming URL parameters from Blinkit/Swiggy/Zomato shares and automatically opens the Add Item modal with pre-filled names, estimated prices, and product URLs.

### Step 8: iOS Apple Shortcuts Workaround (iOS)
* Designed a custom Apple Shortcut configuration that acts as a bridge:
  1. Captures URLs and Text from Zomato/Swiggy's share sheets on iOS.
  2. Forwards them as a query string (`?text=...`) to Safari.
  3. Triggers the same local parsing logic on the PWA frontend.
