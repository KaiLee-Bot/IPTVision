export class ChannelManager {
  constructor() {
    this.channels = [];
    this.activeLinks = new Set();
    this.loadSavedPlaylist();
  }

  async loadChannels(m3uContent) {
    this.savePlaylist(m3uContent);
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
      await this.loadChannels(savedPlaylist);
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
        
        if (tvgNameMatch) currentChannel.tvgName = tvgNameMatch[1];
        if (tvgLogoMatch) currentChannel.logo = tvgLogoMatch[1];
        if (groupTitleMatch) currentChannel.category = groupTitleMatch[1].toLowerCase();
        
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
        const response = await fetch(channel.streamUrl, { method: 'HEAD', timeout: 5000 });
        channel.isActive = response.ok;
        if (response.ok) this.activeLinks.add(channel.id);
      } catch {
        channel.isActive = false;
      }
    });

    await Promise.all(validationPromises);
  }

  getChannels() {
    return this.channels.filter(channel => channel.isActive);
  }

  getChannel(id) {
    return this.channels.find(channel => channel.id === id);
  }

  getCategories() {
    const categories = new Set(this.channels.map(channel => channel.category));
    return Array.from(categories).filter(Boolean);
  }

  filterChannels(category) {
    if (category === 'all') return this.getChannels();
    return this.channels.filter(channel => 
      channel.isActive && channel.category === category
    );
  }

  async refreshChannels() {
    await this.validateChannels();
    return this.getChannels();
  }
}