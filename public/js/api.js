// ===== API Client =====

const API = {
  async _fetch(url, options = {}) {
    try {
      const headers = { 'Content-Type': 'application/json', ...options.headers };
      if (Auth && Auth.token) {
        headers['Authorization'] = `Bearer ${Auth.token}`;
      }
      const res = await fetch(url, {
        headers,
        ...options,
      });

      if (res.status === 401 && !url.includes('/api/auth/login')) {
        if (Auth) Auth.logout();
        window.location.reload();
        throw new Error('Session expired. Please log in again.');
      }

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

  // Change Password
  changePassword(password, newPassword) {
    return this._fetch('/api/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ password, newPassword }),
    });
  },

  // Admin Reset Password
  adminResetPassword(userId, newPassword) {
    return this._fetch('/api/auth/admin-reset-password', {
      method: 'POST',
      body: JSON.stringify({ userId, newPassword }),
    });
  },

  // Manual Payment Confirmation by Admin
  manualConfirmPayment(userId, userName, amount) {
    return this._fetch('/api/payments/manual-confirm', {
      method: 'POST',
      body: JSON.stringify({ userId, userName, amount }),
    });
  },

  // Allowed Apps for Session
  setAllowedApps(allowedAppIds) {
    return this._fetch('/api/session/allowed-apps', {
      method: 'PUT',
      body: JSON.stringify({ allowedAppIds }),
    });
  },

  // Link Payer for Session
  linkPayer(payerUserId, targetUserIds) {
    return this._fetch('/api/session/link-payer', {
      method: 'POST',
      body: JSON.stringify({ payerUserId, targetUserIds }),
    });
  },

  // Complaints
  submitComplaint(complaint) {
    return this._fetch('/api/complaints', {
      method: 'POST',
      body: JSON.stringify(complaint),
    });
  },
  getComplaints(sessionId) {
    const q = sessionId ? `?sessionId=${sessionId}` : '';
    return this._fetch(`/api/complaints${q}`);
  },
  updateComplaintStatus(id, status, refundAmount) {
    return this._fetch(`/api/complaints/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status, refundAmount }),
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
