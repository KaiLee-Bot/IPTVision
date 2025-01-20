export class ChannelManager {
  constructor() {
    this.channels = [];
    this.activeLinks = new Set();
  }

  async loadChannels(m3uContent) {
    try {
      // Parse channels without validation first for immediate display
      this.channels = this.parseM3U(m3uContent);
      
      // Save to localStorage for global access
      localStorage.setItem('global_playlist', JSON.stringify({
        content: m3uContent,
        timestamp: Date.now()
      }));

      // Start validation in background
      this.validateChannelsInBackground();

      return this.channels;
    } catch (error) {
      console.error('Error loading channels:', error);
      throw error;
    }
  }

  async validateChannelsInBackground() {
    // Validate in batches of 10 channels
    const batchSize = 10;
    for (let i = 0; i < this.channels.length; i += batchSize) {
      const batch = this.channels.slice(i, i + batchSize);
      const validationPromises = batch.map(async channel => {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout
          
          const response = await fetch(channel.streamUrl, { 
            method: 'HEAD',
            signal: controller.signal
          });
          
          clearTimeout(timeoutId);
          channel.isActive = response.ok;
          if (response.ok) this.activeLinks.add(channel.id);
        } catch {
          // Mark as active by default - let player handle errors
          channel.isActive = true;
          this.activeLinks.add(channel.id);
        }
      });

      // Wait for current batch to complete before moving to next
      await Promise.allSettled(validationPromises);
    }
  }

  parseM3U(content) {
    const channels = [];
    const lines = content.split('\n');
    let currentChannel = null;

    lines.forEach(line => {
      line = line.trim();
      
      if (line.startsWith('#EXTINF:')) {
        currentChannel = {};
        
        const match = line.match(/#EXTINF:(-?\d+)\s*,\s*(.+)/);
        if (match) {
          currentChannel.duration = parseInt(match[1]);
          currentChannel.name = match[2];
        }
        
        const tvgNameMatch = line.match(/tvg-name="([^"]+)"/);
        const tvgLogoMatch = line.match(/tvg-logo="([^"]+)"/);
        const groupTitleMatch = line.match(/group-title="([^"]+)"/);
        
        if (tvgNameMatch) {
          currentChannel.name = tvgNameMatch[1];
        }
        
        if (!currentChannel.name || currentChannel.name === 'undefined') {
          const rawName = match ? match[2] : 'Canal sem nome';
          currentChannel.name = rawName;
        }

        if (tvgLogoMatch) currentChannel.logo = tvgLogoMatch[1];
        if (groupTitleMatch) currentChannel.category = groupTitleMatch[1].toLowerCase();
        else currentChannel.category = 'geral';
        
        currentChannel.id = crypto.randomUUID();
        
      } else if (line && !line.startsWith('#') && currentChannel) {
        currentChannel.streamUrl = line;
        // Mark all channels as active by default
        currentChannel.isActive = true;
        channels.push(currentChannel);
        currentChannel = null;
      }
    });

    return channels;
  }

  getChannels() {
    return this.channels;
  }

  getChannel(id) {
    return this.channels.find(channel => channel.id === id);
  }

  getCategories() {
    const categories = new Set(this.channels.map(channel => channel.category));
    return Array.from(categories).filter(Boolean);
  }

  filterChannels(category) {
    if (category === 'all') return this.channels;
    return this.channels.filter(channel => channel.category === category);
  }

  publishPlaylistToAllUsers() {
    const currentPlaylist = localStorage.getItem('global_playlist');
    if (currentPlaylist) {
      // Update timestamp to force refresh on other clients
      const updatedPlaylist = JSON.parse(currentPlaylist);
      updatedPlaylist.timestamp = Date.now();
      localStorage.setItem('global_playlist', JSON.stringify(updatedPlaylist));
    }
  }
}