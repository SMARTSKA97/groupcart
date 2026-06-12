// ===== User Views =====

const UserView = {
  apps: [],
  orders: [],
  selectedAppId: null,
  editSelectedAppId: null,
  favorites: [],
  mySettlementTotal: 0,
  currentSession: null,

  // Status display config
  STATUS_CONFIG: {
    'pending':       { label: 'Pending',       icon: '🕐', cssClass: 'status-pending' },
    'confirmed':     { label: 'Confirmed',     icon: '✅', cssClass: 'status-confirmed' },
    'out-of-stock':  { label: 'Out of Stock',  icon: '🚫', cssClass: 'status-oos' },
    'returned':      { label: 'Returned',      icon: '↩️', cssClass: 'status-returned' },
    'not-delivered':  { label: 'Not Delivered', icon: '❌', cssClass: 'status-not-delivered' },
  },

  init() {
    // P1: URL Import Assistant
    const btnDetect = document.getElementById('btn-detect-url');
    if (btnDetect) {
      btnDetect.addEventListener('click', () => this.handleUrlImport());
    }
    const urlInput = document.getElementById('item-import-url');
    if (urlInput) {
      urlInput.addEventListener('paste', () => {
        setTimeout(() => this.handleUrlImport(), 100);
      });
    }

    // P4: Mark Paid button
    const btnMarkPaid = document.getElementById('btn-mark-paid');
    if (btnMarkPaid) {
      btnMarkPaid.addEventListener('click', () => this.handleMarkPaid());
    }

    // P5: Favorites Toggle
    const btnFavsToggle = document.getElementById('btn-favorites-toggle');
    if (btnFavsToggle) {
      btnFavsToggle.addEventListener('click', () => this.toggleFavorites());
    }
  },

  async loadApps() {
    const { apps } = await API.getApps();
    this.apps = apps;
  },

  async loadOrders() {
    const { orders } = await API.getOrders(undefined, this.selectedSessionId);
    this.orders = orders;
  },

  // ---- Status Badge HTML ----
  _statusBadge(order) {
    const cfg = this.STATUS_CONFIG[order.status] || this.STATUS_CONFIG['pending'];
    return `<span class="order-status-badge ${cfg.cssClass}">${cfg.icon} ${cfg.label}</span>`;
  },

  _isExcluded(order) {
    return ['out-of-stock', 'returned', 'not-delivered'].includes(order.status);
  },

  getUPIUrls(upiId, myTotal, upiNote) {
    const isAndroid = /Android/i.test(navigator.userAgent);
    const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
    
    const pa = encodeURIComponent(upiId);
    const pn = encodeURIComponent('GroupCart');
    const am = myTotal;
    const tn = encodeURIComponent(upiNote);
    const cu = 'INR';
    const query = `pa=${pa}&pn=${pn}&am=${am}&tn=${tn}&cu=${cu}`;

    if (isAndroid) {
      const fallback = encodeURIComponent(`upi://pay?${query}`);
      return {
        gpay: `intent://pay?${query}#Intent;scheme=upi;package=com.google.android.apps.nbu.paisa.user;S.browser_fallback_url=${fallback};end`,
        phonepe: `intent://pay?${query}#Intent;scheme=upi;package=com.phonepe.app;S.browser_fallback_url=${fallback};end`,
        paytm: `intent://pay?${query}#Intent;scheme=upi;package=net.one97.paytm;S.browser_fallback_url=${fallback};end`,
        bhim: `intent://pay?${query}#Intent;scheme=upi;package=in.org.npci.upiapp;S.browser_fallback_url=${fallback};end`,
        slice: `intent://pay?${query}#Intent;scheme=upi;package=indwin.c3.shareapp;S.browser_fallback_url=${fallback};end`,
        cred: `intent://pay?${query}#Intent;scheme=upi;package=com.dreamplug.androidapp;S.browser_fallback_url=${fallback};end`,
        generic: `upi://pay?${query}`
      };
    } else if (isIOS) {
      return {
        gpay: `gpay://upi/pay?${query}`,
        phonepe: `phonepe://upi/pay?${query}`,
        paytm: `paytmmp://upi/pay?${query}`,
        bhim: `bhim://upi/pay?${query}`,
        slice: `slice-upi://upi/pay?${query}`,
        cred: `credpay://upi/pay?${query}`,
        generic: `upi://pay?${query}`
      };
    } else {
      return {
        gpay: `upi://pay?${query}`,
        phonepe: `upi://pay?${query}`,
        paytm: `upi://pay?${query}`,
        bhim: `upi://pay?${query}`,
        slice: `upi://pay?${query}`,
        cred: `upi://pay?${query}`,
        generic: `upi://pay?${query}`
      };
    }
  },

  // ---- Render All Orders ----
  renderAllOrders() {
    const container = document.getElementById('orders-list');
    const countEl = document.getElementById('total-items-count');

    if (this.orders.length === 0) {
      container.innerHTML = `
        <div class="empty-state" id="empty-orders">
          <div class="empty-icon">📋</div>
          <p>No orders yet</p>
          <p class="empty-sub">Tap + to add your first item</p>
        </div>`;
      countEl.textContent = '0 items';
      return;
    }

    // Group by app
    const grouped = {};
    for (const order of this.orders) {
      if (!grouped[order.appId]) grouped[order.appId] = [];
      grouped[order.appId].push(order);
    }

    let html = '';
    for (const appId in grouped) {
      const app = this.apps.find(a => a.id === appId) || { name: appId, icon: '📦', color: '#888' };
      const appOrders = grouped[appId];
      const activeOrders = appOrders.filter(o => !this._isExcluded(o));
      const total = activeOrders.reduce((s, o) => s + o.estimatedPrice * o.qty, 0);

      html += `<div class="app-group">`;
      html += `<div class="app-group-header" style="--app-color: ${app.color}">
        <span class="app-group-icon">${app.icon}</span>
        <span class="app-group-name">${escapeHtml(app.name)}</span>
        <span class="app-group-total">${formatCurrency(total)}</span>
      </div>`;

      // Sort: active first, excluded last
      const sortedOrders = [...appOrders].sort((a, b) => {
        const aEx = this._isExcluded(a) ? 1 : 0;
        const bEx = this._isExcluded(b) ? 1 : 0;
        return aEx - bEx;
      });

      let hasRenderedAny = false;
      for (const order of sortedOrders) {
        const isOwn = order.userId === Auth.getUserId();
        if (!isOwn) continue; // Privacy: only show own orders

        hasRenderedAny = true;
        const isExcluded = this._isExcluded(order);

        html += `<div class="order-card own-order ${isExcluded ? 'order-excluded' : ''}" data-order-id="${order.id}" ${!isExcluded ? 'onclick="UserView.openEditModal(\'' + order.id + '\')"' : ''}>
          <div class="order-card-body">
            <div class="order-product ${isExcluded ? 'text-strikethrough' : ''}">${escapeHtml(order.productName)}</div>
            <div class="order-meta">
              <span class="order-user-tag">${escapeHtml(order.userName)}</span>
              <span>×${order.qty}</span>
              ${this._statusBadge(order)}
            </div>
            ${order.status === 'out-of-stock' && order.statusNote ? `<div class="order-status-note">📝 ${escapeHtml(order.statusNote)}</div>` : ''}
            ${order.link ? `<a class="order-link" href="${escapeHtml(order.link)}" target="_blank" rel="noopener" onclick="event.stopPropagation()">🔗 Open link</a>` : ''}
          </div>
          <div>
            <div class="order-price ${isExcluded ? 'text-strikethrough text-muted-price' : ''}">${formatCurrency(order.estimatedPrice * order.qty)}</div>
            ${order.qty > 1 ? `<div class="order-qty">${formatCurrency(order.estimatedPrice)} each</div>` : ''}
          </div>
        </div>`;
      }

      if (!hasRenderedAny) {
        html += `<div style="padding: 0.75rem 1rem; color: var(--text-muted); font-size: 0.85rem; font-style: italic;">No items added by you here</div>`;
      }
      html += `</div>`;
    }

    container.innerHTML = html;
    const activeCount = this.orders.filter(o => !this._isExcluded(o)).length;
    countEl.textContent = `${activeCount} active / ${this.orders.length} total`;
  },

  // ---- Render My Orders ----
  renderMyOrders() {
    const container = document.getElementById('my-orders-list');
    const countEl = document.getElementById('my-items-count');
    const myOrders = this.orders.filter(o => o.userId === Auth.getUserId());

    if (myOrders.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🛍️</div>
          <p>You haven't added anything</p>
          <p class="empty-sub">Tap + to add items</p>
        </div>`;
      countEl.textContent = '0 items';
      return;
    }

    const grouped = {};
    for (const order of myOrders) {
      if (!grouped[order.appId]) grouped[order.appId] = [];
      grouped[order.appId].push(order);
    }

    let html = '';
    for (const appId in grouped) {
      const app = this.apps.find(a => a.id === appId) || { name: appId, icon: '📦', color: '#888' };
      const appOrders = grouped[appId];
      const activeOrders = appOrders.filter(o => !this._isExcluded(o));
      const total = activeOrders.reduce((s, o) => s + o.estimatedPrice * o.qty, 0);

      html += `<div class="app-group">`;
      html += `<div class="app-group-header" style="--app-color: ${app.color}">
        <span class="app-group-icon">${app.icon}</span>
        <span class="app-group-name">${escapeHtml(app.name)}</span>
        <span class="app-group-total">${formatCurrency(total)}</span>
      </div>`;

      // Sort: active first
      const sortedOrders = [...appOrders].sort((a, b) => {
        return (this._isExcluded(a) ? 1 : 0) - (this._isExcluded(b) ? 1 : 0);
      });

      for (const order of sortedOrders) {
        const isExcluded = this._isExcluded(order);
        const isFav = this.favorites.some(f => f.appId === order.appId && f.productName.toLowerCase() === order.productName.toLowerCase());

        html += `<div class="order-card own-order ${isExcluded ? 'order-excluded' : ''}" data-order-id="${order.id}">
          <div class="order-card-body" ${!isExcluded ? `onclick="UserView.openEditModal('${order.id}')"` : ''}>
            <div style="display: flex; align-items: center; gap: 0.25rem;">
              <button class="star-btn ${isFav ? 'starred' : ''}" onclick="event.stopPropagation(); UserView.toggleFavoriteItem('${order.id}')" title="${isFav ? 'Remove from favorites' : 'Add to favorites'}" style="background: none; border: none; color: #f59e0b; font-size: 1.15rem; cursor: pointer; padding: 0;">${isFav ? '★' : '☆'}</button>
              <div class="order-product ${isExcluded ? 'text-strikethrough' : ''}">${escapeHtml(order.productName)}</div>
            </div>
            <div class="order-meta" style="margin-top: 0.5rem; display: flex; align-items: center; gap: 0.75rem;">
              ${isExcluded ? `<span>×${order.qty}</span>` : `
                <div class="compact-qty-stepper" onclick="event.stopPropagation()" style="display: inline-flex; align-items: center; background: rgba(255,255,255,0.05); border: 1px solid var(--border); border-radius: 4px; height: 26px;">
                  <button type="button" class="compact-qty-btn" onclick="UserView.updateQuantity('${order.id}', -1)" style="border: none; background: none; color: var(--text-primary); width: 24px; height: 100%; cursor: pointer; font-weight: 700;">−</button>
                  <span class="compact-qty-val" id="qty-val-${order.id}" style="font-size: 0.8rem; font-weight: 700; width: 20px; text-align: center;">${order.qty}</span>
                  <button type="button" class="compact-qty-btn" onclick="UserView.updateQuantity('${order.id}', 1)" style="border: none; background: none; color: var(--text-primary); width: 24px; height: 100%; cursor: pointer; font-weight: 700;">+</button>
                </div>
              `}
              ${this._statusBadge(order)}
            </div>
            ${order.status === 'out-of-stock' && order.statusNote ? `<div class="order-status-note">📝 ${escapeHtml(order.statusNote)}</div>` : ''}
            ${order.link ? `<a class="order-link" href="${escapeHtml(order.link)}" target="_blank" rel="noopener" onclick="event.stopPropagation()">🔗 Open link</a>` : ''}
          </div>
          <div style="text-align: right; display: flex; flex-direction: column; justify-content: center; align-items: flex-end;">
            <div class="order-price ${isExcluded ? 'text-strikethrough text-muted-price' : ''}">${formatCurrency(order.estimatedPrice * order.qty)}</div>
            ${order.qty > 1 ? `<div class="order-qty" style="font-size: 0.7rem; color: var(--text-secondary);">${formatCurrency(order.estimatedPrice)} each</div>` : ''}
          </div>
        </div>`;
      }
      html += `</div>`;
    }

    container.innerHTML = html;
    const activeCount = myOrders.filter(o => !this._isExcluded(o)).length;
    countEl.textContent = `${activeCount} active / ${myOrders.length} total`;
  },

  // ---- Render Payment Summary ----
  async renderPayments() {
    const container = document.getElementById('payment-summary');

    try {
      const data = await API.getSettlement(this.selectedSessionId);

      if (!data.users || data.users.length === 0) {
        container.innerHTML = `
          <div class="empty-state">
            <div class="empty-icon">⏳</div>
            <p>No orders to settle</p>
          </div>`;
        // Hide tracking as well
        document.getElementById('payment-tracking-container').classList.add('hidden');
        document.getElementById('user-payment-action-box').classList.add('hidden');
        return;
      }

      const appsMap = {};
      for (const app of data.apps) appsMap[app.id] = app;

      let html = '';

      // Bill warnings
      if (data.billWarnings) {
        for (const appId in data.billWarnings) {
          const warning = data.billWarnings[appId];
          const app = appsMap[appId] || { name: appId, icon: '📦' };
          html += `<div class="bill-warning">⚠️ ${app.icon} ${escapeHtml(app.name)}: ${warning.message}</div>`;
        }
      }

      // Discount banners
      for (const appId in data.appDiscounts) {
        const d = data.appDiscounts[appId];
        const app = appsMap[appId] || { name: appId, icon: '📦' };
        const pct = Math.abs(d.discountPercent).toFixed(1);

        if (d.discountPercent > 0.5) {
          html += `<div class="discount-banner">${app.icon} ${escapeHtml(app.name)}: ${pct}% off — saved ${formatCurrency(d.discountAmount)} 🎉</div>`;
        } else if (d.discountPercent < -0.5) {
          html += `<div class="discount-banner surcharge">${app.icon} ${escapeHtml(app.name)}: ${pct}% surcharge — extra ${formatCurrency(Math.abs(d.discountAmount))}</div>`;
        } else if (d.discountPercent >= -0.5 && d.discountPercent <= 0.5) {
          html += `<div class="discount-banner">${app.icon} ${escapeHtml(app.name)}: No discount/surcharge</div>`;
        }
      }

      // Check if any bills have been entered
      const hasBills = Object.keys(data.appDiscounts).length > 0;

      if (!hasBills) {
        html += `<div class="empty-state">
          <div class="empty-icon">⏳</div>
          <p>Waiting for admin to enter bills</p>
          <p class="empty-sub">Once bills are entered, your payment will show here</p>
        </div>`;
        container.innerHTML = html;
        // Hide tracking since bill isn't set yet
        document.getElementById('payment-tracking-container').classList.add('hidden');
        document.getElementById('user-payment-action-box').classList.add('hidden');
        return;
      }

      // UPI Payment Block (if bills are entered and user owes money)
      const myUser = data.users.find(u => u.userId === Auth.getUserId());
      const myTotal = myUser ? myUser.total : 0;

      if (hasBills && myTotal > 0) {
        let upiHtml = '';
        if (data.upiId && data.upiId.trim()) {
          const sessionName = data.session?.name || 'GroupCart';
          
          // Calculate note details: DD/MM/YYYY - X items - Rs.Y
          const sessionDate = data.session?.createdAt ? new Date(data.session.createdAt) : new Date();
          const day = String(sessionDate.getDate()).padStart(2, '0');
          const month = String(sessionDate.getMonth() + 1).padStart(2, '0');
          const year = sessionDate.getFullYear();
          const dateStr = `${day}/${month}/${year}`;
          
          let totalItemsQty = 0;
          for (const appId in myUser.apps) {
            for (const item of myUser.apps[appId].items) {
              totalItemsQty += (item.qty || 1);
            }
          }
          const itemWord = totalItemsQty === 1 ? 'item' : 'items';
          const upiNote = `${dateStr} - ${totalItemsQty} ${itemWord} - Rs.${Math.round(myTotal)}`;

          const upiUrl = `upi://pay?pa=${encodeURIComponent(data.upiId)}&pn=GroupCart&am=${myTotal}&tn=${encodeURIComponent(upiNote)}&cu=INR`;
          const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(upiUrl)}`;
          const upiUrls = this.getUPIUrls(data.upiId, myTotal, upiNote);

          const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);

          upiHtml = `
            <div class="upi-pay-container">
              <div class="upi-pay-title">📱 Pay Your Share (${formatCurrency(myTotal)})</div>
              
              <div class="upi-apps-grid">
                <a href="${upiUrls.gpay}" class="upi-app-btn upi-gpay">
                  <span class="upi-app-logo">🔵</span> GPay
                </a>
                <a href="${upiUrls.phonepe}" class="upi-app-btn upi-phonepe">
                  <span class="upi-app-logo">🟣</span> PhonePe
                </a>
                <a href="${upiUrls.paytm}" class="upi-app-btn upi-paytm">
                  <span class="upi-app-logo">💠</span> Paytm
                </a>
                <a href="${upiUrls.bhim}" class="upi-app-btn upi-bhim">
                  <span class="upi-app-logo">⚡</span> BHIM
                </a>
                <a href="${upiUrls.slice}" class="upi-app-btn upi-slice">
                  <span class="upi-app-logo">🍕</span> Slice
                </a>
                <a href="${upiUrls.cred}" class="upi-app-btn upi-cred">
                  <span class="upi-app-logo">💳</span> CRED
                </a>
                <a href="${upiUrls.generic}" class="upi-app-btn upi-generic">
                  ⚡ Pay via Default UPI App
                </a>
              </div>

              ${isIOS ? `
                <div style="font-size: 0.72rem; color: var(--text-secondary); line-height: 1.3; text-align: left; padding: 0.25rem 0.5rem; background: rgba(0, 210, 255, 0.05); border-left: 2px solid var(--accent-secondary); border-radius: var(--radius-sm); width: 100%;">
                  ℹ️ <strong>iOS Note:</strong> If tapping an app button shows an "address is invalid" alert, it means the app is not installed. Scan the QR code or copy the UPI ID below to pay!
                </div>
              ` : ''}

              <div>
                <img src="${qrUrl}" alt="UPI QR Code" class="upi-qr-image" />
                <div style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 0.5rem;">Scan QR to Pay</div>
              </div>
              <div class="upi-id-box">
                <span>UPI ID: ${escapeHtml(data.upiId)}</span>
                <button class="upi-copy-btn" onclick="UserView.copyToClipboard('${escapeHtml(data.upiId)}', 'UPI ID copied!')">Copy</button>
              </div>
            </div>
          `;
        } else {
          upiHtml = `
            <div class="upi-pay-container" style="border-color: var(--warning); border-style: dashed;">
              <div style="font-size: 0.9rem; font-weight: 600; color: var(--warning);">⚠️ No UPI ID configured</div>
              <div style="font-size: 0.8rem; color: var(--text-secondary);">Ask the admin to save their UPI ID in settings to enable QR codes and app payments.</div>
            </div>
          `;
        }
        html = upiHtml + html;
      }

      // User cards
      const sortedUsers = data.users.sort((a, b) => b.total - a.total);
      for (const user of sortedUsers) {
        const isMe = user.userId === Auth.getUserId();
        html += `<div class="payment-card" ${isMe ? 'style="border-color: var(--accent-primary); border-width: 2px;"' : ''}>
          <div class="payment-card-header">
            <span class="payment-user-name">👤 ${escapeHtml(user.userName)} ${isMe ? '(You)' : ''}</span>
            <span class="payment-total">${formatCurrency(user.total)}</span>
          </div>`;

        for (const appId in user.apps) {
          const app = appsMap[appId] || { name: appId, icon: '📦' };
          const appData = user.apps[appId];
          html += `<div class="payment-line">
            <span class="payment-line-app">${app.icon} ${escapeHtml(app.name)}</span>
            <span class="payment-line-amount">${formatCurrency(appData.final)}</span>
          </div>`;
        }

        html += `<hr class="payment-divider">
          <div class="payment-line">
            <span style="font-weight:700">Total</span>
            <span class="payment-line-amount" style="font-weight:700">${formatCurrency(user.total)}</span>
          </div>
        </div>`;
      }

      // Excluded items section
      if (data.excludedOrders && data.excludedOrders.length > 0) {
        html += `<div class="excluded-section">
          <div class="excluded-section-header">
            <span>🚫 Excluded Items (${data.excludedOrders.length})</span>
            <span class="text-muted">Not included in totals</span>
          </div>`;

        for (const order of data.excludedOrders) {
          const statusCfg = this.STATUS_CONFIG[order.status] || {};
          const app = appsMap[order.appId] || { icon: '📦' };
          html += `<div class="excluded-item">
            <div class="excluded-item-info">
              <span>${app.icon} ${escapeHtml(order.productName)} ×${order.qty}</span>
              <span class="excluded-item-user">by ${escapeHtml(order.userName)}</span>
            </div>
            <div class="excluded-item-status">
              <span class="order-status-badge ${statusCfg.cssClass || ''}">${statusCfg.icon || ''} ${statusCfg.label || order.status}</span>
              <span class="text-strikethrough text-muted-price">${formatCurrency(order.estimatedPrice * order.qty)}</span>
            </div>
          </div>`;
        }
        html += `</div>`;
      }

      // Copy button
      html += `<button class="copy-summary-btn" onclick="UserView.copySummary()">📋 Copy Summary to Clipboard</button>`;

      container.innerHTML = html;
      this._lastSettlement = data;

      // Render payment tracking status panel
      await this.renderPaymentTracking(data);

    } catch (err) {
      container.innerHTML = `<div class="empty-state"><p>Error loading settlement</p></div>`;
    }
  },

  _lastSettlement: null,

  async copySummary() {
    if (!this._lastSettlement) {
      try { this._lastSettlement = await API.getSettlement(); } catch { return; }
    }
    const text = generatePaymentSummaryText(this._lastSettlement);
    try {
      await navigator.clipboard.writeText(text);
      showToast('✅ Summary copied!');
    } catch {
      showToast('❌ Could not copy');
    }
  },

  // ---- Payment Status Tracking (P4) ----
  async renderPaymentTracking(settlementData) {
    const listContainer = document.getElementById('payment-tracking-list');
    const containerBox = document.getElementById('payment-tracking-container');
    const actionBox = document.getElementById('user-payment-action-box');

    if (!settlementData || !settlementData.users || settlementData.users.length === 0) {
      containerBox.classList.add('hidden');
      actionBox.classList.add('hidden');
      return;
    }

    containerBox.classList.remove('hidden');

    try {
      const { payments } = await API.getPayments(this.selectedSessionId);
      
      let listHtml = '';
      const myUserId = Auth.getUserId();
      let myPaymentStatus = 'unpaid';

      for (const user of settlementData.users) {
        const payment = payments.find(p => p.userId === user.userId);
        let badgeClass = 'unpaid';
        let badgeLabel = 'Unpaid';

        if (payment) {
          if (payment.confirmedByAdmin) {
            badgeClass = 'confirmed';
            badgeLabel = 'Confirmed';
          } else {
            badgeClass = 'paid';
            badgeLabel = 'Paid';
          }
        }

        if (user.userId === myUserId) {
          myPaymentStatus = badgeClass;
        }

        listHtml += `
          <div class="payment-track-row">
            <span class="payment-track-user">👤 ${escapeHtml(user.userName)}</span>
            <div class="payment-track-right">
              <span class="payment-track-amount">${formatCurrency(user.total)}</span>
              <span class="status-badge ${badgeClass}">${badgeLabel}</span>
            </div>
          </div>
        `;
      }

      listContainer.innerHTML = listHtml;

      const isReadOnly = this.selectedSessionId !== this.activeSessionId;
      const myTotal = settlementData.users.find(u => u.userId === myUserId)?.total || 0;

      // Allow marking paid only if session isn't read-only, user owes money, and hasn't paid yet
      if (!isReadOnly && myTotal > 0 && myPaymentStatus === 'unpaid') {
        actionBox.classList.remove('hidden');
        this.mySettlementTotal = myTotal;
      } else {
        actionBox.classList.add('hidden');
      }

    } catch (e) {
      console.error('Error rendering payment tracking:', e);
    }
  },

  async handleMarkPaid() {
    const btn = document.getElementById('btn-mark-paid');
    btn.disabled = true;
    btn.textContent = 'Submitting...';

    try {
      await API.markPaid(Auth.getUserId(), Auth.getUserName(), this.mySettlementTotal);
      showToast('✅ Marked as paid! Waiting for admin confirmation.');
      await this.renderPayments();
    } catch (e) {
      showToast('❌ Failed to mark payment');
    } finally {
      btn.disabled = false;
      btn.textContent = 'I Have Paid';
    }
  },

  // ---- Favorites Handling (P5) ----
  async loadFavorites() {
    try {
      const { favorites } = await API.getFavorites(Auth.getUserId());
      this.favorites = favorites || [];
    } catch (e) {
      this.favorites = [];
    }
  },

  renderFavoritesList() {
    const section = document.getElementById('favorites-section');
    const list = document.getElementById('favorites-list');

    if (this.favorites.length === 0) {
      section.classList.add('hidden');
      return;
    }

    section.classList.remove('hidden');

    let html = '';
    for (const fav of this.favorites) {
      const app = this.apps.find(a => a.id === fav.appId) || { icon: '📦', name: fav.appId };
      html += `
        <div class="favorite-item-chip" onclick="UserView.addFromFavorite('${fav.id}')">
          <div style="display:flex; align-items:center; gap:0.4rem; overflow:hidden; flex: 1;">
            <span>${app.icon}</span>
            <span class="favorite-item-name">${escapeHtml(fav.productName)}</span>
          </div>
          <div class="favorite-item-right">
            <span class="favorite-item-price">${formatCurrency(fav.estimatedPrice)}</span>
            <button class="btn-fav-delete" onclick="event.stopPropagation(); UserView.deleteFavorite('${fav.id}')" title="Delete favorite">🗑️</button>
          </div>
        </div>
      `;
    }
    list.innerHTML = html;
  },

  async toggleFavoriteItem(orderId) {
    const order = this.orders.find(o => o.id === orderId);
    if (!order) return;

    const userId = Auth.getUserId();
    const existing = this.favorites.find(f => f.appId === order.appId && f.productName.toLowerCase() === order.productName.toLowerCase());

    try {
      if (existing) {
        await API.removeFavorite(existing.id);
        showToast('⭐ Removed from Favorites');
      } else {
        await API.addFavorite({
          userId,
          appId: order.appId,
          productName: order.productName,
          estimatedPrice: order.estimatedPrice,
          link: order.link
        });
        showToast('⭐ Added to Favorites');
      }
      await this.loadFavorites();
      this.renderMyOrders();
      this.renderFavoritesList();
    } catch (err) {
      showToast('❌ Failed to update favorite');
    }
  },

  toggleFavorites() {
    const container = document.getElementById('favorites-container');
    const chevron = document.getElementById('favorites-chevron');
    const toggleBtn = document.getElementById('btn-favorites-toggle');
    
    const isHidden = container.classList.contains('hidden');
    if (isHidden) {
      container.classList.remove('hidden');
      chevron.textContent = '▲';
      toggleBtn.classList.add('expanded');
      this.renderFavoritesList();
    } else {
      container.classList.add('hidden');
      chevron.textContent = '▼';
      toggleBtn.classList.remove('expanded');
    }
  },

  async deleteFavorite(id) {
    try {
      await API.removeFavorite(id);
      showToast('🗑️ Favorite deleted');
      await this.loadFavorites();
      this.renderFavoritesList();
      this.renderMyOrders();
    } catch (e) {
      showToast('❌ Failed to delete favorite');
    }
  },

  async addFromFavorite(id) {
    if (this.selectedSessionId !== this.activeSessionId) {
      showToast('📜 Past sessions are read-only');
      return;
    }
    const fav = this.favorites.find(f => f.id === id);
    if (!fav) return;

    try {
      const order = {
        userId: Auth.getUserId(),
        userName: Auth.getUserName(),
        appId: fav.appId,
        productName: fav.productName,
        link: fav.link,
        qty: 1,
        estimatedPrice: fav.estimatedPrice,
      };
      await API.addOrder(order);
      showToast('✅ Added from Favorites!');
      await this.refresh();
    } catch (e) {
      showToast('❌ Failed to add item');
    }
  },

  // ---- Delivery Target Progress Bars (P6) ----
  renderThresholdBars(session) {
    const container = document.getElementById('platform-thresholds-container');
    const list = document.getElementById('threshold-bars-list');

    if (!session || this.orders.length === 0) {
      container.classList.add('hidden');
      return;
    }

    const thresholds = session.freeDeliveryThresholds || {};
    const activeAppsWithThresholds = this.apps.filter(app => thresholds[app.id] > 0);

    if (activeAppsWithThresholds.length === 0) {
      container.classList.add('hidden');
      return;
    }

    const appTotals = {};
    const excludedStatuses = ['out-of-stock', 'returned', 'not-delivered'];
    for (const order of this.orders) {
      if (excludedStatuses.includes(order.status)) continue;
      if (!appTotals[order.appId]) appTotals[order.appId] = 0;
      appTotals[order.appId] += order.estimatedPrice * order.qty;
    }

    let html = '';
    let hasAnyBar = false;

    for (const app of activeAppsWithThresholds) {
      const total = appTotals[app.id] || 0;
      const target = thresholds[app.id];
      const pct = Math.min(100, (total / target) * 100);
      const isReached = total >= target;
      hasAnyBar = true;

      let statusMsg = '';
      if (isReached) {
        statusMsg = `<span style="color:#10b981; font-weight:700;">🎉 Free delivery unlocked!</span>`;
      } else {
        statusMsg = `<span>Need <strong>${formatCurrency(target - total)}</strong> more for free delivery</span>`;
      }

      html += `
        <div class="threshold-bar-item">
          <div class="threshold-bar-info">
            <span class="threshold-bar-platform">${app.icon} ${escapeHtml(app.name)}</span>
            <span>${formatCurrency(total)} / ${formatCurrency(target)}</span>
          </div>
          <div class="threshold-bar-progress-bg">
            <div class="threshold-bar-progress-fill ${isReached ? 'reached' : ''}" style="width: ${pct}%;"></div>
          </div>
          <div style="font-size:0.7rem; color:var(--text-secondary); margin-top:0.15rem; display:flex; justify-content:space-between;">
            ${statusMsg}
          </div>
        </div>
      `;
    }

    if (hasAnyBar) {
      list.innerHTML = html;
      container.classList.remove('hidden');
    } else {
      container.classList.add('hidden');
    }
  },

  // ---- Inline Quantity Stepper (P7) ----
  async updateQuantity(orderId, delta) {
    if (this.selectedSessionId !== this.activeSessionId) {
      showToast('📜 Past sessions are read-only');
      return;
    }
    const order = this.orders.find(o => o.id === orderId);
    if (!order) return;

    const newQty = Math.max(1, Math.min(99, order.qty + delta));
    if (newQty === order.qty) return;

    order.qty = newQty;
    const valEl = document.getElementById(`qty-val-${orderId}`);
    if (valEl) valEl.textContent = newQty;
    
    // Optimistic re-render of local calculations
    this.renderMyOrders();
    this.renderAllOrders();
    updateNavBadges();

    // Fire API update directly (de-bounce is simple since it only fires on click)
    try {
      await API.updateOrder(orderId, { qty: newQty });
    } catch (e) {
      showToast('❌ Failed to update quantity');
      await this.refresh();
    }
  },

  // ---- URL Import Assistant (P1) ----
  async handleUrlImport() {
    const urlInput = document.getElementById('item-import-url');
    const url = urlInput.value.trim();
    if (!url) return;

    const spinner = document.getElementById('preview-spinner');
    const content = document.getElementById('preview-content');
    const previewCard = document.getElementById('import-preview-card');
    const detailsText = document.getElementById('preview-details');

    previewCard.classList.remove('hidden');
    spinner.classList.remove('hidden');
    content.classList.add('hidden');

    try {
      const result = await API.scrapeUrl(url);
      spinner.classList.add('hidden');
      
      if (result.success) {
        if (result.productName) {
          document.getElementById('item-name').value = result.productName;
        }
        if (result.estimatedPrice) {
          document.getElementById('item-price').value = Math.round(result.estimatedPrice);
        }
        if (result.appId && this.apps.some(a => a.id === result.appId)) {
          this.selectedAppId = result.appId;
          this.renderAppPicker('app-picker', result.appId);
        }
        
        document.getElementById('item-link').value = url;

        detailsText.textContent = `${result.productName || 'Product'} — ${formatCurrency(result.estimatedPrice)}`;
        content.classList.remove('hidden');
        showToast('✨ Product details detected!');
      } else {
        throw new Error('Detection returned empty/invalid response');
      }
    } catch (err) {
      console.error('Failed to parse URL:', err);
      spinner.classList.add('hidden');
      previewCard.classList.add('hidden');
      showToast('⚠️ Could not auto-detect. Please fill details manually.', 3000);
    }
  },

  // ---- App Picker ----
  renderAppPicker(containerId, selected) {
    const container = document.getElementById(containerId);
    container.innerHTML = this.apps.map(app =>
      `<div class="app-chip ${selected === app.id ? 'selected' : ''}" 
            style="--chip-color: ${app.color}" 
            data-app-id="${app.id}" 
            onclick="UserView.selectApp('${containerId}', '${app.id}')">
        <span>${app.icon}</span>
        <span>${escapeHtml(app.name)}</span>
      </div>`
    ).join('');
  },

  selectApp(containerId, appId) {
    if (containerId === 'app-picker') {
      this.selectedAppId = appId;
    } else {
      this.editSelectedAppId = appId;
    }
    const container = document.getElementById(containerId);
    container.querySelectorAll('.app-chip').forEach(chip => {
      chip.classList.toggle('selected', chip.dataset.appId === appId);
    });
  },

  // ---- Add Item Modal ----
  openAddModal() {
    this.selectedAppId = this.apps.length > 0 ? this.apps[0].id : null;
    this.renderAppPicker('app-picker', this.selectedAppId);
    
    // Clear URL import details
    document.getElementById('item-import-url').value = '';
    document.getElementById('import-preview-card').classList.add('hidden');
    document.getElementById('preview-spinner').classList.add('hidden');

    document.getElementById('item-name').value = '';
    document.getElementById('item-link').value = '';
    document.getElementById('item-qty').value = '1';
    document.getElementById('item-price').value = '';
    document.getElementById('modal-add-item').classList.remove('hidden');
  },

  closeAddModal() {
    document.getElementById('modal-add-item').classList.add('hidden');
  },

  async submitAddItem(e) {
    e.preventDefault();

    if (!this.selectedAppId) {
      showToast('⚠️ Select a delivery app');
      return;
    }

    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = 'Adding...';

    const order = {
      userId: Auth.getUserId(),
      userName: Auth.getUserName(),
      appId: this.selectedAppId,
      productName: document.getElementById('item-name').value.trim(),
      link: document.getElementById('item-link').value.trim(),
      qty: parseInt(document.getElementById('item-qty').value) || 1,
      estimatedPrice: parseFloat(document.getElementById('item-price').value) || 0,
    };

    if (!order.productName) { showToast('⚠️ Enter product name'); btn.disabled = false; btn.textContent = 'Add to Cart'; return; }
    if (order.estimatedPrice <= 0) { showToast('⚠️ Enter estimated price'); btn.disabled = false; btn.textContent = 'Add to Cart'; return; }

    try {
      await API.addOrder(order);
      this.closeAddModal();
      showToast('✅ Item added!');
      await this.refresh();
    } catch (err) {
      showToast('❌ Failed to add item');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Add to Cart';
    }
  },

  // ---- Edit Item Modal ----
  openEditModal(orderId) {
    if (this.selectedSessionId !== this.activeSessionId) {
      showToast('📜 Past sessions are read-only');
      return;
    }
    const order = this.orders.find(o => o.id === orderId);
    if (!order || order.userId !== Auth.getUserId()) return;

    this.editSelectedAppId = order.appId;
    this.renderAppPicker('edit-app-picker', order.appId);
    document.getElementById('edit-item-id').value = order.id;
    document.getElementById('edit-item-name').value = order.productName;
    document.getElementById('edit-item-link').value = order.link || '';
    document.getElementById('edit-item-qty').value = order.qty;
    document.getElementById('edit-item-price').value = order.estimatedPrice;
    document.getElementById('modal-edit-item').classList.remove('hidden');
  },

  closeEditModal() {
    document.getElementById('modal-edit-item').classList.add('hidden');
  },

  async submitEditItem(e) {
    e.preventDefault();

    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = 'Saving...';

    const id = document.getElementById('edit-item-id').value;
    const updates = {
      appId: this.editSelectedAppId,
      productName: document.getElementById('edit-item-name').value.trim(),
      link: document.getElementById('edit-item-link').value.trim(),
      qty: parseInt(document.getElementById('edit-item-qty').value) || 1,
      estimatedPrice: parseFloat(document.getElementById('edit-item-price').value) || 0,
    };

    if (!updates.productName) { showToast('⚠️ Enter product name'); btn.disabled = false; btn.textContent = 'Save Changes'; return; }

    try {
      await API.updateOrder(id, updates);
      this.closeEditModal();
      showToast('✅ Item updated!');
      await this.refresh();
    } catch (err) {
      showToast('❌ Failed to update');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Save Changes';
    }
  },

  async deleteItem() {
    const id = document.getElementById('edit-item-id').value;
    if (!confirm('Delete this item?')) return;

    try {
      await API.deleteOrder(id);
      this.closeEditModal();
      showToast('🗑️ Item deleted');
      await this.refresh();
    } catch (err) {
      showToast('❌ Failed to delete');
    }
  },

  // ---- Copy Helper ----
  async copyToClipboard(text, successMsg) {
    try {
      await navigator.clipboard.writeText(text);
      showToast(successMsg || 'Copied to clipboard!');
    } catch (err) {
      showToast('❌ Copy failed');
    }
  },

  // ---- Refresh ----
  async refresh() {
    const [ , , sessionRes ] = await Promise.all([
      this.loadApps(),
      this.loadOrders(),
      API._fetch('/api/session').catch(() => ({ session: null }))
    ]);
    const activeSession = sessionRes?.session;
    this.currentSession = activeSession;
    
    this.renderAllOrders();
    this.renderMyOrders();
    this.renderThresholdBars(activeSession);
    await this.loadFavorites();
    this.renderFavoritesList();
    updateNavBadges();
  },
};
