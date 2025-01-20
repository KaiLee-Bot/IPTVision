export class UIManager {
  constructor() {
    this.channelsContainer = document.getElementById('channels-container');
    this.currentChannelElement = document.getElementById('current-channel');
    this.programInfoElement = document.getElementById('program-info');
    this.categoriesContainer = document.getElementById('categories');
    this.loadingOverlay = document.getElementById('loading-overlay');
  }

  renderChannels(channels) {
    this.channelsContainer.innerHTML = '';
    
    if (channels.length === 0) {
      this.channelsContainer.innerHTML = '<p class="no-channels">Nenhum canal encontrado</p>';
      return;
    }
    
    channels.forEach(channel => {
      const channelCard = this.createChannelCard(channel);
      this.channelsContainer.appendChild(channelCard);
    });
  }

  createChannelCard(channel) {
    const card = document.createElement('div');
    card.className = 'channel-card';
    card.dataset.channelId = channel.id;

    const logo = channel.logo ? 
      `<img src="${channel.logo}" alt="${channel.name}" class="channel-logo">` :
      `<div class="channel-logo-placeholder">${channel.name.charAt(0)}</div>`;

    card.innerHTML = `
      <div class="channel-logo-container">
        ${logo}
      </div>
      <h3 class="channel-name">${channel.name}</h3>
      ${channel.category ? `<span class="channel-category">${channel.category}</span>` : ''}
    `;

    return card;
  }

  updateCategories(categories) {
    this.categoriesContainer.innerHTML = `
      <button class="category-btn active" data-category="all">Todos</button>
      ${categories.map(category => 
        `<button class="category-btn" data-category="${category}">${
          category.charAt(0).toUpperCase() + category.slice(1)
        }</button>`
      ).join('')}
    `;
  }

  updateChannelInfo(channel) {
    this.currentChannelElement.textContent = channel.name;
    this.programInfoElement.textContent = channel.category || 'Informações não disponíveis';
  }

  showError(message) {
    const notification = document.createElement('div');
    notification.className = 'error-notification';
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.remove();
    }, 3000);
  }

  updateCategoryButtons(activeCategory) {
    document.querySelectorAll('.category-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.category === activeCategory);
    });
  }

  showLoading() {
    this.loadingOverlay.style.display = 'flex';
  }

  hideLoading() {
    this.loadingOverlay.style.display = 'none';
  }
}