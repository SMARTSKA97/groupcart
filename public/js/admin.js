// ===== Admin Views =====

const AdminView = {

  // Status display config
  STATUS_CONFIG: {
    'pending':       { label: 'Pending',       icon: '🕐', cssClass: 'status-pending' },
    'confirmed':     { label: 'Confirmed',     icon: '✅', cssClass: 'status-confirmed' },
    'out-of-stock':  { label: 'Out of Stock',  icon: '🚫', cssClass: 'status-oos' },
    'returned':      { label: 'Returned',      icon: '↩️', cssClass: 'status-returned' },
    'not-delivered':  { label: 'Not Delivered', icon: '❌', cssClass: 'status-not-delivered' },
  },

  // ---- Render Order Board ----
  async renderOrderBoard() {
    const container = document.getElementById('admin-order-board');
    const orders = UserView.orders;
    const apps = UserView.apps;
    const isReadOnly = UserView.selectedSessionId !== UserView.activeSessionId;

    if (orders.length === 0) {
      container.innerHTML = `<p class="text-muted">No orders yet</p>`;
      return;
    }

    const grouped = {};
    for (const order of orders) {
      if (!grouped[order.appId]) grouped[order.appId] = [];
      grouped[order.appId].push(order);
    }

    let html = '';
    for (const appId in grouped) {
      const app = apps.find(a => a.id === appId) || { name: appId, icon: '📦', color: '#888' };
      const appOrders = grouped[appId];
      const activeOrders = appOrders.filter(o => !['out-of-stock', 'returned', 'not-delivered'].includes(o.status));
      const total = activeOrders.reduce((s, o) => s + o.estimatedPrice * o.qty, 0);
      const pendingCount = appOrders.filter(o => o.status === 'pending').length;

      html += `<div class="admin-app-section">
        <div class="admin-app-header">
          <span class="admin-app-dot" style="background: ${app.color}"></span>
          <span>${app.icon} ${escapeHtml(app.name)}</span>
          <span style="color: var(--text-muted); font-weight: 400; font-size: 0.85rem">(${appOrders.length} items)</span>
        </div>`;

      // Bulk confirm button
      if (pendingCount > 0 && !isReadOnly) {
        html += `<button class="btn btn-sm btn-confirm-all" onclick="AdminView.bulkConfirm('${appId}')">
          ✅ Confirm All Pending (${pendingCount})
        </button>`;
      }

      // Active orders first, then excluded
      const sortedOrders = [...appOrders].sort((a, b) => {
        const excluded = ['out-of-stock', 'returned', 'not-delivered'];
        const aExcluded = excluded.includes(a.status) ? 1 : 0;
        const bExcluded = excluded.includes(b.status) ? 1 : 0;
        return aExcluded - bExcluded;
      });

      for (const order of sortedOrders) {
        const isExcluded = ['out-of-stock', 'returned', 'not-delivered'].includes(order.status);
        const statusCfg = this.STATUS_CONFIG[order.status] || this.STATUS_CONFIG['pending'];
        const modifiedBadge = order.adminModified
          ? `<span class="admin-modified-badge" title="Price verified by admin">✅ Verified</span>`
          : '';

        html += `<div class="admin-order-item ${isExcluded ? 'admin-order-excluded' : ''}" data-order-id="${order.id}">
          <div class="admin-order-item-name">
            <span class="${isExcluded ? 'text-strikethrough' : ''}">${escapeHtml(order.productName)} ×${order.qty} ${modifiedBadge}</span>
            <div class="admin-order-item-user">by ${escapeHtml(order.userName)}</div>
            ${order.statusNote ? `<div class="admin-status-note">📝 ${escapeHtml(order.statusNote)}</div>` : ''}
          </div>
          <div class="admin-price-edit">
            <span class="admin-price-label">₹</span>
            <input type="number" class="admin-price-input" id="admin-price-${order.id}" 
                   value="${order.estimatedPrice}" min="0" step="1" ${isExcluded || isReadOnly ? 'disabled' : ''} />
          </div>
          ${order.link ? `<a class="admin-order-link" href="${escapeHtml(order.link)}" target="_blank" rel="noopener">🔗</a>` : ''}
          <div class="admin-status-controls">
            ${this._renderStatusChips(order)}
          </div>
        </div>`;
      }

      html += `<div class="admin-app-total">
        <span>Active Total</span>
        <span id="admin-total-${appId}">${formatCurrency(total)}</span>
      </div>`;
      if (!isReadOnly) {
        html += `<button class="btn btn-sm btn-save-prices" onclick="AdminView.savePrices('${appId}')">✅ Save Prices</button>`;
      }
      html += `</div>`;
    }

    container.innerHTML = html;
  },

  // Generate status action chips based on current status
  _renderStatusChips(order) {
    const status = order.status || 'pending';
    let chips = '';

    // Current status display
    const cfg = this.STATUS_CONFIG[status];
    chips += `<span class="status-badge ${cfg.cssClass}">${cfg.icon} ${cfg.label}</span>`;

    // Only render transition buttons if the session is active
    if (UserView.selectedSessionId === UserView.activeSessionId) {
      // Available transitions
      if (status === 'pending') {
        chips += `<button class="status-chip status-chip-confirm" onclick="AdminView.setStatus('${order.id}', 'confirmed')" title="Confirm">✅</button>`;
        chips += `<button class="status-chip status-chip-oos" onclick="AdminView.promptStatus('${order.id}', 'out-of-stock')" title="Out of Stock">🚫</button>`;
      } else if (status === 'confirmed') {
        chips += `<button class="status-chip status-chip-return" onclick="AdminView.setStatus('${order.id}', 'returned')" title="Returned">↩️</button>`;
        chips += `<button class="status-chip status-chip-nd" onclick="AdminView.setStatus('${order.id}', 'not-delivered')" title="Not Delivered">❌</button>`;
      } else if (status === 'out-of-stock') {
        chips += `<button class="status-chip status-chip-revert" onclick="AdminView.setStatus('${order.id}', 'pending')" title="Revert to Pending">🔄</button>`;
      } else if (status === 'returned' || status === 'not-delivered') {
        chips += `<button class="status-chip status-chip-revert" onclick="AdminView.setStatus('${order.id}', 'confirmed')" title="Revert to Confirmed">🔄</button>`;
      }
    }

    return chips;
  },

  // Set order status (simple)
  async setStatus(orderId, status) {
    try {
      await API.updateOrderStatus(orderId, status, '', Auth.getUserName());
      showToast(`Status updated to ${this.STATUS_CONFIG[status]?.label || status}`);
      await UserView.refresh();
      this.renderOrderBoard();
      this.renderBillsForm();
    } catch (err) {
      showToast('❌ Failed to update status');
    }
  },

  // Prompt for note (out-of-stock)
  async promptStatus(orderId, status) {
    const note = prompt('Add a note (optional, e.g. "Try BigBasket instead"):') || '';
    try {
      await API.updateOrderStatus(orderId, status, note, Auth.getUserName());
      showToast(`Status updated to ${this.STATUS_CONFIG[status]?.label || status}`);
      await UserView.refresh();
      this.renderOrderBoard();
      this.renderBillsForm();
    } catch (err) {
      showToast('❌ Failed to update status');
    }
  },

  // Bulk confirm all pending for an app
  async bulkConfirm(appId) {
    try {
      const result = await API.bulkUpdateStatus(appId, 'confirmed', Auth.getUserName());
      showToast(`✅ ${result.updated} item(s) confirmed!`);
      await UserView.refresh();
      this.renderOrderBoard();
    } catch (err) {
      showToast('❌ Failed to bulk confirm');
    }
  },

  // ---- Save Admin Price Overrides ----
  async savePrices(appId) {
    const orders = UserView.orders.filter(o => o.appId === appId);
    let updated = 0;

    for (const order of orders) {
      const input = document.getElementById(`admin-price-${order.id}`);
      if (!input) continue;

      const newPrice = parseFloat(input.value);
      if (isNaN(newPrice) || newPrice === order.estimatedPrice) continue;

      try {
        await API.updateOrder(order.id, {
          estimatedPrice: newPrice,
          adminOverride: true,
          adminName: Auth.getUserName(),
        });
        updated++;
      } catch (err) {
        showToast(`❌ Failed to update ${order.productName}`);
      }
    }

    if (updated > 0) {
      showToast(`✅ ${updated} price(s) updated!`);
      await UserView.refresh();
      this.renderOrderBoard();
      this.renderBillsForm();
    } else {
      showToast('ℹ️ No price changes detected');
    }
  },

  // ---- Render Bills Form ----
  async renderBillsForm() {
    const container = document.getElementById('admin-bills-form');
    const apps = UserView.apps;
    const orders = UserView.orders;
    const isReadOnly = UserView.selectedSessionId !== UserView.activeSessionId;

    // Get existing bills
    let bills = [];
    try {
      const data = await API.getBills(UserView.selectedSessionId);
      bills = data.bills || [];
    } catch { /* ignore */ }

    // Only show apps that have active orders
    const excludedStatuses = ['out-of-stock', 'returned', 'not-delivered'];
    const appsWithOrders = {};
    const excludedByApp = {};

    for (const order of orders) {
      if (excludedStatuses.includes(order.status)) {
        if (!excludedByApp[order.appId]) excludedByApp[order.appId] = { count: 0, total: 0 };
        excludedByApp[order.appId].count++;
        excludedByApp[order.appId].total += order.estimatedPrice * order.qty;
      } else {
        if (!appsWithOrders[order.appId]) appsWithOrders[order.appId] = 0;
        appsWithOrders[order.appId] += order.estimatedPrice * order.qty;
      }
    }

    if (Object.keys(appsWithOrders).length === 0) {
      container.innerHTML = `<p class="text-muted">No active orders to bill yet</p>`;
      return;
    }

    let html = '';
    for (const appId in appsWithOrders) {
      const app = apps.find(a => a.id === appId) || { name: appId, icon: '📦', color: '#888' };
      const estimated = appsWithOrders[appId];
      const existingBill = bills.find(b => b.appId === appId);

      // Bill warning if items were excluded
      if (excludedByApp[appId] && existingBill) {
        html += `<div class="bill-warning">
          ⚠️ ${excludedByApp[appId].count} item(s) excluded (${formatCurrency(excludedByApp[appId].total)}) — bill may need re-entering
        </div>`;
      }

      html += `<div class="bill-input-row">
        <div class="bill-app-label">
          <span class="admin-app-dot" style="background: ${app.color}"></span>
          <span>${app.icon} ${escapeHtml(app.name)}</span>
        </div>
        <div class="bill-estimated">Est: ${formatCurrency(estimated)}</div>
        <div class="bill-input">
          <input type="number" id="bill-${appId}" placeholder="₹ Actual" min="0" step="1" value="${existingBill ? existingBill.actualAmount : ''}" ${isReadOnly ? 'disabled' : ''} />
        </div>
      </div>`;
    }

    if (!isReadOnly) {
      html += `<button class="btn btn-primary btn-block bill-save-btn" onclick="AdminView.saveBills()">💾 Save Bills</button>`;
    } else {
      html += `<button class="btn btn-block bill-save-btn" style="background: var(--text-muted); color: var(--text-secondary); cursor: not-allowed;" disabled>📜 Session Settled (Read-only)</button>`;
    }
    container.innerHTML = html;
  },

  async saveBills() {
    if (UserView.selectedSessionId !== UserView.activeSessionId) {
      showToast('⚠️ Cannot edit bills of a settled session.');
      return;
    }
    const orders = UserView.orders;
    const excludedStatuses = ['out-of-stock', 'returned', 'not-delivered'];
    const appsWithOrders = new Set(
      orders.filter(o => !excludedStatuses.includes(o.status)).map(o => o.appId)
    );

    let saved = 0;
    for (const appId of appsWithOrders) {
      const input = document.getElementById(`bill-${appId}`);
      if (input && input.value !== '') {
        try {
          await API.setBill(appId, parseFloat(input.value), UserView.selectedSessionId);
          saved++;
        } catch (err) {
          showToast(`❌ Failed to save bill for ${appId}`);
        }
      }
    }

    if (saved > 0) {
      showToast(`✅ ${saved} bill(s) saved!`);
      // Refresh payment view
      UserView.renderPayments();
    }
  },

  // ---- Render Manage Apps ----
  renderManageApps() {
    const container = document.getElementById('admin-apps-list');
    const apps = UserView.apps;

    if (apps.length === 0) {
      container.innerHTML = `<p class="text-muted">No apps configured</p>`;
      return;
    }

    let html = '';
    for (const app of apps) {
      html += `<div class="app-manage-item">
        <div class="app-manage-info">
          <span class="app-manage-dot" style="background: ${app.color}"></span>
          <span>${app.icon} ${escapeHtml(app.name)}</span>
        </div>
        <button class="app-manage-delete" onclick="AdminView.removeApp('${app.id}', '${escapeHtml(app.name)}')">✕ Remove</button>
      </div>`;
    }

    container.innerHTML = html;
  },

  async addApp(e) {
    e.preventDefault();
    const name = document.getElementById('new-app-name').value.trim();
    const icon = document.getElementById('new-app-icon').value.trim() || '📦';
    const color = document.getElementById('new-app-color').value;

    if (!name) { showToast('⚠️ Enter app name'); return; }

    try {
      await API.addApp(name, color, icon);
      document.getElementById('new-app-name').value = '';
      showToast(`✅ ${name} added!`);
      await UserView.loadApps();
      this.renderManageApps();
    } catch (err) {
      showToast(`❌ ${err.message}`);
    }
  },

  async removeApp(id, name) {
    if (!confirm(`Remove ${name}? Existing orders for this app won't be deleted.`)) return;
    try {
      await API.deleteApp(id);
      showToast(`🗑️ ${name} removed`);
      await UserView.loadApps();
      this.renderManageApps();
    } catch (err) {
      showToast(`❌ ${err.message}`);
    }
  },

  // ---- Reset Session ----
  openResetModal() {
    console.log('Open reset modal. Selected:', UserView.selectedSessionId, 'Active:', UserView.activeSessionId);
    if (UserView.selectedSessionId !== UserView.activeSessionId) {
      showToast('⚠️ Cannot reset a historical session.');
      return;
    }
    document.getElementById('reset-session-name').value = '';
    document.getElementById('modal-reset-session').classList.remove('hidden');
  },

  closeResetModal() {
    document.getElementById('modal-reset-session').classList.add('hidden');
  },

  async submitResetSession(e) {
    if (e) e.preventDefault();
    this.closeResetModal();

    const name = document.getElementById('reset-session-name').value.trim();

    try {
      const res = await API.resetSession(name);
      showToast('🔄 Session settled and reset!');
      
      if (res && res.newSession) {
        UserView.selectedSessionId = res.newSession.id;
      }
      if (window.AppController) {
        await window.AppController.loadSessions();
        await UserView.refresh();
        this.renderAll();
        window.AppController.switchTab('home');
      }
    } catch (err) {
      showToast('❌ Failed to reset session');
    }
  },

  // ---- Render All Admin Sections ----
  renderAll() {
    this.renderOrderBoard();
    this.renderBillsForm();
    this.renderManageApps();
  },
};
