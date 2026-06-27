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
    'pending': { label: 'Pending', icon: '🕐', cssClass: 'status-pending' },
    'confirmed': { label: 'Confirmed', icon: '✅', cssClass: 'status-confirmed' },
    'out-of-stock': { label: 'Out of Stock', icon: '🚫', cssClass: 'status-oos' },
    'returned': { label: 'Returned', icon: '↩️', cssClass: 'status-returned' },
    'not-delivered': { label: 'Not Delivered', icon: '❌', cssClass: 'status-not-delivered' },
  },

  init() {
    if (this._initialized) return;
    this._initialized = true;

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

    // Change Password Form
    const changePwdForm = document.getElementById('change-password-form');
    if (changePwdForm) {
      changePwdForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const curr = document.getElementById('ch-curr-password').value;
        const newPwd = document.getElementById('ch-new-password').value;
        const confirmPwd = document.getElementById('ch-confirm-password').value;

        if (newPwd !== confirmPwd) {
          showToast('❌ New passwords do not match');
          return;
        }

        const passwordRegex = /^(?=.*[a-zA-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{6,}$/;
        if (!passwordRegex.test(newPwd)) {
          showToast('❌ Password must be 6+ chars with letter, number, and special char');
          return;
        }

        try {
          await API.changePassword(curr, newPwd);
          showToast('✅ Password changed successfully!');
          changePwdForm.reset();
        } catch (err) {
          showToast(`❌ Change failed: ${err.message}`);
        }
      });
    }

    // Payer links save button
    const btnSavePayerLinks = document.getElementById('btn-save-payer-links');
    if (btnSavePayerLinks) {
      btnSavePayerLinks.addEventListener('click', async () => {
        const checkboxes = document.querySelectorAll('.payer-link-checkbox:checked');
        const targetUserIds = Array.from(checkboxes).map(cb => cb.value);
        try {
          // If none checked, unlink them all
          const allCheckboxes = document.querySelectorAll('.payer-link-checkbox');
          const allUserIds = Array.from(allCheckboxes).map(cb => cb.value);

          await API.linkPayer(null, allUserIds);
          if (targetUserIds.length > 0) {
            await API.linkPayer(Auth.getUserId(), targetUserIds);
          }
          showToast('✅ Payer grouping updated!');
          await this.refresh();
        } catch (err) {
          showToast('❌ Failed to save payer links');
        }
      });
    }

    // Complaint photo preview
    const complaintPhoto = document.getElementById('complaint-photo');
    if (complaintPhoto) {
      complaintPhoto.addEventListener('change', (e) => {
        const file = e.target.files[0];
        const previewContainer = document.getElementById('complaint-photo-preview');
        const previewImg = document.getElementById('complaint-img-preview');

        if (file) {
          const reader = new FileReader();
          reader.onload = (event) => {
            previewImg.src = event.target.result;
            previewContainer.classList.remove('hidden');
          };
          reader.readAsDataURL(file);
        } else {
          previewContainer.classList.add('hidden');
        }
      });
    }

    // Complaint form submission
    const complaintForm = document.getElementById('complaint-form');
    if (complaintForm) {
      complaintForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const orderId = document.getElementById('complaint-order-id').value;
        const productName = document.getElementById('complaint-product-name').value;
        const type = document.getElementById('complaint-type').value;
        const refundAmount = parseFloat(document.getElementById('complaint-refund-amount').value) || 0;
        const note = document.getElementById('complaint-note').value;
        const previewImg = document.getElementById('complaint-img-preview');

        const photoUrl = previewImg.src && previewImg.src.startsWith('data:') ? previewImg.src : '';

        try {
          await API.submitComplaint({ orderId, productName, type, refundAmount, note, photoUrl });
          showToast('✅ Complaint submitted! Admin will review.');
          document.getElementById('modal-complaint').classList.add('hidden');
          complaintForm.reset();
          document.getElementById('complaint-photo-preview').classList.add('hidden');
          await this.refresh();
        } catch (err) {
          showToast('❌ Failed to submit complaint');
        }
      });
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
    const pa = encodeURIComponent(upiId);
    const pn = encodeURIComponent('GroupCart');
    const am = encodeURIComponent(myTotal.toFixed(2));
    const tn = encodeURIComponent(upiNote || '');
    const cu = 'INR';
    const upiParams = `pa=${pa}&pn=${pn}&am=${am}&tn=${tn}&cu=${cu}`;
    const standardUpiLink = `upi://pay?${upiParams}`;

    const isAndroid = /Android/i.test(navigator.userAgent);

    if (isAndroid) {
      // Android Intent URLs target specific app packages
      const intentUrl = (pkg) => `intent://pay?${upiParams}#Intent;scheme=upi;package=${pkg};end`;
      return {
        gpay: intentUrl('com.google.android.apps.nbu.paisa.user'),
        phonepe: intentUrl('com.phonepe.app'),
        paytm: intentUrl('net.one97.paytm'),
        bhim: intentUrl('in.org.npci.upiapp'),
        slice: intentUrl('com.slicepay.app'),
        cred: intentUrl('com.dreamplug.androidapp'),
        generic: standardUpiLink
      };
    }

    // iOS and other platforms use app-specific URL schemes
    return {
      gpay: `tez://upi/pay?${upiParams}`,
      phonepe: `phonepe://pay?${upiParams}`,
      paytm: `paytmmp://pay?${upiParams}`,
      bhim: standardUpiLink,
      slice: standardUpiLink,
      cred: `credpay://upi/pay?${upiParams}`,
      generic: standardUpiLink
    };
  },

  // ---- Render All Orders ----
  renderAllOrders() {
    const container = document.getElementById('orders-list');
    const countEl = document.getElementById('total-items-count');

    // Trigger user onboarding walkthrough if not shown yet
    if (!localStorage.getItem('groupcart_tutorial_user_shown')) {
      localStorage.setItem('groupcart_tutorial_user_shown', 'true');
      setTimeout(() => {
        this.showUserOnboardingTutorial();
      }, 500);
    }

    const currentUserId = Auth.getUserId();
    const isAdmin = Auth.isAdmin();

    // Regular user only sees their own orders on the Home tab
    const displayOrders = isAdmin ? this.orders : this.orders.filter(o => o.userId === currentUserId);

    if (displayOrders.length === 0) {
      container.innerHTML = `
        <div class="empty-state" id="empty-orders">
          <div class="empty-icon">📋</div>
          <p>No items in your cart yet</p>
          <p class="empty-sub">Tap + to add items</p>
        </div>`;
      countEl.textContent = '0 items';
      return;
    }

    // Group by app
    const grouped = {};
    for (const order of displayOrders) {
      if (!grouped[order.appId]) grouped[order.appId] = [];
      grouped[order.appId].push(order);
    }

    let html = '';
    const isSessionClosed = ['locked', 'ordered', 'delivered', 'settled'].includes(this.currentSession?.status);

    for (const appId in grouped) {
      const app = this.apps.find(a => a.id === appId) || { name: appId, icon: '📦', color: '#888' };
      const appOrders = grouped[appId];
      const activeOrders = appOrders.filter(o => !this._isExcluded(o));
      const total = activeOrders.reduce((s, o) => s + (o.estimatedPrice * o.qty - (o.discount || 0)), 0);

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

      for (const order of sortedOrders) {
        const isOwn = order.userId === currentUserId;
        const isExcluded = this._isExcluded(order);
        const isFav = this.favorites.some(f => f.appId === order.appId && f.productName.toLowerCase() === order.productName.toLowerCase());
        const favBtn = isOwn ? `<button class="star-btn ${isFav ? 'starred' : ''}" onclick="event.stopPropagation(); UserView.toggleFavoriteItem('${order.id}')" title="${isFav ? 'Remove from favorites' : 'Add to favorites'}" style="background: none; border: none; color: #f59e0b; font-size: 1.15rem; cursor: pointer; padding: 0; margin-right: 0.25rem;">${isFav ? '★' : '☆'}</button>` : '';

        html += `<div class="order-card ${isOwn ? 'own-order' : 'other-order'} ${isExcluded ? 'order-excluded' : ''}" data-order-id="${order.id}" ${isOwn && !isExcluded && !isSessionClosed ? 'onclick="UserView.openEditModal(\'' + order.id + '\')"' : 'style="cursor: default;"'}>
          <div class="order-card-body">
            <div style="display: flex; align-items: center; gap: 0.25rem;">
              ${favBtn}
              <div class="order-product ${isExcluded ? 'text-strikethrough' : ''}">${escapeHtml(order.productName)}</div>
            </div>
            <div class="order-meta">
              <span class="order-user-tag">${escapeHtml(order.userName)}</span>
              <span>×${order.qty}</span>
              ${this._statusBadge(order)}
            </div>
            ${order.discount ? `<div style="font-size:0.75rem; color:#10b981;">🏷️ Discount: -${formatCurrency(order.discount)}</div>` : ''}
            ${order.status === 'out-of-stock' && order.statusNote ? `<div class="order-status-note">📝 ${escapeHtml(order.statusNote)}</div>` : ''}
            
            <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; margin-top: 0.25rem;">
              ${order.link ? `<a class="order-link" href="${escapeHtml(order.link)}" target="_blank" rel="noopener" onclick="event.stopPropagation()" style="margin: 0;">🔗 Open link</a>` : ''}
              
              <!-- Complaint Option (Only if session is in ordered/delivered/settled states, or order is confirmed) -->
              ${(isOwn && (isSessionClosed || order.status === 'confirmed')) ? `
                <button type="button" class="order-link" onclick="event.stopPropagation(); UserView.openComplaintModal('${order.id}', '${escapeHtml(order.productName)}')" style="background: none; border: none; padding: 0; color: var(--danger); cursor: pointer; font-size: 0.75rem;">⚠️ Report Issue</button>
              ` : ''}
            </div>
          </div>
          <div>
            <div class="order-price ${isExcluded ? 'text-strikethrough text-muted-price' : ''}">${formatCurrency((order.estimatedPrice * order.qty) - (order.discount || 0))}</div>
            ${order.qty > 1 ? `<div class="order-qty">${formatCurrency(order.estimatedPrice)} each</div>` : ''}
          </div>
        </div>`;
      }
      html += `</div>`;
    }

    container.innerHTML = html;
    const activeCount = displayOrders.filter(o => !this._isExcluded(o)).length;
    countEl.textContent = `${activeCount} active / ${displayOrders.length} total`;
  },

  showUserOnboardingTutorial() {
    const slides = [
      { icon: '🛒', title: 'Welcome to GroupCart!', text: 'Split delivery orders with friends and save on delivery fees!' },
      { icon: '🚚', title: 'Live Apps & Progress', text: 'See which delivery apps are live today and track progress toward free delivery.' },
      { icon: '✨', title: 'Instant Link Import', text: 'Simply copy a link from Swiggy, Zepto, or Blinkit and paste it. We\'ll auto-fill the product details!' },
      { icon: '🔒', title: 'Secure Profile', text: 'Keep your account secure. Update your password or quick-add from Favorites in the Profile tab.' }
    ];
    Tutorial.show(slides);
  },

  openComplaintModal(orderId, productName) {
    document.getElementById('complaint-order-id').value = orderId || '';
    document.getElementById('complaint-product-name').value = productName || '';
    document.getElementById('complaint-refund-amount').value = '';
    document.getElementById('complaint-note').value = '';
    document.getElementById('complaint-photo').value = '';
    document.getElementById('complaint-photo-preview').classList.add('hidden');
    document.getElementById('modal-complaint').classList.remove('hidden');
  },

  // ---- Render My Orders ----
  renderMyOrders() {
    const container = document.getElementById('my-orders-list');
    const countEl = document.getElementById('my-items-count');
    if (!container) return;
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
        document.getElementById('payment-tracking-container').classList.add('hidden');
        document.getElementById('user-payment-action-box').classList.add('hidden');
        document.getElementById('payer-linking-container').classList.add('hidden');
        return;
      }

      const { payments } = await API.getPayments(this.selectedSessionId);
      const myUserId = Auth.getUserId();
      const myPayment = payments.find(p => p.userId === myUserId);
      const isConfirmed = myPayment && myPayment.confirmedByAdmin;

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
        document.getElementById('payment-tracking-container').classList.add('hidden');
        document.getElementById('user-payment-action-box').classList.add('hidden');
        document.getElementById('payer-linking-container').classList.add('hidden');
        return;
      }

      // UPI Payment Block (if bills are entered, user owes money, and payment NOT confirmed)
      const myUser = data.users.find(u => u.userId === myUserId);
      const myTotal = myUser ? myUser.total : 0;

      if (hasBills && myTotal > 0 && !isConfirmed) {
        let upiHtml = '';
        if (data.upiId && data.upiId.trim()) {
          const sessionDate = data.session?.createdAt ? new Date(data.session.createdAt) : new Date();
          const day = String(sessionDate.getDate()).padStart(2, '0');
          const month = String(sessionDate.getMonth() + 1).padStart(2, '0');
          const year = sessionDate.getFullYear();
          const dateStr = `${day}/${month}/${year}`;

          let totalItemsQty = 0;
          if (myUser.apps) {
            for (const appId in myUser.apps) {
              for (const item of myUser.apps[appId].items) {
                totalItemsQty += (item.qty || 1);
              }
            }
          }
          const itemWord = totalItemsQty === 1 ? 'item' : 'items';
          const upiNote = `${dateStr} - ${totalItemsQty} ${itemWord} - Rs.${Math.round(myTotal)}`;

          const upiUrl = `upi://pay?pa=${encodeURIComponent(data.upiId)}&pn=GroupCart&am=${myTotal.toFixed(2)}&tn=${encodeURIComponent(upiNote)}&cu=INR`;
          const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(upiUrl)}`;
          const upiUrls = this.getUPIUrls(data.upiId, myTotal, upiNote);
          const isMobile = /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
          const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);

          const upiClickHandler = (appUrl) => {
            if (isMobile) {
              return `onclick="window.location.href='${appUrl}'"`;
            }
            return `onclick="event.preventDefault(); copyToClipboard('${escapeHtml(data.upiId)}').then(() => showToast('📋 UPI ID copied! Open your UPI app to pay.'))"`;
          };

          upiHtml = `
            <div class="upi-pay-container">
              <div class="upi-pay-title">📱 Pay Your Share (${formatCurrency(myTotal)})</div>
              
              <div class="upi-apps-grid">
                <a href="${upiUrls.gpay}" ${upiClickHandler(upiUrls.gpay)} class="upi-app-btn upi-gpay">
                  <span class="upi-app-logo">🔵</span> GPay
                </a>
                <a href="${upiUrls.phonepe}" ${upiClickHandler(upiUrls.phonepe)} class="upi-app-btn upi-phonepe">
                  <span class="upi-app-logo">🟣</span> PhonePe
                </a>
                <a href="${upiUrls.paytm}" ${upiClickHandler(upiUrls.paytm)} class="upi-app-btn upi-paytm">
                  <span class="upi-app-logo">💠</span> Paytm
                </a>
                <a href="${upiUrls.bhim}" ${upiClickHandler(upiUrls.bhim)} class="upi-app-btn upi-bhim">
                  <span class="upi-app-logo">⚡</span> BHIM
                </a>
                <a href="${upiUrls.slice}" ${upiClickHandler(upiUrls.slice)} class="upi-app-btn upi-slice">
                  <span class="upi-app-logo">🍕</span> Slice
                </a>
                <a href="${upiUrls.cred}" ${upiClickHandler(upiUrls.cred)} class="upi-app-btn upi-cred">
                  <span class="upi-app-logo">💳</span> CRED
                </a>
                <a href="${upiUrls.generic}" ${upiClickHandler(upiUrls.generic)} class="upi-app-btn upi-generic">
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
                <button class="upi-copy-btn" onclick="copyToClipboard('${escapeHtml(data.upiId)}').then(() => showToast('✅ UPI ID copied!'))">Copy</button>
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

      // Render Payer Linking / Split Checkboxes (Pay for Friends)
      const payerLinkingContainer = document.getElementById('payer-linking-container');
      const checkboxesContainer = document.getElementById('payer-linking-checkboxes');
      const isReadOnly = this.selectedSessionId !== this.activeSessionId;

      if (payerLinkingContainer && checkboxesContainer) {
        if (!isReadOnly && data.session?.status !== 'settled') {
          const otherUsers = data.users.filter(u => u.userId !== myUserId);
          if (otherUsers.length > 0) {
            payerLinkingContainer.classList.remove('hidden');
            const payerMap = data.session.payerMap ? (data.session.payerMap instanceof Map ? Object.fromEntries(data.session.payerMap) : data.session.payerMap) : {};

            checkboxesContainer.innerHTML = otherUsers.map(u => {
              const isLinkedToMe = payerMap[u.userId] === myUserId;
              return `
                <label class="checkbox-label" style="margin-right: 0.5rem;">
                  <input type="checkbox" class="payer-link-checkbox" value="${u.userId}" ${isLinkedToMe ? 'checked' : ''} />
                  <span class="checkmark"></span>
                  ${escapeHtml(u.userName)} (${formatCurrency(u.total)})
                </label>
              `;
            }).join('');
          } else {
            payerLinkingContainer.classList.add('hidden');
          }
        } else {
          payerLinkingContainer.classList.add('hidden');
        }
      }

      // User cards
      const sortedUsers = data.users.sort((a, b) => b.total - a.total);
      for (const user of sortedUsers) {
        const isMe = user.userId === myUserId;
        const isAdmin = Auth.isAdmin();

        // Non-admins only see their own payment card
        if (!isAdmin && !isMe) {
          continue;
        }

        html += `<div class="payment-card" ${isMe ? 'style="border-color: var(--accent-primary); border-width: 2px;"' : ''}>
          <div class="payment-card-header">
            <span class="payment-user-name">👤 ${escapeHtml(user.userName)} ${isMe ? '(You)' : ''}</span>
            <span class="payment-total">${formatCurrency(user.total)}</span>
          </div>`;

        if (user.apps) {
          for (const appId in user.apps) {
            const app = appsMap[appId] || { name: appId, icon: '📦' };
            const appData = user.apps[appId];
            html += `<div class="payment-line">
              <span class="payment-line-app">${app.icon} ${escapeHtml(app.name)}</span>
              <span class="payment-line-amount">${formatCurrency(appData.final)}</span>
            </div>`;
          }
        }

        // Display payer info if paid by someone else
        if (user.paidBy) {
          html += `<div style="font-size:0.78rem; color:var(--accent-secondary); margin-top:0.25rem;">🔗 Bill grouped under: <strong>${escapeHtml(user.paidByName || 'Friend')}</strong></div>`;
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
      await this.renderPaymentTracking(data, payments);

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
      await copyToClipboard(text);
      showToast('✅ Summary copied!');
    } catch {
      showToast('❌ Could not copy');
    }
  },

  // ---- Payment Status Tracking (P4) ----
  async renderPaymentTracking(settlementData, paymentsList) {
    const listContainer = document.getElementById('payment-tracking-list');
    const containerBox = document.getElementById('payment-tracking-container');
    const actionBox = document.getElementById('user-payment-action-box');
    const amountInput = document.getElementById('pay-custom-amount');

    if (!settlementData || !settlementData.users || settlementData.users.length === 0) {
      containerBox.classList.add('hidden');
      actionBox.classList.add('hidden');
      return;
    }

    containerBox.classList.remove('hidden');

    try {
      const payments = paymentsList || (await API.getPayments(this.selectedSessionId)).payments;

      let listHtml = '';
      const myUserId = Auth.getUserId();
      let myPaymentStatus = 'unpaid';

      for (const user of settlementData.users) {
        const userPayments = payments.filter(p => p.userId === user.userId);
        const totalPaid = userPayments.filter(p => p.confirmedByAdmin).reduce((sum, p) => sum + p.amount, 0);
        const totalPending = userPayments.filter(p => !p.confirmedByAdmin).reduce((sum, p) => sum + p.amount, 0);

        let badgeClass = 'unpaid';
        let badgeLabel = 'Unpaid';

        if (totalPaid >= user.total && user.total > 0) {
          badgeClass = 'confirmed';
          badgeLabel = 'Confirmed';
        } else if (totalPaid + totalPending >= user.total && user.total > 0) {
          badgeClass = 'paid';
          badgeLabel = 'Paid';
        } else if (totalPaid + totalPending > 0) {
          badgeClass = 'paid';
          badgeLabel = `Partial (₹${(totalPaid + totalPending).toFixed(0)})`;
        }

        if (user.userId === myUserId) {
          myPaymentStatus = badgeClass;
        }

        // Regular users should not see others' absolute payment values
        const isMe = user.userId === myUserId;
        const amountDisplay = (Auth.isAdmin() || isMe) ? formatCurrency(user.total) : '—';

        listHtml += `
          <div class="payment-track-row">
            <span class="payment-track-user">👤 ${escapeHtml(user.userName)}</span>
            <div class="payment-track-right">
              <span class="payment-track-amount">${amountDisplay}</span>
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
        if (amountInput) {
          amountInput.value = myTotal.toFixed(2);
          amountInput.placeholder = `Owes ${myTotal.toFixed(2)}`;
        }
      } else {
        actionBox.classList.add('hidden');
      }

    } catch (e) {
      console.error('Error rendering payment tracking:', e);
    }
  },

  async handleMarkPaid() {
    const btn = document.getElementById('btn-mark-paid');
    const amountInput = document.getElementById('pay-custom-amount');
    const customAmount = parseFloat(amountInput ? amountInput.value : 0) || 0;

    if (customAmount <= 0) {
      showToast('❌ Please enter a valid payment amount');
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Submitting...';

    try {
      await API.markPaid(Auth.getUserId(), Auth.getUserName(), customAmount);
      showToast(`✅ Marked ₹${customAmount.toFixed(2)} as paid! Waiting for admin confirmation.`);
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

    // Filter favorites by the active session's allowed apps
    const allowedAppIds = this.currentSession?.allowedAppIds || [];
    const filteredFavorites = allowedAppIds.length > 0
      ? this.favorites.filter(f => allowedAppIds.includes(f.appId))
      : this.favorites;

    if (filteredFavorites.length === 0) {
      section.classList.add('hidden');
      return;
    }

    section.classList.remove('hidden');

    let html = '';
    for (const fav of filteredFavorites) {
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
      showToast('❌ ' + (e.message || 'Failed to add item'));
    }
  },

  // ---- Delivery Target Progress Bars (P6) ----
  renderThresholdBars(session) {
    const container = document.getElementById('platform-thresholds-container');
    const list = document.getElementById('threshold-bars-list');

    if (!session) {
      container.classList.add('hidden');
      return;
    }

    const thresholds = session.freeDeliveryThresholds || {};
    const allowedAppIds = session.allowedAppIds || [];
    const activeAppsWithThresholds = this.apps.filter(app => {
      if (allowedAppIds.length > 0 && !allowedAppIds.includes(app.id)) return false;
      return thresholds[app.id] > 0;
    });

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
    if (this.isImporting) return;

    const urlInput = document.getElementById('item-import-url');
    const url = urlInput.value.trim();
    if (!url) return;

    this.isImporting = true;
    const btnDetect = document.getElementById('btn-detect-url');
    if (btnDetect) btnDetect.disabled = true;

    const spinner = document.getElementById('preview-spinner');
    const previewCard = document.getElementById('import-preview-card');

    previewCard.classList.remove('hidden');
    spinner.classList.remove('hidden');

    try {
      const result = await API.scrapeUrl(url);
      
      // Always pre-fill the link field
      document.getElementById('item-link').value = url;

      if (result.success && result.productName) {
        // Prepare order structure for background auto-add
        const order = {
          userId: Auth.getUserId(),
          userName: Auth.getUserName(),
          appId: result.appId || this.selectedAppId,
          productName: result.productName.trim(),
          link: url,
          qty: 1,
          estimatedPrice: parseFloat(result.estimatedPrice) || 0
        };

        try {
          await API.addOrder(order);
          spinner.classList.add('hidden');
          previewCard.classList.add('hidden');
          this.closeAddModal();
          showToast(`✨ Auto-added: ${order.productName} (${formatCurrency(order.estimatedPrice)})`);
          await this.refresh();
        } catch (addErr) {
          // If addition failed, show the specific server error message
          showToast('❌ ' + (addErr.message || 'Failed to add item'));
          
          // Populate the manual form inputs so user doesn't lose the data
          document.getElementById('item-name').value = order.productName;
          document.getElementById('item-price').value = order.estimatedPrice || '';
          if (order.appId && this.apps.some(a => a.id === order.appId)) {
            this.selectedAppId = order.appId;
            this.renderAppPicker('app-picker', order.appId);
          }
          
          spinner.classList.add('hidden');
          previewCard.classList.add('hidden');
          document.getElementById('modal-add-item').classList.remove('hidden');
        }
      } else {
        throw new Error('Detection returned empty/invalid response');
      }
    } catch (err) {
      console.error('Failed to parse URL:', err);
      spinner.classList.add('hidden');
      previewCard.classList.add('hidden');

      // Put the link into product link on failure
      document.getElementById('item-link').value = url;

      showToast('❌ ' + (err.message || 'Could not auto-detect. Link filled, please enter name and price manually.'));

      // Keep manual form visible on error
      document.getElementById('modal-add-item').classList.remove('hidden');
    } finally {
      this.isImporting = false;
      if (btnDetect) btnDetect.disabled = false;
    }
  },

  // ---- App Picker ----
  renderAppPicker(containerId, selected) {
    const container = document.getElementById(containerId);
    const allowedAppIds = this.currentSession?.allowedAppIds || [];
    const displayApps = allowedAppIds.length > 0 ? this.apps.filter(app => allowedAppIds.includes(app.id)) : this.apps;
    container.innerHTML = displayApps.map(app =>
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
    const allowedAppIds = this.currentSession?.allowedAppIds || [];
    const displayApps = allowedAppIds.length > 0 ? this.apps.filter(app => allowedAppIds.includes(app.id)) : this.apps;
    this.selectedAppId = displayApps.length > 0 ? displayApps[0].id : null;
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
      showToast('❌ ' + (err.message || 'Failed to add item'));
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
    const result = await SwalCustom.fire({
      title: 'Delete Item?',
      text: 'Are you sure you want to delete this item?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Delete',
      cancelButtonText: 'Cancel'
    });
    if (!result.isConfirmed) return;

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
      await copyToClipboard(text);
      showToast(successMsg || 'Copied to clipboard!');
    } catch (err) {
      showToast('❌ Copy failed');
    }
  },

  async renderPurchaseHistory() {
    const listEl = document.getElementById('profile-order-history-list');
    if (!listEl) return;

    try {
      const { sessions } = await API.getSessions();
      const pastSessions = sessions.filter(s => !s.active);

      if (pastSessions.length === 0) {
        listEl.innerHTML = `<p class="text-muted" style="font-size: 0.85rem;">No past order history found.</p>`;
        return;
      }

      let html = '';
      const myUserId = Auth.getUserId();

      for (const sess of pastSessions) {
        const { orders } = await API.getOrders(undefined, sess.id);
        const myOrders = orders.filter(o => o.userId === myUserId);

        if (myOrders.length > 0) {
          const sessDate = sess.settledAt ? new Date(sess.settledAt) : new Date(sess.createdAt);
          const dateStr = sessDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
          const total = myOrders.reduce((sum, o) => sum + (o.estimatedPrice * o.qty - (o.discount || 0)), 0);
          const sessId = sess.id.replace(/[^a-zA-Z0-9]/g, '');

          let itemsHtml = '';
          for (const o of myOrders) {
            const app = this.apps.find(a => a.id === o.appId) || { icon: '📦', name: o.appId };
            const isFav = this.favorites.some(f => f.appId === o.appId && f.productName.toLowerCase() === o.productName.toLowerCase());
            itemsHtml += `
              <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.35rem 0; border-bottom: 1px solid rgba(255,255,255,0.04);">
                <div style="display: flex; align-items: center; gap: 0.4rem; overflow: hidden; flex: 1; min-width: 0;">
                  <span style="font-size: 0.8rem;">${app.icon}</span>
                  <span style="font-size: 0.8rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(o.productName)}</span>
                  <span style="font-size: 0.7rem; color: var(--text-secondary);">x${o.qty}</span>
                </div>
                <div style="display: flex; align-items: center; gap: 0.4rem; flex-shrink: 0;">
                  <span style="font-size: 0.8rem; color: var(--accent-secondary);">${formatCurrency(o.estimatedPrice * o.qty)}</span>
                  <button onclick="UserView.toggleFavFromHistory('${escapeHtml(o.appId)}', '${escapeHtml(o.productName.replace(/'/g, "\\'"))}', ${o.estimatedPrice}, '${escapeHtml((o.link || '').replace(/'/g, "\\'"))}')" 
                    style="background: none; border: none; cursor: pointer; font-size: 0.9rem; padding: 0.1rem;" title="${isFav ? 'Remove from Favorites' : 'Add to Favorites'}">${isFav ? '⭐' : '☆'}</button>
                </div>
              </div>
            `;
          }

          html += `
            <div style="background: rgba(255, 255, 255, 0.02); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 0.75rem; margin-bottom: 0.5rem; text-align: left;">
              <div style="display: flex; justify-content: space-between; align-items: center; cursor: pointer;" onclick="document.getElementById('hist-${sessId}').classList.toggle('hidden'); this.querySelector('.hist-chevron').textContent = document.getElementById('hist-${sessId}').classList.contains('hidden') ? '▶' : '▼';">
                <div style="display: flex; align-items: center; gap: 0.5rem;">
                  <span class="hist-chevron" style="font-size: 0.7rem; color: var(--text-secondary);">▶</span>
                  <strong style="font-size: 0.85rem; color: var(--accent-primary);">${escapeHtml(sess.name || 'Past Session')}</strong>
                </div>
                <div style="display: flex; align-items: center; gap: 0.5rem;">
                  <span style="font-size: 0.75rem; color: var(--text-secondary);">${dateStr}</span>
                  <strong style="font-size: 0.8rem; color: var(--accent-secondary);">${formatCurrency(total)}</strong>
                </div>
              </div>
              <div id="hist-${sessId}" class="hidden" style="margin-top: 0.5rem; padding-top: 0.4rem; border-top: 1px dashed var(--border);">
                ${itemsHtml}
              </div>
            </div>
          `;
        }
      }

      listEl.innerHTML = html || `<p class="text-muted" style="font-size: 0.85rem;">No past order history found.</p>`;
    } catch (err) {
      console.error(err);
      listEl.innerHTML = `<p class="text-danger" style="font-size: 0.85rem;">Error loading purchase history.</p>`;
    }
  },

  async toggleFavFromHistory(appId, productName, estimatedPrice, link) {
    const userId = Auth.getUserId();
    const existing = this.favorites.find(f => f.appId === appId && f.productName.toLowerCase() === productName.toLowerCase());

    try {
      if (existing) {
        await API.removeFavorite(existing.id);
        showToast('⭐ Removed from Favorites');
      } else {
        await API.addFavorite({ userId, appId, productName, estimatedPrice, link });
        showToast('⭐ Added to Favorites');
      }
      await this.loadFavorites();
      this.renderFavoritesList();
      await this.renderPurchaseHistory();
    } catch (err) {
      showToast('❌ Failed to update favorite');
    }
  },

  // ---- Refresh ----
  async refresh() {
    const [, , sessionRes] = await Promise.all([
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
    await this.renderPurchaseHistory();
    updateNavBadges();
  },
};
