const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert');

class FakeClassList {
  constructor() {
    this.classes = new Set();
  }
  add(cls) { this.classes.add(cls); }
  remove(cls) { this.classes.delete(cls); }
  contains(cls) { return this.classes.has(cls); }
}

class FakeElement {
  constructor(tag = 'div', id = '') {
    this.tagName = tag.toUpperCase();
    this.id = id;
    this.classList = new FakeClassList();
    this.style = {
      transform: '',
      setProperty: (k, v) => { this.style[k] = v; }
    };
    this.listeners = new Map();
    this.children = [];
    this.parentElement = null;
    this.title = '';
  }

  addEventListener(event, fn) {
    if (!this.listeners.has(event)) this.listeners.set(event, []);
    this.listeners.get(event).push(fn);
  }

  dispatchEvent(event) {
    const list = this.listeners.get(event.type) || [];
    list.forEach(fn => fn(event));
    if (event.type === 'click' && typeof this.onclick === 'function') {
      this.onclick(event);
    }
  }

  closest(sel) {
    if (sel.includes(this.id) || (this.classList && this.classList.contains(sel.replace('.', '')))) {
      return this;
    }
    return null;
  }

  contains(el) {
    return this === el || this.children.includes(el);
  }
}

describe('Now Playing Multi-Channel Dismissal Verification', () => {
  let UIController;
  let ui;
  let modal;
  let closeBtn;
  let dragPill;
  let headingGroup;
  let artwork;

  beforeEach(() => {
    modal = new FakeElement('section', 'nowPlayingModal');
    closeBtn = new FakeElement('button', 'npCloseBtn');
    closeBtn.classList.add('np-icon-btn');
    closeBtn.classList.add('np-close-btn');

    dragPill = new FakeElement('div');
    dragPill.classList.add('np-drag-pill-wrap');

    headingGroup = new FakeElement('div');
    headingGroup.classList.add('np-heading-group');

    artwork = new FakeElement('div');
    artwork.classList.add('np-artwork-container');

    const handleBar = new FakeElement('div', 'npSwipeHandleBar');
    const root = new FakeElement('div', 'smartphoneRoot');

    global.document = {
      getElementById: (id) => {
        if (id === 'nowPlayingModal') return modal;
        if (id === 'npCloseBtn') return closeBtn;
        if (id === 'npSwipeHandleBar') return handleBar;
        if (id === 'smartphoneRoot') return root;
        return new FakeElement('div', id);
      },
      querySelector: (sel) => {
        if (sel === '.np-drag-pill-wrap') return dragPill;
        if (sel === '.np-heading-group') return headingGroup;
        if (sel === '.np-artwork-container') return artwork;
        return null;
      },
      querySelectorAll: () => [],
      addEventListener: (evt, fn) => {},
      removeEventListener: () => {}
    };

    const windowListeners = new Map();
    global.window = {
      addEventListener: (evt, fn) => {
        if (!windowListeners.has(evt)) windowListeners.set(evt, []);
        windowListeners.get(evt).push(fn);
      },
      removeEventListener: () => {},
      triggerEvent: (evt, data) => {
        const list = windowListeners.get(evt) || [];
        list.forEach(fn => fn(data));
      },
      lucide: { createIcons: () => {} }
    };

    const TrackRepository = require('../js/services/TrackRepository.js');
    const store = new Map();
    const mockStorage = {
      get: async (k, def) => store.has(k) ? store.get(k) : def,
      set: async (k, v) => store.set(k, v),
      remove: async (k) => store.delete(k)
    };
    const trackRepo = new TrackRepository(mockStorage);
    trackRepo.init();

    UIController = require('../js/ui/UIController.js');
    ui = new UIController({
      audioService: { on: () => {} },
      trackRepo,
      downloadService: { isDownloaded: () => false },
      settingsService: { onChange: () => {} },
      voiceService: {},
      toast: { show: () => {} }
    });

    ui.init();
  });

  test('Channel 1: Clicking #npCloseBtn dismisses Now Playing immediately', () => {
    ui.openNowPlayingScreen();
    assert.strictEqual(ui.isNowPlayingOpen, true);
    assert.strictEqual(modal.classList.contains('open'), true);

    closeBtn.dispatchEvent({ type: 'click', stopPropagation: () => {}, preventDefault: () => {} });
    assert.strictEqual(ui.isNowPlayingOpen, false);
    assert.strictEqual(modal.classList.contains('open'), false);
    assert.strictEqual(modal.style.transform, '');
  });

  test('Channel 2: Clicking .np-drag-pill-wrap dismisses Now Playing immediately', () => {
    ui.openNowPlayingScreen();
    assert.strictEqual(ui.isNowPlayingOpen, true);

    dragPill.dispatchEvent({ type: 'click', stopPropagation: () => {} });
    assert.strictEqual(ui.isNowPlayingOpen, false);
    assert.strictEqual(modal.classList.contains('open'), false);
  });

  test('Channel 3: Clicking .np-heading-group title dismisses Now Playing immediately', () => {
    ui.openNowPlayingScreen();
    assert.strictEqual(ui.isNowPlayingOpen, true);

    headingGroup.dispatchEvent({ type: 'click', stopPropagation: () => {} });
    assert.strictEqual(ui.isNowPlayingOpen, false);
    assert.strictEqual(modal.classList.contains('open'), false);
  });

  test('Channel 4: Pressing Escape key dismisses Now Playing immediately', () => {
    ui.openNowPlayingScreen();
    assert.strictEqual(ui.isNowPlayingOpen, true);

    global.window.triggerEvent('keydown', { key: 'Escape' });
    assert.strictEqual(ui.isNowPlayingOpen, false);
    assert.strictEqual(modal.classList.contains('open'), false);
  });
});
