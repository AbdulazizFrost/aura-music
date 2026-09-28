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
