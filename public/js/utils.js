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
