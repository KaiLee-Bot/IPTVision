export class AuthManager {
  constructor() {
    this.currentUser = null;
    this.users = this.loadUsers();
    this.setupDefaultAdmin();
    this.checkExpiredAccounts();
    this.adminPassword = '2012';
    // Check for expired accounts every minute
    setInterval(() => this.checkExpiredAccounts(), 60000);
  }

  setupDefaultAdmin() {
    const adminUser = {
      username: 'DonoIPTVisionK',
      password: 'kaua20126',
      isAdmin: true,
      duration: 'infinite'
    };
    
    if (!this.users.find(u => u.username === adminUser.username)) {
      this.users.push(adminUser);
      this.saveUsers();
    }
  }

  checkExpiredAccounts() {
    const now = Date.now();
    let hasChanges = false;
    
    this.users = this.users.filter(user => {
      if (user.isAdmin || user.duration === 'infinite') return true;
      
      const expiryTime = user.createdAt + (user.duration * 60 * 60 * 1000); // Convert hours to milliseconds
      if (now >= expiryTime) {
        hasChanges = true;
        return false;
      }
      return true;
    });

    if (hasChanges) {
      this.saveUsers();
    }
  }

  loadUsers() {
    const savedUsers = localStorage.getItem('iptvision_users');
    return savedUsers ? JSON.parse(savedUsers) : [];
  }

  saveUsers() {
    localStorage.setItem('iptvision_users', JSON.stringify(this.users));
  }

  login(username, password) {
    const user = this.users.find(u => 
      u.username === username && u.password === password
    );
    
    if (user) {
      this.currentUser = user;
      localStorage.setItem('iptvision_current_user', JSON.stringify(user));
      return true;
    }
    return false;
  }

  logout() {
    this.currentUser = null;
    localStorage.removeItem('iptvision_current_user');
  }

  checkLoggedIn() {
    const savedUser = localStorage.getItem('iptvision_current_user');
    if (savedUser) {
      this.currentUser = JSON.parse(savedUser);
      return true;
    }
    return false;
  }

  isAdmin() {
    return this.currentUser?.isAdmin === true;
  }

  createUser(username, password, duration = 'infinite') {
    if (!this.isAdmin()) {
      throw new Error('Apenas administradores podem criar usuários');
    }
    
    if (!username || !password) {
      throw new Error('Username e senha são obrigatórios');
    }
    
    if (username.length < 3) {
      throw new Error('Username deve ter pelo menos 3 caracteres');
    }
    
    if (password.length < 6) {
      throw new Error('Senha deve ter pelo menos 6 caracteres');
    }
    
    if (this.users.find(u => u.username === username)) {
      throw new Error('Username já existe');
    }

    const newUser = {
      username,
      password,
      isAdmin: false,
      duration: duration,
      createdAt: Date.now()
    };

    this.users.push(newUser);
    this.saveUsers();
    return true;
  }

  deleteUser(username) {
    if (!this.isAdmin()) return false;
    
    // Prevent deleting the admin account
    if (username === 'DonoIPTVisionK') return false;
    
    this.users = this.users.filter(u => u.username !== username);
    this.saveUsers();
    return true;
  }

  searchUsers(query = '') {
    if (!this.isAdmin()) return [];
    
    return this.users.filter(user => 
      user.username.toLowerCase().includes(query.toLowerCase()) ||
      (user.duration + '').toLowerCase().includes(query.toLowerCase())
    );
  }

  verifyAdminPassword(password) {
    return password === this.adminPassword;
  }
}