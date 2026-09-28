const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert');

const Track = require('../js/models/Track.js');
const Playlist = require('../js/models/Playlist.js');
const TrackRepository = require('../js/services/TrackRepository.js');

// Mock StorageService for testing
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

describe('TrackRepository Core Logic', () => {
  let repo;
  let mockStorage;

  beforeEach(async () => {
    mockStorage = new MockStorageService();
    repo = new TrackRepository(mockStorage);
    await repo.init();
  });

  test('initializes default catalog of 19 tracks', () => {
    const tracks = repo.getAllTracks();
    assert.strictEqual(tracks.length, 19);
    assert.strictEqual(tracks[0].title, 'Starboy');
    assert.strictEqual(tracks[0].duration, 230);
  });

  test('searches tracks case-insensitively by title, artist, album, genre', () => {
    const byTitle = repo.searchTracks('starboy');
    assert.strictEqual(byTitle.length, 1);
    assert.strictEqual(byTitle[0].title, 'Starboy');

    const byArtist = repo.searchTracks('alan walker');
    assert.strictEqual(byArtist.length, 1);
    assert.strictEqual(byArtist[0].title, 'Faded');

    const byGenre = repo.searchTracks('', 'Рок');
    assert.ok(byGenre.length >= 2);
    assert.strictEqual(byGenre[0].genre, 'Рок');
  });

  test('toggleLike persists liked status and updates track', async () => {
    const trackId = 'track-1';
    assert.strictEqual(repo.isLiked(trackId), true); // default initial liked

    const unliked = await repo.toggleLike(trackId);
    assert.strictEqual(unliked, false);
    assert.strictEqual(repo.isLiked(trackId), false);
    assert.strictEqual(repo.getLikedTracks().find(t => t.id === trackId), undefined);

    const reliked = await repo.toggleLike(trackId);
    assert.strictEqual(reliked, true);
    assert.strictEqual(repo.isLiked(trackId), true);
  });

  test('addRecentlyPlayed adds to head of list and eliminates duplicates', async () => {
    await repo.addRecentlyPlayed('track-5');
    const recent = repo.getRecentlyPlayedTracks();
    assert.strictEqual(recent[0].id, 'track-5');

    // Add again
    await repo.addRecentlyPlayed('track-5');
    const recentAgain = repo.getRecentlyPlayedTracks();
    assert.strictEqual(recentAgain[0].id, 'track-5');
    // Ensure no duplicate track-5
    const count = recentAgain.filter(t => t.id === 'track-5').length;
    assert.strictEqual(count, 1);
  });

  test('playlist lifecycle: create, add track, remove track, delete', async () => {
    const newPl = await repo.createPlaylist('Study Beats');
    assert.ok(newPl);
    assert.strictEqual(newPl.title, 'Study Beats');

    const added = await repo.addTrackToPlaylist(newPl.id, 'track-1');
    assert.strictEqual(added, true);

    const tracksInPl = repo.getPlaylistTracks(newPl.id);
    assert.strictEqual(tracksInPl.length, 1);
    assert.strictEqual(tracksInPl[0].id, 'track-1');

    const removed = await repo.removeTrackFromPlaylist(newPl.id, 'track-1');
    assert.strictEqual(removed, true);
    assert.strictEqual(repo.getPlaylistTracks(newPl.id).length, 0);

    const deleted = await repo.deletePlaylist(newPl.id);
    assert.strictEqual(deleted, true);
    assert.strictEqual(repo.getPlaylistById(newPl.id), null);
  });

  test('aggregates albums and artists correctly', () => {
    const albums = repo.getAlbums();
    assert.ok(albums.length > 0);
    const starboy = albums.find(a => a.name === 'Starboy');
    assert.ok(starboy);
    assert.strictEqual(starboy.artist, 'The Weeknd');

    const artists = repo.getArtists();
    assert.ok(artists.length > 0);
    const theWeeknd = artists.find(a => a.name === 'The Weeknd');
    assert.ok(theWeeknd);
  });

  test('rename playlist and reorder playlist tracks', async () => {
    const pl = await repo.createPlaylist('Favorites Mix');
    await repo.addTrackToPlaylist(pl.id, 'track-1');
    await repo.addTrackToPlaylist(pl.id, 'track-2');
    await repo.addTrackToPlaylist(pl.id, 'track-3');

    // Rename
    const renamed = await repo.renamePlaylist(pl.id, 'Summer Vibe');
    assert.strictEqual(renamed, true);
    assert.strictEqual(repo.getPlaylistById(pl.id).title, 'Summer Vibe');

    // Reorder
    const reordered = await repo.reorderPlaylistTracks(pl.id, 0, 2);
    assert.strictEqual(reordered, true);
    const updatedTracks = repo.getPlaylistTracks(pl.id);
    assert.strictEqual(updatedTracks[0].id, 'track-2');
    assert.strictEqual(updatedTracks[2].id, 'track-1');
  });
});
