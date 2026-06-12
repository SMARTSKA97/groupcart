// ===== Auth Module =====

const Auth = {
  currentUser: null,

  init() {
    // Restore session from localStorage (persists across tab closes)
    const saved = localStorage.getItem('groupcart_user');
    if (saved) {
      try {
        this.currentUser = JSON.parse(saved);
        return true;
      } catch { /* ignore */ }
    }
    return false;
  },

  async login(name, isAdmin, adminPassword) {
    const { user } = await API.login(name, isAdmin, adminPassword);
    this.currentUser = user;
    localStorage.setItem('groupcart_user', JSON.stringify(user));
    return user;
  },

  logout() {
    this.currentUser = null;
    localStorage.removeItem('groupcart_user');
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
