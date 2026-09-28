/**
 * AudioService — Real Mobile Audio Engine with Queue, Shuffle, Repeat, MediaSession, and Web Audio.
 */
class AudioService {
  constructor(equalizerService = null) {
    this.audioElement = null;
    this.equalizer = equalizerService;
    this.listeners = new Map();

    // Player State
    this.currentTrack = null;
    this.currentTime = 0;
    this.duration = 0;
    this.isPlaying = false;
    this.isLoading = false;
    this.isShuffle = false;
    this.repeatMode = 'all'; // 'off' | 'all' | 'one'
    this.queue = [];
    this.queueIndex = 0;
    this.shuffledOrder = [];
    this.volume = 1.0;
    this.isCrossfade = true;
    this.playbackRate = 1.0;

    this._boundOnTimeUpdate = this._onTimeUpdate.bind(this);
    this._boundOnLoadedMetadata = this._onLoadedMetadata.bind(this);
    this._boundOnEnded = this._onEnded.bind(this);
    this._boundOnPlay = this._onPlay.bind(this);
    this._boundOnPause = this._onPause.bind(this);
    this._boundOnError = this._onError.bind(this);
    this._boundOnWaiting = this._onWaiting.bind(this);
    this._boundOnPlaying = this._onPlaying.bind(this);
  }

  init(element) {
    this.audioElement = element || (typeof document !== 'undefined' ? document.getElementById('nativeAudioElement') : null);
    if (!this.audioElement && typeof Audio !== 'undefined') {
      this.audioElement = new Audio();
      this.audioElement.id = 'nativeAudioElement';
      this.audioElement.preload = 'auto';
      if (typeof document !== 'undefined') {
        document.body.appendChild(this.audioElement);
      }
    }

    if (!this.audioElement) return;

    // Ensure maximum clear native hardware audio volume
    this.audioElement.volume = this.volume;
    this.audioElement.muted = false;

    // Attach native HTML5 audio listeners
    this.audioElement.addEventListener('timeupdate', this._boundOnTimeUpdate);
    this.audioElement.addEventListener('loadedmetadata', this._boundOnLoadedMetadata);
    this.audioElement.addEventListener('durationchange', this._boundOnLoadedMetadata);
    this.audioElement.addEventListener('ended', this._boundOnEnded);
    this.audioElement.addEventListener('play', this._boundOnPlay);
    this.audioElement.addEventListener('pause', this._boundOnPause);
    this.audioElement.addEventListener('error', this._boundOnError);
    this.audioElement.addEventListener('waiting', this._boundOnWaiting);
    this.audioElement.addEventListener('playing', this._boundOnPlaying);

    if (this.equalizer) {
      this.equalizer.init(this.audioElement);
    }

    this._setupMediaSession();
  }

  // --- Event Dispatching ---
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);
    return () => this.listeners.get(event)?.delete(callback);
  }

  emit(event, data) {
    const handlers = this.listeners.get(event);
    if (handlers) {
      handlers.forEach(fn => {
        try { fn(data); } catch (e) { console.error('AudioService listener error:', e); }
      });
    }
  }

  // --- Native Event Handlers ---
  _onTimeUpdate() {
    if (!this.audioElement) return;
    this.currentTime = Math.floor(this.audioElement.currentTime);
    if (this.audioElement.duration && !isNaN(this.audioElement.duration) && isFinite(this.audioElement.duration)) {
      this.duration = Math.floor(this.audioElement.duration);
    }
    this.emit('timeupdate', { currentTime: this.currentTime, duration: this.duration });
  }

  _onLoadedMetadata() {
    if (!this.audioElement) return;
    if (this.audioElement.duration && !isNaN(this.audioElement.duration) && isFinite(this.audioElement.duration)) {
      const detected = Math.floor(this.audioElement.duration);
      if (detected > 2 && detected < 3600) {
        this.duration = detected;
        if (this.currentTrack) {
          if (!this.currentTrack.duration || Math.abs(detected - this.currentTrack.duration) < 30) {
            this.currentTrack.duration = detected;
          }
        }
      }
    }
    this.isLoading = false;
    this.emit('loadedmetadata', { duration: this.duration });
  }

  _onPlay() {
    this.isPlaying = true;
    this.isLoading = false;
    this._updateMediaSessionPlaybackState('playing');
    this.emit('play', this.currentTrack);
  }

  _onPause() {
    this.isPlaying = false;
    this._updateMediaSessionPlaybackState('paused');
    this.emit('pause', this.currentTrack);
  }

  _onWaiting() {
    this.isLoading = true;
    this.emit('buffering', true);
  }

  _onPlaying() {
    this.isLoading = false;
    this.emit('buffering', false);
  }

  _onError(e) {
    this.isLoading = false;
    this.isPlaying = false;
    console.warn('Audio playback error:', e);
    this.emit('error', { error: e, track: this.currentTrack });
  }

  _onEnded() {
    if (this.repeatMode === 'one') {
      this.seek(0);
      this.play().catch(() => {});
    } else {
      this.skipNext(true); // advance automatically
    }
    this.emit('ended', this.currentTrack);
  }

  // --- Queue Management ---
  setQueue(tracks, startIndex = 0, playImmediately = true) {
    if (!Array.isArray(tracks) || tracks.length === 0) return;
    this.queue = [...tracks];
    this.queueIndex = Math.max(0, Math.min(this.queue.length - 1, startIndex));
    this._regenerateShuffleOrder();
    this.emit('queuechange', { queue: this.queue, index: this.queueIndex });

    const trackToPlay = this.queue[this.queueIndex];
    if (trackToPlay) {
      return this.loadTrack(trackToPlay, playImmediately);
    }
  }

  addToQueue(track) {
    if (!track) return;
    this.queue.push(track);
    this._regenerateShuffleOrder();
    this.emit('queuechange', { queue: this.queue, index: this.queueIndex });
  }

  playNextInQueue(track) {
    if (!track) return;
    this.queue.splice(this.queueIndex + 1, 0, track);
    this._regenerateShuffleOrder();
    this.emit('queuechange', { queue: this.queue, index: this.queueIndex });
  }

  removeFromQueue(index) {
    if (index < 0 || index >= this.queue.length) return;
    this.queue.splice(index, 1);
    if (index < this.queueIndex) {
      this.queueIndex--;
    } else if (index === this.queueIndex && this.queue.length > 0) {
      this.queueIndex = Math.min(this.queueIndex, this.queue.length - 1);
      this.loadTrack(this.queue[this.queueIndex], this.isPlaying);
    }
    this._regenerateShuffleOrder();
    this.emit('queuechange', { queue: this.queue, index: this.queueIndex });
  }

  clearUpcomingQueue() {
    if (this.queue.length > 0) {
      this.queue = [this.queue[this.queueIndex]];
      this.queueIndex = 0;
      this._regenerateShuffleOrder();
      this.emit('queuechange', { queue: this.queue, index: this.queueIndex });
    }
  }

  reorderQueue(fromIndex, toIndex) {
    if (fromIndex < 0 || fromIndex >= this.queue.length || toIndex < 0 || toIndex >= this.queue.length) return;
    const [moved] = this.queue.splice(fromIndex, 1);
    this.queue.splice(toIndex, 0, moved);
    if (this.queueIndex === fromIndex) {
      this.queueIndex = toIndex;
    } else if (fromIndex < this.queueIndex && toIndex >= this.queueIndex) {
      this.queueIndex--;
    } else if (fromIndex > this.queueIndex && toIndex <= this.queueIndex) {
      this.queueIndex++;
    }
    this._regenerateShuffleOrder();
    this.emit('queuechange', { queue: this.queue, index: this.queueIndex });
  }

  _regenerateShuffleOrder() {
    if (!this.isShuffle || this.queue.length === 0) {
      this.shuffledOrder = this.queue.map((_, i) => i);
      return;
    }
    const currentIdx = (this.queueIndex >= 0 && this.queueIndex < this.queue.length) ? this.queueIndex : 0;
    const otherIndices = this.queue.map((_, i) => i).filter(i => i !== currentIdx);
    for (let i = otherIndices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [otherIndices[i], otherIndices[j]] = [otherIndices[j], otherIndices[i]];
    }
    this.shuffledOrder = [currentIdx, ...otherIndices];
  }

  // --- Track Loading and Control ---
  async loadTrack(track, autoPlay = true, startPosition = 0) {
    if (!track) return;
    this.currentTrack = track;
    this.currentTime = startPosition;
    this.duration = track.duration || 90;
    this.isLoading = true;

    if (this.equalizer) {
      this.equalizer.ensureContextRunning();
    }

    if (this.audioElement) {
      const src = track.getPlayableSource ? track.getPlayableSource() : (track.localUri || track.audioSrc);
      const curSrc = this.audioElement.src || '';
      if (!curSrc || !curSrc.endsWith(src)) {
        this.audioElement.src = src;
        this.audioElement.currentTime = startPosition;
      }
      this.audioElement.volume = this.volume;
      this.audioElement.muted = false;
    }

    this._updateMediaSessionMetadata(track);
    this.emit('trackchange', track);

    if (autoPlay) {
      await this.play();
    }
  }

  async play() {
    if (!this.audioElement) return;

    if (this.equalizer) {
      this.equalizer.ensureContextRunning();
    }

    try {
      if (!this.audioElement.src && this.currentTrack) {
        const src = this.currentTrack.getPlayableSource ? this.currentTrack.getPlayableSource() : (this.currentTrack.localUri || this.currentTrack.audioSrc);
        this.audioElement.src = src;
      }

      this.audioElement.volume = this.volume;
      this.audioElement.muted = false;

      await this.audioElement.play();
      this.isPlaying = true;
      this.emit('play', this.currentTrack);
    } catch (err) {
      console.warn('Playback play() was blocked or failed:', err);
      this.isPlaying = false;
      this.emit('error', { error: err, track: this.currentTrack });
    }
  }

  pause() {
    if (!this.audioElement) return;
    this.audioElement.pause();
    this.isPlaying = false;
    this.emit('pause', this.currentTrack);
  }

  stop() {
    if (!this.audioElement) return;
    this.audioElement.pause();
    this.seek(0);
    this.isPlaying = false;
    this.emit('stop', this.currentTrack);
  }

  toggleMute() {
    if (!this.audioElement) return false;
    this.audioElement.muted = !this.audioElement.muted;
    this.emit('mutechange', this.audioElement.muted);
    return this.audioElement.muted;
  }

  togglePlay() {
    if (this.isPlaying) {
      this.pause();
    } else {
      this.play();
    }
  }

  seek(targetSeconds) {
    if (!this.audioElement) return;
    const clamped = Math.max(0, Math.min(this.duration || 90, targetSeconds));
    this.audioElement.currentTime = clamped;
    this.currentTime = Math.floor(clamped);
    this.emit('timeupdate', { currentTime: this.currentTime, duration: this.duration });
  }

  skipNext(isAuto = false) {
    if (this.queue.length === 0) return;

    if (this.repeatMode === 'one' && isAuto) {
      this.seek(0);
      this.play().catch(() => {});
      return;
    }

    let nextIndex;
    if (this.isShuffle) {
      const currentPosInShuffle = this.shuffledOrder.indexOf(this.queueIndex);
      const nextPos = currentPosInShuffle + 1;
      if (nextPos >= this.shuffledOrder.length) {
        if (this.repeatMode === 'all') {
          nextIndex = this.shuffledOrder[0];
        } else {
          // Reached end of shuffled queue without repeat
          this.pause();
          this.seek(0);
          return;
        }
      } else {
        nextIndex = this.shuffledOrder[nextPos];
      }
    } else {
      nextIndex = this.queueIndex + 1;
      if (nextIndex >= this.queue.length) {
        if (this.repeatMode === 'all') {
          nextIndex = 0;
        } else {
          // Reached end of queue without repeat
          this.pause();
          this.seek(0);
          return;
        }
      }
    }

    this.queueIndex = nextIndex;
    this.emit('queuechange', { queue: this.queue, index: this.queueIndex });
    this.loadTrack(this.queue[this.queueIndex], true);
  }

  skipPrevious() {
    if (this.queue.length === 0) return;

    // If more than 3 seconds in, restart track
    if (this.currentTime > 3) {
      this.seek(0);
      return;
    }

    let prevIndex;
    if (this.isShuffle) {
      const currentPosInShuffle = this.shuffledOrder.indexOf(this.queueIndex);
      const prevPos = (currentPosInShuffle - 1 + this.shuffledOrder.length) % this.shuffledOrder.length;
      prevIndex = this.shuffledOrder[prevPos];
    } else {
      prevIndex = this.queueIndex - 1;
      if (prevIndex < 0) {
        prevIndex = this.queue.length - 1;
      }
    }

    this.queueIndex = prevIndex;
    this.emit('queuechange', { queue: this.queue, index: this.queueIndex });
    this.loadTrack(this.queue[this.queueIndex], true);
  }

  toggleShuffle() {
    this.isShuffle = !this.isShuffle;
    this._regenerateShuffleOrder();
    this.emit('shufflechange', this.isShuffle);
    return this.isShuffle;
  }

  toggleRepeat() {
    // Cycle: 'all' -> 'one' -> 'off' -> 'all'
    if (this.repeatMode === 'all') {
      this.repeatMode = 'one';
    } else if (this.repeatMode === 'one') {
      this.repeatMode = 'off';
    } else {
      this.repeatMode = 'all';
    }
    this.emit('repeatchange', this.repeatMode);
    return this.repeatMode;
  }

  setVolume(vol) {
    this.volume = Math.max(0, Math.min(1, vol));
    if (this.audioElement) {
      this.audioElement.volume = this.volume;
      this.audioElement.muted = false;
    }
    this.emit('volumechange', this.volume);
  }

  setPlaybackRate(rate) {
    this.playbackRate = Math.max(0.5, Math.min(2.0, rate));
    if (this.audioElement) {
      this.audioElement.playbackRate = this.playbackRate;
    }
    this.emit('ratechange', this.playbackRate);
  }

  // --- System Lockscreen / MediaSession API ---
  _setupMediaSession() {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;

    try {
      navigator.mediaSession.setActionHandler('play', () => this.play());
      navigator.mediaSession.setActionHandler('pause', () => this.pause());
      navigator.mediaSession.setActionHandler('previoustrack', () => this.skipPrevious());
      navigator.mediaSession.setActionHandler('nexttrack', () => this.skipNext());
      navigator.mediaSession.setActionHandler('seekto', (details) => {
        if (details.seekTime !== null && details.seekTime !== undefined) {
          this.seek(details.seekTime);
        }
      });
      navigator.mediaSession.setActionHandler('seekbackward', (details) => {
        const offset = details.seekOffset || 10;
        this.seek(this.currentTime - offset);
      });
      navigator.mediaSession.setActionHandler('seekforward', (details) => {
        const offset = details.seekOffset || 10;
        this.seek(this.currentTime + offset);
      });
      navigator.mediaSession.setActionHandler('stop', () => {
        this.pause();
        this.seek(0);
      });
    } catch (e) {
      console.warn('MediaSession setup note:', e);
    }
  }

  _updateMediaSessionMetadata(track) {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator) || !track) return;
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: track.title,
        artist: track.artist,
        album: track.album,
        artwork: [
          { src: track.cover, sizes: '512x512', type: 'image/jpeg' },
          { src: track.cover, sizes: '256x256', type: 'image/jpeg' }
        ]
      });
    } catch (e) {}
  }

  _updateMediaSessionPlaybackState(state) {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
    try {
      navigator.mediaSession.playbackState = state;
    } catch (e) {}
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = AudioService;
}
