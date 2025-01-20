export class ChannelManager {
  constructor() {
    this.channels = [];
    this.activeLinks = new Set();
    this.room = new WebsimSocket();
    this.setupRealtime();
    this.loadSavedPlaylist();
  }

  setupRealtime() {
    // Listen for playlist updates from other admins
    this.room.onmessage = (event) => {
      const data = event.data;
      if (data.type === 'playlist_update') {
        // Update local playlist with received content
        this.channels = this.parseM3U(data.content);
        this.validateChannels().then(() => {
          // Save to localStorage as backup
          localStorage.setItem('global_playlist', JSON.stringify({
            content: data.content,
            updatedAt: Date.now()
          }));
          
          // Trigger UI update
          const event = new CustomEvent('playlistUpdated', {
            detail: {
              channels: this.channels,
              uploadedBy: data.username
            }
          });
          window.dispatchEvent(event);
        });
      }
    };

    // Subscribe to get initial playlist from persistent records
    this.room.collection('playlist').subscribe((playlists) => {
      if (playlists.length > 0) {
        const latestPlaylist = playlists[0]; // Get most recent playlist
        this.channels = this.parseM3U(latestPlaylist.content);
        this.validateChannels();
        
        // Save to localStorage as backup
        localStorage.setItem('global_playlist', JSON.stringify({
          content: latestPlaylist.content,
          updatedAt: Date.now()
        }));
      }
    });
  }

  async loadChannels(m3uContent) {
    try {
      // Parse and validate channels first
      this.channels = this.parseM3U(m3uContent);
      await this.validateChannels();

      // Store in localStorage as backup
      localStorage.setItem('global_playlist', JSON.stringify({
        content: m3uContent,
        updatedAt: Date.now()
      }));

      // Store playlist in persistent records for new clients
      await this.room.collection('playlist').create({
        content: m3uContent,
      });

      // Broadcast update to all connected clients in real-time
      this.room.send({
        type: 'playlist_update',
        content: m3uContent,
        username: this.room.party.client.username
      });

      return this.channels;
    } catch (error) {
      console.error('Error loading channels:', error);
      throw error;
    }
  }

  async loadSavedPlaylist() {
    try {
      // First try to get playlist from WebsimSocket persistent records
      const playlists = await this.room.collection('playlist').getList();
      if (playlists.length > 0) {
        const latestPlaylist = playlists[0];
        this.channels = this.parseM3U(latestPlaylist.content);
        await this.validateChannels();
        return this.channels;
      }
      
      // Fallback to localStorage if no playlist in persistent records
      const savedPlaylistData = localStorage.getItem('global_playlist');
      if (savedPlaylistData) {
        const playlistData = JSON.parse(savedPlaylistData);
        this.channels = this.parseM3U(playlistData.content);
        await this.validateChannels();
        return this.channels;
      }
    } catch (error) {
      console.error('Error loading saved playlist:', error);
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
        
        // If name is still not set, provide a default using the raw name
        if (!currentChannel.name || currentChannel.name === 'undefined') {
          const rawName = match ? match[2] : 'Canal sem nome';
          currentChannel.name = rawName;
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