// ===== Auth Module =====

const Auth = {
  currentUser: null,
  token: null,

  init() {
    // Restore session from localStorage (persists across tab closes)
    const saved = localStorage.getItem('groupcart_user');
    const savedToken = localStorage.getItem('groupcart_token');
    if (saved && savedToken) {
      try {
        this.currentUser = JSON.parse(saved);
        this.token = savedToken;
        return true;
      } catch { /* ignore */ }
    }
    return false;
  },

  async login(name, password, isAdmin, adminPassword, newPassword, isRegister) {
    const res = await API._fetch('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ name, password, isAdmin, adminPassword, newPassword, isRegister }),
    });

    if (res.registerRequired || res.legacySetupRequired) {
      return res; // let caller handle the modal dialogs for passwords
    }

    this.currentUser = res.user;
    this.token = res.token;
    localStorage.setItem('groupcart_user', JSON.stringify(res.user));
    localStorage.setItem('groupcart_token', res.token);
    return res;
  },

  logout() {
    this.currentUser = null;
    this.token = null;
    localStorage.removeItem('groupcart_user');
    localStorage.removeItem('groupcart_token');
  },

  isAdmin() {
    return this.currentUser && this.currentUser.isAdmin;
  },

  getUserId() {
    return this.currentUser ? this.currentUser.id : null;
  },

  getUserName() {
    return this.currentUser ? this.currentUser.name : '';
  },
};
