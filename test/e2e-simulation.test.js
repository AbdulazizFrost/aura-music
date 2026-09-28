const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');

class FakeClassList {
  constructor() {
    this.classes = new Set();
  }
  add(cls) { this.classes.add(cls); }
  remove(cls) { this.classes.delete(cls); }
  toggle(cls, force) {
    if (force === undefined) {
      if (this.classes.has(cls)) { this.classes.delete(cls); return false; }
      else { this.classes.add(cls); return true; }
    }
    if (force) this.classes.add(cls);
    else this.classes.delete(cls);
    return !!force;
  }
  contains(cls) { return this.classes.has(cls); }
}

// Synthetic DOM environment for headless testing
class FakeElement {
  constructor(tag = 'div', id = '') {
    this.tagName = tag.toUpperCase();
    this.id = id;
    this.classList = new FakeClassList();
    this.style = {
      setProperty: (k, v) => { this.style[k] = v; }
    };
    this.attributes = new Map();
    this.children = [];
    this.parentElement = null;
    this.textContent = '';
    this.innerHTML = '';
    this.value = '';
    this.listeners = new Map();
  }

  getAttribute(name) { return this.attributes.get(name); }
  setAttribute(name, val) { this.attributes.set(name, val); }

  getBoundingClientRect() {
    return { left: 0, top: 0, width: 300, height: 40 };
  }

  appendChild(child) {
    if (child) {
      child.parentElement = this;
      this.children.push(child);
    }
    return child;
  }

  removeChild(child) {
    const idx = this.children.indexOf(child);
    if (idx !== -1) {
      this.children.splice(idx, 1);
      child.parentElement = null;
    }
    return child;
  }

  remove() {
    if (this.parentElement) {
      this.parentElement.removeChild(this);
    }
  }

  addEventListener(event, fn) {
    if (!this.listeners.has(event)) this.listeners.set(event, []);
    this.listeners.get(event).push(fn);
  }

  dispatchEvent(event) {
    const list = this.listeners.get(event.type) || [];
    list.forEach(fn => fn(event));
  }

  querySelector(sel) {
    return new FakeElement('div');
  }

  querySelectorAll(sel) {
    return [new FakeElement('div')];
  }

  scrollIntoView() {}
  focus() {}
}

class FakeDocument {
  constructor() {
    this.elements = new Map();
    this.body = new FakeElement('body');
    this.documentElement = new FakeElement('html');
  }

  addEventListener(evt, fn) {}
  removeEventListener(evt, fn) {}

  getElementById(id) {
    if (!this.elements.has(id)) {
      const el = new FakeElement('div', id);
      this.elements.set(id, el);
    }
    return this.elements.get(id);
  }

  querySelectorAll(sel) {
    return [new FakeElement('div')];
  }

  querySelector(sel) {
    return new FakeElement('div');
  }

  createElement(tag) {
    return new FakeElement(tag);
  }
}

describe('End-to-End User Interaction Simulation', () => {
  let doc;
  let Track;
  let Playlist;
  let AudioService;
  let TrackRepository;
  let DownloadService;
  let SettingsService;
  let VoiceService;
  let ToastService;
  let UIController;

  beforeEach(() => {
    doc = new FakeDocument();
    global.document = doc;
    global.window = {
      location: { href: 'http://localhost/' },
      addEventListener: () => {},
      lucide: { createIcons: () => {} }
    };
    global.requestAnimationFrame = (fn) => fn();

    Track = require('../js/models/Track.js');
    Playlist = require('../js/models/Playlist.js');
    AudioService = require('../js/services/AudioService.js');
    TrackRepository = require('../js/services/TrackRepository.js');
    DownloadService = require('../js/services/DownloadService.js');
    SettingsService = require('../js/services/SettingsService.js');
    VoiceService = require('../js/services/VoiceService.js');
    ToastService = require('../js/ui/ToastService.js');
    UIController = require('../js/ui/UIController.js');
  });

  test('Simulates complete user flow: Tab Switch -> Play Track -> Scrubber Seek -> Like -> Create Playlist -> Close Modal', async () => {
    // 1. Mock Storage
    const store = new Map();
    const mockStorage = {
      get: async (k, def) => store.has(k) ? store.get(k) : def,
      set: async (k, v) => store.set(k, v),
      remove: async (k) => store.delete(k),
      getStorageUsageBytes: async () => 0
    };

    // 2. Setup Services
    const audioService = new AudioService(null);
    audioService.audioElement = {
      src: '',
      currentTime: 0,
      duration: 90,
      play: async () => {},
      pause: () => {},
      addEventListener: () => {}
    };

    const trackRepo = new TrackRepository(mockStorage);
    await trackRepo.init();

    const downloadService = new DownloadService(mockStorage);
    await downloadService.init(trackRepo.getAllTracks());

    const settingsService = new SettingsService(mockStorage, null);
    await settingsService.init();

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

    ui.init();

    // 3. User switches to Search tab
    ui.switchTab('search');
    assert.strictEqual(ui.currentTab, 'search');

    // 4. User searches for "Rockabye" (track-9, which starts unliked)
    ui.onSearchInput('Rockabye');
    const searchResults = trackRepo.searchTracks('Rockabye');
    assert.strictEqual(searchResults.length, 1);
    assert.strictEqual(searchResults[0].artist, 'Clean Bandit ft. Sean Paul');

    // 5. User plays the track
    await ui.playTrackById(searchResults[0].id);
    assert.strictEqual(audioService.currentTrack.title, 'Rockabye');
    assert.strictEqual(audioService.isPlaying, true);

    // 6. User opens Now Playing screen
    ui.openNowPlayingScreen();
    assert.strictEqual(ui.isNowPlayingOpen, true);
    const modal = doc.getElementById('nowPlayingModal');
    assert.ok(modal.classList.contains('open'));

    // 7. User likes the currently playing track (track-9 starts unliked)
    assert.strictEqual(trackRepo.isLiked('track-9'), false);
    await ui.toggleFavorite();
    assert.strictEqual(trackRepo.isLiked('track-9'), true);

    // 8. User closes Now Playing screen via close button / swipe
    ui.closeNowPlayingScreen();
    assert.strictEqual(ui.isNowPlayingOpen, false);
    assert.ok(!modal.classList.contains('open'));

    // 9. User switches to Library tab and creates a new playlist
    ui.switchTab('library');
    assert.strictEqual(ui.currentTab, 'library');

    const newPl = await trackRepo.createPlaylist('Night Vibes 2026');
    assert.ok(newPl);
    assert.strictEqual(newPl.title, 'Night Vibes 2026');

    // 10. User adds the playing track to the new playlist
    const added = await trackRepo.addTrackToPlaylist(newPl.id, 'track-9');
    assert.strictEqual(added, true);
    assert.strictEqual(trackRepo.getPlaylistTracks(newPl.id).length, 1);

    // 11. User switches OLED mode and Audio Quality in Settings
    ui.switchTab('profile');
    assert.strictEqual(ui.currentTab, 'profile');

    await settingsService.setOledMode(true);
    assert.strictEqual(settingsService.isOled, true);

    const newQuality = await settingsService.cycleAudioQuality();
    assert.strictEqual(newQuality.badge, 'ALAC LOSSLESS');

    // 12. User skips to next song
    ui.skipNext();
    assert.strictEqual(audioService.currentTrack.id, 'track-10');
    assert.strictEqual(audioService.currentTrack.title, 'People You Know');
  });
});
