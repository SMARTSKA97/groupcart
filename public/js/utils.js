// ===== Utility Functions =====

function formatCurrency(amount) {
  return '₹' + Math.round(amount).toLocaleString('en-IN');
}

function formatTime(isoString) {
  const d = new Date(isoString);
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

function showToast(message, duration = 2500) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.remove('hidden');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.add('hidden'), duration);
}

function truncate(str, len = 40) {
  return str && str.length > len ? str.substring(0, len) + '…' : str;
}

function isValidUrl(str) {
  try { new URL(str); return true; } catch { return false; }
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function generatePaymentSummaryText(settlementData) {
  if (!settlementData || !settlementData.users || settlementData.users.length === 0) {
    return 'No settlement data available.';
  }

  const appsMap = {};
  for (const app of settlementData.apps) {
    appsMap[app.id] = app;
  }

  let text = '🛒 GroupCart — Payment Summary\n';
  text += '━━━━━━━━━━━━━━━━━━━━━━\n\n';

  // Discounts
  for (const appId in settlementData.appDiscounts) {
    const d = settlementData.appDiscounts[appId];
    const appName = appsMap[appId]?.name || appId;
    const pct = d.discountPercent.toFixed(1);
    if (d.discountPercent > 0) {
      text += `${appName}: ${pct}% off (saved ${formatCurrency(d.discountAmount)})\n`;
    } else if (d.discountPercent < 0) {
      text += `${appName}: ${Math.abs(pct)}% surcharge (extra ${formatCurrency(Math.abs(d.discountAmount))})\n`;
    }
  }

  text += '\n';

  for (const user of settlementData.users) {
    text += `👤 ${user.userName}: ${formatCurrency(user.total)}\n`;
    for (const appId in user.apps) {
      const appName = appsMap[appId]?.icon || '';
      text += `   ${appName} ${appsMap[appId]?.name || appId}: ${formatCurrency(user.apps[appId].final)}\n`;
    }
    text += '\n';
  }

  text += '━━━━━━━━━━━━━━━━━━━━━━\n';
  return text;
}

function generateOrderSummaryText(orders, apps) {
  if (!orders || orders.length === 0) return 'No active orders.';
  const appsMap = {};
  for (const app of apps) {
    appsMap[app.id] = app;
  }
  
  // Group active orders by app, then by productName
  const activeOrders = orders.filter(o => !['out-of-stock', 'returned', 'not-delivered'].includes(o.status));
  if (activeOrders.length === 0) return 'No active orders.';

  const ordersByApp = {};
  for (const order of activeOrders) {
    if (!ordersByApp[order.appId]) ordersByApp[order.appId] = {};
    const appOrders = ordersByApp[order.appId];
    if (!appOrders[order.productName]) {
      appOrders[order.productName] = 0;
    }
    appOrders[order.productName] += order.qty;
  }

  let text = '🛒 GroupCart — Order Placement Summary\n';
  text += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n';

  for (const appId in ordersByApp) {
    const appName = appsMap[appId]?.name || appId;
    const appIcon = appsMap[appId]?.icon || '📦';
    text += `${appIcon} ${appName.toUpperCase()}\n`;
    text += '─────────────────────────────────\n';
    
    const items = ordersByApp[appId];
    for (const name in items) {
      text += `• ${name}  ×  ${items[name]}\n`;
    }
    text += '\n';
  }

  text += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  return text;
}

// ===== SweetAlert2 Global Custom Theme Helper =====
const SwalCustom = {
  fire(options = {}) {
    return Swal.fire({
      background: 'var(--bg-card, #16213e)',
      color: 'var(--text-primary, #e8e8f0)',
      confirmButtonColor: 'var(--accent-primary, #6c63ff)',
      cancelButtonColor: 'var(--bg-input, #0e1628)',
      // Apply theme custom classes
      customClass: {
        popup: 'swal-theme-popup',
        title: 'swal-theme-title',
        htmlContainer: 'swal-theme-html',
        input: 'swal-theme-input',
        confirmButton: 'btn btn-primary',
        cancelButton: 'btn'
      },
      ...options
    });
  }
};

function copyToClipboard(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    return navigator.clipboard.writeText(text);
  }
  return new Promise((resolve, reject) => {
    try {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      textArea.style.top = "0";
      textArea.style.left = "0";
      textArea.style.position = "fixed";
      textArea.style.opacity = "0";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      const successful = document.execCommand('copy');
      document.body.removeChild(textArea);
      if (successful) {
        resolve();
      } else {
        reject(new Error("Fallback copy command was unsuccessful"));
      }
    } catch (err) {
      reject(err);
    }
  });
}

const Tutorial = {
  currentSlide: 0,
  slides: [],
  onFinish: null,

  show(slides, onFinish) {
    this.slides = slides;
    this.currentSlide = 0;
    this.onFinish = onFinish;
    
    const modal = document.getElementById('modal-tutorial');
    if (modal) modal.classList.remove('hidden');
    this.renderSlide();
    
    const prev = document.getElementById('btn-tutorial-prev');
    const next = document.getElementById('btn-tutorial-next');
    if (prev) prev.onclick = () => this.prev();
    if (next) next.onclick = () => this.next();
  },

  renderSlide() {
    const slide = this.slides[this.currentSlide];
    const content = document.getElementById('tutorial-content');
    if (!content) return;
    
    content.innerHTML = `
      <div class="tutorial-slide" style="text-align: center; padding: 1.5rem 1rem;">
        <div style="font-size: 3.5rem; margin-bottom: 1rem;">${slide.icon}</div>
        <h3 style="margin-bottom: 0.75rem; color: var(--accent-primary); font-size: 1.3rem; font-weight: 700;">${slide.title}</h3>
        <p style="font-size: 0.92rem; line-height: 1.55; color: var(--text-secondary); max-width: 340px; margin: 0 auto;">${slide.text}</p>
      </div>
    `;
    
    const prevBtn = document.getElementById('btn-tutorial-prev');
    const nextBtn = document.getElementById('btn-tutorial-next');
    
    if (prevBtn) {
      prevBtn.style.visibility = this.currentSlide === 0 ? 'hidden' : 'visible';
    }
    
    if (nextBtn) {
      nextBtn.textContent = this.currentSlide === this.slides.length - 1 ? 'Got It! 🎉' : 'Next →';
    }
  },

  next() {
    if (this.currentSlide < this.slides.length - 1) {
      this.currentSlide++;
      this.renderSlide();
    } else {
      const modal = document.getElementById('modal-tutorial');
      if (modal) modal.classList.add('hidden');
      if (this.onFinish) this.onFinish();
    }
  },

  prev() {
    if (this.currentSlide > 0) {
      this.currentSlide--;
      this.renderSlide();
    }
  }
};

