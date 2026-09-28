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
