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
👉 **[architecture.md](file:///c:/Users/Administrator/Documents/Workspaces/groupcart/docs/architecture.md)**

---

## 🔄 Workflow

Read the detailed state machine and process flow guide:
👉 **[workflow.md](file:///c:/Users/Administrator/Documents/Workspaces/groupcart/docs/workflow.md)**

---

## 📖 User & Admin Guides

For step-by-step instructions on running or using the app:
👉 **[TUTORIAL.md](file:///c:/Users/Administrator/Documents/Workspaces/groupcart/docs/tutorial.md)**

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

### Docker Compose (One-Liner)

Download the configuration and start the application instantly with:

```bash
# On Linux / macOS / Git Bash:
curl -sSL https://raw.githubusercontent.com/SMARTSKA97/groupcart/main/docker-compose.yml -o docker-compose.yml && docker compose up -d

# On Windows PowerShell:
curl.exe -sSL https://raw.githubusercontent.com/SMARTSKA97/groupcart/main/docker-compose.yml -o docker-compose.yml; docker compose up -d
```

Open:

```text
http://localhost
```

For building locally or development, use **[docker-compose.dev.yml](file:///c:/Users/Administrator/Documents/Workspaces/groupcart/docker-compose.dev.yml)**:
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

| Variable       | Description              | Default value |
| -------------- | ------------------------ | ------------- |
| MONGO_USER     | MongoDB Username         | `admin`       |
| MONGO_PASSWORD | MongoDB Password         | `adminpassword` |
| ADMIN_PASSWORD | Admin Dashboard Password | `admin123`    |

---

## 📦 Releases

| Version | Highlights                                                       | Release Notes |
| ------- | ---------------------------------------------------------------- | ------------- |
| V1      | Initial Release                                                  | - |
| V2      | MongoDB, SSE, Payment Tracking, Favorites, Session History, GHCR | **[RELEASE_NOTES_V2.md](file:///c:/Users/Administrator/Documents/Workspaces/groupcart/docs/release_notes_v2.md)** |
| V3      | Authentication, History, Exports *(Planned)*                     | - |

---

## 👨💻 Author

SKA97

GitHub:
https://github.com/SMARTSKA97
