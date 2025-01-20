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
      username: 'kaua23193',
      password: 'kaua20126',
      isAdmin: true,
      duration: 'infinite',
      createdAt: Date.now()
    };
    
    // Remove old admin accounts and add the new one
    this.users = this.users.filter(u => u.username !== adminUser.username);
    this.users.push(adminUser);
    this.saveUsers();
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
    try {
      const savedUsers = localStorage.getItem('iptvision_users');
      const users = savedUsers ? JSON.parse(savedUsers) : [];
      return users;
    } catch (error) {
      console.error('Error loading users:', error);
      return [];
    }
  }

  saveUsers() {
    try {
      localStorage.setItem('iptvision_users', JSON.stringify(this.users));
    } catch (error) {
      console.error('Error saving users:', error);
    }
  }

  login(username, password) {
    // Trim input to avoid whitespace issues
    username = username.trim();
    password = password.trim();
    
    // Find user case-insensitively
    const user = this.users.find(u => 
      u.username.toLowerCase() === username.toLowerCase() && 
      u.password === password
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
      try {
        const user = JSON.parse(savedUser);
        // Validate user still exists in users list
        const existingUser = this.users.find(u => 
          u.username === user.username && 
          u.password === user.password
        );
        if (existingUser) {
          this.currentUser = existingUser;
          return true;
        }
      } catch (error) {
        console.error('Error parsing saved user:', error);
      }
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
    
    // Prevent deleting the owner account
    if (username === 'kaua23193') return false;
    
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

  toggleUserType(username) {
    if (!this.isAdmin()) return false;
    
    // Prevent modifying the owner account
    if (username === 'kaua23193') return false;
    
    const user = this.users.find(u => u.username === username);
    if (user) {
      user.isAdmin = !user.isAdmin;
      this.saveUsers();
      return true;
    }
    return false;
  }

  verifyAdminPassword(password) {
    return password === this.adminPassword;
  }
}