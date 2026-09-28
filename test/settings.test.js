const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert');

const SettingsService = require('../js/services/SettingsService.js');

class MockStorageService {
  constructor() {
    this.store = new Map();
  }
  async get(key, defaultVal) {
    return this.store.has(key) ? this.store.get(key) : defaultVal;
  }
  async set(key, value) {
    this.store.set(key, value);
  }
  async remove(key) {
    this.store.delete(key);
  }
}

describe('SettingsService Core Logic', () => {
  let settings;
  let mockStorage;

  beforeEach(async () => {
    mockStorage = new MockStorageService();
    settings = new SettingsService(mockStorage, null);
    await settings.init();
  });

  test('setOledMode updates state and persists', async () => {
    assert.strictEqual(settings.isOled, true);
    await settings.setOledMode(false);
    assert.strictEqual(settings.isOled, false);
    assert.strictEqual(await mockStorage.get('aura_oled_mode'), false);
  });

  test('cycleAudioQuality cycles qualities in order and persists', async () => {
    assert.strictEqual(settings.audioQualityIndex, 0);
    const q1 = await settings.cycleAudioQuality();
    assert.strictEqual(settings.audioQualityIndex, 1);
    assert.strictEqual(q1.badge, 'ALAC LOSSLESS');

    const q2 = await settings.cycleAudioQuality();
    assert.strictEqual(settings.audioQualityIndex, 2);
    assert.strictEqual(q2.badge, '320 KBPS AAC');

    const q3 = await settings.cycleAudioQuality();
    assert.strictEqual(settings.audioQualityIndex, 0);
    assert.strictEqual(q3.badge, 'LOSSLESS HI-RES');
  });

  test('setSmartDownloads and setCrossfade persist', async () => {
    await settings.setSmartDownloads(false);
    assert.strictEqual(settings.isSmartDownload, false);
    assert.strictEqual(await mockStorage.get('aura_smart_downloads'), false);

    await settings.setCrossfade(false);
    assert.strictEqual(settings.isCrossfade, false);
    assert.strictEqual(await mockStorage.get('aura_crossfade'), false);
  });
});
