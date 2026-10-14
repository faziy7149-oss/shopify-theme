/* global YT, Vimeo */

if (!customElements.get('video-component')) {
  class Video extends HTMLElement {
    constructor() {
      super();
      this.autoplay = this.dataset.autoplay === 'true';
      this.background = this.dataset.background === 'true';
      this.naturalWidth = this.dataset.naturalWidth === 'true';
    }

    connectedCallback() {
      this.init();
    }

    init() {
      const url = this.dataset.videoUrl;

      if (url) {
        if (url.includes('youtu.be') || url.includes('youtube.com')) {
          if (url.includes('v=')) {
            this.videoId = url.split('v=').pop().split('&')[0];
          } else {
            this.videoId = url.split('?')[0].split('/').pop();
          }

          this.type = 'youtube';
          this.initYouTube();
        } else if (url.includes('vimeo.com')) {
          this.videoId = url.split('?')[0].split('/').pop();
          this.type = 'vimeo';
          this.initVimeo();
        }
      } else {
        this.type = 'tag';
        this.initVideoTag();
      }

      // Allow for videos which haven't played to play on tap
      if (this.background) {
        this.closest('.video-section').addEventListener('click', this.play.bind(this));
      }
    }

    /**
     * Loads a player API script.
     * @param {string} src - Url of script to load.
     */
    loadScript(src) {
      if (document.querySelector(`script[src="${src}"]`)) return;

      const s = document.createElement('script');
      s.src = src;
      s.onerror = (err) => console.warn(`Unable to load script ${src}`, err);  // eslint-disable-line

      if (this.type === 'vimeo') {
        s.onload = () => document.dispatchEvent(new CustomEvent('on:vimeo-api:loaded'));
      } else if (this.type === 'youtube') {
        window.onYouTubeIframeAPIReady = () => document.dispatchEvent(new CustomEvent('on:youtube-api:loaded'));
      }

      document.body.appendChild(s);
    }

    /**
     * Initialises a YouTube video.
     */
    initYouTube() {
      const initYTPlayer = () => {
        YT.ready(() => {
          this.player = new YT.Player(this.querySelector('div'), {
            videoId: this.videoId,
            width: '1280',
            height: '720',
            playerVars: {
              controls: this.background ? 0 : 1,
              disablekb: this.background ? 1 : 0,
              iv_load_policy: 3,
              modestbranding: 1,
              playsinline: 1,
              rel: 0
            },
            events: {
              onReady: this.handleYTReady.bind(this),
              onStateChange: this.handleYTStateChange.bind(this)
            }
          });
        });
      };

      if (!window.YT) {
        document.addEventListener('on:youtube-api:loaded', initYTPlayer.bind(this));
        this.loadScript('//www.youtube.com/iframe_api');
      } else {
        initYTPlayer();
      }
    }

    /**
     * Initialises a Vimeo video.
     */
    initVimeo() {
      const initVimeoPlayer = async () => {
        this.player = new Vimeo.Player(this, {
          id: this.videoId,
          width: '1280',
          height: '720',
          autoplay: this.autoplay,
          background: this.background,
          keyboard: !this.background,
          muted: this.autoplay
        });

        await this.player.ready();
        this.setupIframe('js-vimeo');

        this.player.on('pause', () => {
          if (this.inViewport) this.pausedByUser = true;
        });

        this.player.on('play', () => {
          this.closest('.video-section').classList.add('video-section--played');
          this.dispatchEvent(new CustomEvent('on:media:play', {
            detail: {
              player: this.iframe
            },
            bubbles: true
          }));
        });

        this.play();
      };

      if (!window.Vimeo) {
        document.addEventListener('on:vimeo-api:loaded', initVimeoPlayer.bind(this));
        this.loadScript('//player.vimeo.com/api/player.js');
      } else {
        initVimeoPlayer();
      }
    }

    /**
     * Initialises a video tag.
     */
    initVideoTag() {
      this.player = this.querySelector('video');

      this.player.addEventListener('pause', () => {
        if (this.inViewport) this.pausedByUser = true;
        // ========== 修改开始：暂停时停止结尾检测 ==========
        this.stopFreezeWatch();
        // ========== 修改结束：暂停时停止结尾检测 ==========
      });

      this.player.addEventListener('play', () => {
        // ========== 修改开始：从最后一帧点击播放时重头播放 ==========
        if (this.frozenOnLastFrame) {
          this.frozenOnLastFrame = false;
          this.player.currentTime = 0;
        }
        // ========== 修改结束：从最后一帧点击播放时重头播放 ==========

        // ========== 修改开始：仅非循环视频开启结尾冻结检测 ==========
        // background-video / loop 视频保持原生循环，不冻结最后一帧
        if (this.shouldFreezeOnLastFrame()) {
          this.startFreezeWatch();
        }
        // ========== 修改结束：仅非循环视频开启结尾冻结检测 ==========

        this.dispatchEvent(new CustomEvent('on:media:play', {
          detail: {
            player: this.player
          },
          bubbles: true
        }));
      });

      // ========== 原代码开始（ended 后再回退，会有黑屏闪回）==========
      // this.player.addEventListener('ended', () => {
      //   this.freezeOnLastFrame();
      // });
      // ========== 原代码结束（ended 后再回退，会有黑屏闪回）==========

      // ========== 修改开始：结束前暂停，避免 ended 黑屏闪回 ==========
      // 仅对「不循环」的 Video section 生效；background-video（loop）不受影响
      if (this.shouldFreezeOnLastFrame()) {
        this.player.addEventListener('timeupdate', () => {
          this.tryFreezeBeforeEnd();
        });
      }
      // ========== 修改结束：结束前暂停，避免 ended 黑屏闪回 ==========

      // If the video is already playing
      if (this.player.currentTime > 0 && !this.player.paused && !this.player.ended
        && this.player.readyState > 2) {
        this.closest('.video-section').classList.add('video-section--played');
      } else {
        this.player.addEventListener('play', () => {
          this.closest('.video-section').classList.add('video-section--played');
        });

        this.addObserver(this.player);

        // Mute the video if a click didn't trigger its load
        const deferredMedia = this.closest('deferred-media');
        if (!deferredMedia || deferredMedia.loadTrigger !== 'click') {
          this.player.muted = true;
        }

        this.play();
      }
    }

    // ========== 原代码开始（ended 后 seek 回退，会造成黑屏闪回）==========
    // freezeOnLastFrame() {
    //   if (!this.player || this.type !== 'tag') return;
    //   const duration = this.player.duration;
    //   if (!Number.isFinite(duration) || duration <= 0) return;
    //   this.frozenOnLastFrame = true;
    //   this.player.currentTime = Math.max(0, duration - 0.05);
    //   this.player.pause();
    // }
    // ========== 原代码结束（ended 后 seek 回退，会造成黑屏闪回）==========

    // ========== 修改开始：结束前冻结最后一帧（不触发 ended）==========
    /**
     * Only freeze for click-to-play videos, not background/looping videos.
     */
    shouldFreezeOnLastFrame() {
      return !this.background && this.player && !this.player.loop;
    }

    /**
     * Starts a rAF loop for finer end detection than timeupdate alone.
     */
    startFreezeWatch() {
      if (!this.shouldFreezeOnLastFrame()) return;

      this.stopFreezeWatch();
      const tick = () => {
        this.tryFreezeBeforeEnd();
        if (!this.frozenOnLastFrame && this.player && !this.player.paused) {
          this.freezeWatchRaf = requestAnimationFrame(tick);
        }
      };
      this.freezeWatchRaf = requestAnimationFrame(tick);
    }

    /**
     * Stops the rAF end-detection loop.
     */
    stopFreezeWatch() {
      if (this.freezeWatchRaf) {
        cancelAnimationFrame(this.freezeWatchRaf);
        this.freezeWatchRaf = null;
      }
    }

    /**
     * Pauses just before the end so the last frame stays visible without a black flash.
     */
    tryFreezeBeforeEnd() {
      if (!this.shouldFreezeOnLastFrame()) return;
      if (this.frozenOnLastFrame || !this.player || this.type !== 'tag' || this.player.paused) return;

      const duration = this.player.duration;
      if (!Number.isFinite(duration) || duration <= 0) return;

      // 在真正结束前暂停，避免浏览器清空画面缓冲导致黑屏闪回
      if (duration - this.player.currentTime <= 0.12) {
        this.frozenOnLastFrame = true;
        this.stopFreezeWatch();
        this.player.pause();
      }
    }
    // ========== 修改结束：结束前冻结最后一帧（不触发 ended）==========

    /**
     * Handles a YouTube ready event.
     */
    handleYTReady() {
      this.setupIframe('js-youtube');

      if (this.autoplay) this.player.mute();
      this.play();
    }

    /**
     * Handles a YouTube state change event.
     * @param {object} e - Event object.
     */
    handleYTStateChange(e) {
      if (e.data === YT.PlayerState.PAUSED) {
        if (this.inViewport) this.pausedByUser = true;
      } else if (e.data === YT.PlayerState.ENDED) {
        // ========== 原代码开始 ==========
        // // Looping this way rather than 'loop' API parameter to avoid flash of black background
        // if (this.background) this.player.playVideo();
        // ========== 原代码结束 ==========

        // ========== 修改开始：YouTube 播放结束停留在最后一帧 ==========
        // Looping this way rather than 'loop' API parameter to avoid flash of black background
        if (this.background) {
          this.player.playVideo();
        } else {
          // Stay near the end instead of YouTube's black end screen
          const duration = this.player.getDuration();
          if (Number.isFinite(duration) && duration > 0) {
            this.frozenOnLastFrame = true;
            this.player.seekTo(Math.max(0, duration - 0.1), true);
            this.player.pauseVideo();
          }
        }
        // ========== 修改结束：YouTube 播放结束停留在最后一帧 ==========
      } else if (e.data === YT.PlayerState.PLAYING) {
        // ========== 修改开始：YouTube 从最后一帧点击播放时重头播放 ==========
        if (this.frozenOnLastFrame) {
          this.frozenOnLastFrame = false;
          this.player.seekTo(0, true);
        }
        // ========== 修改结束：YouTube 从最后一帧点击播放时重头播放 ==========

        this.closest('.video-section').classList.add('video-section--played');
        this.dispatchEvent(new CustomEvent('on:media:play', {
          detail: {
            player: this.iframe
          },
          bubbles: true
        }));
      }
    }

    /**
     * Sets up the injected iframe.
     * @param {string} jsClass - Class name to add to the iframe.
     */
    setupIframe(jsClass) {
      // Enable iframe to cover entire container height.
      if (this.autoplay && !this.naturalWidth) {
        this.style.width = `${this.clientHeight * 1.7778}px`;

        window.addEventListener('resize', window.debounce(() => {
          this.style.width = `${this.clientHeight * 1.7778}px`;
        }, 200));
      }

      this.iframe = this.querySelector('iframe');
      this.iframe.title = this.dataset.description;
      this.iframe.classList.add(jsClass);
      this.addObserver(this.iframe);
    }

    /**
     * Plays the video when scrolled into view (if not paused by the user).
     */
    play() {
      if (!this.player || this.pausedByUser) return;

      if (this.type === 'youtube') {
        this.player.playVideo();
      } else {
        this.player.play();
      }
    }

    /**
     * Pauses the video when scrolled out of view (if playing).
     */
    pause() {
      if (!this.player) return;

      if (this.type === 'youtube') {
        if (this.player.getPlayerState() !== 2) {
          this.player.pauseVideo();
          this.pausedByUser = false;
        }
      } else if (this.type === 'vimeo') {
        this.player.getPaused().then((paused) => {
          if (!paused) {
            this.player.pause();
            this.pausedByUser = false;
          }
        });
      } else if (!this.player.paused) {
        this.player.pause();
        this.pausedByUser = false;
      }
    }

    /**
     * Adds an observer to pause the video when not in the viewport.
     * @param {Element} el - Element to observe.
     */
    addObserver(el) {
      if ('IntersectionObserver' in window === false) return;

      const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            this.inViewport = true;
            this.play();
          } else {
            this.inViewport = false;
            this.pause();
          }
        }, { rootMargin: '0px 0px 200px 0px' });
      });

      observer.observe(el);
    }
  }

  customElements.define('video-component', Video);
}
