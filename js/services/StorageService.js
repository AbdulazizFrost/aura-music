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
