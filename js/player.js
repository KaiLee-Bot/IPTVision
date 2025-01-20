export class Player {
  constructor() {
    this.videoElement = document.getElementById('video');
    this.hls = null;
  }

  async play(streamUrl) {
    if (this.hls) {
      this.hls.destroy();
    }

    if (Hls.isSupported()) {
      this.hls = new Hls();
      this.hls.loadSource(streamUrl);
      this.hls.attachMedia(this.videoElement);
      
      return new Promise((resolve, reject) => {
        this.hls.on(Hls.Events.MANIFEST_PARSED, () => {
          this.videoElement.play()
            .then(resolve)
            .catch(reject);
        });
        
        this.hls.on(Hls.Events.ERROR, (event, data) => {
          if (data.fatal) {
            reject(new Error('Stream loading failed'));
          }
        });
      });
    } 
    // Fallback for native HLS support (Safari)
    else if (this.videoElement.canPlayType('application/vnd.apple.mpegurl')) {
      this.videoElement.src = streamUrl;
      return this.videoElement.play();
    }
    else {
      throw new Error('HLS not supported');
    }
  }

  stop() {
    if (this.hls) {
      this.hls.destroy();
      this.hls = null;
    }
    this.videoElement.src = '';
  }
}