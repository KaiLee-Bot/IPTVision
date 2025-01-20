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
  }

  async play(streamUrl) {
    try {
      // Stop any existing playback
      this.stop();

      console.log('Attempting to play:', streamUrl); // Debug log

      if (Hls.isSupported()) {
        console.log('HLS is supported');
        this.hls = new Hls({
          debug: false,
          enableWorker: true,
          lowLatencyMode: true,
          backBufferLength: 90
        });

        this.hls.loadSource(streamUrl);
        this.hls.attachMedia(this.videoElement);
        
        return new Promise((resolve, reject) => {
          this.hls.on(Hls.Events.MANIFEST_PARSED, () => {
            console.log('Manifest parsed, attempting playback');
            this.videoElement.play()
              .then(() => {
                console.log('Playback started successfully');
                resolve();
              })
              .catch(err => {
                console.error('Error during play():', err);
                reject(err);
              });
          });
          
          this.hls.on(Hls.Events.ERROR, (event, data) => {
            console.error('HLS error:', data);
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
                  reject(new Error('Fatal streaming error'));
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
        throw new Error('HLS playback not supported on this device');
      }
    } catch (error) {
      console.error('Error in play():', error);
      throw error;
    }
  }

  stop() {
    if (this.hls) {
      this.hls.destroy();
      this.hls = null;
    }
    this.videoElement.removeAttribute('src');
    this.videoElement.load();
  }
}