// ===== API Client =====

const API = {
  async _fetch(url, options = {}) {
    try {
      const res = await fetch(url, {
        headers: { 'Content-Type': 'application/json' },
        ...options,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Request failed');
      return data;
    } catch (err) {
      console.error(`API Error [${url}]:`, err);
      throw err;
    }
  },

  // Auth
  login(name, isAdmin, adminPassword) {
    return this._fetch('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ name, isAdmin, adminPassword }),
    });
  },
  getUsers() { return this._fetch('/api/auth/users'); },

  // Apps
  getApps() { return this._fetch('/api/apps'); },
  addApp(name, color, icon) {
    return this._fetch('/api/apps', {
      method: 'POST',
      body: JSON.stringify({ name, color, icon }),
    });
  },
  deleteApp(id) { return this._fetch(`/api/apps/${id}`, { method: 'DELETE' }); },

  // Orders
  getOrders(userId, sessionId) {
    const params = [];
    if (userId) params.push(`userId=${userId}`);
    if (sessionId) params.push(`sessionId=${sessionId}`);
    const q = params.length > 0 ? `?${params.join('&')}` : '';
    return this._fetch(`/api/orders${q}`);
  },
  addOrder(order) {
    return this._fetch('/api/orders', {
      method: 'POST',
      body: JSON.stringify(order),
    });
  },
  updateOrder(id, updates) {
    return this._fetch(`/api/orders/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  },
  deleteOrder(id) {
    return this._fetch(`/api/orders/${id}`, { method: 'DELETE' });
  },

  // Order Status
  updateOrderStatus(id, status, statusNote, adminName) {
    return this._fetch(`/api/orders/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status, statusNote, adminName }),
    });
  },
  bulkUpdateStatus(appId, status, adminName) {
    return this._fetch('/api/orders/bulk-status', {
      method: 'PUT',
      body: JSON.stringify({ appId, status, adminName }),
    });
  },

  // Bills
  getBills(sessionId) {
    const q = sessionId ? `?sessionId=${sessionId}` : '';
    return this._fetch(`/api/bills${q}`);
  },
  setBill(appId, actualAmount, sessionId) {
    return this._fetch('/api/bills', {
      method: 'POST',
      body: JSON.stringify({ appId, actualAmount, sessionId }),
    });
  },

  // Settlement
  getSettlement(sessionId) {
    const q = sessionId ? `?sessionId=${sessionId}` : '';
    return this._fetch(`/api/settlement${q}`);
  },

  // Session
  getSessions() { return this._fetch('/api/sessions'); },
  resetSession(name) {
    return this._fetch('/api/session/reset', {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
  },

  // Settings
  getSettings() { return this._fetch('/api/settings'); },
  setSettings(settings) {
    return this._fetch('/api/settings', {
      method: 'POST',
      body: JSON.stringify(settings),
    });
  },

  // Scraper
  scrapeUrl(url) {
    return this._fetch('/api/scrape-url', {
      method: 'POST',
      body: JSON.stringify({ url }),
    });
  },

  // Session status
  updateSessionStatus(status, adminName, name) {
    return this._fetch('/api/session/status', {
      method: 'PUT',
      body: JSON.stringify({ status, adminName, name }),
    });
  },

  // Payments
  getPayments(sessionId) {
    const q = sessionId ? `?sessionId=${sessionId}` : '';
    return this._fetch(`/api/payments${q}`);
  },
  markPaid(userId, userName, amount) {
    return this._fetch('/api/payments/mark-paid', {
      method: 'POST',
      body: JSON.stringify({ userId, userName, amount }),
    });
  },
  confirmPayment(id, confirmed, adminName) {
    return this._fetch(`/api/payments/${id}/confirm`, {
      method: 'PUT',
      body: JSON.stringify({ confirmed, adminName }),
    });
  },

  // Favorites
  getFavorites(userId) {
    return this._fetch(`/api/favorites?userId=${userId}`);
  },
  addFavorite(favorite) {
    return this._fetch('/api/favorites', {
      method: 'POST',
      body: JSON.stringify(favorite),
    });
  },
  removeFavorite(id) {
    return this._fetch(`/api/favorites/${id}`, { method: 'DELETE' });
  },

  // Thresholds
  setThresholds(thresholds) {
    return this._fetch('/api/session/thresholds', {
      method: 'PUT',
      body: JSON.stringify({ thresholds }),
    });
  },

  // Split Mode
  setSplitMode(splitMode, customSplits) {
    return this._fetch('/api/session/split-mode', {
      method: 'PUT',
      body: JSON.stringify({ splitMode, customSplits }),
    });
  },
};

// ===== SSE (Server-Sent Events) =====
let eventSource = null;
const sseHandlers = {};

function connectSSE() {
  if (eventSource) eventSource.close();
  eventSource = new EventSource('/api/events');

  eventSource.onopen = () => console.log('SSE connected');
  eventSource.onerror = () => {
    console.warn('SSE connection lost, reconnecting...');
    setTimeout(() => {
      if (eventSource.readyState === EventSource.CLOSED) connectSSE();
    }, 3000);
  };

  // Register event listeners
  const events = [
    'order-added', 'order-updated', 'order-removed',
    'order-status-changed', 'order-bulk-status-changed',
    'bill-updated', 'user-joined',
    'app-added', 'app-removed', 'session-reset',
    'session-status-changed', 'payment-updated', 'favorite-added',
    'session-thresholds-updated', 'session-split-mode-updated'
  ];
  for (const event of events) {
    eventSource.addEventListener(event, (e) => {
      const data = JSON.parse(e.data);
      if (sseHandlers[event]) {
        for (const handler of sseHandlers[event]) handler(data);
      }
    });
  }
}

function onSSE(event, handler) {
  if (!sseHandlers[event]) sseHandlers[event] = [];
  sseHandlers[event].push(handler);
}
