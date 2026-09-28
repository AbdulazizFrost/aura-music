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
