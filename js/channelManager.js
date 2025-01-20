export class ChannelManager {
  constructor() {
    this.channels = [];
    this.activeLinks = new Set();
    this.loadSavedPlaylist();
  }

  async loadChannels(m3uContent) {
    // Save playlist to localStorage when admin uploads a new one
    localStorage.setItem('iptvision_playlist', m3uContent);
    this.channels = this.parseM3U(m3uContent);
    await this.validateChannels();
    return this.channels;
  }

  savePlaylist(m3uContent) {
    localStorage.setItem('iptvision_playlist', m3uContent);
  }

  async loadSavedPlaylist() {
    const savedPlaylist = localStorage.getItem('iptvision_playlist');
    if (savedPlaylist) {
      // Load channels from saved playlist
      this.channels = this.parseM3U(savedPlaylist);
      await this.validateChannels();
      return this.channels; 
    }
    return [];
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