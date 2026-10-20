# 🛒 GroupCart

**A real-time group ordering and settlement platform for office lunches, snacks, groceries, and shared purchases.**

GroupCart helps teams coordinate orders from platforms like Swiggy, Zomato, Blinkit, Zepto, and Instamart while handling order collection, bill settlement, payment tracking, and session management.

---

## 🚀 Demo

* Quick Demo *(Coming Soon)*
* Full Workflow Walkthrough *(Coming Soon)*

---

## 📸 Screenshots

Screenshots available under:

```text
/docs/screenshots
```

---

## ✨ Features

### 👥 Real-Time Collaboration

* Server-Sent Events (SSE)
* Live order updates
* Live payment updates
* Session state synchronization

### 🛒 Shared Ordering

* Product link sharing
* Auto-fill via scraping
* Manual order entry

### 🔒 Privacy-First Design

* Users see full details of their own orders
* Other users appear as anonymous summaries
* Admin sees complete order information

### 💰 Settlement Engine

* Proportional Split
* Equal Split
* Custom Split
* Automatic rounding correction

### 💳 UPI Integration

* Dynamic QR Codes
* Deep Links
* Payment Confirmation Workflow

### ⭐ Favorites

* Save frequently ordered items
* One-tap reordering

### 📱 Progressive Web App

* Android Share Target
* iOS Shortcut Support
* Installable PWA

### 📂 Session History

* Archive sessions
* Review past orders
* Review settlements

---

## 🏗️ Architecture

Read the comprehensive technical architecture guide:
👉 **[architecture.md](docs/architecture.md)**

---

## 🔄 Workflow

Read the detailed state machine and process flow guide:
👉 **[workflow.md](docs/workflow.md)**

---

## 📖 User & Admin Guides

For step-by-step instructions on running or using the app:
👉 **[TUTORIAL.md](docs/tutorial.md)**

---

## 🛠️ Technology Stack

| Layer            | Technology        | Details / Links |
| ---------------- | ----------------- | --------------- |
| Frontend         | HTML5, Vanilla JS | Mobile-first SPA |
| Backend          | Node.js, Express  | REST APIs & Scrapers |
| Database         | MongoDB           | Mongoose ODM |
| Real-Time        | SSE               | Server-Sent Events stream |
| Reverse Proxy    | Nginx             | Reverse proxy config |
| Containerization | Docker            | Multi-container environment |
| Registry         | GHCR              | GitHub Container Registry |
| CI/CD            | GitHub Actions    | Automated docker pipeline |

---

## 🚀 Quick Start

### 1. Download the config files

```bash
# Linux / macOS / Git Bash
curl -sSL https://raw.githubusercontent.com/SMARTSKA97/groupcart/main/docker-compose.yml -o docker-compose.yml
curl -sSL https://raw.githubusercontent.com/SMARTSKA97/groupcart/main/.env.example -o .env

# Windows PowerShell
curl.exe -sSL https://raw.githubusercontent.com/SMARTSKA97/groupcart/main/docker-compose.yml -o docker-compose.yml
curl.exe -sSL https://raw.githubusercontent.com/SMARTSKA97/groupcart/main/.env.example -o .env
```

### 2. Set your secrets in `.env`

Open `.env` and fill in your own values — **`JWT_SECRET` is required**:

```bash
# Generate a secure JWT secret (run this once and paste the output into .env)
# Linux / macOS / Git Bash
openssl rand -hex 32

# Windows PowerShell (requires OpenSSL or Git Bash)
[System.Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))
```

Your `.env` should look like:

```env
MONGO_USER=admin
MONGO_PASSWORD=your_strong_password
ADMIN_PASSWORD=your_admin_password
JWT_SECRET=paste_the_64_hex_chars_here
```

### 3. Start the application

```bash
docker compose up -d
```

Open:

```text
http://localhost
```

> **Note:** All traffic goes through the nginx reverse proxy on port 80. Port 3000 is internal only and not reachable from outside the Docker network.

For local development (builds from source):

```bash
docker compose -f docker-compose.dev.yml up -d --build
```

---

## 🐳 Docker Images

Latest:

```bash
docker pull ghcr.io/smartska97/groupcart:latest
```

Versioned:

```bash
docker pull ghcr.io/smartska97/groupcart:v2.0.0
```

---

## 🔐 Environment Variables

| Variable         | Required | Description                                                   | Default         |
| ---------------- | -------- | ------------------------------------------------------------- | --------------- |
| `JWT_SECRET`     | **Yes**  | 64-char hex secret for signing auth tokens. Generate with `openssl rand -hex 32`. App refuses to start without it. | *(none)* |
| `MONGO_USER`     | No       | MongoDB username                                              | `admin`         |
| `MONGO_PASSWORD` | No       | MongoDB password — **change before exposing to your network** | `adminpassword` |
| `ADMIN_PASSWORD` | No       | Password for registering the `admin` account                  | `admin123`      |

All variables are read from a `.env` file in the same directory as `docker-compose.yml`. See [`.env.example`](.env.example) for a ready-to-copy template.

> ⚠️ The defaults for `MONGO_PASSWORD` and `ADMIN_PASSWORD` are intentionally weak. Always override them before deploying, even on a home LAN.

---

## 🔒 Security

GroupCart is designed for trusted LAN use, not public internet exposure. The following hardening is applied:

| Area | Measure |
| ---- | ------- |
| **Passwords** | PBKDF2-SHA512 with 310,000 iterations (OWASP 2024). Existing hashes are rehashed to current strength on next login. |
| **Tokens** | HS256 JWT; timing-safe signature verification; 7-day expiry. |
| **Sessions** | `JWT_SECRET` must be set externally — no ephemeral per-restart secret. |
| **Auth enforcement** | All write routes and the SSE stream require a valid token. Status/bill mutations require admin. |
| **Scraper SSRF** | `/api/scrape-url` blocks requests to loopback, RFC-1918, and link-local addresses. |
| **Rate limiting** | Login endpoint: 10 attempts per IP per 15 minutes (in-memory, no extra deps). |
| **Response safety** | `passwordHash`, `salt`, and `hashIterations` are never included in API responses. |
| **XSS** | Dynamic button labels use `data-*` attributes + delegated listeners, not inline `onclick` string interpolation. |
| **Network** | Port 3000 is `expose:`-only — internal to Docker. Only port 80 (nginx) is reachable from the LAN. |
| **Headers** | `X-Content-Type-Options`, `X-Frame-Options`, `X-XSS-Protection`, `Referrer-Policy`, `CSP` set by both the app and nginx. |
| **Body limit** | JSON request body capped at 2 MB. |

---

## 📦 Releases

| Version | Highlights                                                                    | Release Notes |
| ------- | ----------------------------------------------------------------------------- | ------------- |
| V1      | Initial release                                                               | — |
| V2      | MongoDB, SSE, Payment Tracking, Favorites, Session History, GHCR              | [RELEASE_NOTES_V2.md](docs/release_notes_v2.md) |
| V2.1    | Security hardening: auth on all routes, PBKDF2 upgrade, SSRF guard, XSS fixes | — |
| V3      | Authentication improvements, History, Exports *(Planned)*                     | — |

---

## 👨💻 Author

SKA97

GitHub:
https://github.com/SMARTSKA97
