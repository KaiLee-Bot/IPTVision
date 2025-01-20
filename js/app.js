import { ChannelManager } from './channelManager.js';
import { Player } from './player.js';
import { UIManager } from './uiManager.js';
import { AuthManager } from './authManager.js';

class App {
  constructor() {
    this.channelManager = new ChannelManager();
    this.player = new Player();
    this.uiManager = new UIManager();
    this.authManager = new AuthManager();
    this.adminVerified = false;
    
    this.init();
  }

  async init() {
    try {
      this.setupLoginSystem();
      this.setupEventListeners();
      
      // Check if user is already logged in
      if (this.authManager.checkLoggedIn()) {
        this.showMainContent();
      }
    } catch (error) {
      console.error('Failed to initialize app:', error);
      this.uiManager.showError('Erro ao inicializar o aplicativo. Por favor, recarregue a página.');
    }
  }

  setupLoginSystem() {
    const loginForm = document.getElementById('login-form');
    loginForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const username = document.getElementById('username').value;
      const password = document.getElementById('password').value;
      
      if (this.authManager.login(username, password)) {
        this.showMainContent();
      } else {
        this.uiManager.showError('Usuário ou senha inválidos');
      }
    });

    document.getElementById('logout-btn').addEventListener('click', (e) => {
      e.preventDefault();
      this.authManager.logout();
      this.adminVerified = false; // Reset admin verification on logout
      this.showLoginPage();
    });
  }

  showLoginPage() {
    document.getElementById('login-page').classList.add('active');
    document.getElementById('main-page').classList.remove('active');
  }

  showMainContent() {
    document.getElementById('login-page').classList.remove('active');
    document.getElementById('main-page').classList.add('active');
    
    // Show admin features if user is admin
    if (this.authManager.isAdmin()) {
      document.getElementById('admin-menu-btn').style.display = 'inline';
      document.getElementById('m3u-input').closest('.file-input-container').style.display = 'block';
    } else {
      document.getElementById('admin-menu-btn').style.display = 'none';
      document.getElementById('m3u-input').closest('.file-input-container').style.display = 'none';
    }
    this.setupFileInput();
  }

  showAdminPanel() {
    if (!this.authManager.isAdmin()) {
      this.uiManager.showError('Acesso não autorizado');
      return;
    }
    
    // Check if admin verification is needed
    if (!this.adminVerified) {
      const password = prompt('Digite a senha do administrador (4 dígitos):');
      if (!password) return; // User cancelled the prompt
      
      if (this.authManager.verifyAdminPassword(password)) {
        this.adminVerified = true;
      } else {
        this.uiManager.showError('Senha administrativa incorreta');
        return;
      }
    }
    
    // If we get here, admin is verified
    const adminPanel = document.getElementById('admin-panel');
    adminPanel.style.display = adminPanel.style.display === 'block' ? 'none' : 'block';
    if (adminPanel.style.display === 'block') {
      this.renderUsersList();
    }
  }

  renderUsersList(searchQuery = '') {
    if (!this.authManager.isAdmin()) return;
    
    const users = this.authManager.searchUsers(searchQuery);
    const usersList = document.getElementById('users-list');
    
    usersList.innerHTML = users.map(user => {
      const expiryTime = user.duration === 'infinite' ? 
        'Sem expiração' : 
        this.formatExpiryTime(user.createdAt, user.duration);
      
      return `
        <div class="user-item">
          <div class="user-info">
            <span class="user-name">${user.username}</span>
            ${user.isAdmin ? '<span class="admin-badge">Admin</span>' : ''}
            <div class="user-details">
              <span class="user-password">Senha: ${user.password}</span>
              <span class="user-expiry">Expira: ${expiryTime}</span>
            </div>
          </div>
          <div class="user-actions">
            ${!user.isAdmin ? `
              <button class="delete-user-btn" data-username="${user.username}">
                Deletar
              </button>
            ` : ''}
          </div>
        </div>
      `;
    }).join('');

    // Add event listeners for delete buttons
    document.querySelectorAll('.delete-user-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const username = e.target.dataset.username;
        if (confirm(`Tem certeza que deseja deletar o usuário ${username}?`)) {
          this.authManager.deleteUser(username);
          this.renderUsersList(searchQuery);
          this.uiManager.showError('Usuário deletado com sucesso');
        }
      });
    });
  }

  formatExpiryTime(createdAt, duration) {
    if (duration === 'infinite') return 'Nunca';
    
    const expiryTime = new Date(createdAt + (duration * 60 * 60 * 1000));
    return expiryTime.toLocaleString();
  }

  showCreateUserModal() {
    document.getElementById('create-user-modal').style.display = 'flex';
  }

  hideCreateUserModal() {
    document.getElementById('create-user-modal').style.display = 'none';
  }

  setupEventListeners() {
    // Category filter handling
    document.getElementById('categories').addEventListener('click', (e) => {
      if (e.target.classList.contains('category-btn')) {
        const category = e.target.dataset.category;
        const filteredChannels = this.channelManager.filterChannels(category);
        this.uiManager.renderChannels(filteredChannels);
        this.uiManager.updateCategoryButtons(category);
      }
    });

    // Channel selection handling
    document.getElementById('channels-container').addEventListener('click', (e) => {
      const channelCard = e.target.closest('.channel-card');
      if (channelCard) {
        const channelId = channelCard.dataset.channelId;
        this.playChannel(channelId);
      }
    });

    // Admin features
    const adminMenuBtn = document.getElementById('admin-menu-btn');
    adminMenuBtn.addEventListener('click', () => {
      this.showAdminPanel();
    });

    document.getElementById('create-user-btn').addEventListener('click', () => {
      this.showCreateUserModal();
    });

    // Create user form handling
    document.getElementById('create-user-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const username = document.getElementById('new-username').value;
      const password = document.getElementById('new-password').value;
      const duration = document.getElementById('new-duration').value;
      
      try {
        if (this.authManager.createUser(username, password, duration === 'infinite' ? 'infinite' : parseInt(duration))) {
          this.hideCreateUserModal();
          this.renderUsersList();
          this.uiManager.showError('Usuário criado com sucesso!');
          e.target.reset();
        }
      } catch (error) {
        this.uiManager.showError(error.message);
      }
    });

    // Improve search handling
    const searchInput = document.getElementById('user-search');
    let searchTimeout;
    
    searchInput.addEventListener('input', (e) => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        this.renderUsersList(e.target.value);
      }, 300); // Debounce search for better performance
    });

    // Admin menu visibility
    if (this.authManager.isAdmin()) {
      adminMenuBtn.style.display = 'inline-block';
    } else {
      adminMenuBtn.style.display = 'none';
    }
  }

  setupFileInput() {
    const fileInput = document.getElementById('m3u-input');
    fileInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (file) {
        try {
          const content = await file.text();
          await this.loadPlaylist(content);
        } catch (error) {
          console.error('Error reading M3U file:', error);
          this.uiManager.showError('Erro ao ler o arquivo M3U. Verifique se o formato está correto.');
        }
      }
    });
  }

  async loadPlaylist(content) {
    try {
      // Show loading state
      this.uiManager.showLoading();
      
      // Load and validate channels
      await this.channelManager.loadChannels(content);
      
      // Update categories
      const categories = this.channelManager.getCategories();
      this.uiManager.updateCategories(categories);
      
      // Render channel list
      this.uiManager.renderChannels(this.channelManager.getChannels());
      
      // Hide loading state
      this.uiManager.hideLoading();
      
    } catch (error) {
      console.error('Error loading playlist:', error);
      this.uiManager.showError('Erro ao carregar a playlist. Verifique o formato do arquivo.');
      this.uiManager.hideLoading();
    }
  }

  async playChannel(channelId) {
    try {
      const channel = this.channelManager.getChannel(channelId);
      if (!channel) throw new Error('Canal não encontrado');

      this.uiManager.updateChannelInfo(channel);
      await this.player.play(channel.streamUrl);
      
    } catch (error) {
      console.error('Error playing channel:', error);
      this.uiManager.showError('Erro ao reproduzir o canal. Por favor, tente outro canal.');
    }
  }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  window.app = new App();
});