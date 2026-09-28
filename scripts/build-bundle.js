const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');

const moduleFiles = [
  'js/models/Track.js',
  'js/models/Playlist.js',
  'js/services/StorageService.js',
  'js/services/EqualizerService.js',
  'js/services/AudioService.js',
  'js/services/DownloadService.js',
  'js/services/TrackRepository.js',
  'js/services/VoiceService.js',
  'js/services/SettingsService.js',
  'js/ui/ToastService.js',
  'js/ui/UIController.js'
];

let bundleContent = `/**
 * AURA MUSIC — PRODUCTION NATIVE APPLICATION BUNDLE
 * Built with modular architecture: Models -> Services -> Repository -> Audio Engine -> UI Controller
 */
`;

for (const file of moduleFiles) {
  const filePath = path.join(rootDir, file);
  if (fs.existsSync(filePath)) {
    const code = fs.readFileSync(filePath, 'utf8');
    bundleContent += `\n// ==========================================================================\n// Module: ${file}\n// ==========================================================================\n`;
    bundleContent += code + '\n';
  } else {
    console.error(`Missing module: ${file}`);
  }
}

// Append Application Bootstrapper
bundleContent += `
// ==========================================================================
// APPLICATION BOOTSTRAPPER & GLOBAL EVENT BRIDGES
// ==========================================================================

const storageService = new StorageService();
const equalizerService = new EqualizerService();
const audioService = new AudioService(equalizerService);
const trackRepo = new TrackRepository(storageService);
const downloadService = new DownloadService(storageService);
const settingsService = new SettingsService(storageService, equalizerService);
const voiceService = new VoiceService();
const toast = new ToastService();

const ui = new UIController({
  audioService,
  trackRepo,
  downloadService,
  settingsService,
  voiceService,
  toast
});

window.auraApp = {
  storageService,
  equalizerService,
  audioService,
  trackRepo,
  downloadService,
  settingsService,
  voiceService,
  toast,
  ui
};

// Global Event Bridges for HTML Inline Handlers
window.switchTab = (tab) => ui.switchTab(tab);
window.playTrack = (title, artist, album) => {
  const all = trackRepo.getAllTracks();
  const track = all.find(t => t.title.toLowerCase() === (title || '').toLowerCase());
  if (track) {
    ui.playTrackById(track.id);
  } else if (all.length > 0) {
    ui.playTrackById(all[0].id);
  }
};
window.togglePlayState = () => ui.togglePlayState();
window.skipToNextTrack = () => ui.skipNext();
window.skipToPreviousTrack = () => ui.skipPrevious();
window.seekTrackPosition = (e) => {}; // handled directly in scrubber listener
window.toggleShuffle = () => ui.toggleShuffle();
window.toggleRepeat = () => ui.toggleRepeat();
window.toggleFavorite = () => ui.toggleFavorite();
window.openNowPlayingScreen = () => ui.openNowPlayingScreen();
window.closeNowPlayingScreen = () => ui.closeNowPlayingScreen();
window.onSearchType = (val) => ui.onSearchInput(val);
window.clearSearch = () => ui.clearSearch();
window.selectGenre = (g) => ui.selectGenre(g);
window.startVoiceSearch = () => ui.startVoiceSearch();
window.switchLibraryCategory = (btn, cat) => ui.switchLibraryCategory(btn, cat);
window.openLibraryAddMenu = () => ui.openLibraryAddMenu();
window.playLikedSongs = () => ui.playLikedSongs();
window.actionLikedSongsOptions = () => ui.openLikedSongsDetail();
window.openLikedSongsDetail = () => ui.openLikedSongsDetail();
window.playPlaylistTrack = (plId, tId) => ui.playPlaylistTrack(plId, tId);
window.openCreatePlaylistDialog = () => ui.openCreatePlaylistDialog();
window.closeCreatePlaylistDialog = () => ui.closeCreatePlaylistDialog();
window.submitCreatePlaylist = () => ui.submitCreatePlaylist();
window.openPlaylistOptions = (e, id, title) => ui.promptDeletePlaylist(e, id, title);
window.openTrackOptions = (e, title, artist) => {
  const all = trackRepo.getAllTracks();
  const track = all.find(t => t.title.toLowerCase() === (title || '').toLowerCase());
  ui.openTrackOptions(e, track ? track.id : null);
};
window.closeTrackOptions = () => ui.closeTrackOptions();
window.actionPlayNext = () => ui.actionPlayNext();
window.actionAddToQueue = () => ui.actionAddToQueue();
window.actionAddToPlaylist = () => ui.actionAddToPlaylist();
window.actionDownloadTrack = () => ui.actionDownloadTrack();
window.actionViewArtist = () => ui.actionViewArtist();
window.actionShareTrack = () => ui.actionShareTrack();
window.showAirPlayNotice = () => ui.showAirPlayRouting();
window.showQueueNotice = () => ui.showQueueSheet();
window.toggleOledMode = (checked) => settingsService.setOledMode(checked);
window.cycleAudioQuality = () => ui.cycleAudioQuality();
window.toggleSmartDownloads = (checked) => settingsService.setSmartDownloads(checked);
window.cycleEqualizerPreset = () => ui.cycleEqualizerPreset();
window.toggleCrossfade = (checked) => settingsService.setCrossfade(checked);
window.showAppInfo = () => ui.showAppInfo();

window.openNotifications = () => {};
window.closeNotifications = () => {};

// Network online/offline detection
window.addEventListener('offline', () => {
  toast.show('Офлайн-режим: доступна сохраненная музыка', 'info', 4000);
});
window.addEventListener('online', () => {
  toast.show('Подключение к сети восстановлено', 'success', 3000);
});

// Application Lifecycle Initialization
window.addEventListener('DOMContentLoaded', async () => {
  console.log('[AURA MUSIC] Initializing native production music engine...');
  
  // 1. Initialize Audio Element
  const audioEl = document.getElementById('nativeAudioElement');
  audioService.init(audioEl);

  // 2. Initialize Repositories and Services
  await trackRepo.init();
  await downloadService.init(trackRepo.getAllTracks());
  await settingsService.init();

  // 3. Initialize UI Controller
  ui.init();

  // 4. Configure Native Capacitor Mobile Plugins
  if (window.Capacitor?.Plugins) {
    try {
      const { StatusBar, SplashScreen } = window.Capacitor.Plugins;
      if (StatusBar) {
        await StatusBar.setStyle({ style: 'DARK' });
        await StatusBar.setBackgroundColor({ color: '#080A12' });
      }
      if (SplashScreen) {
        await SplashScreen.hide();
      }
    } catch (e) {
      console.warn('Capacitor native plugins init note:', e);
    }
  }

  // 5. Restore Last Playback Session
  const lastTrackId = await storageService.get('aura_last_track_id', null);
  const tracks = trackRepo.getAllTracks();
  let trackToLoad = tracks[0];
  if (lastTrackId) {
    const found = trackRepo.getTrackById(lastTrackId);
    if (found) trackToLoad = found;
  }
  if (trackToLoad) {
    const lastPosition = await storageService.get('aura_last_position', 0);
    audioService.setQueue(tracks, tracks.indexOf(trackToLoad), false);
    if (lastPosition > 0) {
      audioService.seek(lastPosition);
    }
  }

  // Save state on unload / background
  window.addEventListener('beforeunload', () => {
    if (audioService.currentTrack) {
      storageService.set('aura_last_track_id', audioService.currentTrack.id);
      storageService.set('aura_last_position', audioService.currentTime);
    }
  });

  console.log('[AURA MUSIC] Native production engine ready!');
});
`;

// Write to root app.js
const appJsPath = path.join(rootDir, 'app.js');
fs.writeFileSync(appJsPath, bundleContent, 'utf8');
console.log(`[AURA BUILD] Compiled app.js successfully (${(bundleContent.length / 1024).toFixed(1)} KB)`);

// If dist exists, copy to dist/app.js
const distAppJsPath = path.join(rootDir, 'dist', 'app.js');
if (fs.existsSync(path.join(rootDir, 'dist'))) {
  fs.writeFileSync(distAppJsPath, bundleContent, 'utf8');
  console.log(`[AURA BUILD] Copied bundle to dist/app.js`);
}
