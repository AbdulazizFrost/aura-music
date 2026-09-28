const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert');

const Track = require('../js/models/Track.js');
const AudioService = require('../js/services/AudioService.js');

describe('AudioService Core Logic', () => {
  let audioService;
  let sampleTracks;

  beforeEach(() => {
    audioService = new AudioService(null);
    sampleTracks = [
      new Track({ id: 't1', title: 'Song One', artist: 'Artist A', duration: 90, audioSrc: 'audio1.wav' }),
      new Track({ id: 't2', title: 'Song Two', artist: 'Artist B', duration: 90, audioSrc: 'audio2.wav' }),
      new Track({ id: 't3', title: 'Song Three', artist: 'Artist C', duration: 90, audioSrc: 'audio3.wav' })
    ];
  });

  test('setQueue initializes queue, index, and current track', () => {
    audioService.setQueue(sampleTracks, 1, false);
    assert.strictEqual(audioService.queue.length, 3);
    assert.strictEqual(audioService.queueIndex, 1);
    assert.strictEqual(audioService.currentTrack.id, 't2');
  });

  test('addToQueue adds track to the end of the queue', () => {
    audioService.setQueue(sampleTracks, 0, false);
    const newTrack = new Track({ id: 't4', title: 'Song Four' });
    audioService.addToQueue(newTrack);
    assert.strictEqual(audioService.queue.length, 4);
    assert.strictEqual(audioService.queue[3].id, 't4');
  });

  test('playNextInQueue inserts track immediately after current track', () => {
    audioService.setQueue(sampleTracks, 0, false);
    const urgentTrack = new Track({ id: 't-urgent', title: 'Urgent Track' });
    audioService.playNextInQueue(urgentTrack);
    assert.strictEqual(audioService.queue[1].id, 't-urgent');
    assert.strictEqual(audioService.queue[2].id, 't2');
  });

  test('removeFromQueue removes item and adjusts index correctly', () => {
    audioService.setQueue(sampleTracks, 1, false); // current is t2
    audioService.removeFromQueue(0); // remove t1 before current
    assert.strictEqual(audioService.queue.length, 2);
    assert.strictEqual(audioService.queueIndex, 0); // adjusted down to remain on t2
    assert.strictEqual(audioService.queue[0].id, 't2');
  });

  test('clearUpcomingQueue retains only the current track', () => {
    audioService.setQueue(sampleTracks, 1, false);
    audioService.clearUpcomingQueue();
    assert.strictEqual(audioService.queue.length, 1);
    assert.strictEqual(audioService.queueIndex, 0);
    assert.strictEqual(audioService.currentTrack.id, 't2');
  });

  test('toggleRepeat cycles through all -> one -> off -> all', () => {
    assert.strictEqual(audioService.repeatMode, 'all');
    assert.strictEqual(audioService.toggleRepeat(), 'one');
    assert.strictEqual(audioService.toggleRepeat(), 'off');
    assert.strictEqual(audioService.toggleRepeat(), 'all');
  });

  test('toggleShuffle toggles shuffle flag and generates shuffled order', () => {
    audioService.setQueue(sampleTracks, 0, false);
    assert.strictEqual(audioService.isShuffle, false);
    audioService.toggleShuffle();
    assert.strictEqual(audioService.isShuffle, true);
    assert.strictEqual(audioService.shuffledOrder.length, 3);
  });

  test('skipNext advances to next track and loops when repeat is all', () => {
    audioService.setQueue(sampleTracks, 2, false); // at last index
    audioService.repeatMode = 'all';
    audioService.skipNext(false);
    assert.strictEqual(audioService.queueIndex, 0);
    assert.strictEqual(audioService.currentTrack.id, 't1');
  });

  test('skipPrevious returns to previous track or loops to end', () => {
    audioService.setQueue(sampleTracks, 0, false);
    audioService.skipPrevious();
    assert.strictEqual(audioService.queueIndex, 2);
    assert.strictEqual(audioService.currentTrack.id, 't3');
  });

  test('reorderQueue moves track and updates queueIndex accordingly', () => {
    audioService.setQueue(sampleTracks, 0, false); // current is t1 at index 0
    audioService.reorderQueue(0, 2); // move t1 to index 2
    assert.strictEqual(audioService.queue[2].id, 't1');
    assert.strictEqual(audioService.queueIndex, 2);
    assert.strictEqual(audioService.currentTrack.id, 't1');

    audioService.reorderQueue(2, 0);
    assert.strictEqual(audioService.queue[0].id, 't1');
    assert.strictEqual(audioService.queueIndex, 0);
  });

  test('stop and toggleMute control audio element state', () => {
    let paused = false;
    const mockEl = {
      pause: () => { paused = true; },
      currentTime: 45,
      muted: false,
      addEventListener: () => {}
    };
    audioService.init(mockEl);
    audioService.isPlaying = true;
    audioService.duration = 100;

    audioService.stop();
    assert.strictEqual(paused, true);
    assert.strictEqual(audioService.isPlaying, false);
    assert.strictEqual(mockEl.currentTime, 0);

    const isMuted = audioService.toggleMute();
    assert.strictEqual(isMuted, true);
    assert.strictEqual(mockEl.muted, true);
    const unmuted = audioService.toggleMute();
    assert.strictEqual(unmuted, false);
    assert.strictEqual(mockEl.muted, false);
  });
});
