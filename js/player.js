export class Player {
  constructor() {
    this.videoElement = document.getElementById('video');
    this.hls = null;
    this.initVideo();
  }

  initVideo() {
    // Set default properties
    this.videoElement.playsInline = true;
    this.videoElement.controls = true;
    
    // Add error handling
    this.videoElement.addEventListener('error', (e) => {
      console.error('Video error:', this.videoElement.error);
      this.handleVideoError(e);
    });
  }

  handleVideoError(error) {
    console.log('Handling video error, attempting recovery...');
    if (this.hls) {
      if (this.hls.media && this.hls.media.error) {
        this.hls.recoverMediaError();
      } else {
        this.hls.startLoad();
      }
    }
  }

  async play(streamUrl) {
    try {
      // Stop any existing playback
      this.stop();

      console.log('Attempting to play:', streamUrl);

      // Try to detect the content type
      let contentType;
      try {
        const response = await fetch(streamUrl, { method: 'HEAD' });
        contentType = response.headers.get('content-type');
      } catch (error) {
        console.log('Could not determine content type, attempting playback anyway');
      }

      // Handle different types of content
      if (contentType && contentType.includes('video/mp4')) {
        // Direct video file
        this.videoElement.src = streamUrl;
        return this.videoElement.play();
      } else if (Hls.isSupported()) {
        // HLS stream
        console.log('Using HLS.js');
        this.hls = new Hls({
          debug: false,
          enableWorker: true,
          lowLatencyMode: true,
          backBufferLength: 90,
          maxBufferLength: 30,
          maxMaxBufferLength: 60,
          maxBufferSize: 60 * 1000 * 1000, // 60MB
          maxBufferHole: 0.5,
          liveSyncDurationCount: 3,
          liveMaxLatencyDurationCount: 10,
          progressive: true
        });

        return new Promise((resolve, reject) => {
          this.hls.loadSource(streamUrl);
          this.hls.attachMedia(this.videoElement);
          
          this.hls.on(Hls.Events.MANIFEST_PARSED, () => {
            console.log('HLS manifest parsed, attempting playback');
            this.videoElement.play()
              .then(resolve)
              .catch(err => {
                console.error('Play failed, trying alternative method:', err);
                // Try alternative playback method
                this.tryAlternativePlayback(streamUrl).then(resolve).catch(reject);
              });
          });
          
          this.hls.on(Hls.Events.ERROR, (event, data) => {
            if (data.fatal) {
              switch(data.type) {
                case Hls.ErrorTypes.NETWORK_ERROR:
                  console.log('Network error - attempting to recover');
                  this.hls.startLoad();
                  break;
                case Hls.ErrorTypes.MEDIA_ERROR:
                  console.log('Media error - attempting to recover');
                  this.hls.recoverMediaError();
                  break;
                default:
                  this.tryAlternativePlayback(streamUrl).then(resolve).catch(reject);
                  break;
              }
            }
          });
        });
      } 
      // Native HLS support (Safari)
      else if (this.videoElement.canPlayType('application/vnd.apple.mpegurl')) {
        console.log('Using native HLS support');
        this.videoElement.src = streamUrl;
        return this.videoElement.play();
      }
      else {
        return this.tryAlternativePlayback(streamUrl);
      }
    } catch (error) {
      console.error('Error in play():', error);
      throw error;
    }
  }

  async tryAlternativePlayback(streamUrl) {
    console.log('Trying alternative playback method');
    return new Promise((resolve, reject) => {
      // Try direct playback
      this.videoElement.src = streamUrl;
      this.videoElement.load();
      
      const playPromise = this.videoElement.play();
      if (playPromise) {
        playPromise.then(resolve).catch(reject);
      } else {
        reject(new Error('Playback not supported'));
      }
    });
  }

  stop() {
    try {
      if (this.videoElement) {
        this.videoElement.pause();
      }
      if (this.hls) {
        this.hls.destroy();
        this.hls = null;
      }
      if (this.videoElement) {
        this.videoElement.removeAttribute('src');
        this.videoElement.load();
      }
    } catch (error) {
      console.error('Error stopping playback:', error);
    }
  }
}