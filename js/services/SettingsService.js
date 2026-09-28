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
