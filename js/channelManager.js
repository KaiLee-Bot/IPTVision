export class ChannelManager {
  constructor() {
    this.channels = [];
    this.activeLinks = new Set();
    this.loadSavedPlaylist();
    
    // Add playlist update check interval
    setInterval(() => this.checkForPlaylistUpdates(), 10000); // Check every 10 seconds
  }

  async loadChannels(m3uContent) {
    // Save playlist to localStorage with timestamp
    const playlistData = {
      content: m3uContent,
      timestamp: Date.now(),
      uploadedBy: JSON.parse(localStorage.getItem('iptvision_current_user'))?.username
    };
    
    localStorage.setItem('global_playlist', JSON.stringify(playlistData));
    
    this.channels = this.parseM3U(m3uContent);
    await this.validateChannels();
    return this.channels;
  }

  async loadSavedPlaylist() {
    const savedPlaylistData = localStorage.getItem('global_playlist');
    if (savedPlaylistData) {
      const playlistData = JSON.parse(savedPlaylistData);
      // Load channels from saved playlist
      this.channels = this.parseM3U(playlistData.content);
      await this.validateChannels();
      return this.channels; 
    }
    return [];
  }

  // Check for playlist updates from other admins
  async checkForPlaylistUpdates() {
    const currentData = localStorage.getItem('global_playlist');
    if (!currentData) return;

    const currentPlaylist = JSON.parse(currentData);
    const lastUpdateTime = currentPlaylist.timestamp;

    try {
      // In a real implementation, this would be an API call to your server
      // For now, we'll simulate by checking localStorage
      const latestData = localStorage.getItem('global_playlist');
      if (!latestData) return;

      const latestPlaylist = JSON.parse(latestData);
      
      // If there's a newer playlist available
      if (latestPlaylist.timestamp > lastUpdateTime) {
        console.log('New playlist detected, updating...');
        this.channels = this.parseM3U(latestPlaylist.content);
        await this.validateChannels();
        
        // Trigger UI update
        const event = new CustomEvent('playlistUpdated', {
          detail: {
            channels: this.channels,
            uploadedBy: latestPlaylist.uploadedBy
          }
        });
        window.dispatchEvent(event);
      }
    } catch (error) {
      console.error('Error checking for playlist updates:', error);
    }
  }

  parseM3U(content) {
    const channels = [];
    const lines = content.split('\n');
    let currentChannel = null;

    lines.forEach(line => {
      line = line.trim();
      
      if (line.startsWith('#EXTINF:')) {
        // Parse channel info
        currentChannel = {};
        
        // Extract duration and channel name
        const match = line.match(/#EXTINF:(-?\d+)\s*,\s*(.+)/);
        if (match) {
          currentChannel.duration = parseInt(match[1]);
          currentChannel.name = match[2];
        }
        
        // Extract additional attributes if present
        const tvgNameMatch = line.match(/tvg-name="([^"]+)"/);
        const tvgLogoMatch = line.match(/tvg-logo="([^"]+)"/);
        const groupTitleMatch = line.match(/group-title="([^"]+)"/);
        
        // Use tvg-name as title if available, otherwise keep existing name
        if (tvgNameMatch) {
          currentChannel.name = tvgNameMatch[1];
        }
        
        // If name is still not set, provide a default
        if (!currentChannel.name) {
          currentChannel.name = 'Canal sem nome';
        }

        if (tvgLogoMatch) currentChannel.logo = tvgLogoMatch[1];
        if (groupTitleMatch) currentChannel.category = groupTitleMatch[1].toLowerCase();
        else currentChannel.category = 'geral';
        
        currentChannel.id = crypto.randomUUID();
        
      } else if (line && !line.startsWith('#') && currentChannel) {
        // This is the URL line
        currentChannel.streamUrl = line;
        channels.push(currentChannel);
        currentChannel = null;
      }
    });

    return channels;
  }

  async validateChannels() {
    const validationPromises = this.channels.map(async channel => {
      try {
        // First try with HEAD request
        try {
          const response = await fetch(channel.streamUrl, { 
            method: 'HEAD',
            timeout: 5000
          });
          channel.isActive = response.ok;
          if (response.ok) this.activeLinks.add(channel.id);
        } catch {
          // If HEAD fails, try with GET request
          const response = await fetch(channel.streamUrl, { 
            method: 'GET',
            timeout: 5000
          });
          channel.isActive = response.ok;
          if (response.ok) this.activeLinks.add(channel.id);
        }
      } catch {
        // Mark as active even if validation fails - let player handle errors
        channel.isActive = true;
        this.activeLinks.add(channel.id);
      }
    });

    // Wait for all validations to complete
    await Promise.allSettled(validationPromises);
  }

  getChannels() {
    // Return all channels instead of filtering by isActive
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

  async refreshChannels() {
    await this.validateChannels();
    return this.getChannels();
  }
}