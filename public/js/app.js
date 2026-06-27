// ===== Main App Controller =====

(function () {
  const loginScreen = document.getElementById('screen-login');
  const appShell = document.getElementById('app-shell');
  let sessionsList = [];
  let deferredPrompt = null;

  // ---- Web Share Target Parser (PWA) ----
  function parseSharedText(text, url) {
    text = text || '';
    url = url || '';
    
    let name = '';
    let price = '';
    let detectedApp = '';
    
    // Extract URL if embedded in text
    if (!url) {
      const urlMatch = text.match(/https?:\/\/[^\s]+/i);
      if (urlMatch) {
        url = urlMatch[0];
      }
    }

    url = url.trim();

    // Detect delivery platform
    if (url.includes('zomato.com')) {
      detectedApp = 'zomato';
    } else if (url.includes('swiggy.com')) {
      detectedApp = 'swiggy';
    } else if (url.includes('blinkit.com')) {
      detectedApp = 'blinkit';
    } else if (url.includes('zepto')) {
      detectedApp = 'zepto';
    }

    // Attempt to extract Price (e.g. ₹240, Rs. 150, Rs150)
    const priceMatch = text.match(/(?:₹|Rs\.?|INR)\s*(\d+(?:\.\d{2})?)/i) || text.match(/\b(\d+)\s*(?:rupees|rs)\b/i);
    if (priceMatch) {
      price = parseFloat(priceMatch[1]);
    }

    // Clean up text to extract product name
    let cleanText = text
      .replace(/https?:\/\/[^\s]+/gi, '') // remove URL
      .replace(/check out/gi, '')
      .replace(/i found this/gi, '')
      .replace(/on zomato/gi, '')
      .replace(/on swiggy/gi, '')
      .replace(/on blinkit/gi, '')
      .replace(/on zepto/gi, '')
      .replace(/from [^!\n]+/gi, '') // remove restaurant name
      .replace(/\([^)]+\)/g, '') // remove parens (price info)
      .replace(/[!.,\n]/g, '') // remove punctuation
      .trim();

    if (cleanText) {
      name = cleanText;
    } else {
      name = 'Shared Item';
    }

    return { name, price, url, appId: detectedApp };
  }

  function processShare(data) {
    if (!data) return;
    
    const parsed = parseSharedText(data.text || data.title, data.url);
    
    // Open modal and pre-fill fields
    UserView.openAddModal();
    
    if (parsed.name) document.getElementById('item-name').value = parsed.name;
    if (parsed.url) document.getElementById('item-link').value = parsed.url;
    if (parsed.price) document.getElementById('item-price').value = parsed.price;
    
    // Autoselect the detected platform if valid
    if (parsed.appId && UserView.apps.some(a => a.id === parsed.appId)) {
      UserView.selectedAppId = parsed.appId;
      UserView.renderAppPicker('app-picker', parsed.appId);
    }
  }

  function handleShareTarget() {
    const params = new URLSearchParams(window.location.search);
    const title = params.get('title');
    const text = params.get('text');
    const url = params.get('url');

    if (title || text || url) {
      window.history.replaceState({}, document.title, window.location.pathname);

      if (!Auth.currentUser) {
        sessionStorage.setItem('pending_share', JSON.stringify({ title, text, url }));
      } else {
        processShare({ title, text, url });
      }
    }
  }

  // ---- Boot ----
  async function boot() {
    // PWA Install listeners
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredPrompt = e;
      const dismissed = localStorage.getItem('pwa-dismissed') === 'true';
      if (!dismissed) {
        document.getElementById('pwa-install-banner').classList.remove('hidden');
      }
    });

    document.getElementById('pwa-btn-dismiss').addEventListener('click', () => {
      document.getElementById('pwa-install-banner').classList.add('hidden');
      localStorage.setItem('pwa-dismissed', 'true');
    });

    document.getElementById('pwa-btn-install').addEventListener('click', async () => {
      document.getElementById('pwa-install-banner').classList.add('hidden');
      if (deferredPrompt) {
        deferredPrompt.prompt();
        await deferredPrompt.userChoice;
        deferredPrompt = null;
      }
    });

    // Share target
    handleShareTarget();
    if (Auth.init()) {
      showApp();
    } else {
      showLogin();
    }
  }

  function showLogin() {
    loginScreen.classList.add('active');
    appShell.classList.add('hidden');
    const banner = document.getElementById('session-history-banner');
    if (banner) banner.remove();
  }

  async function loadSessions() {
    try {
      const { sessions } = await API.getSessions();
      sessionsList = sessions;
      const select = document.getElementById('session-select');
      
      const wasViewingActive = !UserView.selectedSessionId || UserView.selectedSessionId === UserView.activeSessionId;

      // Save active session ID
      const active = sessions.find(s => s.active);
      UserView.activeSessionId = active ? active.id : null;
      
      if (wasViewingActive) {
        UserView.selectedSessionId = UserView.activeSessionId;
      } else if (!sessions.some(s => s.id === UserView.selectedSessionId)) {
        UserView.selectedSessionId = UserView.activeSessionId;
      }

      select.innerHTML = sessions.map(s => {
        let label = s.name || `Session ${new Date(s.createdAt).toLocaleDateString('en-IN')}`;
        if (s.active) label = `🟢 ${label} (Active)`;
        else label = `🔴 ${label} (Settled)`;
        return `<option value="${s.id}" ${s.id === UserView.selectedSessionId ? 'selected' : ''}>${label}</option>`;
      }).join('');
      
      updateSessionStatusUI();
    } catch (err) {
      console.error('Failed to load sessions:', err);
    }
  }

  function renderStatusPipeline(status) {
    const statusFlow = ['adding', 'locked', 'ordered', 'delivered', 'settled'];
    const currentIndex = statusFlow.indexOf(status || 'adding');
    
    const steps = document.querySelectorAll('.status-step');
    const lines = document.querySelectorAll('.status-line');

    steps.forEach((step, idx) => {
      step.classList.remove('active', 'completed');
      if (idx === currentIndex) {
        step.classList.add('active');
      } else if (idx < currentIndex) {
        step.classList.add('completed');
      }
    });

    lines.forEach((line, idx) => {
      line.classList.remove('completed');
      if (idx < currentIndex) {
        line.classList.add('completed');
      }
    });
  }

  function updateSessionStatusUI() {
    const isReadOnly = UserView.selectedSessionId !== UserView.activeSessionId;
    
    // Hide/show FAB
    document.getElementById('fab-add').classList.toggle('hidden', isReadOnly);
    
    // Show/hide a history read-only banner in the content area
    let banner = document.getElementById('session-history-banner');
    if (isReadOnly) {
      if (!banner) {
        banner = document.createElement('div');
        banner.id = 'session-history-banner';
        banner.className = 'history-banner';
        banner.textContent = '📜 You are viewing a settled (read-only) session';
        const main = document.querySelector('.main-content');
        main.insertBefore(banner, main.firstChild);
      }
    } else if (banner) {
      banner.remove();
    }

    // Update status pipeline indicators
    const selectedSession = sessionsList.find(s => s.id === UserView.selectedSessionId);
    const status = selectedSession ? selectedSession.status : 'adding';
    renderStatusPipeline(status);
  }

  async function showApp() {
    loginScreen.classList.remove('active');
    appShell.classList.remove('hidden');

    // Update greeting
    document.getElementById('greeting-text').textContent = `Hi, ${Auth.getUserName()}`;

    // Show/hide admin elements
    const isAdmin = Auth.isAdmin();
    document.getElementById('admin-badge').classList.toggle('hidden', !isAdmin);
    document.querySelectorAll('.admin-only').forEach(el => el.classList.toggle('hidden', !isAdmin));

    // Load sessions first
    await loadSessions();

    // Load settings for Admin (UPI config)
    if (isAdmin) {
      try {
        const { settings } = await API.getSettings();
        document.getElementById('admin-upi-id').value = settings.upiId || '';
      } catch (err) { /* ignore */ }
    }

    // Initialize View Triggers
    UserView.init();
    if (isAdmin) {
      AdminView.init();
    }

    // Load data
    await UserView.refresh();

    if (isAdmin) {
      AdminView.renderAll();
    }

    // Connect SSE
    connectSSE();
    setupSSEHandlers();

    // Process any pending shares
    const pendingShare = sessionStorage.getItem('pending_share');
    if (pendingShare) {
      sessionStorage.removeItem('pending_share');
      processShare(JSON.parse(pendingShare));
    }
  }

  // Toggle Signup / Login mode
  const toggleSignupLink = document.getElementById('toggle-signup-link');
  const loginModeInput = document.getElementById('login-mode');
  const loginFormTitle = document.getElementById('login-form-title');
  const loginConfirmGroup = document.getElementById('login-confirm-group');
  const loginBtnSubmit = document.getElementById('login-btn-submit');
  
  if (toggleSignupLink) {
    toggleSignupLink.addEventListener('click', function (e) {
      e.preventDefault();
      const isLogin = loginModeInput.value === 'login';
      if (isLogin) {
        loginModeInput.value = 'signup';
        loginFormTitle.textContent = 'Create Account';
        loginConfirmGroup.classList.remove('hidden');
        loginBtnSubmit.textContent = 'Sign Up →';
        toggleSignupLink.textContent = 'Already have an account? Log In';
      } else {
        loginModeInput.value = 'login';
        loginFormTitle.textContent = 'Welcome Back';
        loginConfirmGroup.classList.add('hidden');
        loginBtnSubmit.textContent = 'Log In →';
        toggleSignupLink.textContent = "Don't have an account? Sign Up";
      }
    });
  }

  document.getElementById('login-form').addEventListener('submit', async function (e) {
    e.preventDefault();
    const errorEl = document.getElementById('login-error');
    errorEl.classList.add('hidden');

    const name = document.getElementById('login-name').value.trim();
    const password = document.getElementById('login-password').value;
    const confirmPassword = document.getElementById('login-confirm-password').value;
    const mode = loginModeInput.value;

    if (!name) return;

    const btn = this.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = mode === 'signup' ? 'Signing up...' : 'Logging in...';

    // Password strength check helper
    const passwordRegex = /^(?=.*[a-zA-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{6,}$/;

    try {
      if (mode === 'signup') {
        if (!password) {
          throw new Error('Password is required');
        }
        if (password !== confirmPassword) {
          throw new Error('Passwords do not match');
        }
        if (!passwordRegex.test(password)) {
          throw new Error('Password must be 6+ characters and contain a letter, a number, and a special character');
        }
        
        // Execute registration call
        await Auth.login(name, password, false, '', '', true);
      } else {
        // Log in
        const res = await Auth.login(name, password);
        
        if (res && res.legacySetupRequired) {
          document.getElementById('legacy-name').value = name;
          document.getElementById('modal-legacy-password').classList.remove('hidden');
          btn.disabled = false;
          btn.textContent = "Log In →";
          return;
        }

        if (res && res.registerRequired) {
          throw new Error('Account not found. Select "Sign Up" below to register.');
        }
      }
      showApp();
    } catch (err) {
      errorEl.textContent = err.message || 'Login failed';
      errorEl.classList.remove('hidden');
    } finally {
      btn.disabled = false;
      btn.textContent = mode === 'signup' ? "Sign Up →" : "Log In →";
    }
  });

  // ---- Legacy Password Setup Form ----
  const legacyForm = document.getElementById('legacy-password-form');
  if (legacyForm) {
    legacyForm.addEventListener('submit', async function (e) {
      e.preventDefault();
      const errorEl = document.getElementById('legacy-error');
      errorEl.classList.add('hidden');

      const name = document.getElementById('legacy-name').value;
      const newPwd = document.getElementById('legacy-new-password').value;
      const rePwd = document.getElementById('legacy-retype-password').value;

      if (!newPwd) {
        errorEl.textContent = 'Password is required';
        errorEl.classList.remove('hidden');
        return;
      }
      if (newPwd !== rePwd) {
        errorEl.textContent = 'Passwords do not match';
        errorEl.classList.remove('hidden');
        return;
      }

      const passwordRegex = /^(?=.*[a-zA-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{6,}$/;
      if (!passwordRegex.test(newPwd)) {
        errorEl.textContent = 'Password must be 6+ characters with a letter, number, and special char';
        errorEl.classList.remove('hidden');
        return;
      }

      const btn = this.querySelector('button[type="submit"]');
      btn.disabled = true;
      btn.textContent = 'Saving...';

      try {
        await Auth.login(name, '', false, '', newPwd);
        document.getElementById('modal-legacy-password').classList.add('hidden');
        showApp();
      } catch (err) {
        errorEl.textContent = err.message || 'Failed to setup password';
        errorEl.classList.remove('hidden');
      } finally {
        btn.disabled = false;
        btn.textContent = 'Save Password';
      }
    });
  }

  // ---- Payer Linking Dynamic Checkbox Handler ----
  document.addEventListener('change', async (e) => {
    if (e.target.classList.contains('payer-link-checkbox')) {
      const checkedBoxes = document.querySelectorAll('.payer-link-checkbox:checked');
      const targetUserIds = Array.from(checkedBoxes).map(cb => cb.value);
      
      try {
        await API.linkPayer(Auth.getUserId(), targetUserIds);
        showToast('🔗 Bill groupings updated!');
        await UserView.refresh();
        UserView.renderPayments();
      } catch (err) {
        showToast('❌ Failed to update payment grouping');
        e.target.checked = !e.target.checked; // Revert checkbox check on error
      }
    }
  });

  // ---- Logout ----
  document.getElementById('logout-btn').addEventListener('click', function () {
    Auth.logout();
    if (eventSource) eventSource.close();
    showLogin();
    switchTab('home');
    clearNavBadges();
  });

  // ---- Tab Navigation ----
  const navItems = document.querySelectorAll('.nav-item');
  navItems.forEach(btn => {
    btn.addEventListener('click', function () {
      switchTab(this.dataset.tab);
    });
  });

  function switchTab(tabName) {
    navItems.forEach(btn => btn.classList.toggle('active', btn.dataset.tab === tabName));

    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
    const targetTab = document.getElementById(`tab-${tabName}`);
    if (targetTab) targetTab.classList.add('active');

    if (tabName === 'payments') {
      UserView.renderPayments();
    }
    if (tabName === 'admin' && Auth.isAdmin()) {
      AdminView.renderAll();
    }
  }

  // ---- FAB (Add Item) ----
  document.getElementById('fab-add').addEventListener('click', () => UserView.openAddModal());

  // ---- Modal Close (overlay click) ----
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', function () {
      this.closest('.modal').classList.add('hidden');
    });
  });

  // ---- Add Item Form ----
  document.getElementById('add-item-form').addEventListener('submit', (e) => UserView.submitAddItem(e));

  // Qty steppers (Add modal)
  document.getElementById('qty-minus').addEventListener('click', () => {
    const input = document.getElementById('item-qty');
    input.value = Math.max(1, parseInt(input.value) - 1);
  });
  document.getElementById('qty-plus').addEventListener('click', () => {
    const input = document.getElementById('item-qty');
    input.value = Math.min(99, parseInt(input.value) + 1);
  });

  // ---- Edit Item Form ----
  document.getElementById('edit-item-form').addEventListener('submit', (e) => UserView.submitEditItem(e));
  document.getElementById('edit-delete-btn').addEventListener('click', () => UserView.deleteItem());

  // Qty steppers (Edit modal)
  document.getElementById('edit-qty-minus').addEventListener('click', () => {
    const input = document.getElementById('edit-item-qty');
    input.value = Math.max(1, parseInt(input.value) - 1);
  });
  document.getElementById('edit-qty-plus').addEventListener('click', () => {
    const input = document.getElementById('edit-item-qty');
    input.value = Math.min(99, parseInt(input.value) + 1);
  });

  // ---- Add App Form (Admin) ----
  document.getElementById('add-app-form').addEventListener('submit', (e) => AdminView.addApp(e));

  // ---- Admin Settings Form (Admin) ----
  document.getElementById('admin-settings-form').addEventListener('submit', async function (e) {
    e.preventDefault();
    const upiId = document.getElementById('admin-upi-id').value.trim();
    const btn = this.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = 'Saving...';
    try {
      await API.setSettings({ upiId });
      showToast('✅ UPI ID saved!');
      if (document.getElementById('tab-payments').classList.contains('active')) {
        UserView.renderPayments();
      }
    } catch (err) {
      showToast('❌ Failed to save UPI ID');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Save UPI ID';
    }
  });

  // ---- Session Selector ----
  document.getElementById('session-select').addEventListener('change', async function () {
    UserView.selectedSessionId = this.value;
    updateSessionStatusUI();
    await UserView.refresh();
    if (Auth.isAdmin()) {
      AdminView.renderAll();
    }
  });

  // ---- Reset Session (Admin) ----
  document.getElementById('reset-session-btn').addEventListener('click', () => AdminView.openResetModal());
  document.getElementById('reset-session-form').addEventListener('submit', (e) => AdminView.submitResetSession(e));
  document.getElementById('settle-session-form').addEventListener('submit', (e) => AdminView.submitSettleSession(e));

  // ---- SSE Handlers ----
  function setupSSEHandlers() {
    onSSE('order-added', async () => {
      await UserView.refresh();
      if (Auth.isAdmin()) AdminView.renderAll();
    });

    onSSE('order-updated', async () => {
      await UserView.refresh();
      if (Auth.isAdmin()) AdminView.renderAll();
    });

    onSSE('order-removed', async () => {
      await UserView.refresh();
      if (Auth.isAdmin()) AdminView.renderAll();
    });

    onSSE('order-status-changed', async (data) => {
      await UserView.refresh();
      if (Auth.isAdmin()) AdminView.renderAll();

      if (data.order && data.order.userId === Auth.getUserId()) {
        const statusLabels = {
          'out-of-stock': '🚫 Out of Stock',
          'returned': '↩️ Returned',
          'not-delivered': '❌ Not Delivered',
          'confirmed': '✅ Confirmed',
          'pending': '🕐 Pending',
        };
        const label = statusLabels[data.order.status] || data.order.status;
        showToast(`${label}: ${data.order.productName}`);
      }
    });

    onSSE('order-bulk-status-changed', async (data) => {
      await UserView.refresh();
      if (Auth.isAdmin()) AdminView.renderAll();
      if (data.count > 0) {
        showToast(`${data.count} item(s) status updated`);
      }
    });

    onSSE('bill-updated', async () => {
      const paymentsTab = document.getElementById('tab-payments');
      if (paymentsTab.classList.contains('active')) {
        UserView.renderPayments();
      }
      if (Auth.isAdmin()) {
        AdminView.renderPaymentAdmin();
      }
    });

    onSSE('app-added', async () => {
      await UserView.loadApps();
      if (Auth.isAdmin()) AdminView.renderManageApps();
    });

    onSSE('app-removed', async () => {
      await UserView.loadApps();
      if (Auth.isAdmin()) AdminView.renderManageApps();
    });

    onSSE('session-reset', async (data) => {
      if (data && data.activeSessionId) {
        if (UserView.selectedSessionId === data.activeSessionId) {
          return;
        }
        UserView.selectedSessionId = data.activeSessionId;
      }
      showToast('🔄 Session was reset by admin');
      await loadSessions();
      await UserView.refresh();
      if (Auth.isAdmin()) AdminView.renderAll();
      switchTab('home');
    });

    onSSE('user-joined', (data) => {
      showToast(`👋 ${data.user.name} joined!`);
    });

    // P3: Session status changed
    onSSE('session-status-changed', async (data) => {
      await loadSessions();
      await UserView.refresh();
      if (Auth.isAdmin()) AdminView.renderAll();
      showToast(`🚦 Session status is now: ${data.status.toUpperCase()}`);
    });

    // P4: Payment marked / confirmed
    onSSE('payment-updated', async () => {
      const paymentsTab = document.getElementById('tab-payments');
      if (paymentsTab.classList.contains('active')) {
        UserView.renderPayments();
      }
      if (Auth.isAdmin()) {
        AdminView.renderPaymentAdmin();
      }
    });

    // P5: Favorite starred
    onSSE('favorite-added', async () => {
      await UserView.loadFavorites();
      UserView.renderFavoritesList();
    });

    // P6: Threshold targets updated
    onSSE('session-thresholds-updated', async () => {
      await UserView.refresh();
    });

    // P8: Split mode updated
    onSSE('session-split-mode-updated', async () => {
      await UserView.refresh();
      UserView.renderPayments();
      if (Auth.isAdmin()) AdminView.renderAll();
    });
  }

  // ---- Start ----
  boot();

  window.AppController = {
    loadSessions,
    switchTab,
    updateSessionStatusUI
  };
})();

// ===== Nav Badge Helpers (global) =====
function updateNavBadges() {
  const orders = UserView.orders || [];
  const userId = Auth.getUserId();
  const excludedStatuses = ['out-of-stock', 'returned', 'not-delivered'];

  const myActiveCount = orders.filter(o => o.userId === userId && !excludedStatuses.includes(o.status)).length;
  const mineTab = document.querySelector('.nav-item[data-tab="home"]');
  let mineBadge = mineTab.querySelector('.nav-badge');
  if (myActiveCount > 0) {
    if (!mineBadge) {
      mineBadge = document.createElement('span');
      mineBadge.className = 'nav-badge';
      mineTab.appendChild(mineBadge);
    }
    mineBadge.textContent = myActiveCount;
  } else if (mineBadge) {
    mineBadge.remove();
  }

  const myTotal = orders
    .filter(o => o.userId === userId && !excludedStatuses.includes(o.status))
    .reduce((sum, o) => sum + o.estimatedPrice * o.qty, 0);
  const payTab = document.querySelector('.nav-item[data-tab="payments"]');
  let payBadge = payTab.querySelector('.nav-badge');
  if (myTotal > 0) {
    if (!payBadge) {
      payBadge = document.createElement('span');
      payBadge.className = 'nav-badge nav-badge-amount';
      payTab.appendChild(payBadge);
    }
    payBadge.textContent = formatCurrency(myTotal);
  } else if (payBadge) {
    payBadge.remove();
  }
}

function clearNavBadges() {
  document.querySelectorAll('.nav-badge').forEach(b => b.remove());
}
