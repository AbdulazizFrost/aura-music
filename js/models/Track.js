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
