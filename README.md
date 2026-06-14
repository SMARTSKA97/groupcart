# 🛒 GroupCart

GroupCart is a sleek, mobile-first web application designed to make group ordering and bill splitting effortless. When ordering lunch, snacks, or groceries with friends or colleagues from apps like Zepto, Blinkit, Instamart, or Swiggy/Zomato, GroupCart helps you pool orders, apply platform discounts/surcharges accurately, and settle up easily.

---

## 🌟 Key Features

1. **Interactive Session Status Pipeline**:
   - A real-time visual progress tracker displays the current lifecycle state of an order: `People Adding Items` ➔ `Locked for Ordering` ➔ `Placed / Ordered` ➔ `Delivered` ➔ `Settled`.
   - Transitions lock or unlock application functions (such as adding or modifying items) and are broadcasted to all connected clients in real-time.

2. **Order Privacy & Admin Visibility**:
   - Standard users see their own items in full detail on the **Home ("All Orders")** tab.
   - Other users' active items are automatically grouped and rendered as anonymous summary cards (`[User]'s Order` showing only total count and estimated price), hiding individual product names and links.
   - Organizers logged in as the Admin see everyone's order items in full detail on the Home tab to coordinate cart updates and manage items on the Order Board.

3. **UPI Payment & Admin Confirmation Flow**:
   - Admins can configure their UPI ID in settings to enable direct, seamless payments.
   - In the **Pay (💰)** tab, users see their exact final cost calculations.
   - Users can tap a deep link to launch their favorite payment app (GPay, PhonePe, Paytm, BHIM, Slice, CRED) or scan a dynamically generated QR Code with pre-filled amount and remarks metadata.
   - The user marks the bill as completed via **"I Have Paid"** (status changes to `Paid`).
   - Admins confirm transactions in real-time under the **Confirm Payments** panel on the Admin Dashboard (status updates to `Confirmed` with a green badge).

4. **Dynamic Split & Rounding Engines**:
   - **Proportional Split**: Proportions app invoice adjustments (delivery fees, surcharges, discounts) across users based on their active items cost. Smart rounding dispatches rounding fractions (paisas) to the participant with the largest decimal remainder to balance the bill exactly.
   - **Equal Split**: Distributes total platform bills equally among all participants, redistributing flat costs back to apps proportionally.
   - **Custom Split**: Organizers can enter custom absolute rupee amounts to charge each participant.
   - Includes informational discount badges (e.g. `saved ₹120.00!`) and warning alerts if active items are updated *after* entering bills.

5. **Favorites Quick-Add Drawer**:
   - Users can star products on active item cards to add them to their personal favorites database list.
   - Starred items appear in a toggleable sliding Favorites Drawer under the "Mine" tab, allowing users to re-add common products with a single tap.

6. **PWA Mobile Share Target & Install Prompts**:
   - Manifest metadata and Service Worker caching configurations enable native web app installation.
   - The app detects local insecure hosting states and prompts users with a custom PWA Install Banner UI.
   - Intercepts incoming system share payloads (via Android Share sheets or Apple iOS Shortcuts) to parse shared Swiggy/Blinkit/Zepto links and automatically pre-fill the cart item form.

7. **Server-Sent Events (SSE)**:
   - Replaces constant HTTP polling loops with a push event stream at `/api/events` to synchronize cart lists, progress bars, bills, and payment statuses across devices in real-time.

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

### Option A: Run Pre-built Image from GHCR (Recommended)

The application is automatically built and published to the **GitHub Container Registry (GHCR)** on every push to the `main` branch. You can run the application using the pre-built image without needing to compile it locally.

1. Ensure you have configured your local `.env` file (copied from `.env.example`).
2. Start the services using the GHCR docker-compose configuration:
   ```bash
   docker compose -f docker-compose.ghcr.yml up -d
   ```

### Option B: Build and Run Locally

If you are developing or want to compile the image from source code:

1. Clone this repository and navigate to the project directory:
   ```bash
   cd groupcart
   ```

2. Build and run the containers:
   ```bash
   docker compose up -d --build
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
* Modified the core UI rendering engine in `public/js/user.js` to show detailed item information for the logged-in user, and aggregated anonymous summaries (total count and cost) for other users' active items.
* Enabled full detailed order visibility for administrators on the Home tab while keeping non-own cards non-clickable and read-only.
* Restricted the backend management Order Board to the Admin console dashboard.

### Step 9: Theme-Integrated Dialogs & Custom Modals
* Integrated the SweetAlert2 library and styled dialog overlays to match the app's premium dark purple theme.
* Removed native browser alerts/confirms/prompts in favor of swal2 popups for deleting items, deleting apps, and adding out-of-stock note reasons.
* Created a custom HTML/CSS modal prompting for an optional session name during session settlement, matching the reset session flow.

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

### Step 10: Automated CI/CD & GitHub Container Registry (GHCR)
* Set up a GitHub Actions workflow in `.github/workflows/docker-publish.yml` triggered on push/merge to the `main` branch.
* Automates extraction of the application version from `package.json` (e.g. `v2.0.0`) and builds the Docker image.
* Publishes the built image to GitHub Container Registry (GHCR) at `ghcr.io/smartska97/groupcart` under tags `v<version>` (e.g., `v2.0.0`) and `latest` for easy pull-and-run deployment.
