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
    
    this.initializeDeviceSupport();
    this.init();

    // Listen for playlist updates from WebsimSocket
    window.addEventListener('playlistUpdated', (e) => {
      const { channels, uploadedBy } = e.detail;
      this.uiManager.renderChannels(channels);
      
      // Update categories
      const categories = this.channelManager.getCategories();
      this.uiManager.updateCategories(categories);
      
      // Show notification
      this.uiManager.showError(`Playlist atualizada por ${uploadedBy}`);
    });
  }

  async init() {
    try {
      this.setupLoginSystem();
      this.setupEventListeners();
      
      // Check if user is already logged in
      if (this.authManager.checkLoggedIn()) {
        this.showMainContent();
        
        // Load saved playlist when initializing
        const savedPlaylist = localStorage.getItem('global_playlist');
        if (savedPlaylist) {
          await this.loadPlaylist(JSON.parse(savedPlaylist).content);
        }
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
      const username = document.getElementById('username').value.trim();
      const password = document.getElementById('password').value.trim();
      
      if (this.authManager.login(username, password)) {
        this.showMainContent();
        // Clear form
        loginForm.reset();
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
    
    if (this.authManager.isAdmin()) {
      document.getElementById('admin-menu-btn').style.display = 'inline';
      document.getElementById('m3u-input').closest('.file-input-container').style.display = 'block';
    } else {
      document.getElementById('admin-menu-btn').style.display = 'none';
      document.getElementById('m3u-input').closest('.file-input-container').style.display = 'none';
    }

    // Load saved playlist when showing main content
    const savedPlaylist = localStorage.getItem('global_playlist');
    if (savedPlaylist) {
      this.loadPlaylist(JSON.parse(savedPlaylist).content);
    }
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
      
      const isOwner = user.username === 'DonoVisionPlayK';
      
      return `
        <div class="user-item">
          <div class="user-info">
            <span class="user-name">${user.username}</span>
            <button class="user-type-toggle ${user.isAdmin ? 'admin' : 'normal'}"
                    ${isOwner ? 'disabled' : ''}
                    data-username="${user.username}">
              ${user.isAdmin ? 'Admin' : 'Normal'}
            </button>
            <div class="user-details">
              <span class="user-password">Senha: ${user.password}</span>
              <span class="user-expiry">Expira: ${expiryTime}</span>
            </div>
          </div>
          <div class="user-actions">
            <button class="login-as-user-btn" data-username="${user.username}" data-password="${user.password}">
              Logar como usuário
            </button>
            ${!isOwner ? `
              <button class="delete-user-btn" data-username="${user.username}">
                Deletar
              </button>
            ` : ''}
          </div>
        </div>
      `;
    }).join('');

    // Add event listeners for login as user buttons
    document.querySelectorAll('.login-as-user-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const username = e.target.dataset.username;
        const password = e.target.dataset.password;
        this.authManager.login(username, password);
        this.showMainContent();
        this.uiManager.showError(`Logado como ${username}`);
      });
    });

    // Add event listeners for delete buttons and type toggle
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

    // Add event listeners for user type toggle
    document.querySelectorAll('.user-type-toggle').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const username = e.target.dataset.username;
        if (this.authManager.toggleUserType(username)) {
          this.renderUsersList(searchQuery);
          this.uiManager.showError(`Tipo de usuário alterado com sucesso`);
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

    // Add home button refresh functionality
    document.querySelector('a[href="https://visionplay.com/home"]').addEventListener('click', (e) => {
      e.preventDefault();
      window.location.reload();
    });

    // Add double-tap support for mobile fullscreen
    let lastTap = 0;
    document.getElementById('video').addEventListener('touchend', (e) => {
      const currentTime = new Date().getTime();
      const tapLength = currentTime - lastTap;
      
      if (tapLength < 500 && tapLength > 0) {
        // Double tap detected
        if (document.fullscreenElement) {
          document.exitFullscreen();
        } else {
          document.getElementById('video-player').requestFullscreen();
        }
      }
      lastTap = currentTime;
    });
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
      this.uiManager.showLoading();
      
      // Load and validate channels
      const channels = await this.channelManager.loadChannels(content);
      
      // Update categories
      const categories = this.channelManager.getCategories();
      this.uiManager.updateCategories(categories);
      
      // Render channel list
      this.uiManager.renderChannels(this.channelManager.getChannels());
      
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

  initializeDeviceSupport() {
    // Enable keyboard navigation for TV
    if (this.isTV()) {
      this.enableTVNavigation();
    }

    // Add touch support for mobile/tablet
    if (this.isTouchDevice()) {
      this.enableTouchSupport();
    }

    // Handle orientation changes
    this.handleOrientationChange();
  }

  isTV() {
    return window.matchMedia('(min-width: 1200px) and (min-height: 800px)').matches;
  }

  isTouchDevice() {
    return ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
  }

  enableTVNavigation() {
    document.addEventListener('keydown', (e) => {
      const focusedElement = document.activeElement;
      
      switch(e.key) {
        case 'ArrowRight':
        case 'ArrowLeft':
        case 'ArrowUp':
        case 'ArrowDown':
          this.handleTVNavigation(e.key);
          break;
        case 'Enter':
          if (focusedElement.classList.contains('channel-card')) {
            const channelId = focusedElement.dataset.channelId;
            this.playChannel(channelId);
          }
          break;
      }
    });
  }

  handleTVNavigation(direction) {
    const focusableElements = [
      ...document.querySelectorAll('.channel-card, .category-btn, button, input')
    ].filter(el => {
      const style = window.getComputedStyle(el);
      return style.display !== 'none' && style.visibility !== 'hidden';
    });

    const currentIndex = focusableElements.indexOf(document.activeElement);
    let nextIndex;

    switch(direction) {
      case 'ArrowRight':
        nextIndex = currentIndex + 1;
        break;
      case 'ArrowLeft':
        nextIndex = currentIndex - 1;
        break;
      case 'ArrowUp':
        nextIndex = currentIndex - Math.floor(window.innerWidth / 250); // Approximate items per row
        break;
      case 'ArrowDown':
        nextIndex = currentIndex + Math.floor(window.innerWidth / 250);
        break;
    }

    if (nextIndex >= 0 && nextIndex < focusableElements.length) {
      focusableElements[nextIndex].focus();
    }
  }

  enableTouchSupport() {
    let touchStartX = 0;
    let touchStartY = 0;

    document.addEventListener('touchstart', (e) => {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
    }, { passive: true });

    document.addEventListener('touchend', (e) => {
      const touchEndX = e.changedTouches[0].clientX;
      const touchEndY = e.changedTouches[0].clientY;
      const deltaX = touchEndX - touchStartX;
      const deltaY = touchEndY - touchStartY;

      // Detect swipe
      if (Math.abs(deltaX) > 50 || Math.abs(deltaY) > 50) {
        this.handleSwipe(deltaX, deltaY);
      }
    }, { passive: true });
  }

  handleSwipe(deltaX, deltaY) {
    // Add swipe gesture handling if needed
    // For example, swiping between categories or channels
  }

  handleOrientationChange() {
    window.addEventListener('orientationchange', () => {
      // Adjust layout after orientation change
      setTimeout(() => {
        const video = document.getElementById('video');
        if (video && !video.paused) {
          video.play();
        }
      }, 100);
    });
  }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  window.app = new App();
});