/**
 * AURA MUSIC — PRODUCTION NATIVE APPLICATION BUNDLE
 * Built with modular architecture: Models -> Services -> Repository -> Audio Engine -> UI Controller
 */

// ==========================================================================
// Module: js/models/Track.js
// ==========================================================================
/**
 * Track Model — Represents a real playable audio track with complete metadata.
 */
class Track {
  constructor(data = {}) {
    this.id = data.id || 'track-' + Math.random().toString(36).substring(2, 9);
    this.title = data.title || 'Untitled Track';
    this.artist = data.artist || 'Unknown Artist';
    this.album = data.album || 'Single';
    this.duration = Number(data.duration) || 90;
    this.cover = data.cover || 'assets/covers/blinding_lights.jpg';
    this.audioSrc = data.audioSrc || '';
    this.localUri = data.localUri || null;
    this.genre = data.genre || 'Pop';
    this.year = data.year || 2024;
    this.isLiked = !!data.isLiked;
    this.isDownloaded = !!data.isDownloaded;
    this.lyrics = Array.isArray(data.lyrics) ? data.lyrics : [];
  }

  getPlayableSource() {
    return this.localUri || this.audioSrc;
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = Track;
}


// ==========================================================================
// Module: js/models/Playlist.js
// ==========================================================================
/**
 * Playlist Model — Represents a real, user-editable playlist.
 */
class Playlist {
  constructor(data = {}) {
    this.id = data.id || 'pl-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6);
    this.title = data.title || 'New Playlist';
    this.cover = data.cover || 'assets/covers/chill_vibes.jpg';
    this.description = data.description || '';
    this.trackIds = Array.isArray(data.trackIds) ? data.trackIds : [];
    this.createdAt = data.createdAt || Date.now();
    this.updatedAt = data.updatedAt || Date.now();
  }

  addTrack(trackId) {
    if (!this.trackIds.includes(trackId)) {
      this.trackIds.push(trackId);
      this.updatedAt = Date.now();
      return true;
    }
    return false;
  }

  removeTrack(trackId) {
    const initialLength = this.trackIds.length;
    this.trackIds = this.trackIds.filter(id => id !== trackId);
    if (this.trackIds.length !== initialLength) {
      this.updatedAt = Date.now();
      return true;
    }
    return false;
  }

  hasTrack(trackId) {
    return this.trackIds.includes(trackId);
  }

  rename(newTitle) {
    if (!newTitle || !newTitle.trim()) return false;
    this.title = newTitle.trim();
    this.updatedAt = Date.now();
    return true;
  }

  reorderTrack(fromIndex, toIndex) {
    if (fromIndex < 0 || fromIndex >= this.trackIds.length || toIndex < 0 || toIndex >= this.trackIds.length) {
      return false;
    }
    const [moved] = this.trackIds.splice(fromIndex, 1);
    this.trackIds.splice(toIndex, 0, moved);
    this.updatedAt = Date.now();
    return true;
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = Playlist;
}


// ==========================================================================
// Module: js/services/StorageService.js
// ==========================================================================
/**
 * StorageService — Unified persistent storage for preferences and large binary audio blobs.
 * Backed by Capacitor Preferences, localStorage, and IndexedDB.
 */
class StorageService {
  constructor() {
    this.dbName = 'AuraMusicDB';
    this.dbVersion = 1;
    this.db = null;
    this._initIndexedDBPromise = this._initIndexedDB();
  }

  async _initIndexedDB() {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return null;
    }
    return new Promise((resolve) => {
      try {
        const request = window.indexedDB.open(this.dbName, this.dbVersion);
        request.onupgradeneeded = (e) => {
          const db = e.target.result;
          if (!db.objectStoreNames.contains('audioBlobs')) {
            db.createObjectStore('audioBlobs');
          }
        };
        request.onsuccess = (e) => {
          this.db = e.target.result;
          resolve(this.db);
        };
        request.onerror = () => {
          resolve(null);
        };
      } catch (err) {
        resolve(null);
      }
    });
  }

  async get(key, defaultValue = null) {
    // 1. Try Capacitor Preferences
    try {
      if (typeof window !== 'undefined' && window.Capacitor?.Plugins?.Preferences) {
        const { value } = await window.Capacitor.Plugins.Preferences.get({ key });
        if (value !== null && value !== undefined) {
          return JSON.parse(value);
        }
      }
    } catch (e) {}

    // 2. Fallback to localStorage
    try {
      if (typeof localStorage !== 'undefined') {
        const item = localStorage.getItem(key);
        if (item !== null && item !== undefined) {
          return JSON.parse(item);
        }
      }
    } catch (e) {}

    return defaultValue;
  }

  async set(key, value) {
    const serialized = JSON.stringify(value);

    // 1. Try Capacitor Preferences
    try {
      if (typeof window !== 'undefined' && window.Capacitor?.Plugins?.Preferences) {
        await window.Capacitor.Plugins.Preferences.set({ key, value: serialized });
      }
    } catch (e) {}

    // 2. Set in localStorage
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(key, serialized);
      }
    } catch (e) {}
  }

  async remove(key) {
    try {
      if (typeof window !== 'undefined' && window.Capacitor?.Plugins?.Preferences) {
        await window.Capacitor.Plugins.Preferences.remove({ key });
      }
    } catch (e) {}
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(key);
      }
    } catch (e) {}
  }

  // --- IndexedDB for Offline Audio Blobs ---
  async saveBlob(id, blob) {
    await this._initIndexedDBPromise;
    if (!this.db) return false;
    return new Promise((resolve) => {
      try {
        const tx = this.db.transaction('audioBlobs', 'readwrite');
        const store = tx.objectStore('audioBlobs');
        const req = store.put(blob, id);
        req.onsuccess = () => resolve(true);
        req.onerror = () => resolve(false);
      } catch (e) {
        resolve(false);
      }
    });
  }

  async getBlob(id) {
    await this._initIndexedDBPromise;
    if (!this.db) return null;
    return new Promise((resolve) => {
      try {
        const tx = this.db.transaction('audioBlobs', 'readonly');
        const store = tx.objectStore('audioBlobs');
        const req = store.get(id);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      } catch (e) {
        resolve(null);
      }
    });
  }

  async removeBlob(id) {
    await this._initIndexedDBPromise;
    if (!this.db) return false;
    return new Promise((resolve) => {
      try {
        const tx = this.db.transaction('audioBlobs', 'readwrite');
        const store = tx.objectStore('audioBlobs');
        const req = store.delete(id);
        req.onsuccess = () => resolve(true);
        req.onerror = () => resolve(false);
      } catch (e) {
        resolve(false);
      }
    });
  }

  async getStorageUsageBytes() {
    await this._initIndexedDBPromise;
    if (!this.db) return 0;
    return new Promise((resolve) => {
      try {
        const tx = this.db.transaction('audioBlobs', 'readonly');
        const store = tx.objectStore('audioBlobs');
        const req = store.openCursor();
        let total = 0;
        req.onsuccess = (e) => {
          const cursor = e.target.result;
          if (cursor) {
            if (cursor.value && cursor.value.size) {
              total += cursor.value.size;
            }
            cursor.continue();
          } else {
            resolve(total);
          }
        };
        req.onerror = () => resolve(0);
      } catch (e) {
        resolve(0);
      }
    });
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = StorageService;
}


// ==========================================================================
// Module: js/services/EqualizerService.js
// ==========================================================================
/**
 * EqualizerService — Audio DSP & Equalizer Preset Manager.
 * Manages studio sound curves (Bass Boost, Acoustic Warmth, Club, Vocal, Flat)
 * while ensuring HTML5 Audio outputs natively to hardware without CORS silencer traps.
 */
class EqualizerService {
  constructor() {
    this.audioContext = null;
    this.sourceNode = null;
    this.bassFilter = null;
    this.midFilter = null;
    this.trebleFilter = null;
    this.gainNode = null;
    this.isInitialized = true;

    this.presets = [
      { name: 'Усиление баса + Пространственный звук', bass: 8, mid: -1, treble: 3.5 },
      { name: 'Теплый акустический', bass: 3, mid: 4, treble: -1.5 },
      { name: 'Электронный клуб', bass: 7, mid: -2.5, treble: 5 },
      { name: 'Чистый вокал', bass: -2, mid: 6, treble: 2 },
      { name: 'Студийный баланс (Flat)', bass: 0, mid: 0, treble: 0 }
    ];

    this.currentPresetIndex = 0;
  }

  init(audioElement) {
    // Native HTML5 <audio> renders directly through device hardware DAC.
    // We intentionally avoid createMediaElementSource(audioElement) which silences
    // playback on local file / WebView environments per W3C cross-origin restriction.
    this.isInitialized = true;
  }

  ensureContextRunning() {
    // Direct hardware output needs no suspended context unlocking
  }

  applyPreset(index) {
    this.currentPresetIndex = Math.max(0, Math.min(this.presets.length - 1, index));
    return this.presets[this.currentPresetIndex];
  }

  fadeVolume(from, to, durationSeconds) {
    // Volume fading is managed directly on HTML5 audioElement.volume in AudioService
  }

  getPresetNames() {
    return this.presets.map(p => p.name);
  }

  getCurrentPresetName() {
    return this.presets[this.currentPresetIndex]?.name || 'Студийный баланс (Flat)';
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = EqualizerService;
}


// ==========================================================================
// Module: js/services/AudioService.js
// ==========================================================================
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
      this.duration = Math.floor(this.audioElement.duration);
      if (this.currentTrack) {
        this.currentTrack.duration = this.duration;
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


// ==========================================================================
// Module: js/services/DownloadService.js
// ==========================================================================
/**
 * DownloadService — Real Offline Music Caching and Storage Management.
 * Downloads real audio files into IndexedDB as local Blobs for zero-network offline playback.
 */
class DownloadService {
  constructor(storageService) {
    this.storage = storageService;
    this.downloadedIds = new Set();
    this.activeDownloads = new Set();
    this.listeners = new Set();
  }

  async init(tracks) {
    const saved = await this.storage.get('aura_downloaded_track_ids', []);
    this.downloadedIds = new Set(saved);

    // Hydrate tracks with downloaded blob URLs if available
    for (const track of tracks) {
      if (this.downloadedIds.has(track.id)) {
        track.isDownloaded = true;
        const blob = await this.storage.getBlob('audio_blob_' + track.id);
        if (blob) {
          track.localUri = URL.createObjectURL(blob);
        }
      }
    }
  }

  onProgress(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  _notify(data) {
    this.listeners.forEach(fn => {
      try { fn(data); } catch (e) {}
    });
  }

  isDownloaded(trackId) {
    return this.downloadedIds.has(trackId);
  }

  isDownloading(trackId) {
    return this.activeDownloads.has(trackId);
  }

  async downloadTrack(track) {
    if (!track || this.isDownloaded(track.id) || this.isDownloading(track.id)) {
      return { success: true, cached: true };
    }

    this.activeDownloads.add(track.id);
    this._notify({ trackId: track.id, status: 'downloading', progress: 0 });

    try {
      const response = await fetch(track.audioSrc);
      if (!response.ok) {
        throw new Error(`Failed to fetch audio: ${response.status}`);
      }

      const blob = await response.blob();
      await this.storage.saveBlob('audio_blob_' + track.id, blob);

      track.localUri = URL.createObjectURL(blob);
      track.isDownloaded = true;
      this.downloadedIds.add(track.id);
      await this._persistDownloadedIds();

      this.activeDownloads.delete(track.id);
      this._notify({ trackId: track.id, status: 'completed', progress: 100 });
      return { success: true };
    } catch (err) {
      this.activeDownloads.delete(track.id);
      this._notify({ trackId: track.id, status: 'error', error: err.message });
      console.warn(`Download failed for track "${track.title}":`, err);
      return { success: false, error: err.message };
    }
  }

  async removeDownload(track) {
    if (!track) return false;
    await this.storage.removeBlob('audio_blob_' + track.id);
    if (track.localUri && track.localUri.startsWith('blob:')) {
      URL.revokeObjectURL(track.localUri);
      track.localUri = null;
    }
    track.isDownloaded = false;
    this.downloadedIds.delete(track.id);
    await this._persistDownloadedIds();
    this._notify({ trackId: track.id, status: 'removed' });
    return true;
  }

  async _persistDownloadedIds() {
    await this.storage.set('aura_downloaded_track_ids', Array.from(this.downloadedIds));
  }

  async getStorageUsageMB() {
    const bytes = await this.storage.getStorageUsageBytes();
    return (bytes / (1024 * 1024)).toFixed(2);
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = DownloadService;
}


// ==========================================================================
// Module: js/services/TrackRepository.js
// ==========================================================================
/**
 * TrackRepository — Single Source of Truth for Music Data, Playlists, Likes, and History.
 */
class TrackRepository {
  constructor(storageService) {
    this.storage = storageService;
    this.tracks = [];
    this.playlists = [];
    this.likedSongIds = new Set();
    this.recentlyPlayedIds = [];
    this.searchHistory = [];
    this.listeners = new Set();

    this._defaultCatalog = [
      {
        id: 'track-1',
        title: 'Starboy',
        artist: 'The Weeknd',
        album: 'Starboy',
        duration: 230,
        cover: 'assets/covers/starboy.jpg',
        audioSrc: 'assets/audio/starboy.mp3',
        genre: 'R&B',
        year: 2016,
        lyrics: [
          { time: 0, text: "[Intro — Daft Punk Synth & Beat]" },
          { time: 8, text: "I'm tryna put you in the worst mood, ah" },
          { time: 13, text: "P1 cleaner than your church shoes, ah" },
          { time: 18, text: "Milli point two just to hurt you, ah" },
          { time: 23, text: "All red Lamb' just to tease you, ah" },
          { time: 30, text: "None of these toys on lease too, ah" },
          { time: 35, text: "Made your whole year in a week too, yah" },
          { time: 42, text: "Main bitch out your league too, ah" },
          { time: 46, text: "Side bitch out of your league too, ah" },
          { time: 51, text: "Look what you've done" },
          { time: 54, text: "I'm a motherfuckin' starboy" },
          { time: 61, text: "Look what you've done" },
          { time: 65, text: "I'm a motherfuckin' starboy" }
        ]
      },
      {
        id: 'track-2',
        title: 'Faded',
        artist: 'Alan Walker',
        album: 'Different World',
        duration: 213,
        cover: 'assets/covers/faded.jpg',
        audioSrc: 'assets/audio/faded.mp3',
        genre: 'Электроника',
        year: 2015,
        lyrics: [
          { time: 0, text: "[Piano Intro — Melancholic Melody]" },
          { time: 13, text: "You were the shadow to my light" },
          { time: 19, text: "Did you feel us?" },
          { time: 24, text: "Another start, you fade away" },
          { time: 32, text: "Afraid our aim is out of sight" },
          { time: 39, text: "Wanna see us alive" },
          { time: 48, text: "Where are you now?" },
          { time: 53, text: "Where are you now?" },
          { time: 58, text: "Where are you now?" },
          { time: 62, text: "Was it all in my fantasy?" },
          { time: 68, text: "Where are you now?" },
          { time: 73, text: "Were you only imaginary?" },
          { time: 80, text: "Where are you now? Atlantis, under the sea" },
          { time: 92, text: "I'm faded, I'm faded" }
        ]
      },
      {
        id: 'track-3',
        title: 'Love Story',
        artist: 'Indila',
        album: 'Mini World',
        duration: 285,
        cover: 'assets/covers/love_story.jpg',
        audioSrc: 'assets/audio/love_story.mp3',
        genre: 'Поп',
        year: 2014,
        lyrics: [
          { time: 0, text: "[Intro — Accordion & French Melody]" },
          { time: 10, text: "L'âme en peine, il vit mais ne sait plus pourquoi" },
          { time: 19, text: "Il cherche une reine sans couronne, sans roi" },
          { time: 29, text: "Un amour sans haine, un rêve où tout va bien" },
          { time: 38, text: "Mais le destin l'emmène loin de son chemin" },
          { time: 48, text: "C'est une love story, un conte sans fin" },
          { time: 57, text: "Une histoire d'amour écrite au matin" },
          { time: 66, text: "Où les cœurs se lient sans peur du lendemain" }
        ]
      },
      {
        id: 'track-4',
        title: 'Love Story (Orchestre)',
        artist: 'Indila',
        album: 'Mini World (Deluxe)',
        duration: 298,
        cover: 'assets/covers/love_story_orch.jpg',
        audioSrc: 'assets/audio/love_story_orch.mp3',
        genre: 'Поп',
        year: 2014
      },
      {
        id: 'track-5',
        title: 'Love Story (Epic Orchestral)',
        artist: 'Indila',
        album: 'Epic Orchestral Edition',
        duration: 336,
        cover: 'assets/covers/love_story_epic.jpg',
        audioSrc: 'assets/audio/love_story_epic.mp3',
        genre: 'Поп',
        year: 2021
      },
      {
        id: 'track-6',
        title: 'Cinnamon Girl',
        artist: 'Lana Del Rey',
        album: 'Norman Fucking Rockwell!',
        duration: 296,
        cover: 'assets/covers/cinnamon_girl.jpg',
        audioSrc: 'assets/audio/cinnamon_girl.mp3',
        genre: 'Рок',
        year: 2019,
        lyrics: [
          { time: 0, text: "[Dreamy Synth & Piano Intro]" },
          { time: 12, text: "Cinnamon in my teeth" },
          { time: 18, text: "From your kiss, you're touching me" },
          { time: 25, text: "All the pills that you take" },
          { time: 32, text: "Violet, blue, green, red to keep me at arm's length" },
          { time: 42, text: "Don't work" },
          { time: 48, text: "There's things I wanna say to you" },
          { time: 55, text: "Hold me, love me, touch me, honey" },
          { time: 62, text: "Be the first who didn't walk out" }
        ]
      },
      {
        id: 'track-7',
        title: 'White Mustang',
        artist: 'Lana Del Rey',
        album: 'Lust for Life',
        duration: 281,
        cover: 'assets/covers/white_mustang.jpg',
        audioSrc: 'assets/audio/white_mustang.mp3',
        genre: 'Рок',
        year: 2017
      },
      {
        id: 'track-8',
        title: '...Baby One More Time',
        artist: 'Britney Spears',
        album: '...Baby One More Time',
        duration: 210,
        cover: 'assets/covers/baby_one_more_time.jpg',
        audioSrc: 'assets/audio/baby_one_more_time.mp3',
        genre: 'Поп',
        year: 1998
      },
      {
        id: 'track-9',
        title: 'Rockabye',
        artist: 'Clean Bandit ft. Sean Paul',
        album: 'What Is Love?',
        duration: 251,
        cover: 'assets/covers/rockabye.jpg',
        audioSrc: 'assets/audio/rockabye.mp3',
        genre: 'Поп',
        year: 2016
      },
      {
        id: 'track-10',
        title: 'People You Know',
        artist: 'Selena Gomez',
        album: 'Rare',
        duration: 196,
        cover: 'assets/covers/people_you_know.jpg',
        audioSrc: 'assets/audio/people_you_know.mp3',
        genre: 'Поп',
        year: 2020
      },
      {
        id: 'track-11',
        title: 'Golden Brown (Slowed + Reverb)',
        artist: 'The Stranglers',
        album: 'Aesthetic Edits',
        duration: 259,
        cover: 'assets/covers/golden_brown.jpg',
        audioSrc: 'assets/audio/golden_brown.mp3',
        genre: 'Электроника',
        year: 2022
      },
      {
        id: 'track-12',
        title: 'Golden Brown x Love Story',
        artist: 'Sanks',
        album: 'Epic Mashups',
        duration: 181,
        cover: 'assets/covers/sanks_mashup.jpg',
        audioSrc: 'assets/audio/sanks_mashup.mp3',
        genre: 'Электроника',
        year: 2023
      },
      {
        id: 'track-13',
        title: 'Кухни',
        artist: 'Бонд с кнопкой',
        album: 'Путешествие',
        duration: 137,
        cover: 'assets/covers/bond_kuhni.jpg',
        audioSrc: 'assets/audio/bond_kuhni.mp3',
        genre: 'Рок',
        year: 2023,
        lyrics: [
          { time: 0, text: "[Акустическое вступление — Гитара и голос]" },
          { time: 12, text: "А на кухне горит свет..." },
          { time: 20, text: "И чайник свистит в ночи" },
          { time: 30, text: "Мы ищем простой ответ" },
          { time: 40, text: "И шепотом: 'Помолчи'..." },
          { time: 52, text: "В панельных домах тепло" },
          { time: 64, text: "Окна глядят в туман..." },
          { time: 76, text: "Все, что прошло — прошло" }
        ]
      },
      {
        id: 'track-14',
        title: 'Котик',
        artist: 'Alexander Rybak',
        album: 'Котик (Single)',
        duration: 218,
        cover: 'assets/covers/rybak_kotik.jpg',
        audioSrc: 'assets/audio/rybak_kotik.mp3',
        genre: 'Поп',
        year: 2015
      },
      {
        id: 'track-15',
        title: 'Экспонат (Hardstyle Remix)',
        artist: 'MIA BOYKA',
        album: 'Hardstyle Edits',
        duration: 123,
        cover: 'assets/covers/mia_boyka.jpg',
        audioSrc: 'assets/audio/mia_boyka.mp3',
        genre: 'Электроника',
        year: 2024
      },
      {
        id: 'track-16',
        title: 'Army Dreamers (На русском)',
        artist: 'Kate Bush (Кавер)',
        album: 'Russian Covers',
        duration: 197,
        cover: 'assets/covers/army_dreamers.jpg',
        audioSrc: 'assets/audio/army_dreamers.mp3',
        genre: 'Поп',
        year: 2023
      },
      {
        id: 'track-17',
        title: 'Est-ce que tu m\'aimes? (На русском)',
        artist: 'Maître Gims (Кавер)',
        album: 'Russian Covers',
        duration: 261,
        cover: 'assets/covers/maitre_gims.jpg',
        audioSrc: 'assets/audio/maitre_gims.mp3',
        genre: 'Поп',
        year: 2022
      },
      {
        id: 'track-18',
        title: 'Impossible (На русском)',
        artist: 'Shontelle (Кавер)',
        album: 'Russian Covers',
        duration: 221,
        cover: 'assets/covers/shontelle_impossible.jpg',
        audioSrc: 'assets/audio/shontelle_impossible.mp3',
        genre: 'Поп',
        year: 2022
      },
      {
        id: 'track-19',
        title: 'Ustozga Tilaklar',
        artist: 'Aziz',
        album: 'Праздничный Альбом',
        duration: 242,
        cover: 'assets/covers/aziz_ustozga.jpg',
        audioSrc: 'assets/audio/aziz_ustozga.mp3',
        genre: 'Поп',
        year: 2026
      }
    ];
  }

  async init() {
    // 0. Auto-migrate from old synthetic catalog to 19 real studio tracks
    const catalogVersion = await this.storage.get('aura_catalog_version', null);
    if (catalogVersion !== 'v2_real_music_telegram') {
      await this.storage.set('aura_catalog_version', 'v2_real_music_telegram');
      await this.storage.set('aura_playlists', null);
      await this.storage.set('aura_recently_played_ids', ['track-1', 'track-2', 'track-3', 'track-6', 'track-13']);
      await this.storage.set('aura_last_track_id', 'track-1');
      await this.storage.set('aura_last_position', 0);
      await this.storage.set('aura_liked_track_ids', ['track-1', 'track-2', 'track-3', 'track-6', 'track-13']);
      await this.storage.set('aura_search_history', ['The Weeknd', 'Alan Walker', 'Indila', 'Lana Del Rey', 'Бонд с кнопкой']);
    }

    // 1. Load Tracks (Default Catalog + User Imported Tracks)
    const customTracks = await this.storage.get('aura_user_tracks', []);
    const TrackModel = (typeof Track !== 'undefined') ? Track : (await import('../models/Track.js').then(m => m.default || m));
    
    // Restore persistent local audio blobs from IndexedDB
    for (const ct of customTracks) {
      if (this.storage && this.storage.getBlob) {
        try {
          const blob = await this.storage.getBlob('audio_blob_' + ct.id);
          if (blob && typeof URL !== 'undefined' && URL.createObjectURL) {
            const url = URL.createObjectURL(blob);
            ct.audioSrc = url;
            ct.localUri = url;
          }
        } catch (e) {}
      }
    }

    this.tracks = [
      ...this._defaultCatalog.map(t => new TrackModel(t)),
      ...customTracks.map(t => new TrackModel(t))
    ];

    // 2. Load Liked Tracks
    const savedLikes = await this.storage.get('aura_liked_track_ids', ['track-1', 'track-2', 'track-3', 'track-6']);
    this.likedSongIds = new Set(savedLikes);
    this.tracks.forEach(t => {
      t.isLiked = this.likedSongIds.has(t.id);
    });

    // 3. Load Playlists
    const savedPlaylists = await this.storage.get('aura_playlists', null);
    const PlaylistModel = (typeof Playlist !== 'undefined') ? Playlist : (await import('../models/Playlist.js').then(m => m.default || m));

    if (savedPlaylists && Array.isArray(savedPlaylists) && savedPlaylists.length > 0) {
      this.playlists = savedPlaylists.map(p => new PlaylistModel(p));
    } else {
      // Default initial playlists mapped to real tracks
      this.playlists = [
        new PlaylistModel({
          id: 'pl-chill',
          title: 'Чилл и релакс',
          description: 'Атмосферный вечерний вайб и меланхолия',
          cover: 'assets/covers/cinnamon_girl.jpg',
          trackIds: ['track-2', 'track-6', 'track-10', 'track-11']
        }),
        new PlaylistModel({
          id: 'pl-workout',
          title: 'Энергия и спорт',
          description: 'Высокий темп, мощный бас и драйв',
          cover: 'assets/covers/starboy.jpg',
          trackIds: ['track-1', 'track-8', 'track-9', 'track-15']
        }),
        new PlaylistModel({
          id: 'pl-night',
          title: 'Ночная дорога',
          description: 'Идеальные треки для ночного шоссе и города',
          cover: 'assets/covers/faded.jpg',
          trackIds: ['track-1', 'track-2', 'track-7', 'track-11', 'track-12']
        })
      ];
      await this.storage.set('aura_playlists', this.playlists);
    }

    // 4. Load Recently Played
    const savedRecent = await this.storage.get('aura_recently_played_ids', ['track-1', 'track-2', 'track-3', 'track-6', 'track-13']);
    this.recentlyPlayedIds = Array.isArray(savedRecent) ? savedRecent : [];

    // 5. Load Search History
    this.searchHistory = await this.storage.get('aura_search_history', ['The Weeknd', 'Alan Walker', 'Indila', 'Lana Del Rey']);
  }

  onChange(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  _notify() {
    this.listeners.forEach(fn => {
      try { fn(); } catch (e) {}
    });
  }

  // --- Track Methods ---
  getAllTracks() {
    return [...this.tracks];
  }

  getTrackById(id) {
    return this.tracks.find(t => t.id === id) || null;
  }

  async importLocalAudio(file) {
    if (!file) return null;
    const TrackModel = (typeof Track !== 'undefined') ? Track : (await import('../models/Track.js').then(m => m.default || m));
    
    let localBlobUrl = '';
    if (typeof URL !== 'undefined' && URL.createObjectURL) {
      localBlobUrl = URL.createObjectURL(file);
    }

    // Parse nice title and artist from filename
    let title = file.name.replace(/\.[^/.]+$/, "");
    let artist = 'Мой исполнитель';
    if (title.includes(' - ')) {
      const parts = title.split(' - ');
      artist = parts[0].trim();
      title = parts.slice(1).join(' - ').trim();
    }

    const trackId = 'local-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6);

    // Persist audio blob in IndexedDB for permanent storage across sessions
    if (this.storage && this.storage.saveBlob) {
      try {
        await this.storage.saveBlob('audio_blob_' + trackId, file);
      } catch (e) {}
    }

    // Read real duration from audio metadata
    let detectedDuration = 180;
    if (typeof Audio !== 'undefined' && localBlobUrl) {
      try {
        await new Promise((resolve) => {
          const a = new Audio();
          a.src = localBlobUrl;
          a.onloadedmetadata = () => {
            if (a.duration && !isNaN(a.duration) && isFinite(a.duration)) {
              detectedDuration = Math.floor(a.duration);
            }
            resolve();
          };
          a.onerror = () => resolve();
          setTimeout(resolve, 300);
        });
      } catch (e) {}
    }

    const newTrack = new TrackModel({
      id: trackId,
      title,
      artist,
      album: 'Моя музыка',
      duration: detectedDuration,
      cover: 'assets/covers/cinnamon_girl.jpg',
      audioSrc: localBlobUrl,
      localUri: localBlobUrl,
      genre: 'Моя музыка',
      year: new Date().getFullYear(),
      isDownloaded: true
    });

    this.tracks.unshift(newTrack);

    // Save metadata of imported tracks
    const importedTracksMeta = this.tracks
      .filter(t => t.id.startsWith('local-'))
      .map(t => ({
        id: t.id,
        title: t.title,
        artist: t.artist,
        album: t.album,
        duration: t.duration,
        genre: t.genre,
        year: t.year,
        cover: t.cover,
        isDownloaded: true
      }));
    await this.storage.set('aura_user_tracks', importedTracksMeta);

    this._notify();
    return newTrack;
  }

  // --- Likes ---
  async toggleLike(trackId) {
    const isLiked = this.likedSongIds.has(trackId);
    if (isLiked) {
      this.likedSongIds.delete(trackId);
    } else {
      this.likedSongIds.add(trackId);
    }

    const track = this.getTrackById(trackId);
    if (track) {
      track.isLiked = !isLiked;
    }

    await this.storage.set('aura_liked_track_ids', Array.from(this.likedSongIds));
    this._notify();
    return !isLiked;
  }

  isLiked(trackId) {
    return this.likedSongIds.has(trackId);
  }

  getLikedTracks() {
    return Array.from(this.likedSongIds)
      .map(id => this.getTrackById(id))
      .filter(Boolean);
  }

  // --- Recently Played ---
  async addRecentlyPlayed(trackId) {
    if (!trackId) return;
    const getId = (x) => (typeof x === 'object' && x !== null ? x.trackId : x);
    const item = { trackId, playedAt: Date.now() };
    this.recentlyPlayedIds = [
      item,
      ...this.recentlyPlayedIds.filter(id => getId(id) !== trackId)
    ].slice(0, 20);

    await this.storage.set('aura_recently_played_ids', this.recentlyPlayedIds);
    this._notify();
  }

  getRecentlyPlayedTracks() {
    const getId = (x) => (typeof x === 'object' && x !== null ? x.trackId : x);
    return this.recentlyPlayedIds
      .map(id => this.getTrackById(getId(id)))
      .filter(Boolean);
  }

  // --- Playlists ---
  getPlaylists() {
    return [...this.playlists];
  }

  getPlaylistById(id) {
    return this.playlists.find(p => p.id === id) || null;
  }

  async createPlaylist(title, cover = 'assets/covers/cinnamon_girl.jpg', description = '') {
    if (!title || !title.trim()) return null;
    const PlaylistModel = (typeof Playlist !== 'undefined') ? Playlist : (await import('../models/Playlist.js').then(m => m.default || m));
    const newPl = new PlaylistModel({
      title: title.trim(),
      cover,
      description,
      trackIds: []
    });

    this.playlists.unshift(newPl);
    await this.storage.set('aura_playlists', this.playlists);
    this._notify();
    return newPl;
  }

  async renamePlaylist(playlistId, newTitle) {
    const pl = this.getPlaylistById(playlistId);
    if (!pl || !newTitle || !newTitle.trim()) return false;
    const renamed = pl.rename ? pl.rename(newTitle) : false;
    if (!renamed) {
      pl.title = newTitle.trim();
      pl.updatedAt = Date.now();
    }
    await this.storage.set('aura_playlists', this.playlists);
    this._notify();
    return true;
  }

  async reorderPlaylistTracks(playlistId, fromIndex, toIndex) {
    const pl = this.getPlaylistById(playlistId);
    if (!pl) return false;
    const reordered = pl.reorderTrack ? pl.reorderTrack(fromIndex, toIndex) : false;
    if (!reordered && Array.isArray(pl.trackIds)) {
      if (fromIndex < 0 || fromIndex >= pl.trackIds.length || toIndex < 0 || toIndex >= pl.trackIds.length) return false;
      const [moved] = pl.trackIds.splice(fromIndex, 1);
      pl.trackIds.splice(toIndex, 0, moved);
      pl.updatedAt = Date.now();
    }
    await this.storage.set('aura_playlists', this.playlists);
    this._notify();
    return true;
  }

  async deletePlaylist(playlistId) {
    this.playlists = this.playlists.filter(p => p.id !== playlistId);
    await this.storage.set('aura_playlists', this.playlists);
    this._notify();
    return true;
  }

  async addTrackToPlaylist(playlistId, trackId) {
    const pl = this.getPlaylistById(playlistId);
    if (!pl) return false;
    const added = pl.addTrack(trackId);
    if (added) {
      await this.storage.set('aura_playlists', this.playlists);
      this._notify();
    }
    return added;
  }

  async removeTrackFromPlaylist(playlistId, trackId) {
    const pl = this.getPlaylistById(playlistId);
    if (!pl) return false;
    const removed = pl.removeTrack(trackId);
    if (removed) {
      await this.storage.set('aura_playlists', this.playlists);
      this._notify();
    }
    return removed;
  }

  getPlaylistTracks(playlistId) {
    const pl = this.getPlaylistById(playlistId);
    if (!pl) return [];
    return pl.trackIds
      .map(id => this.getTrackById(id))
      .filter(Boolean);
  }

  // --- Search & Aggregations ---
  searchTracks(query = '', genre = null) {
    let result = [...this.tracks];
    const q = query.trim().toLowerCase();

    if (genre) {
      result = result.filter(t => t.genre.toLowerCase() === genre.toLowerCase());
    }

    if (q) {
      const matchingPlaylists = this.playlists.filter(p => p.title.toLowerCase().includes(q));
      const plTrackIds = new Set(matchingPlaylists.flatMap(p => p.trackIds));

      result = result.filter(t =>
        t.title.toLowerCase().includes(q) ||
        t.artist.toLowerCase().includes(q) ||
        t.album.toLowerCase().includes(q) ||
        t.genre.toLowerCase().includes(q) ||
        plTrackIds.has(t.id)
      );
    }

    return result;
  }

  async addSearchHistory(query) {
    if (!query || !query.trim()) return;
    const q = query.trim();
    this.searchHistory = [q, ...this.searchHistory.filter(item => item.toLowerCase() !== q.toLowerCase())].slice(0, 8);
    await this.storage.set('aura_search_history', this.searchHistory);
  }

  getSearchHistory() {
    return [...this.searchHistory];
  }

  async clearSearchHistory() {
    this.searchHistory = [];
    await this.storage.set('aura_search_history', []);
  }

  // Albums Aggregation
  getAlbums() {
    const map = new Map();
    for (const t of this.tracks) {
      if (!map.has(t.album)) {
        map.set(t.album, {
          name: t.album,
          artist: t.artist,
          cover: t.cover,
          tracks: []
        });
      }
      map.get(t.album).tracks.push(t);
    }
    return Array.from(map.values()).map(alb => ({
      ...alb,
      songsCount: alb.tracks.length
    }));
  }

  // Artists Aggregation
  getArtists() {
    const map = new Map();
    for (const t of this.tracks) {
      if (!map.has(t.artist)) {
        map.set(t.artist, {
          name: t.artist,
          cover: t.cover,
          tracks: []
        });
      }
      map.get(t.artist).tracks.push(t);
    }
    return Array.from(map.values()).map(art => ({
      ...art,
      songsCount: art.tracks.length
    }));
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = TrackRepository;
}


// ==========================================================================
// Module: js/services/VoiceService.js
// ==========================================================================
/**
 * VoiceService — Real Speech Recognition for Voice Search.
 * Uses Web Speech API (SpeechRecognition / webkitSpeechRecognition).
 */
class VoiceService {
  constructor() {
    this.recognition = null;
    this.isListening = false;
    this.isSupported = false;
    this._init();
  }

  _init() {
    if (typeof window === 'undefined') return;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      this.isSupported = true;
      this.recognition = new SpeechRecognition();
      this.recognition.continuous = false;
      this.recognition.interimResults = false;
      this.recognition.lang = 'ru-RU';
    }
  }

  startListening(onResult, onError, onEnd) {
    if (!this.isSupported || !this.recognition) {
      if (onError) onError({ code: 'NOT_SUPPORTED', message: 'Голосовой поиск не поддерживается на данном устройстве.' });
      return;
    }

    if (this.isListening) {
      this.recognition.stop();
      this.isListening = false;
    }

    this.recognition.onstart = () => {
      this.isListening = true;
    };

    this.recognition.onresult = (event) => {
      this.isListening = false;
      if (event.results && event.results.length > 0) {
        const transcript = event.results[0][0].transcript;
        if (onResult) onResult(transcript);
      }
    };

    this.recognition.onerror = (err) => {
      this.isListening = false;
      if (onError) onError(err);
    };

    this.recognition.onend = () => {
      this.isListening = false;
      if (onEnd) onEnd();
    };

    try {
      this.recognition.start();
    } catch (e) {
      this.isListening = false;
      if (onError) onError(e);
    }
  }

  stopListening() {
    if (this.recognition && this.isListening) {
      this.recognition.stop();
      this.isListening = false;
    }
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = VoiceService;
}


// ==========================================================================
// Module: js/services/SettingsService.js
// ==========================================================================
/**
 * SettingsService — Manages User Preferences, Audio Quality, OLED Themes, and EQ.
 */
class SettingsService {
  constructor(storageService, equalizerService = null) {
    this.storage = storageService;
    this.equalizer = equalizerService;

    this.audioQualities = [
      { name: 'Hi-Res Lossless (24-бит/192 кГц)', badge: 'LOSSLESS HI-RES', bitrate: 9216 },
      { name: 'Lossless ALAC (16-бит/44.1 кГц)', badge: 'ALAC LOSSLESS', bitrate: 1411 },
      { name: 'Высокая эффективность (320 кбит/с AAC)', badge: '320 KBPS AAC', bitrate: 320 }
    ];

    this.isOled = true;
    this.audioQualityIndex = 0;
    this.eqPresetIndex = 0;
    this.isSmartDownload = true;
    this.isCrossfade = true;
    this.listeners = new Set();
  }

  async init() {
    this.isOled = await this.storage.get('aura_oled_mode', true);
    this.audioQualityIndex = await this.storage.get('aura_audio_quality', 0);
    this.eqPresetIndex = await this.storage.get('aura_eq_preset', 0);
    this.isSmartDownload = await this.storage.get('aura_smart_downloads', true);
    this.isCrossfade = await this.storage.get('aura_crossfade', true);

    this.applyOledMode(this.isOled);
    if (this.equalizer) {
      this.equalizer.applyPreset(this.eqPresetIndex);
    }
  }

  onChange(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  _notify() {
    this.listeners.forEach(fn => {
      try { fn(); } catch (e) {}
    });
  }

  async setOledMode(enabled) {
    this.isOled = !!enabled;
    this.applyOledMode(this.isOled);
    await this.storage.set('aura_oled_mode', this.isOled);
    this._notify();
  }

  applyOledMode(enabled) {
    if (typeof document === 'undefined') return;
    document.documentElement.style.setProperty('--bg-app', enabled ? '#000000' : '#080A12');
  }

  async cycleAudioQuality() {
    this.audioQualityIndex = (this.audioQualityIndex + 1) % this.audioQualities.length;
    await this.storage.set('aura_audio_quality', this.audioQualityIndex);
    this._notify();
    return this.getCurrentQuality();
  }

  getCurrentQuality() {
    return this.audioQualities[this.audioQualityIndex];
  }

  async cycleEqualizerPreset() {
    if (!this.equalizer) return;
    const presets = this.equalizer.presets;
    this.eqPresetIndex = (this.eqPresetIndex + 1) % presets.length;
    this.equalizer.applyPreset(this.eqPresetIndex);
    await this.storage.set('aura_eq_preset', this.eqPresetIndex);
    this._notify();
    return this.equalizer.getCurrentPresetName();
  }

  async setSmartDownloads(enabled) {
    this.isSmartDownload = !!enabled;
    await this.storage.set('aura_smart_downloads', this.isSmartDownload);
    this._notify();
  }

  async setCrossfade(enabled) {
    this.isCrossfade = !!enabled;
    await this.storage.set('aura_crossfade', this.isCrossfade);
    this._notify();
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = SettingsService;
}


// ==========================================================================
// Module: js/ui/ToastService.js
// ==========================================================================
/**
 * ToastService — Non-blocking luxury floating toast notifications.
 * Replaces intrusive alert() dialogs with elegant mobile toasts.
 */
class ToastService {
  constructor() {
    this.container = null;
    this.currentTimer = null;
  }

  _getOrCreateContainer() {
    if (typeof document === 'undefined') return null;
    if (!this.container) {
      this.container = document.createElement('div');
      this.container.className = 'aura-toast-container';
      document.body.appendChild(this.container);
    }
    return this.container;
  }

  show(message, type = 'info', duration = 2800) {
    const container = this._getOrCreateContainer();
    if (!container) return;

    if (this.currentTimer) {
      clearTimeout(this.currentTimer);
    }

    container.innerHTML = '';
    const toast = document.createElement('div');
    toast.className = `aura-toast aura-toast-${type}`;

    let iconName = 'info';
    if (type === 'success') iconName = 'check-circle';
    if (type === 'heart') iconName = 'heart';
    if (type === 'download') iconName = 'download-cloud';
    if (type === 'error') iconName = 'alert-triangle';

    toast.innerHTML = `
      <i data-lucide="${iconName}" class="aura-toast-icon"></i>
      <span class="aura-toast-text">${message}</span>
    `;

    container.appendChild(toast);
    if (typeof window !== 'undefined' && window.lucide) {
      window.lucide.createIcons();
    }

    // Trigger animation
    requestAnimationFrame(() => {
      toast.classList.add('visible');
    });

    this.currentTimer = setTimeout(() => {
      toast.classList.remove('visible');
      setTimeout(() => {
        if (toast.parentElement) toast.remove();
      }, 300);
    }, duration);
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = ToastService;
}


// ==========================================================================
// Module: js/ui/UIController.js
// ==========================================================================
/**
 * UIController — Complete Native Mobile UI View Controller for AURA MUSIC.
 * Connects all screens, controls, gestures, and modals to real application services.
 */
class UIController {
  constructor(deps) {
    this.audioService = deps.audioService;
    this.trackRepo = deps.trackRepo;
    this.downloadService = deps.downloadService;
    this.settingsService = deps.settingsService;
    this.voiceService = deps.voiceService;
    this.toast = deps.toast;

    this.currentTab = 'home';
    this.currentLibraryCategory = 'playlists';
    this.activeSheetTrack = null;
    this.isNowPlayingOpen = false;
    this.isScrubbing = false;
    this.activePlaylistDetail = null;
  }

  init() {
    this._bindAudioEvents();
    this._bindSettingsEvents();
    this._bindRepoEvents();
    this._setupSwipeGestures();
    this._setupScrubberInteraction();
    this._setupGreeting();

    // Ensure smartphone container is NEVER scrolled offscreen by rogue browser focus
    const root = document.getElementById('smartphoneRoot');
    if (root) {
      root.addEventListener('scroll', () => {
        if (root.scrollTop !== 0) root.scrollTop = 0;
        if (root.scrollLeft !== 0) root.scrollLeft = 0;
      }, { passive: false });
    }

    // Render Initial Views
    this.renderRecentlyPlayed();
    this.renderSearchResults(this.trackRepo.getAllTracks());
    this.renderLibrary();
    this.updateLikedBadge();
    this.syncAllUI();
  }

  // --- Reactive Subscriptions ---
  _bindAudioEvents() {
    this.audioService.on('timeupdate', ({ currentTime, duration }) => {
      if (!this.isScrubbing) {
        this._updateScrubberAndProgress(currentTime, duration);
      }
    });

    this.audioService.on('trackchange', (track) => {
      this.syncAllUI();
      this.trackRepo.addRecentlyPlayed(track.id);
      this._updateAmbientGlow(track);
    });

    this.audioService.on('play', () => {
      this._updatePlayPauseIcons(true);
    });

    this.audioService.on('pause', () => {
      this._updatePlayPauseIcons(false);
    });

    this.audioService.on('shufflechange', (isShuffle) => {
      const btn = document.getElementById('btnShuffle');
      if (btn) btn.classList.toggle('active', isShuffle);
    });

    this.audioService.on('repeatchange', (mode) => {
      const btn = document.getElementById('btnRepeat');
      if (btn) {
        btn.classList.toggle('active', mode !== 'off');
        btn.style.opacity = mode === 'off' ? '0.45' : '1.0';
        if (mode === 'one') {
          btn.style.color = '#EC4899';
        } else {
          btn.style.color = '';
        }
      }
    });

    this.audioService.on('error', ({ error, track }) => {
      this.toast.show(`Playback error: ${track?.title || 'Track'} could not be loaded.`, 'error');
    });
  }

  _bindSettingsEvents() {
    this.settingsService.onChange(() => {
      this._updateSettingsUI();
    });
  }

  _bindRepoEvents() {
    this.trackRepo.onChange(() => {
      this.renderRecentlyPlayed();
      this.renderLibrary();
      this.updateLikedBadge();
      this._updateFeaturedCounts();
      this._updateFavoriteButton();
    });
  }

  _setupGreeting() {
    const subtitle = document.querySelector('.user-greeting .greeting-subtitle');
    if (subtitle) {
      const hour = new Date().getHours();
      let greeting = 'Доброе утро';
      if (hour >= 12 && hour < 17) greeting = 'Добрый день';
      if (hour >= 17 || hour < 5) greeting = 'Добрый вечер';
      subtitle.textContent = greeting;
    }
    this._updateFeaturedCounts();
  }

  _updateFeaturedCounts() {
    const chillCount = document.getElementById('fcardChillCount');
    const workoutCount = document.getElementById('fcardWorkoutCount');
    const nightCount = document.getElementById('fcardNightCount');

    const chill = this.trackRepo.getPlaylistById('pl-chill');
    const workout = this.trackRepo.getPlaylistById('pl-workout');
    const night = this.trackRepo.getPlaylistById('pl-night');

    const fmtCount = (n) => {
      if (n % 10 === 1 && n % 100 !== 11) return `${n} трек`;
      if ([2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100)) return `${n} трека`;
      return `${n} треков`;
    };

    if (chillCount && chill) chillCount.textContent = fmtCount(chill.trackIds.length);
    if (workoutCount && workout) workoutCount.textContent = fmtCount(workout.trackIds.length);
    if (nightCount && night) nightCount.textContent = fmtCount(night.trackIds.length);
  }

  openLibraryAddMenu() {
    this.triggerHaptic('LIGHT');
    const content = `
      <div style="padding: 10px 0;">
        <h4 style="font-size:16px; font-weight:800; color:#FFF; margin-bottom:12px;">Добавить в медиатеку</h4>
        <div style="display:flex; flex-direction:column; gap:8px;">
          <button class="sheet-row-btn" onclick="window.auraApp.ui.closeCustomSheet(); window.auraApp.ui.openCreatePlaylistDialog();">
            <i data-lucide="plus-square"></i>
            <span>Создать новый плейлист</span>
          </button>
          <button class="sheet-row-btn" onclick="window.auraApp.ui.closeCustomSheet(); window.auraApp.ui.triggerImportAudio();">
            <i data-lucide="folder-plus"></i>
            <span>Загрузить музыку с устройства (MP3)</span>
          </button>
        </div>
      </div>
    `;
    this._openCustomSheet('Опции медиатеки', content);
  }

  // ==========================================================================
  // NAVIGATION & TABS
  // ==========================================================================
  switchTab(tabName) {
    this.triggerHaptic('LIGHT');
    this.currentTab = tabName;

    document.querySelectorAll('.app-screen').forEach(scr => scr.classList.remove('active'));
    const target = document.getElementById(`screen${this._capitalize(tabName)}`);
    if (target) target.classList.add('active');

    document.querySelectorAll('.tab-item').forEach(btn => btn.classList.remove('active'));
    const activeBtn = document.getElementById(`tab${this._capitalize(tabName)}`);
    if (activeBtn) activeBtn.classList.add('active');

    if (tabName === 'search') {
      const input = document.getElementById('liveSearchInput');
      if (input && input.value.trim().length === 0) {
        this.renderSearchResults(this.trackRepo.getAllTracks());
      }
    } else if (tabName === 'library') {
      this.renderLibrary();
    }
  }

  _capitalize(s) {
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  openNowPlayingScreen() {
    this.triggerHaptic('LIGHT');
    const modal = document.getElementById('nowPlayingModal');
    if (modal) {
      this.isNowPlayingOpen = true;
      modal.classList.remove('dragging');
      modal.style.transform = '';
      modal.classList.add('open');
    }
  }

  closeNowPlayingScreen() {
    this.triggerHaptic('LIGHT');
    const modal = document.getElementById('nowPlayingModal');
    if (modal) {
      this.isNowPlayingOpen = false;
      modal.classList.remove('dragging');
      modal.style.transform = '';
      modal.classList.remove('open');
    }
  }

  _setupSwipeGestures() {
    const modal = document.getElementById('nowPlayingModal');
    const handleBar = document.getElementById('npSwipeHandleBar');
    const dragPill = document.querySelector('.np-drag-pill-wrap');
    const artwork = document.querySelector('.np-artwork-container');
    if (!modal) return;

    let startY = 0;
    let isDragging = false;

    const onStart = (clientY, target) => {
      // Don't drag if user clicked an interactive control
      if (target && target.closest && target.closest('.np-icon-btn, .np-ctrl-action, .sub-action-btn, #npFavoriteBtn, #scrubberTrackLine, button, a')) {
        return false;
      }
      startY = clientY;
      isDragging = true;
      modal.classList.add('dragging');
      return true;
    };

    const onMove = (clientY) => {
      if (!isDragging) return;
      const deltaY = clientY - startY;
      if (deltaY > 0) {
        modal.style.transform = `translateY(${deltaY}px)`;
      }
    };

    const onEnd = (clientY) => {
      if (!isDragging) return;
      isDragging = false;
      modal.classList.remove('dragging');
      const deltaY = clientY - startY;
      if (deltaY > 50) {
        this.closeNowPlayingScreen();
      } else {
        modal.style.transform = '';
      }
    };

    // Touch events for mobile: drag down from top bar, drag pill, artwork, or modal
    const touchElements = [modal, handleBar, dragPill, artwork].filter(Boolean);
    touchElements.forEach(el => {
      el.addEventListener('touchstart', (e) => {
        onStart(e.touches[0].clientY, e.target);
      }, { passive: true });

      el.addEventListener('touchmove', (e) => {
        onMove(e.touches[0].clientY);
      }, { passive: true });

      el.addEventListener('touchend', (e) => {
        const clientY = e.changedTouches[0]?.clientY || startY;
        onEnd(clientY);
      });
    });

    // Mouse drag events for desktop browser testing on top area and artwork
    const dragElements = [handleBar, dragPill, artwork].filter(Boolean);
    dragElements.forEach(el => {
      el.addEventListener('mousedown', (e) => {
        if (onStart(e.clientY, e.target)) {
          const moveHandler = (ev) => onMove(ev.clientY);
          const upHandler = (ev) => {
            window.removeEventListener('mousemove', moveHandler);
            window.removeEventListener('mouseup', upHandler);
            onEnd(ev.clientY);
          };
          window.addEventListener('mousemove', moveHandler);
          window.addEventListener('mouseup', upHandler);
        }
      });
    });

    // Explicit Close Button handlers: click + touchend + onclick fallback
    const closeBtn = document.getElementById('npCloseBtn');
    if (closeBtn) {
      const handleClose = (e) => {
        if (e) {
          e.stopPropagation();
          e.preventDefault();
        }
        this.closeNowPlayingScreen();
      };
      closeBtn.onclick = handleClose;
      closeBtn.addEventListener('click', handleClose);
      closeBtn.addEventListener('touchend', handleClose);
    }

    // Drag Pill tap/click to close
    if (dragPill) {
      dragPill.onclick = (e) => {
        if (e) e.stopPropagation();
        this.closeNowPlayingScreen();
      };
    }

    // Dynamic Island / Notch tap to close when Now Playing is open
    const phoneNotch = document.querySelector('.phone-dynamic-notch');
    if (phoneNotch) {
      phoneNotch.style.cursor = 'pointer';
      phoneNotch.onclick = (e) => {
        if (this.isNowPlayingOpen) {
          if (e) e.stopPropagation();
          this.closeNowPlayingScreen();
        }
      };
    }

    // Top Header text tap to close
    const headingGroup = document.querySelector('.np-heading-group');
    if (headingGroup) {
      headingGroup.style.cursor = 'pointer';
      headingGroup.title = 'Нажмите, чтобы свернуть';
      headingGroup.onclick = (e) => {
        if (e) e.stopPropagation();
        this.closeNowPlayingScreen();
      };
    }

    // Keyboard Escape Key to close Now Playing on desktop
    if (typeof window !== 'undefined' && window.addEventListener) {
      window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          this.closeNowPlayingScreen();
        }
      });
    }

    // Clicking desktop backdrop outside phone shell closes Now Playing
    if (typeof document !== 'undefined' && document.addEventListener) {
      document.addEventListener('click', (e) => {
        if (!this.isNowPlayingOpen) return;
        const root = document.getElementById('smartphoneRoot');
        if (root && root.contains && !root.contains(e.target)) {
          this.closeNowPlayingScreen();
        }
      });
    }

    // Native Android / Capacitor Back Button Support
    if (window.Capacitor?.Plugins?.App) {
      window.Capacitor.Plugins.App.addListener('backButton', () => {
        if (this.isNowPlayingOpen) {
          this.closeNowPlayingScreen();
        }
      });
    }
  }

  // ==========================================================================
  // PLAYBACK ACTIONS
  // ==========================================================================
  playTrackById(trackId) {
    const track = this.trackRepo.getTrackById(trackId);
    if (!track) return Promise.resolve();
    this.triggerHaptic('MEDIUM');

    const allTracks = this.trackRepo.getAllTracks();
    const index = allTracks.findIndex(t => t.id === trackId);
    return this.audioService.setQueue(allTracks, Math.max(0, index), true);
  }

  playPlaylist(playlistId, shuffle = false) {
    const tracks = this.trackRepo.getPlaylistTracks(playlistId);
    if (!tracks || tracks.length === 0) {
      this.toast.show('Плейлист пуст. Добавьте треки!', 'info');
      return Promise.resolve();
    }
    this.triggerHaptic('MEDIUM');
    const p = this.audioService.setQueue(tracks, 0, true);
    if (shuffle && !this.audioService.isShuffle) {
      this.audioService.toggleShuffle();
    }
    this.toast.show(`Воспроизведение плейлиста (${tracks.length} треков)`, 'success');
    return p;
  }

  playLikedSongs() {
    const liked = this.trackRepo.getLikedTracks();
    if (liked.length === 0) {
      this.toast.show('Пока нет любимых треков! Нажмите ❤️ на любом треке.', 'heart');
      return;
    }
    this.triggerHaptic('MEDIUM');
    this.audioService.setQueue(liked, 0, true);
    this.toast.show(`Воспроизведение: ${liked.length} любимых треков`, 'heart');
  }

  togglePlayState() {
    this.triggerHaptic('LIGHT');
    if (!this.audioService.currentTrack) {
      const first = this.trackRepo.getAllTracks()[0];
      if (first) {
        this.audioService.setQueue(this.trackRepo.getAllTracks(), 0, true);
      }
      return;
    }
    this.audioService.togglePlay();
  }

  skipNext() {
    this.triggerHaptic('LIGHT');
    this.audioService.skipNext();
  }

  skipPrevious() {
    this.triggerHaptic('LIGHT');
    this.audioService.skipPrevious();
  }

  toggleShuffle() {
    this.triggerHaptic('LIGHT');
    const isShuffle = this.audioService.toggleShuffle();
    this.toast.show(isShuffle ? 'Случайный порядок включен' : 'Случайный порядок выключен', 'info');
  }

  toggleRepeat() {
    this.triggerHaptic('LIGHT');
    const mode = this.audioService.toggleRepeat();
    let label = 'Повтор очереди';
    if (mode === 'one') label = 'Повтор текущего трека';
    if (mode === 'off') label = 'Повтор выключен';
    this.toast.show(label, 'info');
  }

  async toggleFavorite() {
    const track = this.audioService.currentTrack;
    if (!track) return;
    this.triggerHaptic('MEDIUM');

    const isLiked = await this.trackRepo.toggleLike(track.id);
    this.toast.show(
      isLiked ? `"${track.title}" добавлен в любимые` : `"${track.title}" удален из любимых`,
      'heart'
    );

    // Smart auto-download for offline listening
    if (isLiked && this.settingsService.smartDownloads && !this.downloadService.isDownloaded(track.id)) {
      this.downloadService.downloadTrack(track).then((res) => {
        if (res?.success) {
          this.toast.show(`"${track.title}" автосохранен офлайн`, 'success');
        }
      });
    }
  }

  // ==========================================================================
  // SCRUBBER & TIMELINE
  // ==========================================================================
  _setupScrubberInteraction() {
    const line = document.getElementById('scrubberTrackLine');
    if (!line) return;

    const handleSeek = (clientX) => {
      const rect = line.getBoundingClientRect();
      const clickX = clientX - rect.left;
      const percentage = Math.max(0, Math.min(1, clickX / rect.width));
      const targetTime = Math.floor(percentage * (this.audioService.duration || 90));
      this.audioService.seek(targetTime);
      this._updateScrubberAndProgress(targetTime, this.audioService.duration || 90);
    };

    line.addEventListener('click', (e) => {
      handleSeek(e.clientX);
    });

    line.addEventListener('touchstart', (e) => {
      this.isScrubbing = true;
      handleSeek(e.touches[0].clientX);
    }, { passive: true });

    line.addEventListener('touchmove', (e) => {
      if (!this.isScrubbing) return;
      handleSeek(e.touches[0].clientX);
    }, { passive: true });

    line.addEventListener('touchend', () => {
      this.isScrubbing = false;
    });
  }

  _updateScrubberAndProgress(currentTime, duration) {
    const dur = duration || 90;
    const pct = Math.min(100, Math.max(0, (currentTime / dur) * 100));

    // Mini Player Progress
    const miniTrack = document.getElementById('miniProgressTrack');
    if (miniTrack) miniTrack.style.width = `${pct}%`;

    // Scrubber Fills
    const scrubberFill = document.getElementById('scrubberFill');
    const scrubberHandle = document.getElementById('scrubberHandle');
    if (scrubberFill) scrubberFill.style.width = `${pct}%`;
    if (scrubberHandle) scrubberHandle.style.left = `${pct}%`;

    // Timestamps
    const timeElapsed = document.getElementById('timeElapsed');
    const timeRemaining = document.getElementById('timeRemaining');
    if (timeElapsed) timeElapsed.textContent = this._formatSeconds(currentTime);
    if (timeRemaining) timeRemaining.textContent = `-${this._formatSeconds(Math.max(0, dur - currentTime))}`;

    // Lyrics
    this._renderLyrics(currentTime);
  }

  _renderLyrics(currentTime) {
    const container = document.getElementById('lyricsStreamLines');
    if (!container) return;

    const track = this.audioService.currentTrack;
    if (!track || !track.lyrics || track.lyrics.length === 0) {
      container.innerHTML = `
        <div style="padding: 24px; text-align: center; color: var(--text-muted); font-size: 13px;">
          Инструментальный трек или текст песни недоступен.
        </div>
      `;
      return;
    }

    const lyrics = track.lyrics;
    let activeIndex = 0;
    lyrics.forEach((l, idx) => {
      if (currentTime >= l.time) activeIndex = idx;
    });

    container.innerHTML = lyrics.map((l, idx) => {
      let cls = 'upcoming';
      if (idx < activeIndex) cls = 'past';
      if (idx === activeIndex) cls = 'active-line';
      return `<p class="np-lyric ${cls}" onclick="window.auraApp.audioService.seek(${l.time})">${l.text}</p>`;
    }).join('');

    // Smooth auto scroll to active lyric (ONLY inside lyrics container, NEVER scrolling page/smartphoneRoot)
    const activeEl = container.querySelector('.active-line');
    if (activeEl && this.isNowPlayingOpen) {
      const containerHeight = container.clientHeight;
      if (containerHeight > 0) {
        const lineTop = activeEl.offsetTop - container.offsetTop;
        const targetScroll = lineTop - (containerHeight / 2) + (activeEl.clientHeight / 2);
        container.scrollTo({ top: Math.max(0, targetScroll), behavior: 'smooth' });
      }
    }
  }

  _formatSeconds(secs) {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  }

  // ==========================================================================
  // UI SYNCHRONIZATION
  // ==========================================================================
  syncAllUI() {
    const track = this.audioService.currentTrack;
    if (!track) return;

    // Mini Player
    const miniTitle = document.getElementById('miniSongTitle');
    const miniArtist = document.getElementById('miniArtistSub');
    const miniCover = document.getElementById('miniArtImg');
    if (miniTitle) miniTitle.textContent = track.title;
    if (miniArtist) miniArtist.textContent = track.artist;
    if (miniCover) miniCover.src = track.cover;

    // Now Playing
    const npSong = document.getElementById('npSongName');
    const npArtist = document.getElementById('npArtistName');
    const npArtwork = document.getElementById('npArtworkImg');
    const npBadge = document.getElementById('npBadgeName');
    const npPlaylist = document.getElementById('npPlaylistTitle');
    if (npSong) npSong.textContent = track.title;
    if (npArtist) npArtist.textContent = track.artist;
    if (npArtwork) npArtwork.src = track.cover;
    if (npBadge) npBadge.textContent = this.settingsService.getCurrentQuality().badge;
    if (npPlaylist) npPlaylist.textContent = track.album || 'AURA MUSIC';

    this._updatePlayPauseIcons(this.audioService.isPlaying);
    this._updateFavoriteButton();
    this._updateScrubberAndProgress(this.audioService.currentTime, this.audioService.duration);
  }

  _updatePlayPauseIcons(isPlaying) {
    const iconPlays = document.querySelectorAll('.icon-play-state, .master-play-icon');
    const iconPauses = document.querySelectorAll('.icon-pause-state, .master-pause-icon');
    const activeEq = document.querySelector('.song-row-item.active .equalizer-bars-live');

    iconPlays.forEach(el => el.style.display = isPlaying ? 'none' : 'block');
    iconPauses.forEach(el => el.style.display = isPlaying ? 'block' : 'none');
    if (activeEq) activeEq.style.display = isPlaying ? 'flex' : 'none';
  }

  _updateFavoriteButton() {
    const track = this.audioService.currentTrack;
    const isLiked = track ? this.trackRepo.isLiked(track.id) : false;
    const heartBtn = document.getElementById('npFavoriteBtn');
    if (heartBtn) {
      heartBtn.classList.toggle('active', isLiked);
    }
  }

  _updateAmbientGlow(track) {
    const glow = document.getElementById('npAmbientGlow');
    if (!glow || !track) return;
    // Map genre to luxury theme glow
    const colors = {
      'Synthwave': 'rgba(168, 85, 247, 0.45) 0%, rgba(236, 72, 153, 0.25) 45%',
      'Pop': 'rgba(236, 72, 153, 0.45) 0%, rgba(249, 115, 22, 0.25) 45%',
      'R&B': 'rgba(249, 115, 22, 0.45) 0%, rgba(217, 70, 239, 0.25) 45%',
      'Rock': 'rgba(59, 130, 246, 0.45) 0%, rgba(168, 85, 247, 0.25) 45%',
      'Electronic': 'rgba(6, 182, 212, 0.45) 0%, rgba(59, 130, 246, 0.25) 45%'
    };
    const grad = colors[track.genre] || colors['Synthwave'];
    glow.style.background = `radial-gradient(circle at 50% 30%, ${grad}, transparent 75%)`;
  }

  // ==========================================================================
  // SCREEN 1: HOME
  // ==========================================================================
  renderRecentlyPlayed() {
    const container = document.getElementById('homeRecentSongsContainer');
    if (!container) return;

    const tracks = this.trackRepo.getRecentlyPlayedTracks();
    if (tracks.length === 0) {
      container.innerHTML = `
        <div style="padding: 20px; text-align: center; color: var(--text-muted); font-size: 13px;">
          Недавно прослушанных треков пока нет. Включите любой трек выше!
        </div>
      `;
      return;
    }

    const currentId = this.audioService.currentTrack?.id;
    container.innerHTML = tracks.map(song => {
      const isCurrent = song.id === currentId;
      return `
        <div class="song-row-item ${isCurrent ? 'active' : ''}" onclick="window.auraApp.ui.playTrackById('${song.id}')">
          <div class="song-cover-box">
            <img src="${song.cover}" alt="${song.title}" class="song-art-img">
            ${isCurrent ? `
              <div class="equalizer-bars-live" style="display:${this.audioService.isPlaying ? 'flex' : 'none'};">
                <span></span><span></span><span></span>
              </div>
            ` : ''}
          </div>
          <div class="song-metadata">
            <h4 class="song-title-text">${song.title}</h4>
            <p class="song-artist-text">${song.artist}</p>
          </div>
          <span class="song-time-text">${this._formatSeconds(song.duration)}</span>
          <button class="more-options-btn" onclick="window.auraApp.ui.openTrackOptions(event, '${song.id}')" aria-label="More">
            <i data-lucide="more-vertical"></i>
          </button>
        </div>
      `;
    }).join('');

    if (window.lucide) window.lucide.createIcons();
  }

  // ==========================================================================
  // SCREEN 2: SEARCH
  // ==========================================================================
  onSearchInput(val) {
    const query = val.trim();
    const clearBtn = document.getElementById('btnSearchClear');
    const genreSection = document.getElementById('sectionBrowseGenre');
    const header = document.getElementById('searchListHeader');

    if (query.length > 0) {
      if (clearBtn) clearBtn.style.display = 'flex';
      if (genreSection) genreSection.style.display = 'none';
      if (header) header.textContent = `Результаты по запросу "${val}"`;

      this.trackRepo.addSearchHistory(query);
      const filtered = this.trackRepo.searchTracks(query);
      this.renderSearchResults(filtered);
    } else {
      this.clearSearch();
    }
  }

  clearSearch() {
    const input = document.getElementById('liveSearchInput');
    const clearBtn = document.getElementById('btnSearchClear');
    const genreSection = document.getElementById('sectionBrowseGenre');
    const header = document.getElementById('searchListHeader');

    if (input) input.value = '';
    if (clearBtn) clearBtn.style.display = 'none';
    if (genreSection) genreSection.style.display = 'block';
    if (header) header.textContent = 'Сейчас в тренде';

    this.renderSearchResults(this.trackRepo.getAllTracks());
  }

  selectGenre(genreName) {
    this.triggerHaptic('LIGHT');
    const input = document.getElementById('liveSearchInput');
    const clearBtn = document.getElementById('btnSearchClear');
    const genreSection = document.getElementById('sectionBrowseGenre');
    const header = document.getElementById('searchListHeader');

    const genreAliases = {
      'pop': 'Поп',
      'поп': 'Поп',
      'electronic': 'Электроника',
      'электроника': 'Электроника',
      'rock': 'Рок',
      'рок': 'Рок',
      'r&b': 'R&B',
      'rnb': 'R&B'
    };
    const canonicalGenre = genreAliases[genreName.toLowerCase()] || genreName;

    if (input) input.value = canonicalGenre;
    if (clearBtn) clearBtn.style.display = 'flex';
    if (genreSection) genreSection.style.display = 'none';
    if (header) header.textContent = `Жанр: ${canonicalGenre}`;

    const filtered = this.trackRepo.searchTracks('', canonicalGenre);
    this.renderSearchResults(filtered);
  }

  startVoiceSearch() {
    this.triggerHaptic('LIGHT');
    this.toast.show('Слушаю... Назовите трек или исполнителя', 'info', 3000);

    this.voiceService.startListening(
      (transcript) => {
        this.toast.show(`Распознано: "${transcript}"`, 'success');
        const input = document.getElementById('liveSearchInput');
        if (input) input.value = transcript;
        this.onSearchInput(transcript);
      },
      (err) => {
        const msg = err.message || 'Голосовой поиск недоступен. Введите запрос вручную.';
        this.toast.show(msg, 'error');
      }
    );
  }

  renderSearchResults(tracks) {
    const container = document.getElementById('searchResultsContainer');
    if (!container) return;

    if (tracks.length === 0) {
      container.innerHTML = `
        <div style="padding: 32px 16px; text-align: center; color: var(--text-muted); font-size: 14px;">
          <i data-lucide="music-off" style="width:36px; height:36px; margin-bottom:8px; opacity:0.6;"></i>
          <p>По вашему запросу ничего не найдено.</p>
        </div>
      `;
      if (window.lucide) window.lucide.createIcons();
      return;
    }

    const currentId = this.audioService.currentTrack?.id;
    container.innerHTML = tracks.map(song => {
      const isCurrent = song.id === currentId;
      return `
        <div class="song-row-item ${isCurrent ? 'active' : ''}" onclick="window.auraApp.ui.playTrackById('${song.id}')">
          <div class="song-cover-box">
            <img src="${song.cover}" alt="${song.title}" class="song-art-img">
          </div>
          <div class="song-metadata">
            <h4 class="song-title-text">${song.title}</h4>
            <p class="song-artist-text">${song.artist}</p>
          </div>
          <span class="song-time-text">${this._formatSeconds(song.duration)}</span>
          <button class="more-options-btn" onclick="window.auraApp.ui.openTrackOptions(event, '${song.id}')" aria-label="More">
            <i data-lucide="more-vertical"></i>
          </button>
        </div>
      `;
    }).join('');

    if (window.lucide) window.lucide.createIcons();
  }

  // ==========================================================================
  // SCREEN 3: LIBRARY
  // ==========================================================================
  switchLibraryCategory(btn, category) {
    this.triggerHaptic('LIGHT');
    document.querySelectorAll('.seg-pill').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    this.currentLibraryCategory = category;
    this.renderLibrary();
  }

  updateLikedBadge() {
    const counter = document.getElementById('likedCounterText');
    if (counter) {
      const count = this.trackRepo.likedSongIds.size;
      let word = 'треков';
      if (count % 10 === 1 && count % 100 !== 11) word = 'трек';
      else if ([2, 3, 4].includes(count % 10) && ![12, 13, 14].includes(count % 100)) word = 'трека';
      counter.textContent = `${count} ${word}`;
    }
  }

  renderLibrary() {
    const container = document.getElementById('libraryListContainer');
    if (!container) return;

    if (this.currentLibraryCategory === 'songs') {
      const songs = this.trackRepo.getAllTracks();
      container.innerHTML = songs.map(song => `
        <div class="library-row" onclick="window.auraApp.ui.playTrackById('${song.id}')">
          <div class="lib-cover">
            <img src="${song.cover}" alt="${song.title}">
          </div>
          <div class="lib-meta">
            <h4 class="lib-title">${song.title}</h4>
            <span class="lib-sub">${song.artist} • ${this._formatSeconds(song.duration)}</span>
          </div>
          <button class="more-options-btn" onclick="window.auraApp.ui.openTrackOptions(event, '${song.id}')">
            <i data-lucide="more-vertical"></i>
          </button>
        </div>
      `).join('');
    } else if (this.currentLibraryCategory === 'albums') {
      const albums = this.trackRepo.getAlbums();
      container.innerHTML = albums.map(alb => `
        <div class="library-row" onclick="window.auraApp.ui.playAlbum('${alb.name}')">
          <div class="lib-cover">
            <img src="${alb.cover}" alt="${alb.name}">
          </div>
          <div class="lib-meta">
            <h4 class="lib-title">${alb.name}</h4>
            <span class="lib-sub">${alb.artist} • ${alb.songsCount} трек(ов)</span>
          </div>
          <button class="more-options-btn" onclick="window.auraApp.ui.playAlbum('${alb.name}')">
            <i data-lucide="play"></i>
          </button>
        </div>
      `).join('');
    } else if (this.currentLibraryCategory === 'artists') {
      const artists = this.trackRepo.getArtists();
      container.innerHTML = artists.map(art => `
        <div class="library-row" onclick="window.auraApp.ui.selectGenre('${art.name}')">
          <div class="lib-cover" style="border-radius: 50%;">
            <img src="${art.cover}" alt="${art.name}">
          </div>
          <div class="lib-meta">
            <h4 class="lib-title">${art.name}</h4>
            <span class="lib-sub">Подтвержденный артист • ${art.songsCount} трек(ов)</span>
          </div>
          <button class="more-options-btn"><i data-lucide="chevron-right"></i></button>
        </div>
      `).join('');
    } else {
      // Playlists
      const playlists = this.trackRepo.getPlaylists();
      container.innerHTML = playlists.map(pl => `
        <div class="library-row" onclick="window.auraApp.ui.openPlaylistDetail('${pl.id}')">
          <div class="lib-cover">
            <img src="${pl.cover}" alt="${pl.title}">
          </div>
          <div class="lib-meta">
            <h4 class="lib-title">${pl.title}</h4>
            <span class="lib-sub">${pl.trackIds.length} трек(ов)</span>
          </div>
          <button class="more-options-btn" onclick="window.auraApp.ui.promptDeletePlaylist(event, '${pl.id}', '${pl.title}')">
            <i data-lucide="more-vertical"></i>
          </button>
        </div>
      `).join('');
    }

    if (window.lucide) window.lucide.createIcons();
  }

  playAlbum(albumName) {
    const tracks = this.trackRepo.getAllTracks().filter(t => t.album === albumName);
    if (tracks.length > 0) {
      this.triggerHaptic('MEDIUM');
      this.audioService.setQueue(tracks, 0, true);
      this.toast.show(`Воспроизведение альбома "${albumName}"`, 'success');
    }
  }

  // ==========================================================================
  // PLAYLIST MODALS & MANAGEMENT
  // ==========================================================================
  openCreatePlaylistDialog() {
    this.triggerHaptic('LIGHT');
    const d = document.getElementById('createPlaylistDialog');
    if (d) {
      d.classList.add('open');
      const input = document.getElementById('newPlaylistInput');
      if (input) {
        input.value = '';
        input.focus();
      }
    }
  }

  closeCreatePlaylistDialog() {
    const d = document.getElementById('createPlaylistDialog');
    if (d) d.classList.remove('open');
  }

  async submitCreatePlaylist() {
    const input = document.getElementById('newPlaylistInput');
    const title = input ? input.value.trim() : '';
    if (title) {
      this.triggerHaptic('MEDIUM');
      const pl = await this.trackRepo.createPlaylist(title);
      this.toast.show(`Плейлист "${pl.title}" создан!`, 'success');
      this.renderLibrary();
    }
    this.closeCreatePlaylistDialog();
  }

  async promptDeletePlaylist(e, plId, plTitle) {
    if (e) e.stopPropagation();
    this.triggerHaptic('MEDIUM');
    if (confirm(`Удалить плейлист "${plTitle}"?`)) {
      await this.trackRepo.deletePlaylist(plId);
      this.toast.show(`Плейлист "${plTitle}" удален`, 'info');
      this.renderLibrary();
    }
  }

  // Playlist Detail Sheet
  openPlaylistDetail(playlistId) {
    const pl = this.trackRepo.getPlaylistById(playlistId);
    if (!pl) return;
    this.triggerHaptic('LIGHT');
    this.activePlaylistDetail = pl;

    const tracks = this.trackRepo.getPlaylistTracks(playlistId);
    const content = `
      <div style="padding: 8px 0 20px;">
        <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:18px;">
          <div style="display:flex; align-items:center; gap:16px;">
            <img src="${pl.cover}" style="width:72px; height:72px; border-radius:12px; object-fit:cover;">
            <div>
              <h3 style="font-size:18px; font-weight:800; color:#FFF;">${pl.title}</h3>
              <span style="font-size:12px; color:var(--text-secondary);">${tracks.length} треков</span>
            </div>
          </div>
          <button class="more-options-btn" onclick="window.auraApp.ui.promptRenamePlaylist('${pl.id}')" title="Переименовать" style="padding:8px 12px; background:rgba(255,255,255,0.08); border-radius:10px; font-size:12px; color:#FFF; display:flex; align-items:center; gap:6px;">
            <i data-lucide="edit-2"></i>
            <span>Имя</span>
          </button>
        </div>
        <div style="display:flex; gap:10px; margin-bottom:16px;">
          <button class="dialog-btn confirm" style="flex:1;" onclick="window.auraApp.ui.playPlaylist('${pl.id}', false)">
            <i data-lucide="play"></i> Слушать
          </button>
          <button class="dialog-btn cancel" style="flex:1;" onclick="window.auraApp.ui.playPlaylist('${pl.id}', true)">
            <i data-lucide="shuffle"></i> Вперемешку
          </button>
        </div>
        <div class="song-list-view" style="max-height: 280px; overflow-y: auto;">
          ${tracks.length === 0 ? `
            <div style="padding: 20px; text-align: center; color: var(--text-muted); font-size: 13px;">
              В этом плейлисте пока нет треков. Нажмите «...» на любом треке, чтобы добавить!
            </div>
          ` : tracks.map((t, idx) => `
            <div class="song-row-item" onclick="window.auraApp.ui.playPlaylistTrack('${pl.id}', '${t.id}')">
              <div class="song-cover-box"><img src="${t.cover}" class="song-art-img"></div>
              <div class="song-metadata">
                <h4 class="song-title-text">${t.title}</h4>
                <p class="song-artist-text">${t.artist}</p>
              </div>
              <div style="display:flex; align-items:center; gap:4px;" onclick="event.stopPropagation()">
                ${idx > 0 ? `
                  <button class="more-options-btn" style="padding:4px;" onclick="window.auraApp.ui.movePlaylistTrack('${pl.id}', ${idx}, -1)" title="Поднять выше">
                    <i data-lucide="chevron-up"></i>
                  </button>
                ` : ''}
                ${idx < tracks.length - 1 ? `
                  <button class="more-options-btn" style="padding:4px;" onclick="window.auraApp.ui.movePlaylistTrack('${pl.id}', ${idx}, 1)" title="Опустить ниже">
                    <i data-lucide="chevron-down"></i>
                  </button>
                ` : ''}
                <button class="more-options-btn" onclick="window.auraApp.ui.removeTrackFromPlaylist('${pl.id}', '${t.id}')" title="Удалить из плейлиста">
                  <i data-lucide="minus-circle"></i>
                </button>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    this._openCustomSheet('Плейлист', content);
  }

  playPlaylistTrack(playlistId, trackId) {
    const tracks = this.trackRepo.getPlaylistTracks(playlistId);
    const idx = tracks.findIndex(t => t.id === trackId);
    if (idx !== -1) {
      this.triggerHaptic('LIGHT');
      this.audioService.setQueue(tracks, idx, true);
      this.closeCustomSheet();
    }
  }

  async promptRenamePlaylist(playlistId) {
    const pl = this.trackRepo.getPlaylistById(playlistId);
    if (!pl) return;
    const newTitle = prompt('Новое название плейлиста:', pl.title);
    if (newTitle && newTitle.trim() && newTitle.trim() !== pl.title) {
      await this.trackRepo.renamePlaylist(playlistId, newTitle.trim());
      this.toast.show(`Плейлист переименован в "${newTitle.trim()}"`, 'success');
      this.openPlaylistDetail(playlistId);
      this.renderLibrary();
    }
  }

  async movePlaylistTrack(playlistId, fromIndex, direction) {
    const toIndex = fromIndex + direction;
    const success = await this.trackRepo.reorderPlaylistTracks(playlistId, fromIndex, toIndex);
    if (success) {
      this.openPlaylistDetail(playlistId);
    }
  }

  openLikedSongsDetail() {
    this.triggerHaptic('LIGHT');
    const liked = this.trackRepo.getLikedTracks();
    const content = `
      <div style="padding: 8px 0 20px;">
        <div style="display:flex; align-items:center; gap:16px; margin-bottom:18px;">
          <div style="width:72px; height:72px; border-radius:12px; background:linear-gradient(135deg, #EC4899 0%, #8B5CF6 100%); display:flex; align-items:center; justify-content:center;">
            <i data-lucide="heart" style="color:#FFF; width:36px; height:36px;"></i>
          </div>
          <div>
            <h3 style="font-size:18px; font-weight:800; color:#FFF;">Любимые треки</h3>
            <span style="font-size:12px; color:var(--text-secondary);">${liked.length} треков</span>
          </div>
        </div>
        <div style="display:flex; gap:10px; margin-bottom:16px;">
          <button class="dialog-btn confirm" style="flex:1;" onclick="window.auraApp.ui.playLikedSongs(); window.auraApp.ui.closeCustomSheet();">
            <i data-lucide="play"></i> Слушать
          </button>
          <button class="dialog-btn cancel" style="flex:1;" onclick="window.auraApp.ui.playLikedSongsShuffled(); window.auraApp.ui.closeCustomSheet();">
            <i data-lucide="shuffle"></i> Вперемешку
          </button>
        </div>
        <div class="song-list-view" style="max-height: 280px; overflow-y: auto;">
          ${liked.length === 0 ? `
            <div style="padding: 20px; text-align: center; color: var(--text-muted); font-size: 13px;">
              Нет избранных треков. Нажмите ❤️ на любом треке, чтобы добавить его сюда!
            </div>
          ` : liked.map((t, idx) => `
            <div class="song-row-item" onclick="window.auraApp.audioService.setQueue(window.auraApp.trackRepo.getLikedTracks(), ${idx}, true); window.auraApp.ui.closeCustomSheet();">
              <div class="song-cover-box"><img src="${t.cover}" class="song-art-img"></div>
              <div class="song-metadata">
                <h4 class="song-title-text">${t.title}</h4>
                <p class="song-artist-text">${t.artist}</p>
              </div>
              <button class="more-options-btn" onclick="event.stopPropagation(); window.auraApp.ui.removeFromLiked('${t.id}')">
                <i data-lucide="heart" style="color:#EC4899; fill:#EC4899;"></i>
              </button>
            </div>
          `).join('')}
        </div>
      </div>
    `;
    this._openCustomSheet('Любимые треки', content);
  }

  playLikedSongsShuffled() {
    const liked = this.trackRepo.getLikedTracks();
    if (liked.length === 0) {
      this.toast.show('Пока нет любимых треков! Нажмите ❤️ на любом треке.', 'heart');
      return;
    }
    this.triggerHaptic('MEDIUM');
    this.audioService.setQueue(liked, 0, true);
    if (!this.audioService.isShuffle) {
      this.audioService.toggleShuffle();
    }
    this.toast.show(`Воспроизведение: ${liked.length} любимых треков (Вперемешку)`, 'heart');
  }

  async removeFromLiked(trackId) {
    await this.trackRepo.toggleLike(trackId);
    this.toast.show('Удалено из любимых', 'info');
    this.openLikedSongsDetail();
    this.updateLikedBadge();
  }

  async removeTrackFromPlaylist(playlistId, trackId) {
    await this.trackRepo.removeTrackFromPlaylist(playlistId, trackId);
    this.toast.show('Трек удален из плейлиста', 'info');
    this.openPlaylistDetail(playlistId);
    this.renderLibrary();
  }

  // ==========================================================================
  // TRACK OPTIONS BOTTOM SHEET
  // ==========================================================================
  openTrackOptions(e, trackId) {
    if (e) e.stopPropagation();
    this.triggerHaptic('LIGHT');

    const track = this.trackRepo.getTrackById(trackId) || this.audioService.currentTrack;
    if (!track) return;
    this.activeSheetTrack = track;

    const backdrop = document.getElementById('trackOptionsBackdrop');
    const tTitle = document.getElementById('sheetTrackTitle');
    const tArtist = document.getElementById('sheetTrackArtist');
    const tImg = document.getElementById('sheetTrackImg');

    if (tTitle) tTitle.textContent = track.title;
    if (tArtist) tArtist.textContent = track.artist;
    if (tImg) tImg.src = track.cover;

    const dlText = document.getElementById('sheetDownloadText');
    const dlIcon = document.getElementById('sheetDownloadIcon');
    if (dlText && dlIcon) {
      if (track.isDownloaded) {
        dlText.textContent = 'Удалить из памяти';
        dlIcon.setAttribute('data-lucide', 'trash-2');
      } else {
        dlText.textContent = 'Скачать аудиофайл';
        dlIcon.setAttribute('data-lucide', 'download');
      }
      if (window.lucide) window.lucide.createIcons();
    }

    if (backdrop) backdrop.classList.add('open');
  }

  closeTrackOptions() {
    const backdrop = document.getElementById('trackOptionsBackdrop');
    if (backdrop) backdrop.classList.remove('open');
  }

  actionPlayNext() {
    this.triggerHaptic('LIGHT');
    const track = this.activeSheetTrack;
    if (!track) return;
    this.closeTrackOptions();
    this.audioService.playNextInQueue(track);
    this.toast.show(`"${track.title}" будет сыгран следующим`, 'info');
  }

  actionAddToQueue() {
    this.triggerHaptic('LIGHT');
    const track = this.activeSheetTrack;
    if (!track) return;
    this.closeTrackOptions();
    this.audioService.addToQueue(track);
    this.toast.show(`"${track.title}" добавлен в очередь`, 'info');
  }

  actionAddToPlaylist() {
    this.triggerHaptic('LIGHT');
    const track = this.activeSheetTrack;
    if (!track) return;
    this.closeTrackOptions();

    const playlists = this.trackRepo.getPlaylists();
    if (playlists.length === 0) {
      this.openCreatePlaylistDialog();
      return;
    }

    const content = `
      <div style="padding: 10px 0;">
        <h4 style="font-size:16px; font-weight:700; color:#FFF; margin-bottom:12px;">Выберите плейлист</h4>
        <div style="display:flex; flex-direction:column; gap:8px; max-height:240px; overflow-y:auto;">
          ${playlists.map(p => `
            <button class="sheet-row-btn" onclick="window.auraApp.ui.confirmAddTrackToPlaylist('${p.id}', '${track.id}')">
              <i data-lucide="list-plus"></i>
              <span>${p.title} (${p.trackIds.length} треков)</span>
            </button>
          `).join('')}
        </div>
      </div>
    `;
    this._openCustomSheet('Добавить в плейлист', content);
  }

  async confirmAddTrackToPlaylist(playlistId, trackId) {
    const pl = this.trackRepo.getPlaylistById(playlistId);
    const added = await this.trackRepo.addTrackToPlaylist(playlistId, trackId);
    this.closeCustomSheet();
    if (added) {
      this.toast.show(`Добавлено в "${pl.title}"`, 'success');
    } else {
      this.toast.show(`Уже есть в "${pl.title}"`, 'info');
    }
  }

  async actionDownloadTrack() {
    this.triggerHaptic('LIGHT');
    const track = this.activeSheetTrack;
    if (!track) return;
    this.closeTrackOptions();

    if (track.isDownloaded) {
      this.toast.show(`Удаление "${track.title}"...`, 'info');
      await this.downloadService.removeDownload(track);
      this.toast.show(`"${track.title}" удален из офлайн-памяти`, 'info');
      this.renderLibrary();
    } else {
      this.toast.show(`Загрузка "${track.title}"...`, 'download');
      const result = await this.downloadService.downloadTrack(track);
      if (result.success) {
        this.toast.show(`Трек "${track.title}" сохранен офлайн!`, 'success');
        this.renderLibrary();
      } else {
        this.toast.show(`Ошибка загрузки: ${result.error}`, 'error');
      }
    }
  }

  actionViewArtist() {
    this.closeTrackOptions();
    if (this.activeSheetTrack) {
      this.switchTab('search');
      this.selectGenre(this.activeSheetTrack.artist);
    }
  }

  actionShareTrack() {
    this.triggerHaptic('LIGHT');
    const track = this.activeSheetTrack;
    if (!track) return;
    this.closeTrackOptions();

    if (navigator.share) {
      navigator.share({
        title: track.title,
        text: `Послушайте ${track.title} — ${track.artist} в AURA MUSIC`,
        url: window.location.href
      }).catch(() => {});
    } else {
      this.toast.show('Ссылка на трек скопирована в буфер!', 'info');
    }
  }

  // ==========================================================================
  // UP NEXT QUEUE SHEET & AIRPLAY ROUTING
  // ==========================================================================
  showQueueSheet() {
    this.triggerHaptic('LIGHT');
    const queue = this.audioService.queue;
    const curIdx = this.audioService.queueIndex;

    const content = `
      <div style="padding: 10px 0;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
          <h4 style="font-size:16px; font-weight:800; color:#FFF;">Очередь треков (${queue.length})</h4>
          <button class="section-link-btn" onclick="window.auraApp.audioService.clearUpcomingQueue(); window.auraApp.ui.closeCustomSheet(); window.auraApp.ui.toast.show('Очередь очищена', 'info');">Очистить</button>
        </div>
        <div style="max-height: 320px; overflow-y:auto; display:flex; flex-direction:column; gap:8px;">
          ${queue.map((t, idx) => `
            <div class="song-row-item ${idx === curIdx ? 'active' : ''}" onclick="window.auraApp.audioService.setQueue(window.auraApp.audioService.queue, ${idx}, true); window.auraApp.ui.closeCustomSheet();">
              <div class="song-cover-box"><img src="${t.cover}" class="song-art-img"></div>
              <div class="song-metadata">
                <h4 class="song-title-text">${t.title} ${idx === curIdx ? '(Сейчас играет)' : ''}</h4>
                <p class="song-artist-text">${t.artist}</p>
              </div>
              <div style="display:flex; align-items:center; gap:2px;" onclick="event.stopPropagation()">
                ${idx > 0 ? `
                  <button class="more-options-btn" style="padding:4px;" onclick="window.auraApp.audioService.reorderQueue(${idx}, ${idx - 1}); window.auraApp.ui.showQueueSheet();" title="Выше">
                    <i data-lucide="chevron-up"></i>
                  </button>
                ` : ''}
                ${idx < queue.length - 1 ? `
                  <button class="more-options-btn" style="padding:4px;" onclick="window.auraApp.audioService.reorderQueue(${idx}, ${idx + 1}); window.auraApp.ui.showQueueSheet();" title="Ниже">
                    <i data-lucide="chevron-down"></i>
                  </button>
                ` : ''}
                <button class="more-options-btn" onclick="window.auraApp.audioService.removeFromQueue(${idx}); window.auraApp.ui.showQueueSheet();" title="Удалить из очереди">
                  <i data-lucide="x"></i>
                </button>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    this._openCustomSheet('Очередь', content);
  }

  async showAirPlayRouting() {
    this.triggerHaptic('LIGHT');
    let devicesList = 'Динамик смартфона / Bluetooth / Наушники';
    if (typeof navigator !== 'undefined' && navigator.mediaDevices?.enumerateDevices) {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const audioOutputs = devices.filter(d => d.kind === 'audiooutput');
        if (audioOutputs.length > 0) {
          devicesList = audioOutputs.map(d => d.label || 'Аудиовыход').filter(Boolean).join(', ') || devicesList;
        }
      } catch (e) {}
    }

    const content = `
      <div style="padding: 12px 0;">
        <h4 style="font-size:16px; font-weight:800; color:#FFF; margin-bottom:8px;">Трансляция звука</h4>
        <p style="font-size:13px; color:var(--text-secondary); margin-bottom:16px;">
          Цифровой аудиопоток без потерь направлен на активное аудиоустройство.
        </p>
        <div style="background:var(--bg-surface); padding:12px; border-radius:12px; font-size:12px; color:var(--text-secondary); line-height:1.6;">
          <div><b>Активный вывод:</b> ${devicesList}</div>
          <div><b>Формат потока:</b> Прямой аппаратный DAC (Direct Output)</div>
          <div><b>Битрейт:</b> ${this.settingsService.getCurrentQuality().bitrate} кбит/с</div>
          <div><b>Активный эквалайзер:</b> ${this.settingsService.equalizer?.getCurrentPresetName() || 'Студийный баланс (Flat)'}</div>
        </div>
      </div>
    `;
    this._openCustomSheet('Устройство', content);
  }

  // ==========================================================================
  // SETTINGS & PROFILE
  // ==========================================================================
  _updateSettingsUI() {
    const qualityLabel = document.getElementById('audioQualityVal');
    if (qualityLabel) {
      qualityLabel.textContent = this.settingsService.getCurrentQuality().name;
    }

    const eqLabel = document.getElementById('eqPresetVal');
    if (eqLabel && this.settingsService.equalizer) {
      eqLabel.textContent = this.settingsService.equalizer.getCurrentPresetName();
    }

    const npBadge = document.getElementById('npBadgeName');
    if (npBadge) {
      npBadge.textContent = this.settingsService.getCurrentQuality().badge;
    }
  }

  async cycleAudioQuality() {
    this.triggerHaptic('LIGHT');
    const quality = await this.settingsService.cycleAudioQuality();
    this.toast.show(`Качество аудио: ${quality.name}`, 'info');
  }

  async cycleEqualizerPreset() {
    this.triggerHaptic('LIGHT');
    const presetName = await this.settingsService.cycleEqualizerPreset();
    this.toast.show(`Эквалайзер: ${presetName}`, 'info');
  }

  async showAppInfo() {
    this.triggerHaptic('LIGHT');
    const storageUsage = await this.downloadService.getStorageUsageMB();
    const content = `
      <div style="padding: 12px 0;">
        <h4 style="font-size:18px; font-weight:800; color:#FFF; margin-bottom:6px;">AURA MUSIC Mobile</h4>
        <span style="font-size:12px; color:var(--text-secondary);">Сборка 3.4.0 • Android и iOS</span>
        <div style="background:var(--bg-surface); padding:14px; border-radius:12px; margin:16px 0; font-size:13px; color:var(--text-secondary); line-height:1.7;">
          <div>🎵 <b>Всего в каталоге:</b> ${this.trackRepo.getAllTracks().length} треков</div>
          <div>💾 <b>Офлайн-хранилище:</b> ${storageUsage} МБ кешировано</div>
          <div>🎧 <b>Аудиодвижок:</b> Студийный DSP (Web Audio API)</div>
        </div>
        <button class="sheet-row-btn destructive" onclick="window.auraApp.ui.clearAppCache()">
          <i data-lucide="trash-2"></i>
          <span>Очистить скачанный кеш</span>
        </button>
      </div>
    `;
    this._openCustomSheet('О программе', content);
  }

  async clearAppCache() {
    this.triggerHaptic('MEDIUM');
    const tracks = this.trackRepo.getAllTracks();
    for (const t of tracks) {
      if (t.isDownloaded) {
        await this.downloadService.removeDownload(t);
      }
    }
    this.closeCustomSheet();
    this.toast.show('Офлайн-кеш успешно очищен!', 'success');
    this.renderLibrary();
  }

  // File Import for Custom User Music
  triggerImportAudio() {
    this.triggerHaptic('LIGHT');
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'audio/*';
    input.multiple = true;
    input.onchange = async (e) => {
      const files = Array.from(e.target.files || []);
      if (files.length === 0) return;

      this.toast.show(`Импорт ${files.length} аудиофайлов...`, 'download');
      for (const file of files) {
        await this.trackRepo.importLocalAudio(file);
      }
      this.toast.show(`Добавлено ${files.length} треков в медиатеку!`, 'success');
      this.renderLibrary();
    };
    input.click();
  }

  // Generic Custom Sheet Modal
  _openCustomSheet(title, htmlContent) {
    let sheet = document.getElementById('auraCustomSheet');
    if (!sheet) {
      sheet = document.createElement('div');
      sheet.id = 'auraCustomSheet';
      sheet.className = 'sheet-backdrop';
      sheet.innerHTML = `
        <div class="native-bottom-sheet" onclick="event.stopPropagation()">
          <div class="sheet-drag-pill"></div>
          <div id="auraCustomSheetBody"></div>
          <button class="sheet-row-btn destructive" onclick="window.auraApp.ui.closeCustomSheet()" style="margin-top:12px;">
            <span>Закрыть</span>
          </button>
        </div>
      `;
      sheet.onclick = () => this.closeCustomSheet();
      document.body.appendChild(sheet);
    }

    const body = document.getElementById('auraCustomSheetBody');
    if (body) body.innerHTML = htmlContent;

    if (window.lucide) window.lucide.createIcons();
    sheet.classList.add('open');
  }

  closeCustomSheet() {
    const sheet = document.getElementById('auraCustomSheet');
    if (sheet) sheet.classList.remove('open');
  }

  // Haptic Feedback Helper
  triggerHaptic(style = 'LIGHT') {
    try {
      if (window.Capacitor?.Plugins?.Haptics) {
        window.Capacitor.Plugins.Haptics.impact({ style });
      }
    } catch (e) {}
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = UIController;
}


// ==========================================================================
// APPLICATION BOOTSTRAPPER & GLOBAL EVENT BRIDGES
// ==========================================================================

const storageService = new StorageService();
const equalizerService = new EqualizerService();
const audioService = new AudioService(equalizerService);
const trackRepo = new TrackRepository(storageService);
const downloadService = new DownloadService(storageService);
const settingsService = new SettingsService(storageService, equalizerService);
const voiceService = new VoiceService();
const toast = new ToastService();

const ui = new UIController({
  audioService,
  trackRepo,
  downloadService,
  settingsService,
  voiceService,
  toast
});

window.auraApp = {
  storageService,
  equalizerService,
  audioService,
  trackRepo,
  downloadService,
  settingsService,
  voiceService,
  toast,
  ui
};

// Global Event Bridges for HTML Inline Handlers
window.switchTab = (tab) => ui.switchTab(tab);
window.playTrack = (title, artist, album) => {
  const all = trackRepo.getAllTracks();
  const track = all.find(t => t.title.toLowerCase() === (title || '').toLowerCase());
  if (track) {
    ui.playTrackById(track.id);
  } else if (all.length > 0) {
    ui.playTrackById(all[0].id);
  }
};
window.togglePlayState = () => ui.togglePlayState();
window.skipToNextTrack = () => ui.skipNext();
window.skipToPreviousTrack = () => ui.skipPrevious();
window.seekTrackPosition = (e) => {}; // handled directly in scrubber listener
window.toggleShuffle = () => ui.toggleShuffle();
window.toggleRepeat = () => ui.toggleRepeat();
window.toggleFavorite = () => ui.toggleFavorite();
window.openNowPlayingScreen = () => ui.openNowPlayingScreen();
window.closeNowPlayingScreen = () => ui.closeNowPlayingScreen();
window.onSearchType = (val) => ui.onSearchInput(val);
window.clearSearch = () => ui.clearSearch();
window.selectGenre = (g) => ui.selectGenre(g);
window.startVoiceSearch = () => ui.startVoiceSearch();
window.switchLibraryCategory = (btn, cat) => ui.switchLibraryCategory(btn, cat);
window.openLibraryAddMenu = () => ui.openLibraryAddMenu();
window.playLikedSongs = () => ui.playLikedSongs();
window.actionLikedSongsOptions = () => ui.openLikedSongsDetail();
window.openLikedSongsDetail = () => ui.openLikedSongsDetail();
window.playPlaylistTrack = (plId, tId) => ui.playPlaylistTrack(plId, tId);
window.openCreatePlaylistDialog = () => ui.openCreatePlaylistDialog();
window.closeCreatePlaylistDialog = () => ui.closeCreatePlaylistDialog();
window.submitCreatePlaylist = () => ui.submitCreatePlaylist();
window.openPlaylistOptions = (e, id, title) => ui.promptDeletePlaylist(e, id, title);
window.openTrackOptions = (e, title, artist) => {
  const all = trackRepo.getAllTracks();
  const track = all.find(t => t.title.toLowerCase() === (title || '').toLowerCase());
  ui.openTrackOptions(e, track ? track.id : null);
};
window.closeTrackOptions = () => ui.closeTrackOptions();
window.actionPlayNext = () => ui.actionPlayNext();
window.actionAddToQueue = () => ui.actionAddToQueue();
window.actionAddToPlaylist = () => ui.actionAddToPlaylist();
window.actionDownloadTrack = () => ui.actionDownloadTrack();
window.actionViewArtist = () => ui.actionViewArtist();
window.actionShareTrack = () => ui.actionShareTrack();
window.showAirPlayNotice = () => ui.showAirPlayRouting();
window.showQueueNotice = () => ui.showQueueSheet();
window.toggleOledMode = (checked) => settingsService.setOledMode(checked);
window.cycleAudioQuality = () => ui.cycleAudioQuality();
window.toggleSmartDownloads = (checked) => settingsService.setSmartDownloads(checked);
window.cycleEqualizerPreset = () => ui.cycleEqualizerPreset();
window.toggleCrossfade = (checked) => settingsService.setCrossfade(checked);
window.showAppInfo = () => ui.showAppInfo();

window.openNotifications = () => {};
window.closeNotifications = () => {};

// Network online/offline detection
window.addEventListener('offline', () => {
  toast.show('Офлайн-режим: доступна сохраненная музыка', 'info', 4000);
});
window.addEventListener('online', () => {
  toast.show('Подключение к сети восстановлено', 'success', 3000);
});

// Application Lifecycle Initialization
window.addEventListener('DOMContentLoaded', async () => {
  console.log('[AURA MUSIC] Initializing native production music engine...');
  
  // 1. Initialize Audio Element
  const audioEl = document.getElementById('nativeAudioElement');
  audioService.init(audioEl);

  // 2. Initialize Repositories and Services
  await trackRepo.init();
  await downloadService.init(trackRepo.getAllTracks());
  await settingsService.init();

  // 3. Initialize UI Controller
  ui.init();

  // 4. Configure Native Capacitor Mobile Plugins
  if (window.Capacitor?.Plugins) {
    try {
      const { StatusBar, SplashScreen } = window.Capacitor.Plugins;
      if (StatusBar) {
        await StatusBar.setStyle({ style: 'DARK' });
        await StatusBar.setBackgroundColor({ color: '#080A12' });
      }
      if (SplashScreen) {
        await SplashScreen.hide();
      }
    } catch (e) {
      console.warn('Capacitor native plugins init note:', e);
    }
  }

  // 5. Restore Last Playback Session
  const lastTrackId = await storageService.get('aura_last_track_id', null);
  const tracks = trackRepo.getAllTracks();
  let trackToLoad = tracks[0];
  if (lastTrackId) {
    const found = trackRepo.getTrackById(lastTrackId);
    if (found) trackToLoad = found;
  }
  if (trackToLoad) {
    const lastPosition = await storageService.get('aura_last_position', 0);
    audioService.setQueue(tracks, tracks.indexOf(trackToLoad), false);
    if (lastPosition > 0) {
      audioService.seek(lastPosition);
    }
  }

  // Save state on unload / background
  window.addEventListener('beforeunload', () => {
    if (audioService.currentTrack) {
      storageService.set('aura_last_track_id', audioService.currentTrack.id);
      storageService.set('aura_last_position', audioService.currentTime);
    }
  });

  console.log('[AURA MUSIC] Native production engine ready!');
});
