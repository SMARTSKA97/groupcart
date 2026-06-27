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

  init() {
    this.initSplitModeSelector();
    
    const btnSaveThresholds = document.getElementById('btn-save-thresholds');
    if (btnSaveThresholds) {
      btnSaveThresholds.addEventListener('click', () => this.saveThresholds());
    }

    const btnCopyOrder = document.getElementById('btn-copy-order-summary');
    if (btnCopyOrder) {
      btnCopyOrder.addEventListener('click', () => this.copyOrderSummary());
    }

    const btnCopyPayment = document.getElementById('btn-copy-payment-summary');
    if (btnCopyPayment) {
      btnCopyPayment.addEventListener('click', () => this.copyPaymentSummary());
    }

    // Save Rounding Mode
    const btnSaveRounding = document.getElementById('btn-save-rounding-mode');
    if (btnSaveRounding) {
      btnSaveRounding.addEventListener('click', async () => {
        const rounding = document.querySelector('input[name="rounding-mode"]:checked')?.value || 'automatic';
        try {
          await API.setSplitMode(undefined, undefined, rounding);
          showToast(`✅ Rounding mode set to: ${rounding.toUpperCase()}`);
          await UserView.refresh();
          this.renderAll();
        } catch (err) {
          showToast('❌ Failed to save rounding mode');
        }
      });
    }

    // Save Allowed Apps
    const btnSaveSessionApps = document.getElementById('btn-save-session-apps');
    if (btnSaveSessionApps) {
      btnSaveSessionApps.addEventListener('click', async () => {
        const checkboxes = document.querySelectorAll('.admin-session-app-checkbox:checked');
        const allowedAppIds = Array.from(checkboxes).map(cb => cb.value);
        try {
          await API.setAllowedApps(allowedAppIds);
          showToast('✅ Allowed apps saved!');
          await UserView.refresh();
          this.renderAll();
        } catch (err) {
          showToast('❌ Failed to save allowed apps');
        }
      });
    }

    // OOS Move Scraper Detector
    const btnOOSDetect = document.getElementById('btn-oos-detect');
    if (btnOOSDetect) {
      btnOOSDetect.addEventListener('click', async () => {
        const urlInput = document.getElementById('oos-move-link');
        const url = urlInput.value.trim();
        if (!url) return;
        
        btnOOSDetect.disabled = true;
        btnOOSDetect.textContent = '...';
        try {
          const res = await API.scrapeUrl(url);
          if (res.success) {
            if (res.productName) document.getElementById('oos-move-name').value = res.productName;
            if (res.estimatedPrice) document.getElementById('oos-move-price').value = Math.round(res.estimatedPrice);
            if (res.appId) this.selectOOSApp(res.appId);
            showToast('✨ Details detected!');
          } else {
            showToast('❌ Not detected');
          }
        } catch (err) {
          showToast('❌ Detection failed');
        } finally {
          btnOOSDetect.disabled = false;
          btnOOSDetect.textContent = 'Detect';
        }
      });
    }

    // Submit OOS Move Form
    const oosForm = document.getElementById('oos-move-form');
    if (oosForm) {
      oosForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const orderId = document.getElementById('oos-move-order-id').value;
        const targetAppId = this.oosTargetAppId;
        const link = document.getElementById('oos-move-link').value.trim();
        const productName = document.getElementById('oos-move-name').value.trim();
        const price = parseFloat(document.getElementById('oos-move-price').value) || 0;

        if (!targetAppId) {
          showToast('⚠️ Please select a target app');
          return;
        }

        try {
          await API.updateOrder(orderId, { appId: targetAppId, link, productName, estimatedPrice: price });
          await API.updateOrderStatus(orderId, 'pending', 'Moved target platform', Auth.getUserName());
          showToast('✅ Item moved successfully!');
          this.closeOOSMoveModal();
          await UserView.refresh();
          this.renderAll();
        } catch (err) {
          showToast('❌ Failed to move item');
        }
      });
    }
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

      // Extract all product links for copying
      const linksText = appOrders.filter(o => o.link).map(o => o.link).join('\n');

      html += `<div class="admin-app-section">
        <div class="admin-app-header">
          <span class="admin-app-dot" style="background: ${app.color}"></span>
          <span>${app.icon} ${escapeHtml(app.name)}</span>
          <span style="color: var(--text-muted); font-weight: 400; font-size: 0.85rem">(${appOrders.length} items)</span>
        </div>
        ${linksText ? `<button class="btn btn-sm btn-secondary" onclick="copyToClipboard('${escapeHtml(linksText)}').then(() => showToast('✅ Copied all links!'))" style="margin-bottom: 0.75rem; width: 100%; font-size: 0.75rem; padding: 4px;">🔗 Copy All Product Links</button>` : ''}
      `;

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
            ${(order.status === 'out-of-stock' && !isReadOnly) ? `
              <button class="status-chip" onclick="AdminView.openOOSMoveModal('${order.id}', '${escapeHtml(order.productName)}')" style="background: var(--accent-secondary); color: white; border: none; font-size: 0.72rem; padding: 2px 6px; cursor: pointer; border-radius: 4px; display: inline-flex; align-items: center; gap: 2px;">🔄 Move</button>
            ` : ''}
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
      this.renderDashboard();
    } catch (err) {
      showToast('❌ Failed to update status');
    }
  },

  // Prompt for note (out-of-stock)
  async promptStatus(orderId, status) {
    const result = await SwalCustom.fire({
      title: 'Out of Stock Note',
      text: 'Add a note (optional, e.g. "Try BigBasket instead"):',
      input: 'text',
      inputPlaceholder: 'Enter note here...',
      showCancelButton: true,
      confirmButtonText: 'Submit',
      cancelButtonText: 'Cancel'
    });
    if (!result.isConfirmed) return;
    const note = result.value ? result.value.trim() : '';
    try {
      await API.updateOrderStatus(orderId, status, note, Auth.getUserName());
      showToast(`Status updated to ${this.STATUS_CONFIG[status]?.label || status}`);
      await UserView.refresh();
      this.renderOrderBoard();
      this.renderBillsForm();
      this.renderDashboard();
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
      this.renderDashboard();
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
      this.renderDashboard();
    } else {
      showToast('ℹ️ No price changes detected');
    }
  },

  // ---- Session Status transitions (P3) ----
  renderSessionStatusControls() {
    let card = document.getElementById('admin-status-card');
    const container = document.querySelector('#tab-admin .admin-sections');
    if (!container) return;

    if (!card) {
      card = document.createElement('div');
      card.id = 'admin-status-card';
      card.className = 'admin-card';
      container.insertBefore(card, container.firstChild);
    }

    const currentStatus = UserView.currentSession?.status || 'adding';
    const isReadOnly = UserView.selectedSessionId !== UserView.activeSessionId;

    const statusLabels = {
      'adding': 'Adding Items',
      'locked': 'Locked',
      'ordered': 'Ordered',
      'delivered': 'Delivered',
      'settled': 'Settled'
    };

    let buttonsHtml = '';
    if (!isReadOnly) {
      const statusFlow = ['adding', 'locked', 'ordered', 'delivered', 'settled'];
      const currentIndex = statusFlow.indexOf(currentStatus);
      
      if (currentIndex < statusFlow.length - 1) {
        const nextStatus = statusFlow[currentIndex + 1];
        buttonsHtml = `
          <button class="btn btn-primary btn-block" style="margin-top: 0.75rem;" onclick="AdminView.updateStatus('${nextStatus}')">
            Advance Status to: ${statusLabels[nextStatus]} →
          </button>
        `;
      }
      if (currentIndex > 0) {
        const prevStatus = statusFlow[currentIndex - 1];
        buttonsHtml += `
          <button class="btn btn-sm btn-text" style="margin-top: 0.5rem; width: 100%; text-align: center;" onclick="AdminView.updateStatus('${prevStatus}')">
            ← Revert to: ${statusLabels[prevStatus]}
          </button>
        `;
      }
    } else {
      buttonsHtml = `<p class="text-muted" style="font-size: 0.85rem; margin-top: 0.5rem;">📜 Session settled and closed.</p>`;
    }

    card.innerHTML = `
      <h3>🚦 Session Status Control</h3>
      <p style="font-size: 0.85rem; color: var(--text-secondary);">Current Status: <strong style="color: var(--accent-primary); text-transform: uppercase;">${statusLabels[currentStatus] || currentStatus}</strong></p>
      ${buttonsHtml}
    `;
  },

  async updateStatus(newStatus) {
    if (newStatus === 'settled') {
      this.openSettleModal();
      return;
    }
    try {
      await API.updateSessionStatus(newStatus, Auth.getUserName());
      showToast(`✅ Session status updated to ${newStatus.toUpperCase()}`);
      await UserView.refresh();
      this.renderAll();
    } catch (e) {
      showToast('❌ Failed to update session status');
    }
  },

  // ---- Confirm Payments (P4) ----
  async renderPaymentAdmin() {
    let card = document.getElementById('admin-payments-card');
    const container = document.querySelector('#tab-admin .admin-sections');
    if (!container) return;

    if (!card) {
      card = document.createElement('div');
      card.id = 'admin-payments-card';
      card.className = 'admin-card';
      const statusCard = document.getElementById('admin-status-card');
      if (statusCard && statusCard.nextSibling) {
        container.insertBefore(card, statusCard.nextSibling);
      } else {
        container.appendChild(card);
      }
    }

    const isReadOnly = UserView.selectedSessionId !== UserView.activeSessionId;

    let settlement;
    try {
      settlement = await API.getSettlement(UserView.selectedSessionId);
    } catch (e) {
      card.innerHTML = `<h3>💳 Confirm Payments</h3><p class="text-muted">Error loading payments</p>`;
      return;
    }

    if (!settlement.users || settlement.users.length === 0) {
      card.innerHTML = `<h3>💳 Confirm Payments</h3><p class="text-muted">No active orders</p>`;
      return;
    }

    let payments = [];
    try {
      const res = await API.getPayments(UserView.selectedSessionId);
      payments = res.payments || [];
    } catch (e) {}

    let html = '<h3>💳 Confirm Payments</h3>';
    html += `<div style="display: flex; flex-direction: column; gap: 0.75rem; margin-top: 0.5rem;">`;

    let activeOwer = false;
    for (const user of settlement.users) {
      if (user.total <= 0) continue;
      activeOwer = true;

      const userPayments = payments.filter(p => p.userId === user.userId);
      let paymentsListHtml = '';
      const totalPaidOrPending = userPayments.reduce((sum, p) => sum + p.amount, 0);

      if (userPayments.length > 0) {
        paymentsListHtml = `<div style="margin-top: 0.4rem; padding-left: 0.75rem; border-left: 2px solid var(--border); display: flex; flex-direction: column; gap: 0.35rem;">`;
        for (const p of userPayments) {
          const pStatus = p.confirmedByAdmin ? 
            `<span class="status-badge confirmed">Confirmed</span>` : 
            `<span class="status-badge paid">Paid</span>`;
          const pAction = p.confirmedByAdmin ? 
            `<button class="btn btn-sm btn-text" onclick="AdminView.setPaymentConfirm('${p.id}', false)" style="color: var(--danger); padding: 2px 6px; font-size: 0.7rem; margin-left: 0.5rem;">Unconfirm</button>` : 
            `<button class="btn btn-sm btn-primary" onclick="AdminView.setPaymentConfirm('${p.id}', true)" style="padding: 2px 6px; font-size: 0.7rem; margin-left: 0.5rem;">Confirm</button>`;

          paymentsListHtml += `
            <div style="display: flex; align-items: center; justify-content: space-between; font-size: 0.78rem;">
              <span>Paid: <strong>${formatCurrency(p.amount)}</strong></span>
              <div style="display: flex; align-items: center;">
                ${pStatus}
                ${!isReadOnly ? pAction : ''}
              </div>
            </div>
          `;
        }

        // Allow manual confirmation of any remaining amount
        const remaining = user.total - totalPaidOrPending;
        if (remaining > 0.5 && !isReadOnly) {
          paymentsListHtml += `
            <div style="display: flex; align-items: center; justify-content: space-between; font-size: 0.78rem; margin-top: 0.25rem;">
              <span class="text-muted">Remaining: <strong>${formatCurrency(remaining)}</strong></span>
              <button class="btn btn-sm btn-secondary" onclick="AdminView.manualConfirm('${user.userId}', '${escapeHtml(user.userName)}', ${remaining})" style="padding: 2px 6px; font-size: 0.7rem;">Confirm Rest</button>
            </div>
          `;
        }
        paymentsListHtml += `</div>`;
      } else {
        paymentsListHtml = `
          <div style="display: flex; align-items: center; justify-content: space-between; margin-top: 0.4rem;">
            <span class="status-badge unpaid">Unpaid</span>
            ${!isReadOnly ? `<button class="btn btn-sm btn-secondary" onclick="AdminView.manualConfirm('${user.userId}', '${escapeHtml(user.userName)}', ${user.total})" style="padding: 2px 6px; font-size: 0.7rem;">Manual Confirm</button>` : ''}
          </div>
        `;
      }

      html += `
        <div style="background: rgba(255, 255, 255, 0.01); border: 1px solid var(--border); padding: 0.55rem 0.75rem; border-radius: var(--radius-sm);">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="font-weight: 600; font-size: 0.85rem;">👤 ${escapeHtml(user.userName)}</span>
            <span style="font-size: 0.8rem; font-weight: 500;">Total Owed: <strong style="color: var(--accent-secondary);">${formatCurrency(user.total)}</strong></span>
          </div>
          ${paymentsListHtml}
        </div>
      `;
    }

    if (!activeOwer) {
      html += `<p class="text-muted" style="font-size:0.85rem;">No payments to confirm (everyone owes ₹0).</p>`;
    }

    html += `</div>`;
    card.innerHTML = html;
  },

  async setPaymentConfirm(paymentId, confirmed) {
    try {
      await API.confirmPayment(paymentId, confirmed, Auth.getUserName());
      showToast(confirmed ? '✅ Payment confirmed!' : '↩️ Payment unconfirmed');
      await this.renderPaymentAdmin();
      // Force user view sync
      UserView.renderPayments();
    } catch (e) {
      showToast('❌ Failed to update payment status');
    }
  },

  // ---- Split Modes Wiring (P8) ----
  initSplitModeSelector() {
    const radios = document.querySelectorAll('input[name="split-mode"]');
    radios.forEach(radio => {
      radio.addEventListener('change', async (e) => {
        const mode = e.target.value;
        try {
          await API.setSplitMode(mode);
          showToast(`⚖️ Split mode changed to: ${mode}`);
          
          if (mode === 'custom') {
            document.getElementById('custom-split-inputs').classList.remove('hidden');
            await this.renderCustomSplitFields();
          } else {
            document.getElementById('custom-split-inputs').classList.add('hidden');
            await UserView.refresh();
            UserView.renderPayments();
            this.renderPaymentAdmin();
          }
        } catch (err) {
          showToast('❌ Failed to update split mode');
        }
      });
    });

    const btnSaveSplits = document.getElementById('btn-save-custom-splits');
    if (btnSaveSplits) {
      btnSaveSplits.addEventListener('click', () => this.saveCustomSplits());
    }
  },

  async renderCustomSplitFields() {
    const container = document.getElementById('custom-split-fields-list');
    
    let settlement;
    try {
      settlement = await API.getSettlement(UserView.selectedSessionId);
    } catch (e) {
      return;
    }

    const customSplits = settlement.session?.customSplits || {};
    const isReadOnly = UserView.selectedSessionId !== UserView.activeSessionId;

    let html = '';
    for (const user of settlement.users) {
      const existingVal = customSplits[user.userId] !== undefined ? customSplits[user.userId] : user.total;
      html += `
        <div style="display: flex; justify-content: space-between; align-items: center; gap: 1rem;">
          <span style="font-size: 0.85rem; font-weight: 500;">👤 ${escapeHtml(user.userName)}</span>
          <input type="number" class="custom-split-input-val" data-user-id="${user.userId}" 
                 value="${existingVal}" min="0" step="1" style="width: 100px; text-align: right;" ${isReadOnly ? 'disabled' : ''} />
        </div>
      `;
    }
    container.innerHTML = html;
  },

  async saveCustomSplits() {
    const inputs = document.querySelectorAll('.custom-split-input-val');
    const customSplits = {};
    inputs.forEach(input => {
      customSplits[input.dataset.userId] = parseFloat(input.value) || 0;
    });

    try {
      await API.setSplitMode('custom', customSplits);
      showToast('✅ Custom splits saved!');
      await UserView.refresh();
      UserView.renderPayments();
      this.renderPaymentAdmin();
    } catch (e) {
      showToast('❌ Failed to save splits');
    }
  },

  syncSplitModeUI(session) {
    if (!session) return;
    const mode = session.splitMode || 'proportional';
    const radio = document.querySelector(`input[name="split-mode"][value="${mode}"]`);
    if (radio) radio.checked = true;

    const customBox = document.getElementById('custom-split-inputs');
    if (mode === 'custom') {
      customBox.classList.remove('hidden');
      this.renderCustomSplitFields();
    } else {
      customBox.classList.add('hidden');
    }

    const rounding = session.roundingMode || 'automatic';
    const roundingRadio = document.querySelector(`input[name="rounding-mode"][value="${rounding}"]`);
    if (roundingRadio) roundingRadio.checked = true;
  },

  // ---- Threshold targets (P6) ----
  renderThresholdConfigFields(session) {
    const container = document.getElementById('admin-threshold-inputs-list');
    const thresholds = session?.freeDeliveryThresholds || {};
    const apps = UserView.apps;

    if (apps.length === 0) {
      container.innerHTML = `<p class="text-muted" style="font-size: 0.85rem;">No apps configured to set targets.</p>`;
      return;
    }

    const isReadOnly = UserView.selectedSessionId !== UserView.activeSessionId;

    let html = '';
    for (const app of apps) {
      const val = thresholds[app.id] || 0;
      html += `
        <div style="display: flex; justify-content: space-between; align-items: center; gap: 1rem;">
          <span style="font-size: 0.85rem; font-weight: 500;">${app.icon} ${escapeHtml(app.name)}</span>
          <input type="number" class="threshold-input-val" data-app-id="${app.id}" 
                 value="${val > 0 ? val : ''}" placeholder="e.g. 500" min="0" step="10" style="width: 120px; text-align: right;" ${isReadOnly ? 'disabled' : ''} />
        </div>
      `;
    }
    container.innerHTML = html;
  },

  async saveThresholds() {
    const inputs = document.querySelectorAll('.threshold-input-val');
    const thresholds = {};
    inputs.forEach(input => {
      const val = parseFloat(input.value) || 0;
      if (val > 0) {
        thresholds[input.dataset.appId] = val;
      }
    });

    try {
      await API.setThresholds(thresholds);
      showToast('✅ Delivery targets saved!');
      await UserView.refresh();
    } catch (e) {
      showToast('❌ Failed to save targets');
    }
  },

  // ---- Summary copy functions (P10) ----
  renderDashboard() {
    const container = document.getElementById('admin-platform-summary-cards');
    const orders = UserView.orders;
    const apps = UserView.apps;

    if (orders.length === 0) {
      container.innerHTML = `<p class="text-muted" style="font-size:0.85rem;">No active orders yet.</p>`;
      return;
    }

    const appGroups = {};
    const excludedStatuses = ['out-of-stock', 'returned', 'not-delivered'];
    
    for (const order of orders) {
      if (excludedStatuses.includes(order.status)) continue;
      if (!appGroups[order.appId]) appGroups[order.appId] = { count: 0, total: 0 };
      appGroups[order.appId].count += order.qty;
      appGroups[order.appId].total += order.estimatedPrice * order.qty;
    }

    let html = '';
    let hasData = false;

    for (const appId in appGroups) {
      const app = apps.find(a => a.id === appId) || { name: appId, icon: '📦' };
      const group = appGroups[appId];
      hasData = true;

      html += `
        <div class="platform-summary-card">
          <div class="platform-summary-icon">${app.icon}</div>
          <div class="platform-summary-name">${escapeHtml(app.name)}</div>
          <div class="platform-summary-value">${formatCurrency(group.total)}</div>
          <div class="platform-summary-count">${group.count} ${group.count === 1 ? 'item' : 'items'}</div>
        </div>
      `;
    }

    if (hasData) {
      container.innerHTML = html;
    } else {
      container.innerHTML = `<p class="text-muted" style="font-size:0.85rem;">No active items.</p>`;
    }
  },

  async copyOrderSummary() {
    const text = generateOrderSummaryText(UserView.orders, UserView.apps);
    try {
      await navigator.clipboard.writeText(text);
      showToast('✅ Order Summary copied to clipboard!');
    } catch (e) {
      showToast('❌ Failed to copy summary');
    }
  },

  async copyPaymentSummary() {
    let settlement;
    try {
      settlement = await API.getSettlement(UserView.selectedSessionId);
    } catch (e) {
      showToast('❌ Failed to load settlement');
      return;
    }
    const text = generatePaymentSummaryText(settlement);
    try {
      await navigator.clipboard.writeText(text);
      showToast('✅ Payment Summary copied to clipboard!');
    } catch (e) {
      showToast('❌ Failed to copy summary');
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
      UserView.renderPayments();
      this.renderPaymentAdmin();
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
    const result = await SwalCustom.fire({
      title: 'Remove Platform?',
      text: `Are you sure you want to remove ${name}? Existing orders for this app won't be deleted.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Remove',
      cancelButtonText: 'Cancel'
    });
    if (!result.isConfirmed) return;
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

  // ---- Settle Session ----
  openSettleModal() {
    console.log('Open settle modal. Selected:', UserView.selectedSessionId, 'Active:', UserView.activeSessionId);
    if (UserView.selectedSessionId !== UserView.activeSessionId) {
      showToast('⚠️ Cannot settle a historical session.');
      return;
    }
    document.getElementById('settle-session-name').value = '';
    document.getElementById('modal-settle-session').classList.remove('hidden');
  },

  closeSettleModal() {
    document.getElementById('modal-settle-session').classList.add('hidden');
  },

  async submitSettleSession(e) {
    if (e) e.preventDefault();
    this.closeSettleModal();

    const name = document.getElementById('settle-session-name').value.trim();

    try {
      await API.updateSessionStatus('settled', Auth.getUserName(), name);
      showToast(`✅ Session status updated to SETTLED`);
      await UserView.refresh();
      this.renderAll();
    } catch (err) {
      showToast('❌ Failed to settle session');
    }
  },

  // ---- Render All Admin Sections ----
  renderAll() {
    // Trigger admin onboarding walkthrough if not shown yet
    if (!localStorage.getItem('groupcart_tutorial_admin_shown')) {
      localStorage.setItem('groupcart_tutorial_admin_shown', 'true');
      setTimeout(() => {
        this.showAdminOnboardingTutorial();
      }, 500);
    }

    this.renderOrderBoard();
    this.renderBillsForm();
    this.renderManageApps();
    this.renderSessionStatusControls();
    this.renderPaymentAdmin();
    this.renderDashboard();
    this.renderSessionAppsCheckboxes();
    this.renderManageUsers();
    
    if (UserView.currentSession) {
      this.syncSplitModeUI(UserView.currentSession);
      this.renderThresholdConfigFields(UserView.currentSession);
    }
  },

  renderSessionAppsCheckboxes() {
    const container = document.getElementById('admin-session-apps-checkboxes');
    if (!container) return;
    
    const session = UserView.currentSession;
    const allowedAppIds = session?.allowedAppIds || [];
    
    container.innerHTML = UserView.apps.map(app => {
      const isAllowed = allowedAppIds.length === 0 || allowedAppIds.includes(app.id);
      return `
        <label class="checkbox-label" style="margin-right: 0.75rem;">
          <input type="checkbox" class="admin-session-app-checkbox" value="${app.id}" ${isAllowed ? 'checked' : ''} />
          <span class="checkmark"></span>
          ${app.icon} ${escapeHtml(app.name)}
        </label>
      `;
    }).join('');
  },

  async renderManageUsers() {
    const container = document.getElementById('admin-users-list');
    if (!container) return;

    try {
      const { users } = await API._fetch('/api/auth/users');
      
      if (users.length === 0) {
        container.innerHTML = `<p class="text-muted" style="font-size: 0.8rem;">No registered users found.</p>`;
        return;
      }

      container.innerHTML = users.map(user => `
        <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.01); border: 1px solid var(--border); padding: 0.4rem 0.6rem; border-radius: var(--radius-sm); margin-bottom: 0.25rem;">
          <span style="font-size: 0.85rem; font-weight: 500;">👤 ${escapeHtml(user.name)} ${user.isAdmin ? '<strong style="color:var(--accent-primary);">[Admin]</strong>' : ''}</span>
          <button class="btn btn-sm btn-text" onclick="AdminView.resetUserPassword('${user.id}', '${escapeHtml(user.name)}')" style="color: var(--warning); padding: 2px 8px; font-size: 0.75rem;">Reset Pass</button>
        </div>
      `).join('');
    } catch (err) {
      container.innerHTML = `<p class="text-danger" style="font-size: 0.8rem;">Error loading users.</p>`;
    }
  },

  async resetUserPassword(userId, userName) {
    const result = await SwalCustom.fire({
      title: `Reset Password for ${userName}`,
      text: 'Enter new password (6+ chars, alphanumeric, special char):',
      input: 'password',
      inputPlaceholder: 'New Password',
      showCancelButton: true,
      confirmButtonText: 'Reset',
      cancelButtonText: 'Cancel'
    });
    if (!result.isConfirmed || !result.value) return;
    
    const newPwd = result.value.trim();
    const passwordRegex = /^(?=.*[a-zA-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{6,}$/;
    if (!passwordRegex.test(newPwd)) {
      showToast('❌ Password must be 6+ characters and contain letter, number, and special character');
      return;
    }

    try {
      await API.adminResetPassword(userId, newPwd);
      showToast(`✅ Password reset successfully for ${userName}!`);
    } catch (err) {
      showToast(`❌ Failed to reset password: ${err.message}`);
    }
  },

  async manualConfirm(userId, userName, amount) {
    try {
      await API.manualConfirmPayment(userId, userName, amount);
      showToast(`✅ Payment confirmed for ${userName}!`);
      await UserView.refresh();
      this.renderPaymentAdmin();
    } catch (e) {
      showToast('❌ Failed to confirm payment');
    }
  },

  openOOSMoveModal(orderId, productName) {
    document.getElementById('oos-move-order-id').value = orderId;
    document.getElementById('oos-move-name').value = productName;
    document.getElementById('oos-move-link').value = '';
    document.getElementById('oos-move-price').value = '';
    
    this.oosTargetAppId = UserView.apps.length > 0 ? UserView.apps[0].id : null;
    this.renderOOSAppPicker();
    document.getElementById('modal-oos-move').classList.remove('hidden');
  },

  closeOOSMoveModal() {
    document.getElementById('modal-oos-move').classList.add('hidden');
  },

  renderOOSAppPicker() {
    const container = document.getElementById('oos-app-picker');
    if (!container) return;
    
    const session = UserView.currentSession;
    const allowedAppIds = session?.allowedAppIds || [];
    const activeApps = UserView.apps.filter(app => {
      if (allowedAppIds.length > 0 && !allowedAppIds.includes(app.id)) return false;
      return true;
    });

    container.innerHTML = activeApps.map(app =>
      `<div class="app-chip ${this.oosTargetAppId === app.id ? 'selected' : ''}" 
             style="--chip-color: ${app.color}" 
             data-app-id="${app.id}" 
             onclick="AdminView.selectOOSApp('${app.id}')">
         <span>${app.icon}</span>
         <span>${escapeHtml(app.name)}</span>
       </div>`
     ).join('');
  },

  selectOOSApp(appId) {
    this.oosTargetAppId = appId;
    const container = document.getElementById('oos-app-picker');
    if (!container) return;
    container.querySelectorAll('.app-chip').forEach(chip => {
      chip.classList.toggle('selected', chip.dataset.appId === appId);
    });
  },

  showAdminOnboardingTutorial() {
    const slides = [
      { icon: '⚙️', title: 'Admin Controls Dashboard', text: 'Advance session statuses (Adding -> Locked -> Ordered -> Delivered -> Settled) and restrict allowed platforms.' },
      { icon: '💵', title: 'Calculated Bill Splits', text: 'Enter final bills from the delivery apps. The server automatically splits delivery fees and discounts proportionally!' },
      { icon: '💳', title: 'Direct Payment Confirm', text: 'Directly confirm user payments with a single click. Useful for cash or offline pay confirmation!' },
      { icon: '🚫', title: 'Out of Stock Redirection', text: 'If a product is OOS, click "Move" to switch it to another active platform, scrape new details, and reset status back to pending.' }
    ];
    Tutorial.show(slides);
  },
};
