/**
 * UIController — Complete Native Mobile UI View Controller for AURA MUSIC.
 * Connects all screens, controls, gestures, and modals to real application services.
 */
class UIController {
  constructor(deps) {
    this.audioService = deps.audioService;
    this.trackRepo = deps.trackRepo;
    this.downloadService = deps.downloadService;
    this.settingsService = deps.settingsService;
    this.voiceService = deps.voiceService;
    this.toast = deps.toast;

    this.currentTab = 'home';
    this.currentLibraryCategory = 'playlists';
    this.activeSheetTrack = null;
    this.isNowPlayingOpen = false;
    this.isScrubbing = false;
    this.activePlaylistDetail = null;
  }

  init() {
    this._bindAudioEvents();
    this._bindSettingsEvents();
    this._bindRepoEvents();
    this._setupSwipeGestures();
    this._setupScrubberInteraction();
    this._setupGreeting();

    // Ensure smartphone container is NEVER scrolled offscreen by rogue browser focus
    const root = document.getElementById('smartphoneRoot');
    if (root) {
      root.addEventListener('scroll', () => {
        if (root.scrollTop !== 0) root.scrollTop = 0;
        if (root.scrollLeft !== 0) root.scrollLeft = 0;
      }, { passive: false });
    }

    // Render Initial Views
    this.renderRecentlyPlayed();
    this.renderSearchResults(this.trackRepo.getAllTracks());
    this.renderLibrary();
    this.updateLikedBadge();
    this.syncAllUI();
  }

  // --- Reactive Subscriptions ---
  _bindAudioEvents() {
    this.audioService.on('timeupdate', ({ currentTime, duration }) => {
      if (!this.isScrubbing) {
        this._updateScrubberAndProgress(currentTime, duration);
      }
    });

    this.audioService.on('trackchange', (track) => {
      this.syncAllUI();
      this.trackRepo.addRecentlyPlayed(track.id);
      this._updateAmbientGlow(track);
    });

    this.audioService.on('play', () => {
      this._updatePlayPauseIcons(true);
    });

    this.audioService.on('pause', () => {
      this._updatePlayPauseIcons(false);
    });

    this.audioService.on('shufflechange', (isShuffle) => {
      const btn = document.getElementById('btnShuffle');
      if (btn) btn.classList.toggle('active', isShuffle);
    });

    this.audioService.on('repeatchange', (mode) => {
      const btn = document.getElementById('btnRepeat');
      if (btn) {
        btn.classList.toggle('active', mode !== 'off');
        btn.style.opacity = mode === 'off' ? '0.45' : '1.0';
        if (mode === 'one') {
          btn.style.color = '#EC4899';
        } else {
          btn.style.color = '';
        }
      }
    });

    this.audioService.on('error', ({ error, track }) => {
      this.toast.show(`Playback error: ${track?.title || 'Track'} could not be loaded.`, 'error');
    });
  }

  _bindSettingsEvents() {
    this.settingsService.onChange(() => {
      this._updateSettingsUI();
    });
  }

  _bindRepoEvents() {
    this.trackRepo.onChange(() => {
      this.renderRecentlyPlayed();
      this.renderLibrary();
      this.updateLikedBadge();
      this._updateFeaturedCounts();
      this._updateFavoriteButton();
    });
  }

  _setupGreeting() {
    const subtitle = document.querySelector('.user-greeting .greeting-subtitle');
    if (subtitle) {
      const hour = new Date().getHours();
      let greeting = 'Доброе утро';
      if (hour >= 12 && hour < 17) greeting = 'Добрый день';
      if (hour >= 17 || hour < 5) greeting = 'Добрый вечер';
      subtitle.textContent = greeting;
    }
    this._updateFeaturedCounts();
  }

  _updateFeaturedCounts() {
    const chillCount = document.getElementById('fcardChillCount');
    const workoutCount = document.getElementById('fcardWorkoutCount');
    const nightCount = document.getElementById('fcardNightCount');

    const chill = this.trackRepo.getPlaylistById('pl-chill');
    const workout = this.trackRepo.getPlaylistById('pl-workout');
    const night = this.trackRepo.getPlaylistById('pl-night');

    const fmtCount = (n) => {
      if (n % 10 === 1 && n % 100 !== 11) return `${n} трек`;
      if ([2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100)) return `${n} трека`;
      return `${n} треков`;
    };

    if (chillCount && chill) chillCount.textContent = fmtCount(chill.trackIds.length);
    if (workoutCount && workout) workoutCount.textContent = fmtCount(workout.trackIds.length);
    if (nightCount && night) nightCount.textContent = fmtCount(night.trackIds.length);
  }

  openLibraryAddMenu() {
    this.triggerHaptic('LIGHT');
    const content = `
      <div style="padding: 10px 0;">
        <h4 style="font-size:16px; font-weight:800; color:#FFF; margin-bottom:12px;">Добавить в медиатеку</h4>
        <div style="display:flex; flex-direction:column; gap:8px;">
          <button class="sheet-row-btn" onclick="window.auraApp.ui.closeCustomSheet(); window.auraApp.ui.openCreatePlaylistDialog();">
            <i data-lucide="plus-square"></i>
            <span>Создать новый плейлист</span>
          </button>
          <button class="sheet-row-btn" onclick="window.auraApp.ui.closeCustomSheet(); window.auraApp.ui.triggerImportAudio();">
            <i data-lucide="folder-plus"></i>
            <span>Загрузить музыку с устройства (MP3)</span>
          </button>
        </div>
      </div>
    `;
    this._openCustomSheet('Опции медиатеки', content);
  }

  // ==========================================================================
  // NAVIGATION & TABS
  // ==========================================================================
  switchTab(tabName) {
    this.triggerHaptic('LIGHT');
    this.currentTab = tabName;

    document.querySelectorAll('.app-screen').forEach(scr => scr.classList.remove('active'));
    const target = document.getElementById(`screen${this._capitalize(tabName)}`);
    if (target) target.classList.add('active');

    document.querySelectorAll('.tab-item').forEach(btn => btn.classList.remove('active'));
    const activeBtn = document.getElementById(`tab${this._capitalize(tabName)}`);
    if (activeBtn) activeBtn.classList.add('active');

    if (tabName === 'search') {
      const input = document.getElementById('liveSearchInput');
      if (input && input.value.trim().length === 0) {
        this.renderSearchResults(this.trackRepo.getAllTracks());
      }
    } else if (tabName === 'library') {
      this.renderLibrary();
    }
  }

  _capitalize(s) {
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  openNowPlayingScreen() {
    this.triggerHaptic('LIGHT');
    const modal = document.getElementById('nowPlayingModal');
    if (modal) {
      this.isNowPlayingOpen = true;
      modal.classList.remove('dragging');
      modal.style.transform = '';
      modal.classList.add('open');
    }
  }

  closeNowPlayingScreen() {
    this.triggerHaptic('LIGHT');
    const modal = document.getElementById('nowPlayingModal');
    if (modal) {
      this.isNowPlayingOpen = false;
      modal.classList.remove('dragging');
      modal.style.transform = '';
      modal.classList.remove('open');
    }
  }

  _setupSwipeGestures() {
    const modal = document.getElementById('nowPlayingModal');
    const handleBar = document.getElementById('npSwipeHandleBar');
    const dragPill = document.querySelector('.np-drag-pill-wrap');
    const artwork = document.querySelector('.np-artwork-container');
    if (!modal) return;

    let startY = 0;
    let isDragging = false;

    const onStart = (clientY, target) => {
      // Don't drag if user clicked an interactive control
      if (target && target.closest && target.closest('.np-icon-btn, .np-ctrl-action, .sub-action-btn, #npFavoriteBtn, #scrubberTrackLine, button, a')) {
        return false;
      }
      startY = clientY;
      isDragging = true;
      modal.classList.add('dragging');
      return true;
    };

    const onMove = (clientY) => {
      if (!isDragging) return;
      const deltaY = clientY - startY;
      if (deltaY > 0) {
        modal.style.transform = `translateY(${deltaY}px)`;
      }
    };

    const onEnd = (clientY) => {
      if (!isDragging) return;
      isDragging = false;
      modal.classList.remove('dragging');
      const deltaY = clientY - startY;
      if (deltaY > 50) {
        this.closeNowPlayingScreen();
      } else {
        modal.style.transform = '';
      }
    };

    // Touch events for mobile: drag down from top bar, drag pill, artwork, or modal
    const touchElements = [modal, handleBar, dragPill, artwork].filter(Boolean);
    touchElements.forEach(el => {
      el.addEventListener('touchstart', (e) => {
        onStart(e.touches[0].clientY, e.target);
      }, { passive: true });

      el.addEventListener('touchmove', (e) => {
        onMove(e.touches[0].clientY);
      }, { passive: true });

      el.addEventListener('touchend', (e) => {
        const clientY = e.changedTouches[0]?.clientY || startY;
        onEnd(clientY);
      });
    });

    // Mouse drag events for desktop browser testing on top area and artwork
    const dragElements = [handleBar, dragPill, artwork].filter(Boolean);
    dragElements.forEach(el => {
      el.addEventListener('mousedown', (e) => {
        if (onStart(e.clientY, e.target)) {
          const moveHandler = (ev) => onMove(ev.clientY);
          const upHandler = (ev) => {
            window.removeEventListener('mousemove', moveHandler);
            window.removeEventListener('mouseup', upHandler);
            onEnd(ev.clientY);
          };
          window.addEventListener('mousemove', moveHandler);
          window.addEventListener('mouseup', upHandler);
        }
      });
    });

    // Explicit Close Button handlers: click + touchend + onclick fallback
    const closeBtn = document.getElementById('npCloseBtn');
    if (closeBtn) {
      const handleClose = (e) => {
        if (e) {
          e.stopPropagation();
          e.preventDefault();
        }
        this.closeNowPlayingScreen();
      };
      closeBtn.onclick = handleClose;
      closeBtn.addEventListener('click', handleClose);
      closeBtn.addEventListener('touchend', handleClose);
    }

    // Drag Pill tap/click to close
    if (dragPill) {
      dragPill.onclick = (e) => {
        if (e) e.stopPropagation();
        this.closeNowPlayingScreen();
      };
    }

    // Dynamic Island / Notch tap to close when Now Playing is open
    const phoneNotch = document.querySelector('.phone-dynamic-notch');
    if (phoneNotch) {
      phoneNotch.style.cursor = 'pointer';
      phoneNotch.onclick = (e) => {
        if (this.isNowPlayingOpen) {
          if (e) e.stopPropagation();
          this.closeNowPlayingScreen();
        }
      };
    }

    // Top Header text tap to close
    const headingGroup = document.querySelector('.np-heading-group');
    if (headingGroup) {
      headingGroup.style.cursor = 'pointer';
      headingGroup.title = 'Нажмите, чтобы свернуть';
      headingGroup.onclick = (e) => {
        if (e) e.stopPropagation();
        this.closeNowPlayingScreen();
      };
    }

    // Keyboard Escape Key to close Now Playing on desktop
    if (typeof window !== 'undefined' && window.addEventListener) {
      window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          this.closeNowPlayingScreen();
        }
      });
    }

    // Clicking desktop backdrop outside phone shell closes Now Playing
    if (typeof document !== 'undefined' && document.addEventListener) {
      document.addEventListener('click', (e) => {
        if (!this.isNowPlayingOpen) return;
        const root = document.getElementById('smartphoneRoot');
        if (root && root.contains && !root.contains(e.target)) {
          this.closeNowPlayingScreen();
        }
      });
    }

    // Native Android / Capacitor Back Button Support
    if (window.Capacitor?.Plugins?.App) {
      window.Capacitor.Plugins.App.addListener('backButton', () => {
        if (this.isNowPlayingOpen) {
          this.closeNowPlayingScreen();
        }
      });
    }
  }

  // ==========================================================================
  // PLAYBACK ACTIONS
  // ==========================================================================
  playTrackById(trackId) {
    const track = this.trackRepo.getTrackById(trackId);
    if (!track) return Promise.resolve();
    this.triggerHaptic('MEDIUM');

    const allTracks = this.trackRepo.getAllTracks();
    const index = allTracks.findIndex(t => t.id === trackId);
    return this.audioService.setQueue(allTracks, Math.max(0, index), true);
  }

  playPlaylist(playlistId, shuffle = false) {
    const tracks = this.trackRepo.getPlaylistTracks(playlistId);
    if (!tracks || tracks.length === 0) {
      this.toast.show('Плейлист пуст. Добавьте треки!', 'info');
      return Promise.resolve();
    }
    this.triggerHaptic('MEDIUM');
    const p = this.audioService.setQueue(tracks, 0, true);
    if (shuffle && !this.audioService.isShuffle) {
      this.audioService.toggleShuffle();
    }
    this.toast.show(`Воспроизведение плейлиста (${tracks.length} треков)`, 'success');
    return p;
  }

  playLikedSongs() {
    const liked = this.trackRepo.getLikedTracks();
    if (liked.length === 0) {
      this.toast.show('Пока нет любимых треков! Нажмите ❤️ на любом треке.', 'heart');
      return;
    }
    this.triggerHaptic('MEDIUM');
    this.audioService.setQueue(liked, 0, true);
    this.toast.show(`Воспроизведение: ${liked.length} любимых треков`, 'heart');
  }

  togglePlayState() {
    this.triggerHaptic('LIGHT');
    if (!this.audioService.currentTrack) {
      const first = this.trackRepo.getAllTracks()[0];
      if (first) {
        this.audioService.setQueue(this.trackRepo.getAllTracks(), 0, true);
      }
      return;
    }
    this.audioService.togglePlay();
  }

  skipNext() {
    this.triggerHaptic('LIGHT');
    this.audioService.skipNext();
  }

  skipPrevious() {
    this.triggerHaptic('LIGHT');
    this.audioService.skipPrevious();
  }

  toggleShuffle() {
    this.triggerHaptic('LIGHT');
    const isShuffle = this.audioService.toggleShuffle();
    this.toast.show(isShuffle ? 'Случайный порядок включен' : 'Случайный порядок выключен', 'info');
  }

  toggleRepeat() {
    this.triggerHaptic('LIGHT');
    const mode = this.audioService.toggleRepeat();
    let label = 'Повтор очереди';
    if (mode === 'one') label = 'Повтор текущего трека';
    if (mode === 'off') label = 'Повтор выключен';
    this.toast.show(label, 'info');
  }

  async toggleFavorite() {
    const track = this.audioService.currentTrack;
    if (!track) return;
    this.triggerHaptic('MEDIUM');

    const isLiked = await this.trackRepo.toggleLike(track.id);
    this.toast.show(
      isLiked ? `"${track.title}" добавлен в любимые` : `"${track.title}" удален из любимых`,
      'heart'
    );

    // Smart auto-download for offline listening
    if (isLiked && this.settingsService.smartDownloads && !this.downloadService.isDownloaded(track.id)) {
      this.downloadService.downloadTrack(track).then((res) => {
        if (res?.success) {
          this.toast.show(`"${track.title}" автосохранен офлайн`, 'success');
        }
      });
    }
  }

  // ==========================================================================
  // SCRUBBER & TIMELINE
  // ==========================================================================
  _setupScrubberInteraction() {
    const line = document.getElementById('scrubberTrackLine');
    if (!line) return;

    const handleSeek = (clientX) => {
      const rect = line.getBoundingClientRect();
      const clickX = clientX - rect.left;
      const percentage = Math.max(0, Math.min(1, clickX / rect.width));
      const targetTime = Math.floor(percentage * (this.audioService.duration || 90));
      this.audioService.seek(targetTime);
      this._updateScrubberAndProgress(targetTime, this.audioService.duration || 90);
    };

    line.addEventListener('click', (e) => {
      handleSeek(e.clientX);
    });

    line.addEventListener('touchstart', (e) => {
      this.isScrubbing = true;
      handleSeek(e.touches[0].clientX);
    }, { passive: true });

    line.addEventListener('touchmove', (e) => {
      if (!this.isScrubbing) return;
      handleSeek(e.touches[0].clientX);
    }, { passive: true });

    line.addEventListener('touchend', () => {
      this.isScrubbing = false;
    });
  }

  _updateScrubberAndProgress(currentTime, duration) {
    const dur = duration || 90;
    const pct = Math.min(100, Math.max(0, (currentTime / dur) * 100));

    // Mini Player Progress
    const miniTrack = document.getElementById('miniProgressTrack');
    if (miniTrack) miniTrack.style.width = `${pct}%`;

    // Scrubber Fills
    const scrubberFill = document.getElementById('scrubberFill');
    const scrubberHandle = document.getElementById('scrubberHandle');
    if (scrubberFill) scrubberFill.style.width = `${pct}%`;
    if (scrubberHandle) scrubberHandle.style.left = `${pct}%`;

    // Timestamps
    const timeElapsed = document.getElementById('timeElapsed');
    const timeRemaining = document.getElementById('timeRemaining');
    if (timeElapsed) timeElapsed.textContent = this._formatSeconds(currentTime);
    if (timeRemaining) timeRemaining.textContent = `-${this._formatSeconds(Math.max(0, dur - currentTime))}`;

    // Lyrics
    this._renderLyrics(currentTime);
  }

  _renderLyrics(currentTime) {
    const container = document.getElementById('lyricsStreamLines');
    if (!container) return;

    const track = this.audioService.currentTrack;
    if (!track || !track.lyrics || track.lyrics.length === 0) {
      container.innerHTML = `
        <div style="padding: 24px; text-align: center; color: var(--text-muted); font-size: 13px;">
          Инструментальный трек или текст песни недоступен.
        </div>
      `;
      return;
    }

    const lyrics = track.lyrics;
    let activeIndex = 0;
    lyrics.forEach((l, idx) => {
      if (currentTime >= l.time) activeIndex = idx;
    });

    container.innerHTML = lyrics.map((l, idx) => {
      let cls = 'upcoming';
      if (idx < activeIndex) cls = 'past';
      if (idx === activeIndex) cls = 'active-line';
      return `<p class="np-lyric ${cls}" onclick="window.auraApp.audioService.seek(${l.time})">${l.text}</p>`;
    }).join('');

    // Smooth auto scroll to active lyric (ONLY inside lyrics container, NEVER scrolling page/smartphoneRoot)
    const activeEl = container.querySelector('.active-line');
    if (activeEl && this.isNowPlayingOpen) {
      const containerHeight = container.clientHeight;
      if (containerHeight > 0) {
        const lineTop = activeEl.offsetTop - container.offsetTop;
        const targetScroll = lineTop - (containerHeight / 2) + (activeEl.clientHeight / 2);
        container.scrollTo({ top: Math.max(0, targetScroll), behavior: 'smooth' });
      }
    }
  }

  _formatSeconds(secs) {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  }

  // ==========================================================================
  // UI SYNCHRONIZATION
  // ==========================================================================
  syncAllUI() {
    const track = this.audioService.currentTrack;
    if (!track) return;

    // Mini Player
    const miniTitle = document.getElementById('miniSongTitle');
    const miniArtist = document.getElementById('miniArtistSub');
    const miniCover = document.getElementById('miniArtImg');
    if (miniTitle) miniTitle.textContent = track.title;
    if (miniArtist) miniArtist.textContent = track.artist;
    if (miniCover) miniCover.src = track.cover;

    // Now Playing
    const npSong = document.getElementById('npSongName');
    const npArtist = document.getElementById('npArtistName');
    const npArtwork = document.getElementById('npArtworkImg');
    const npBadge = document.getElementById('npBadgeName');
    const npPlaylist = document.getElementById('npPlaylistTitle');
    if (npSong) npSong.textContent = track.title;
    if (npArtist) npArtist.textContent = track.artist;
    if (npArtwork) npArtwork.src = track.cover;
    if (npBadge) npBadge.textContent = this.settingsService.getCurrentQuality().badge;
    if (npPlaylist) npPlaylist.textContent = track.album || 'AURA MUSIC';

    this._updatePlayPauseIcons(this.audioService.isPlaying);
    this._updateFavoriteButton();
    this._updateScrubberAndProgress(this.audioService.currentTime, this.audioService.duration);
  }

  _updatePlayPauseIcons(isPlaying) {
    const iconPlays = document.querySelectorAll('.icon-play-state, .master-play-icon');
    const iconPauses = document.querySelectorAll('.icon-pause-state, .master-pause-icon');
    const activeEq = document.querySelector('.song-row-item.active .equalizer-bars-live');

    iconPlays.forEach(el => el.style.display = isPlaying ? 'none' : 'block');
    iconPauses.forEach(el => el.style.display = isPlaying ? 'block' : 'none');
    if (activeEq) activeEq.style.display = isPlaying ? 'flex' : 'none';
  }

  _updateFavoriteButton() {
    const track = this.audioService.currentTrack;
    const isLiked = track ? this.trackRepo.isLiked(track.id) : false;
    const heartBtn = document.getElementById('npFavoriteBtn');
    if (heartBtn) {
      heartBtn.classList.toggle('active', isLiked);
    }
  }

  _updateAmbientGlow(track) {
    const glow = document.getElementById('npAmbientGlow');
    if (!glow || !track) return;
    // Map genre to luxury theme glow
    const colors = {
      'Synthwave': 'rgba(168, 85, 247, 0.45) 0%, rgba(236, 72, 153, 0.25) 45%',
      'Pop': 'rgba(236, 72, 153, 0.45) 0%, rgba(249, 115, 22, 0.25) 45%',
      'R&B': 'rgba(249, 115, 22, 0.45) 0%, rgba(217, 70, 239, 0.25) 45%',
      'Rock': 'rgba(59, 130, 246, 0.45) 0%, rgba(168, 85, 247, 0.25) 45%',
      'Electronic': 'rgba(6, 182, 212, 0.45) 0%, rgba(59, 130, 246, 0.25) 45%'
    };
    const grad = colors[track.genre] || colors['Synthwave'];
    glow.style.background = `radial-gradient(circle at 50% 30%, ${grad}, transparent 75%)`;
  }

  // ==========================================================================
  // SCREEN 1: HOME
  // ==========================================================================
  renderRecentlyPlayed() {
    const container = document.getElementById('homeRecentSongsContainer');
    if (!container) return;

    const tracks = this.trackRepo.getRecentlyPlayedTracks();
    if (tracks.length === 0) {
      container.innerHTML = `
        <div style="padding: 20px; text-align: center; color: var(--text-muted); font-size: 13px;">
          Недавно прослушанных треков пока нет. Включите любой трек выше!
        </div>
      `;
      return;
    }

    const currentId = this.audioService.currentTrack?.id;
    container.innerHTML = tracks.map(song => {
      const isCurrent = song.id === currentId;
      return `
        <div class="song-row-item ${isCurrent ? 'active' : ''}" onclick="window.auraApp.ui.playTrackById('${song.id}')">
          <div class="song-cover-box">
            <img src="${song.cover}" alt="${song.title}" class="song-art-img">
            ${isCurrent ? `
              <div class="equalizer-bars-live" style="display:${this.audioService.isPlaying ? 'flex' : 'none'};">
                <span></span><span></span><span></span>
              </div>
            ` : ''}
          </div>
          <div class="song-metadata">
            <h4 class="song-title-text">${song.title}</h4>
            <p class="song-artist-text">${song.artist}</p>
          </div>
          <span class="song-time-text">${this._formatSeconds(song.duration)}</span>
          <button class="more-options-btn" onclick="window.auraApp.ui.openTrackOptions(event, '${song.id}')" aria-label="More">
            <i data-lucide="more-vertical"></i>
          </button>
        </div>
      `;
    }).join('');

    if (window.lucide) window.lucide.createIcons();
  }

  // ==========================================================================
  // SCREEN 2: SEARCH
  // ==========================================================================
  onSearchInput(val) {
    const query = val.trim();
    const clearBtn = document.getElementById('btnSearchClear');
    const genreSection = document.getElementById('sectionBrowseGenre');
    const header = document.getElementById('searchListHeader');

    if (query.length > 0) {
      if (clearBtn) clearBtn.style.display = 'flex';
      if (genreSection) genreSection.style.display = 'none';
      if (header) header.textContent = `Результаты по запросу "${val}"`;

      this.trackRepo.addSearchHistory(query);
      const filtered = this.trackRepo.searchTracks(query);
      this.renderSearchResults(filtered);
    } else {
      this.clearSearch();
    }
  }

  clearSearch() {
    const input = document.getElementById('liveSearchInput');
    const clearBtn = document.getElementById('btnSearchClear');
    const genreSection = document.getElementById('sectionBrowseGenre');
    const header = document.getElementById('searchListHeader');

    if (input) input.value = '';
    if (clearBtn) clearBtn.style.display = 'none';
    if (genreSection) genreSection.style.display = 'block';
    if (header) header.textContent = 'Сейчас в тренде';

    this.renderSearchResults(this.trackRepo.getAllTracks());
  }

  selectGenre(genreName) {
    this.triggerHaptic('LIGHT');
    const input = document.getElementById('liveSearchInput');
    const clearBtn = document.getElementById('btnSearchClear');
    const genreSection = document.getElementById('sectionBrowseGenre');
    const header = document.getElementById('searchListHeader');

    const genreAliases = {
      'pop': 'Поп',
      'поп': 'Поп',
      'electronic': 'Электроника',
      'электроника': 'Электроника',
      'rock': 'Рок',
      'рок': 'Рок',
      'r&b': 'R&B',
      'rnb': 'R&B'
    };
    const canonicalGenre = genreAliases[genreName.toLowerCase()] || genreName;

    if (input) input.value = canonicalGenre;
    if (clearBtn) clearBtn.style.display = 'flex';
    if (genreSection) genreSection.style.display = 'none';
    if (header) header.textContent = `Жанр: ${canonicalGenre}`;

    const filtered = this.trackRepo.searchTracks('', canonicalGenre);
    this.renderSearchResults(filtered);
  }

  startVoiceSearch() {
    this.triggerHaptic('LIGHT');
    this.toast.show('Слушаю... Назовите трек или исполнителя', 'info', 3000);

    this.voiceService.startListening(
      (transcript) => {
        this.toast.show(`Распознано: "${transcript}"`, 'success');
        const input = document.getElementById('liveSearchInput');
        if (input) input.value = transcript;
        this.onSearchInput(transcript);
      },
      (err) => {
        const msg = err.message || 'Голосовой поиск недоступен. Введите запрос вручную.';
        this.toast.show(msg, 'error');
      }
    );
  }

  renderSearchResults(tracks) {
    const container = document.getElementById('searchResultsContainer');
    if (!container) return;

    if (tracks.length === 0) {
      container.innerHTML = `
        <div style="padding: 32px 16px; text-align: center; color: var(--text-muted); font-size: 14px;">
          <i data-lucide="music-off" style="width:36px; height:36px; margin-bottom:8px; opacity:0.6;"></i>
          <p>По вашему запросу ничего не найдено.</p>
        </div>
      `;
      if (window.lucide) window.lucide.createIcons();
      return;
    }

    const currentId = this.audioService.currentTrack?.id;
    container.innerHTML = tracks.map(song => {
      const isCurrent = song.id === currentId;
      return `
        <div class="song-row-item ${isCurrent ? 'active' : ''}" onclick="window.auraApp.ui.playTrackById('${song.id}')">
          <div class="song-cover-box">
            <img src="${song.cover}" alt="${song.title}" class="song-art-img">
          </div>
          <div class="song-metadata">
            <h4 class="song-title-text">${song.title}</h4>
            <p class="song-artist-text">${song.artist}</p>
          </div>
          <span class="song-time-text">${this._formatSeconds(song.duration)}</span>
          <button class="more-options-btn" onclick="window.auraApp.ui.openTrackOptions(event, '${song.id}')" aria-label="More">
            <i data-lucide="more-vertical"></i>
          </button>
        </div>
      `;
    }).join('');

    if (window.lucide) window.lucide.createIcons();
  }

  // ==========================================================================
  // SCREEN 3: LIBRARY
  // ==========================================================================
  switchLibraryCategory(btn, category) {
    this.triggerHaptic('LIGHT');
    document.querySelectorAll('.seg-pill').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    this.currentLibraryCategory = category;
    this.renderLibrary();
  }

  updateLikedBadge() {
    const counter = document.getElementById('likedCounterText');
    if (counter) {
      const count = this.trackRepo.likedSongIds.size;
      let word = 'треков';
      if (count % 10 === 1 && count % 100 !== 11) word = 'трек';
      else if ([2, 3, 4].includes(count % 10) && ![12, 13, 14].includes(count % 100)) word = 'трека';
      counter.textContent = `${count} ${word}`;
    }
  }

  renderLibrary() {
    const container = document.getElementById('libraryListContainer');
    if (!container) return;

    if (this.currentLibraryCategory === 'songs') {
      const songs = this.trackRepo.getAllTracks();
      container.innerHTML = songs.map(song => `
        <div class="library-row" onclick="window.auraApp.ui.playTrackById('${song.id}')">
          <div class="lib-cover">
            <img src="${song.cover}" alt="${song.title}">
          </div>
          <div class="lib-meta">
            <h4 class="lib-title">${song.title}</h4>
            <span class="lib-sub">${song.artist} • ${this._formatSeconds(song.duration)}</span>
          </div>
          <button class="more-options-btn" onclick="window.auraApp.ui.openTrackOptions(event, '${song.id}')">
            <i data-lucide="more-vertical"></i>
          </button>
        </div>
      `).join('');
    } else if (this.currentLibraryCategory === 'albums') {
      const albums = this.trackRepo.getAlbums();
      container.innerHTML = albums.map(alb => `
        <div class="library-row" onclick="window.auraApp.ui.playAlbum('${alb.name}')">
          <div class="lib-cover">
            <img src="${alb.cover}" alt="${alb.name}">
          </div>
          <div class="lib-meta">
            <h4 class="lib-title">${alb.name}</h4>
            <span class="lib-sub">${alb.artist} • ${alb.songsCount} трек(ов)</span>
          </div>
          <button class="more-options-btn" onclick="window.auraApp.ui.playAlbum('${alb.name}')">
            <i data-lucide="play"></i>
          </button>
        </div>
      `).join('');
    } else if (this.currentLibraryCategory === 'artists') {
      const artists = this.trackRepo.getArtists();
      container.innerHTML = artists.map(art => `
        <div class="library-row" onclick="window.auraApp.ui.selectGenre('${art.name}')">
          <div class="lib-cover" style="border-radius: 50%;">
            <img src="${art.cover}" alt="${art.name}">
          </div>
          <div class="lib-meta">
            <h4 class="lib-title">${art.name}</h4>
            <span class="lib-sub">Подтвержденный артист • ${art.songsCount} трек(ов)</span>
          </div>
          <button class="more-options-btn"><i data-lucide="chevron-right"></i></button>
        </div>
      `).join('');
    } else {
      // Playlists
      const playlists = this.trackRepo.getPlaylists();
      container.innerHTML = playlists.map(pl => `
        <div class="library-row" onclick="window.auraApp.ui.openPlaylistDetail('${pl.id}')">
          <div class="lib-cover">
            <img src="${pl.cover}" alt="${pl.title}">
          </div>
          <div class="lib-meta">
            <h4 class="lib-title">${pl.title}</h4>
            <span class="lib-sub">${pl.trackIds.length} трек(ов)</span>
          </div>
          <button class="more-options-btn" onclick="window.auraApp.ui.promptDeletePlaylist(event, '${pl.id}', '${pl.title}')">
            <i data-lucide="more-vertical"></i>
          </button>
        </div>
      `).join('');
    }

    if (window.lucide) window.lucide.createIcons();
  }

  playAlbum(albumName) {
    const tracks = this.trackRepo.getAllTracks().filter(t => t.album === albumName);
    if (tracks.length > 0) {
      this.triggerHaptic('MEDIUM');
      this.audioService.setQueue(tracks, 0, true);
      this.toast.show(`Воспроизведение альбома "${albumName}"`, 'success');
    }
  }

  // ==========================================================================
  // PLAYLIST MODALS & MANAGEMENT
  // ==========================================================================
  openCreatePlaylistDialog() {
    this.triggerHaptic('LIGHT');
    const d = document.getElementById('createPlaylistDialog');
    if (d) {
      d.classList.add('open');
      const input = document.getElementById('newPlaylistInput');
      if (input) {
        input.value = '';
        input.focus();
      }
    }
  }

  closeCreatePlaylistDialog() {
    const d = document.getElementById('createPlaylistDialog');
    if (d) d.classList.remove('open');
  }

  async submitCreatePlaylist() {
    const input = document.getElementById('newPlaylistInput');
    const title = input ? input.value.trim() : '';
    if (title) {
      this.triggerHaptic('MEDIUM');
      const pl = await this.trackRepo.createPlaylist(title);
      this.toast.show(`Плейлист "${pl.title}" создан!`, 'success');
      this.renderLibrary();
    }
    this.closeCreatePlaylistDialog();
  }

  async promptDeletePlaylist(e, plId, plTitle) {
    if (e) e.stopPropagation();
    this.triggerHaptic('MEDIUM');
    if (confirm(`Удалить плейлист "${plTitle}"?`)) {
      await this.trackRepo.deletePlaylist(plId);
      this.toast.show(`Плейлист "${plTitle}" удален`, 'info');
      this.renderLibrary();
    }
  }

  // Playlist Detail Sheet
  openPlaylistDetail(playlistId) {
    const pl = this.trackRepo.getPlaylistById(playlistId);
    if (!pl) return;
    this.triggerHaptic('LIGHT');
    this.activePlaylistDetail = pl;

    const tracks = this.trackRepo.getPlaylistTracks(playlistId);
    const content = `
      <div style="padding: 8px 0 20px;">
        <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:18px;">
          <div style="display:flex; align-items:center; gap:16px;">
            <img src="${pl.cover}" style="width:72px; height:72px; border-radius:12px; object-fit:cover;">
            <div>
              <h3 style="font-size:18px; font-weight:800; color:#FFF;">${pl.title}</h3>
              <span style="font-size:12px; color:var(--text-secondary);">${tracks.length} треков</span>
            </div>
          </div>
          <button class="more-options-btn" onclick="window.auraApp.ui.promptRenamePlaylist('${pl.id}')" title="Переименовать" style="padding:8px 12px; background:rgba(255,255,255,0.08); border-radius:10px; font-size:12px; color:#FFF; display:flex; align-items:center; gap:6px;">
            <i data-lucide="edit-2"></i>
            <span>Имя</span>
          </button>
        </div>
        <div style="display:flex; gap:10px; margin-bottom:16px;">
          <button class="dialog-btn confirm" style="flex:1;" onclick="window.auraApp.ui.playPlaylist('${pl.id}', false)">
            <i data-lucide="play"></i> Слушать
          </button>
          <button class="dialog-btn cancel" style="flex:1;" onclick="window.auraApp.ui.playPlaylist('${pl.id}', true)">
            <i data-lucide="shuffle"></i> Вперемешку
          </button>
        </div>
        <div class="song-list-view" style="max-height: 280px; overflow-y: auto;">
          ${tracks.length === 0 ? `
            <div style="padding: 20px; text-align: center; color: var(--text-muted); font-size: 13px;">
              В этом плейлисте пока нет треков. Нажмите «...» на любом треке, чтобы добавить!
            </div>
          ` : tracks.map((t, idx) => `
            <div class="song-row-item" onclick="window.auraApp.ui.playPlaylistTrack('${pl.id}', '${t.id}')">
              <div class="song-cover-box"><img src="${t.cover}" class="song-art-img"></div>
              <div class="song-metadata">
                <h4 class="song-title-text">${t.title}</h4>
                <p class="song-artist-text">${t.artist}</p>
              </div>
              <div style="display:flex; align-items:center; gap:4px;" onclick="event.stopPropagation()">
                ${idx > 0 ? `
                  <button class="more-options-btn" style="padding:4px;" onclick="window.auraApp.ui.movePlaylistTrack('${pl.id}', ${idx}, -1)" title="Поднять выше">
                    <i data-lucide="chevron-up"></i>
                  </button>
                ` : ''}
                ${idx < tracks.length - 1 ? `
                  <button class="more-options-btn" style="padding:4px;" onclick="window.auraApp.ui.movePlaylistTrack('${pl.id}', ${idx}, 1)" title="Опустить ниже">
                    <i data-lucide="chevron-down"></i>
                  </button>
                ` : ''}
                <button class="more-options-btn" onclick="window.auraApp.ui.removeTrackFromPlaylist('${pl.id}', '${t.id}')" title="Удалить из плейлиста">
                  <i data-lucide="minus-circle"></i>
                </button>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    this._openCustomSheet('Плейлист', content);
  }

  playPlaylistTrack(playlistId, trackId) {
    const tracks = this.trackRepo.getPlaylistTracks(playlistId);
    const idx = tracks.findIndex(t => t.id === trackId);
    if (idx !== -1) {
      this.triggerHaptic('LIGHT');
      this.audioService.setQueue(tracks, idx, true);
      this.closeCustomSheet();
    }
  }

  async promptRenamePlaylist(playlistId) {
    const pl = this.trackRepo.getPlaylistById(playlistId);
    if (!pl) return;
    const newTitle = prompt('Новое название плейлиста:', pl.title);
    if (newTitle && newTitle.trim() && newTitle.trim() !== pl.title) {
      await this.trackRepo.renamePlaylist(playlistId, newTitle.trim());
      this.toast.show(`Плейлист переименован в "${newTitle.trim()}"`, 'success');
      this.openPlaylistDetail(playlistId);
      this.renderLibrary();
    }
  }

  async movePlaylistTrack(playlistId, fromIndex, direction) {
    const toIndex = fromIndex + direction;
    const success = await this.trackRepo.reorderPlaylistTracks(playlistId, fromIndex, toIndex);
    if (success) {
      this.openPlaylistDetail(playlistId);
    }
  }

  openLikedSongsDetail() {
    this.triggerHaptic('LIGHT');
    const liked = this.trackRepo.getLikedTracks();
    const content = `
      <div style="padding: 8px 0 20px;">
        <div style="display:flex; align-items:center; gap:16px; margin-bottom:18px;">
          <div style="width:72px; height:72px; border-radius:12px; background:linear-gradient(135deg, #EC4899 0%, #8B5CF6 100%); display:flex; align-items:center; justify-content:center;">
            <i data-lucide="heart" style="color:#FFF; width:36px; height:36px;"></i>
          </div>
          <div>
            <h3 style="font-size:18px; font-weight:800; color:#FFF;">Любимые треки</h3>
            <span style="font-size:12px; color:var(--text-secondary);">${liked.length} треков</span>
          </div>
        </div>
        <div style="display:flex; gap:10px; margin-bottom:16px;">
          <button class="dialog-btn confirm" style="flex:1;" onclick="window.auraApp.ui.playLikedSongs(); window.auraApp.ui.closeCustomSheet();">
            <i data-lucide="play"></i> Слушать
          </button>
          <button class="dialog-btn cancel" style="flex:1;" onclick="window.auraApp.ui.playLikedSongsShuffled(); window.auraApp.ui.closeCustomSheet();">
            <i data-lucide="shuffle"></i> Вперемешку
          </button>
        </div>
        <div class="song-list-view" style="max-height: 280px; overflow-y: auto;">
          ${liked.length === 0 ? `
            <div style="padding: 20px; text-align: center; color: var(--text-muted); font-size: 13px;">
              Нет избранных треков. Нажмите ❤️ на любом треке, чтобы добавить его сюда!
            </div>
          ` : liked.map((t, idx) => `
            <div class="song-row-item" onclick="window.auraApp.audioService.setQueue(window.auraApp.trackRepo.getLikedTracks(), ${idx}, true); window.auraApp.ui.closeCustomSheet();">
              <div class="song-cover-box"><img src="${t.cover}" class="song-art-img"></div>
              <div class="song-metadata">
                <h4 class="song-title-text">${t.title}</h4>
                <p class="song-artist-text">${t.artist}</p>
              </div>
              <button class="more-options-btn" onclick="event.stopPropagation(); window.auraApp.ui.removeFromLiked('${t.id}')">
                <i data-lucide="heart" style="color:#EC4899; fill:#EC4899;"></i>
              </button>
            </div>
          `).join('')}
        </div>
      </div>
    `;
    this._openCustomSheet('Любимые треки', content);
  }

  playLikedSongsShuffled() {
    const liked = this.trackRepo.getLikedTracks();
    if (liked.length === 0) {
      this.toast.show('Пока нет любимых треков! Нажмите ❤️ на любом треке.', 'heart');
      return;
    }
    this.triggerHaptic('MEDIUM');
    this.audioService.setQueue(liked, 0, true);
    if (!this.audioService.isShuffle) {
      this.audioService.toggleShuffle();
    }
    this.toast.show(`Воспроизведение: ${liked.length} любимых треков (Вперемешку)`, 'heart');
  }

  async removeFromLiked(trackId) {
    await this.trackRepo.toggleLike(trackId);
    this.toast.show('Удалено из любимых', 'info');
    this.openLikedSongsDetail();
    this.updateLikedBadge();
  }

  async removeTrackFromPlaylist(playlistId, trackId) {
    await this.trackRepo.removeTrackFromPlaylist(playlistId, trackId);
    this.toast.show('Трек удален из плейлиста', 'info');
    this.openPlaylistDetail(playlistId);
    this.renderLibrary();
  }

  // ==========================================================================
  // TRACK OPTIONS BOTTOM SHEET
  // ==========================================================================
  openTrackOptions(e, trackId) {
    if (e) e.stopPropagation();
    this.triggerHaptic('LIGHT');

    const track = this.trackRepo.getTrackById(trackId) || this.audioService.currentTrack;
    if (!track) return;
    this.activeSheetTrack = track;

    const backdrop = document.getElementById('trackOptionsBackdrop');
    const tTitle = document.getElementById('sheetTrackTitle');
    const tArtist = document.getElementById('sheetTrackArtist');
    const tImg = document.getElementById('sheetTrackImg');

    if (tTitle) tTitle.textContent = track.title;
    if (tArtist) tArtist.textContent = track.artist;
    if (tImg) tImg.src = track.cover;

    const dlText = document.getElementById('sheetDownloadText');
    const dlIcon = document.getElementById('sheetDownloadIcon');
    if (dlText && dlIcon) {
      if (track.isDownloaded) {
        dlText.textContent = 'Удалить из памяти';
        dlIcon.setAttribute('data-lucide', 'trash-2');
      } else {
        dlText.textContent = 'Скачать аудиофайл';
        dlIcon.setAttribute('data-lucide', 'download');
      }
      if (window.lucide) window.lucide.createIcons();
    }

    if (backdrop) backdrop.classList.add('open');
  }

  closeTrackOptions() {
    const backdrop = document.getElementById('trackOptionsBackdrop');
    if (backdrop) backdrop.classList.remove('open');
  }

  actionPlayNext() {
    this.triggerHaptic('LIGHT');
    const track = this.activeSheetTrack;
    if (!track) return;
    this.closeTrackOptions();
    this.audioService.playNextInQueue(track);
    this.toast.show(`"${track.title}" будет сыгран следующим`, 'info');
  }

  actionAddToQueue() {
    this.triggerHaptic('LIGHT');
    const track = this.activeSheetTrack;
    if (!track) return;
    this.closeTrackOptions();
    this.audioService.addToQueue(track);
    this.toast.show(`"${track.title}" добавлен в очередь`, 'info');
  }

  actionAddToPlaylist() {
    this.triggerHaptic('LIGHT');
    const track = this.activeSheetTrack;
    if (!track) return;
    this.closeTrackOptions();

    const playlists = this.trackRepo.getPlaylists();
    if (playlists.length === 0) {
      this.openCreatePlaylistDialog();
      return;
    }

    const content = `
      <div style="padding: 10px 0;">
        <h4 style="font-size:16px; font-weight:700; color:#FFF; margin-bottom:12px;">Выберите плейлист</h4>
        <div style="display:flex; flex-direction:column; gap:8px; max-height:240px; overflow-y:auto;">
          ${playlists.map(p => `
            <button class="sheet-row-btn" onclick="window.auraApp.ui.confirmAddTrackToPlaylist('${p.id}', '${track.id}')">
              <i data-lucide="list-plus"></i>
              <span>${p.title} (${p.trackIds.length} треков)</span>
            </button>
          `).join('')}
        </div>
      </div>
    `;
    this._openCustomSheet('Добавить в плейлист', content);
  }

  async confirmAddTrackToPlaylist(playlistId, trackId) {
    const pl = this.trackRepo.getPlaylistById(playlistId);
    const added = await this.trackRepo.addTrackToPlaylist(playlistId, trackId);
    this.closeCustomSheet();
    if (added) {
      this.toast.show(`Добавлено в "${pl.title}"`, 'success');
    } else {
      this.toast.show(`Уже есть в "${pl.title}"`, 'info');
    }
  }

  async actionDownloadTrack() {
    this.triggerHaptic('LIGHT');
    const track = this.activeSheetTrack;
    if (!track) return;
    this.closeTrackOptions();

    if (track.isDownloaded) {
      this.toast.show(`Удаление "${track.title}"...`, 'info');
      await this.downloadService.removeDownload(track);
      this.toast.show(`"${track.title}" удален из офлайн-памяти`, 'info');
      this.renderLibrary();
    } else {
      this.toast.show(`Загрузка "${track.title}"...`, 'download');
      const result = await this.downloadService.downloadTrack(track);
      if (result.success) {
        this.toast.show(`Трек "${track.title}" сохранен офлайн!`, 'success');
        this.renderLibrary();
      } else {
        this.toast.show(`Ошибка загрузки: ${result.error}`, 'error');
      }
    }
  }

  actionViewArtist() {
    this.closeTrackOptions();
    if (this.activeSheetTrack) {
      this.switchTab('search');
      this.selectGenre(this.activeSheetTrack.artist);
    }
  }

  actionShareTrack() {
    this.triggerHaptic('LIGHT');
    const track = this.activeSheetTrack;
    if (!track) return;
    this.closeTrackOptions();

    if (navigator.share) {
      navigator.share({
        title: track.title,
        text: `Послушайте ${track.title} — ${track.artist} в AURA MUSIC`,
        url: window.location.href
      }).catch(() => {});
    } else {
      this.toast.show('Ссылка на трек скопирована в буфер!', 'info');
    }
  }

  // ==========================================================================
  // UP NEXT QUEUE SHEET & AIRPLAY ROUTING
  // ==========================================================================
  showQueueSheet() {
    this.triggerHaptic('LIGHT');
    const queue = this.audioService.queue;
    const curIdx = this.audioService.queueIndex;

    const content = `
      <div style="padding: 10px 0;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
          <h4 style="font-size:16px; font-weight:800; color:#FFF;">Очередь треков (${queue.length})</h4>
          <button class="section-link-btn" onclick="window.auraApp.audioService.clearUpcomingQueue(); window.auraApp.ui.closeCustomSheet(); window.auraApp.ui.toast.show('Очередь очищена', 'info');">Очистить</button>
        </div>
        <div style="max-height: 320px; overflow-y:auto; display:flex; flex-direction:column; gap:8px;">
          ${queue.map((t, idx) => `
            <div class="song-row-item ${idx === curIdx ? 'active' : ''}" onclick="window.auraApp.audioService.setQueue(window.auraApp.audioService.queue, ${idx}, true); window.auraApp.ui.closeCustomSheet();">
              <div class="song-cover-box"><img src="${t.cover}" class="song-art-img"></div>
              <div class="song-metadata">
                <h4 class="song-title-text">${t.title} ${idx === curIdx ? '(Сейчас играет)' : ''}</h4>
                <p class="song-artist-text">${t.artist}</p>
              </div>
              <div style="display:flex; align-items:center; gap:2px;" onclick="event.stopPropagation()">
                ${idx > 0 ? `
                  <button class="more-options-btn" style="padding:4px;" onclick="window.auraApp.audioService.reorderQueue(${idx}, ${idx - 1}); window.auraApp.ui.showQueueSheet();" title="Выше">
                    <i data-lucide="chevron-up"></i>
                  </button>
                ` : ''}
                ${idx < queue.length - 1 ? `
                  <button class="more-options-btn" style="padding:4px;" onclick="window.auraApp.audioService.reorderQueue(${idx}, ${idx + 1}); window.auraApp.ui.showQueueSheet();" title="Ниже">
                    <i data-lucide="chevron-down"></i>
                  </button>
                ` : ''}
                <button class="more-options-btn" onclick="window.auraApp.audioService.removeFromQueue(${idx}); window.auraApp.ui.showQueueSheet();" title="Удалить из очереди">
                  <i data-lucide="x"></i>
                </button>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    this._openCustomSheet('Очередь', content);
  }

  async showAirPlayRouting() {
    this.triggerHaptic('LIGHT');
    let devicesList = 'Динамик смартфона / Bluetooth / Наушники';
    if (typeof navigator !== 'undefined' && navigator.mediaDevices?.enumerateDevices) {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const audioOutputs = devices.filter(d => d.kind === 'audiooutput');
        if (audioOutputs.length > 0) {
          devicesList = audioOutputs.map(d => d.label || 'Аудиовыход').filter(Boolean).join(', ') || devicesList;
        }
      } catch (e) {}
    }

    const content = `
      <div style="padding: 12px 0;">
        <h4 style="font-size:16px; font-weight:800; color:#FFF; margin-bottom:8px;">Трансляция звука</h4>
        <p style="font-size:13px; color:var(--text-secondary); margin-bottom:16px;">
          Цифровой аудиопоток без потерь направлен на активное аудиоустройство.
        </p>
        <div style="background:var(--bg-surface); padding:12px; border-radius:12px; font-size:12px; color:var(--text-secondary); line-height:1.6;">
          <div><b>Активный вывод:</b> ${devicesList}</div>
          <div><b>Формат потока:</b> Прямой аппаратный DAC (Direct Output)</div>
          <div><b>Битрейт:</b> ${this.settingsService.getCurrentQuality().bitrate} кбит/с</div>
          <div><b>Активный эквалайзер:</b> ${this.settingsService.equalizer?.getCurrentPresetName() || 'Студийный баланс (Flat)'}</div>
        </div>
      </div>
    `;
    this._openCustomSheet('Устройство', content);
  }

  // ==========================================================================
  // SETTINGS & PROFILE
  // ==========================================================================
  _updateSettingsUI() {
    const qualityLabel = document.getElementById('audioQualityVal');
    if (qualityLabel) {
      qualityLabel.textContent = this.settingsService.getCurrentQuality().name;
    }

    const eqLabel = document.getElementById('eqPresetVal');
    if (eqLabel && this.settingsService.equalizer) {
      eqLabel.textContent = this.settingsService.equalizer.getCurrentPresetName();
    }

    const npBadge = document.getElementById('npBadgeName');
    if (npBadge) {
      npBadge.textContent = this.settingsService.getCurrentQuality().badge;
    }
  }

  async cycleAudioQuality() {
    this.triggerHaptic('LIGHT');
    const quality = await this.settingsService.cycleAudioQuality();
    this.toast.show(`Качество аудио: ${quality.name}`, 'info');
  }

  async cycleEqualizerPreset() {
    this.triggerHaptic('LIGHT');
    const presetName = await this.settingsService.cycleEqualizerPreset();
    this.toast.show(`Эквалайзер: ${presetName}`, 'info');
  }

  async showAppInfo() {
    this.triggerHaptic('LIGHT');
    const storageUsage = await this.downloadService.getStorageUsageMB();
    const content = `
      <div style="padding: 12px 0;">
        <h4 style="font-size:18px; font-weight:800; color:#FFF; margin-bottom:6px;">AURA MUSIC Mobile</h4>
        <span style="font-size:12px; color:var(--text-secondary);">Сборка 3.4.0 • Android и iOS</span>
        <div style="background:var(--bg-surface); padding:14px; border-radius:12px; margin:16px 0; font-size:13px; color:var(--text-secondary); line-height:1.7;">
          <div>🎵 <b>Всего в каталоге:</b> ${this.trackRepo.getAllTracks().length} треков</div>
          <div>💾 <b>Офлайн-хранилище:</b> ${storageUsage} МБ кешировано</div>
          <div>🎧 <b>Аудиодвижок:</b> Студийный DSP (Web Audio API)</div>
        </div>
        <button class="sheet-row-btn destructive" onclick="window.auraApp.ui.clearAppCache()">
          <i data-lucide="trash-2"></i>
          <span>Очистить скачанный кеш</span>
        </button>
      </div>
    `;
    this._openCustomSheet('О программе', content);
  }

  async clearAppCache() {
    this.triggerHaptic('MEDIUM');
    const tracks = this.trackRepo.getAllTracks();
    for (const t of tracks) {
      if (t.isDownloaded) {
        await this.downloadService.removeDownload(t);
      }
    }
    this.closeCustomSheet();
    this.toast.show('Офлайн-кеш успешно очищен!', 'success');
    this.renderLibrary();
  }

  // File Import for Custom User Music
  triggerImportAudio() {
    this.triggerHaptic('LIGHT');
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'audio/*';
    input.multiple = true;
    input.onchange = async (e) => {
      const files = Array.from(e.target.files || []);
      if (files.length === 0) return;

      this.toast.show(`Импорт ${files.length} аудиофайлов...`, 'download');
      for (const file of files) {
        await this.trackRepo.importLocalAudio(file);
      }
      this.toast.show(`Добавлено ${files.length} треков в медиатеку!`, 'success');
      this.renderLibrary();
    };
    input.click();
  }

  // Generic Custom Sheet Modal
  _openCustomSheet(title, htmlContent) {
    let sheet = document.getElementById('auraCustomSheet');
    if (!sheet) {
      sheet = document.createElement('div');
      sheet.id = 'auraCustomSheet';
      sheet.className = 'sheet-backdrop';
      sheet.innerHTML = `
        <div class="native-bottom-sheet" onclick="event.stopPropagation()">
          <div class="sheet-drag-pill"></div>
          <div id="auraCustomSheetBody"></div>
          <button class="sheet-row-btn destructive" onclick="window.auraApp.ui.closeCustomSheet()" style="margin-top:12px;">
            <span>Закрыть</span>
          </button>
        </div>
      `;
      sheet.onclick = () => this.closeCustomSheet();
      document.body.appendChild(sheet);
    }

    const body = document.getElementById('auraCustomSheetBody');
    if (body) body.innerHTML = htmlContent;

    if (window.lucide) window.lucide.createIcons();
    sheet.classList.add('open');
  }

  closeCustomSheet() {
    const sheet = document.getElementById('auraCustomSheet');
    if (sheet) sheet.classList.remove('open');
  }

  // Haptic Feedback Helper
  triggerHaptic(style = 'LIGHT') {
    try {
      if (window.Capacitor?.Plugins?.Haptics) {
        window.Capacitor.Plugins.Haptics.impact({ style });
      }
    } catch (e) {}
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = UIController;
}
