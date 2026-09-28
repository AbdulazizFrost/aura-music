/**
 * TrackRepository — Single Source of Truth for Music Data, Playlists, Likes, and History.
 */
class TrackRepository {
  constructor(storageService) {
    this.storage = storageService;
    this.tracks = [];
    this.playlists = [];
    this.likedSongIds = new Set();
    this.recentlyPlayedIds = [];
    this.searchHistory = [];
    this.listeners = new Set();

    this._defaultCatalog = [
      {
        id: 'track-1',
        title: 'Starboy',
        artist: 'The Weeknd',
        album: 'Starboy',
        duration: 230,
        cover: 'assets/covers/starboy.jpg',
        audioSrc: 'assets/audio/starboy.mp3',
        genre: 'R&B',
        year: 2016,
        lyrics: [
          { time: 0, text: "[Intro — Daft Punk Synth & Beat]" },
          { time: 8, text: "I'm tryna put you in the worst mood, ah" },
          { time: 13, text: "P1 cleaner than your church shoes, ah" },
          { time: 18, text: "Milli point two just to hurt you, ah" },
          { time: 23, text: "All red Lamb' just to tease you, ah" },
          { time: 30, text: "None of these toys on lease too, ah" },
          { time: 35, text: "Made your whole year in a week too, yah" },
          { time: 42, text: "Main bitch out your league too, ah" },
          { time: 46, text: "Side bitch out of your league too, ah" },
          { time: 51, text: "Look what you've done" },
          { time: 54, text: "I'm a motherfuckin' starboy" },
          { time: 61, text: "Look what you've done" },
          { time: 65, text: "I'm a motherfuckin' starboy" }
        ]
      },
      {
        id: 'track-2',
        title: 'Faded',
        artist: 'Alan Walker',
        album: 'Different World',
        duration: 213,
        cover: 'assets/covers/faded.jpg',
        audioSrc: 'assets/audio/faded.mp3',
        genre: 'Электроника',
        year: 2015,
        lyrics: [
          { time: 0, text: "[Piano Intro — Melancholic Melody]" },
          { time: 13, text: "You were the shadow to my light" },
          { time: 19, text: "Did you feel us?" },
          { time: 24, text: "Another start, you fade away" },
          { time: 32, text: "Afraid our aim is out of sight" },
          { time: 39, text: "Wanna see us alive" },
          { time: 48, text: "Where are you now?" },
          { time: 53, text: "Where are you now?" },
          { time: 58, text: "Where are you now?" },
          { time: 62, text: "Was it all in my fantasy?" },
          { time: 68, text: "Where are you now?" },
          { time: 73, text: "Were you only imaginary?" },
          { time: 80, text: "Where are you now? Atlantis, under the sea" },
          { time: 92, text: "I'm faded, I'm faded" }
        ]
      },
      {
        id: 'track-3',
        title: 'Love Story',
        artist: 'Indila',
        album: 'Mini World',
        duration: 285,
        cover: 'assets/covers/love_story.jpg',
        audioSrc: 'assets/audio/love_story.mp3',
        genre: 'Поп',
        year: 2014,
        lyrics: [
          { time: 0, text: "[Intro — Accordion & French Melody]" },
          { time: 10, text: "L'âme en peine, il vit mais ne sait plus pourquoi" },
          { time: 19, text: "Il cherche une reine sans couronne, sans roi" },
          { time: 29, text: "Un amour sans haine, un rêve où tout va bien" },
          { time: 38, text: "Mais le destin l'emmène loin de son chemin" },
          { time: 48, text: "C'est une love story, un conte sans fin" },
          { time: 57, text: "Une histoire d'amour écrite au matin" },
          { time: 66, text: "Où les cœurs se lient sans peur du lendemain" }
        ]
      },
      {
        id: 'track-4',
        title: 'Love Story (Orchestre)',
        artist: 'Indila',
        album: 'Mini World (Deluxe)',
        duration: 298,
        cover: 'assets/covers/love_story_orch.jpg',
        audioSrc: 'assets/audio/love_story_orch.mp3',
        genre: 'Поп',
        year: 2014
      },
      {
        id: 'track-5',
        title: 'Love Story (Epic Orchestral)',
        artist: 'Indila',
        album: 'Epic Orchestral Edition',
        duration: 336,
        cover: 'assets/covers/love_story_epic.jpg',
        audioSrc: 'assets/audio/love_story_epic.mp3',
        genre: 'Поп',
        year: 2021
      },
      {
        id: 'track-6',
        title: 'Cinnamon Girl',
        artist: 'Lana Del Rey',
        album: 'Norman Fucking Rockwell!',
        duration: 296,
        cover: 'assets/covers/cinnamon_girl.jpg',
        audioSrc: 'assets/audio/cinnamon_girl.mp3',
        genre: 'Рок',
        year: 2019,
        lyrics: [
          { time: 0, text: "[Dreamy Synth & Piano Intro]" },
          { time: 12, text: "Cinnamon in my teeth" },
          { time: 18, text: "From your kiss, you're touching me" },
          { time: 25, text: "All the pills that you take" },
          { time: 32, text: "Violet, blue, green, red to keep me at arm's length" },
          { time: 42, text: "Don't work" },
          { time: 48, text: "There's things I wanna say to you" },
          { time: 55, text: "Hold me, love me, touch me, honey" },
          { time: 62, text: "Be the first who didn't walk out" }
        ]
      },
      {
        id: 'track-7',
        title: 'White Mustang',
        artist: 'Lana Del Rey',
        album: 'Lust for Life',
        duration: 281,
        cover: 'assets/covers/white_mustang.jpg',
        audioSrc: 'assets/audio/white_mustang.mp3',
        genre: 'Рок',
        year: 2017
      },
      {
        id: 'track-8',
        title: '...Baby One More Time',
        artist: 'Britney Spears',
        album: '...Baby One More Time',
        duration: 210,
        cover: 'assets/covers/baby_one_more_time.jpg',
        audioSrc: 'assets/audio/baby_one_more_time.mp3',
        genre: 'Поп',
        year: 1998
      },
      {
        id: 'track-9',
        title: 'Rockabye',
        artist: 'Clean Bandit ft. Sean Paul',
        album: 'What Is Love?',
        duration: 251,
        cover: 'assets/covers/rockabye.jpg',
        audioSrc: 'assets/audio/rockabye.mp3',
        genre: 'Поп',
        year: 2016
      },
      {
        id: 'track-10',
        title: 'People You Know',
        artist: 'Selena Gomez',
        album: 'Rare',
        duration: 196,
        cover: 'assets/covers/people_you_know.jpg',
        audioSrc: 'assets/audio/people_you_know.mp3',
        genre: 'Поп',
        year: 2020
      },
      {
        id: 'track-11',
        title: 'Golden Brown (Slowed + Reverb)',
        artist: 'The Stranglers',
        album: 'Aesthetic Edits',
        duration: 259,
        cover: 'assets/covers/golden_brown.jpg',
        audioSrc: 'assets/audio/golden_brown.mp3',
        genre: 'Электроника',
        year: 2022
      },
      {
        id: 'track-12',
        title: 'Golden Brown x Love Story',
        artist: 'Sanks',
        album: 'Epic Mashups',
        duration: 181,
        cover: 'assets/covers/sanks_mashup.jpg',
        audioSrc: 'assets/audio/sanks_mashup.mp3',
        genre: 'Электроника',
        year: 2023
      },
      {
        id: 'track-13',
        title: 'Кухни',
        artist: 'Бонд с кнопкой',
        album: 'Путешествие',
        duration: 137,
        cover: 'assets/covers/bond_kuhni.jpg',
        audioSrc: 'assets/audio/bond_kuhni.mp3',
        genre: 'Рок',
        year: 2023,
        lyrics: [
          { time: 0, text: "[Акустическое вступление — Гитара и голос]" },
          { time: 12, text: "А на кухне горит свет..." },
          { time: 20, text: "И чайник свистит в ночи" },
          { time: 30, text: "Мы ищем простой ответ" },
          { time: 40, text: "И шепотом: 'Помолчи'..." },
          { time: 52, text: "В панельных домах тепло" },
          { time: 64, text: "Окна глядят в туман..." },
          { time: 76, text: "Все, что прошло — прошло" }
        ]
      },
      {
        id: 'track-14',
        title: 'Котик',
        artist: 'Alexander Rybak',
        album: 'Котик (Single)',
        duration: 218,
        cover: 'assets/covers/rybak_kotik.jpg',
        audioSrc: 'assets/audio/rybak_kotik.mp3',
        genre: 'Поп',
        year: 2015
      },
      {
        id: 'track-15',
        title: 'Экспонат (Hardstyle Remix)',
        artist: 'MIA BOYKA',
        album: 'Hardstyle Edits',
        duration: 123,
        cover: 'assets/covers/mia_boyka.jpg',
        audioSrc: 'assets/audio/mia_boyka.mp3',
        genre: 'Электроника',
        year: 2024
      },
      {
        id: 'track-16',
        title: 'Army Dreamers (На русском)',
        artist: 'Kate Bush (Кавер)',
        album: 'Russian Covers',
        duration: 197,
        cover: 'assets/covers/army_dreamers.jpg',
        audioSrc: 'assets/audio/army_dreamers.mp3',
        genre: 'Поп',
        year: 2023
      },
      {
        id: 'track-17',
        title: 'Est-ce que tu m\'aimes? (На русском)',
        artist: 'Maître Gims (Кавер)',
        album: 'Russian Covers',
        duration: 261,
        cover: 'assets/covers/maitre_gims.jpg',
        audioSrc: 'assets/audio/maitre_gims.mp3',
        genre: 'Поп',
        year: 2022
      },
      {
        id: 'track-18',
        title: 'Impossible (На русском)',
        artist: 'Shontelle (Кавер)',
        album: 'Russian Covers',
        duration: 221,
        cover: 'assets/covers/shontelle_impossible.jpg',
        audioSrc: 'assets/audio/shontelle_impossible.mp3',
        genre: 'Поп',
        year: 2022
      },
      {
        id: 'track-19',
        title: 'Ustozga Tilaklar',
        artist: 'Aziz',
        album: 'Праздничный Альбом',
        duration: 242,
        cover: 'assets/covers/aziz_ustozga.jpg',
        audioSrc: 'assets/audio/aziz_ustozga.mp3',
        genre: 'Поп',
        year: 2026
      }
    ];
  }

  async init() {
    // 0. Auto-migrate from old synthetic catalog to 19 real studio tracks
    const catalogVersion = await this.storage.get('aura_catalog_version', null);
    if (catalogVersion !== 'v2_real_music_telegram') {
      await this.storage.set('aura_catalog_version', 'v2_real_music_telegram');
      await this.storage.set('aura_playlists', null);
      await this.storage.set('aura_recently_played_ids', ['track-1', 'track-2', 'track-3', 'track-6', 'track-13']);
      await this.storage.set('aura_last_track_id', 'track-1');
      await this.storage.set('aura_last_position', 0);
      await this.storage.set('aura_liked_track_ids', ['track-1', 'track-2', 'track-3', 'track-6', 'track-13']);
      await this.storage.set('aura_search_history', ['The Weeknd', 'Alan Walker', 'Indila', 'Lana Del Rey', 'Бонд с кнопкой']);
    }

    // 1. Load Tracks (Default Catalog + User Imported Tracks)
    const customTracks = await this.storage.get('aura_user_tracks', []);
    const TrackModel = (typeof Track !== 'undefined') ? Track : (await import('../models/Track.js').then(m => m.default || m));
    
    // Restore persistent local audio blobs from IndexedDB
    for (const ct of customTracks) {
      if (this.storage && this.storage.getBlob) {
        try {
          const blob = await this.storage.getBlob('audio_blob_' + ct.id);
          if (blob && typeof URL !== 'undefined' && URL.createObjectURL) {
            const url = URL.createObjectURL(blob);
            ct.audioSrc = url;
            ct.localUri = url;
          }
        } catch (e) {}
      }
    }

    this.tracks = [
      ...this._defaultCatalog.map(t => new TrackModel(t)),
      ...customTracks.map(t => new TrackModel(t))
    ];

    // 2. Load Liked Tracks
    const savedLikes = await this.storage.get('aura_liked_track_ids', ['track-1', 'track-2', 'track-3', 'track-6']);
    this.likedSongIds = new Set(savedLikes);
    this.tracks.forEach(t => {
      t.isLiked = this.likedSongIds.has(t.id);
    });

    // 3. Load Playlists
    const savedPlaylists = await this.storage.get('aura_playlists', null);
    const PlaylistModel = (typeof Playlist !== 'undefined') ? Playlist : (await import('../models/Playlist.js').then(m => m.default || m));

    if (savedPlaylists && Array.isArray(savedPlaylists) && savedPlaylists.length > 0) {
      this.playlists = savedPlaylists.map(p => new PlaylistModel(p));
    } else {
      // Default initial playlists mapped to real tracks
      this.playlists = [
        new PlaylistModel({
          id: 'pl-chill',
          title: 'Чилл и релакс',
          description: 'Атмосферный вечерний вайб и меланхолия',
          cover: 'assets/covers/cinnamon_girl.jpg',
          trackIds: ['track-2', 'track-6', 'track-10', 'track-11']
        }),
        new PlaylistModel({
          id: 'pl-workout',
          title: 'Энергия и спорт',
          description: 'Высокий темп, мощный бас и драйв',
          cover: 'assets/covers/starboy.jpg',
          trackIds: ['track-1', 'track-8', 'track-9', 'track-15']
        }),
        new PlaylistModel({
          id: 'pl-night',
          title: 'Ночная дорога',
          description: 'Идеальные треки для ночного шоссе и города',
          cover: 'assets/covers/faded.jpg',
          trackIds: ['track-1', 'track-2', 'track-7', 'track-11', 'track-12']
        })
      ];
      await this.storage.set('aura_playlists', this.playlists);
    }

    // 4. Load Recently Played
    const savedRecent = await this.storage.get('aura_recently_played_ids', ['track-1', 'track-2', 'track-3', 'track-6', 'track-13']);
    this.recentlyPlayedIds = Array.isArray(savedRecent) ? savedRecent : [];

    // 5. Load Search History
    this.searchHistory = await this.storage.get('aura_search_history', ['The Weeknd', 'Alan Walker', 'Indila', 'Lana Del Rey']);
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

  // --- Track Methods ---
  getAllTracks() {
    return [...this.tracks];
  }

  getTrackById(id) {
    return this.tracks.find(t => t.id === id) || null;
  }

  async importLocalAudio(file) {
    if (!file) return null;
    const TrackModel = (typeof Track !== 'undefined') ? Track : (await import('../models/Track.js').then(m => m.default || m));
    
    let localBlobUrl = '';
    if (typeof URL !== 'undefined' && URL.createObjectURL) {
      localBlobUrl = URL.createObjectURL(file);
    }

    // Parse nice title and artist from filename
    let title = file.name.replace(/\.[^/.]+$/, "");
    let artist = 'Мой исполнитель';
    if (title.includes(' - ')) {
      const parts = title.split(' - ');
      artist = parts[0].trim();
      title = parts.slice(1).join(' - ').trim();
    }

    const trackId = 'local-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6);

    // Persist audio blob in IndexedDB for permanent storage across sessions
    if (this.storage && this.storage.saveBlob) {
      try {
        await this.storage.saveBlob('audio_blob_' + trackId, file);
      } catch (e) {}
    }

    // Read real duration from audio metadata
    let detectedDuration = 180;
    if (typeof Audio !== 'undefined' && localBlobUrl) {
      try {
        await new Promise((resolve) => {
          const a = new Audio();
          a.src = localBlobUrl;
          a.onloadedmetadata = () => {
            if (a.duration && !isNaN(a.duration) && isFinite(a.duration)) {
              detectedDuration = Math.floor(a.duration);
            }
            resolve();
          };
          a.onerror = () => resolve();
          setTimeout(resolve, 300);
        });
      } catch (e) {}
    }

    const newTrack = new TrackModel({
      id: trackId,
      title,
      artist,
      album: 'Моя музыка',
      duration: detectedDuration,
      cover: 'assets/covers/cinnamon_girl.jpg',
      audioSrc: localBlobUrl,
      localUri: localBlobUrl,
      genre: 'Моя музыка',
      year: new Date().getFullYear(),
      isDownloaded: true
    });

    this.tracks.unshift(newTrack);

    // Save metadata of imported tracks
    const importedTracksMeta = this.tracks
      .filter(t => t.id.startsWith('local-'))
      .map(t => ({
        id: t.id,
        title: t.title,
        artist: t.artist,
        album: t.album,
        duration: t.duration,
        genre: t.genre,
        year: t.year,
        cover: t.cover,
        isDownloaded: true
      }));
    await this.storage.set('aura_user_tracks', importedTracksMeta);

    this._notify();
    return newTrack;
  }

  // --- Likes ---
  async toggleLike(trackId) {
    const isLiked = this.likedSongIds.has(trackId);
    if (isLiked) {
      this.likedSongIds.delete(trackId);
    } else {
      this.likedSongIds.add(trackId);
    }

    const track = this.getTrackById(trackId);
    if (track) {
      track.isLiked = !isLiked;
    }

    await this.storage.set('aura_liked_track_ids', Array.from(this.likedSongIds));
    this._notify();
    return !isLiked;
  }

  isLiked(trackId) {
    return this.likedSongIds.has(trackId);
  }

  getLikedTracks() {
    return Array.from(this.likedSongIds)
      .map(id => this.getTrackById(id))
      .filter(Boolean);
  }

  // --- Recently Played ---
  async addRecentlyPlayed(trackId) {
    if (!trackId) return;
    const getId = (x) => (typeof x === 'object' && x !== null ? x.trackId : x);
    const item = { trackId, playedAt: Date.now() };
    this.recentlyPlayedIds = [
      item,
      ...this.recentlyPlayedIds.filter(id => getId(id) !== trackId)
    ].slice(0, 20);

    await this.storage.set('aura_recently_played_ids', this.recentlyPlayedIds);
    this._notify();
  }

  getRecentlyPlayedTracks() {
    const getId = (x) => (typeof x === 'object' && x !== null ? x.trackId : x);
    return this.recentlyPlayedIds
      .map(id => this.getTrackById(getId(id)))
      .filter(Boolean);
  }

  // --- Playlists ---
  getPlaylists() {
    return [...this.playlists];
  }

  getPlaylistById(id) {
    return this.playlists.find(p => p.id === id) || null;
  }

  async createPlaylist(title, cover = 'assets/covers/cinnamon_girl.jpg', description = '') {
    if (!title || !title.trim()) return null;
    const PlaylistModel = (typeof Playlist !== 'undefined') ? Playlist : (await import('../models/Playlist.js').then(m => m.default || m));
    const newPl = new PlaylistModel({
      title: title.trim(),
      cover,
      description,
      trackIds: []
    });

    this.playlists.unshift(newPl);
    await this.storage.set('aura_playlists', this.playlists);
    this._notify();
    return newPl;
  }

  async renamePlaylist(playlistId, newTitle) {
    const pl = this.getPlaylistById(playlistId);
    if (!pl || !newTitle || !newTitle.trim()) return false;
    const renamed = pl.rename ? pl.rename(newTitle) : false;
    if (!renamed) {
      pl.title = newTitle.trim();
      pl.updatedAt = Date.now();
    }
    await this.storage.set('aura_playlists', this.playlists);
    this._notify();
    return true;
  }

  async reorderPlaylistTracks(playlistId, fromIndex, toIndex) {
    const pl = this.getPlaylistById(playlistId);
    if (!pl) return false;
    const reordered = pl.reorderTrack ? pl.reorderTrack(fromIndex, toIndex) : false;
    if (!reordered && Array.isArray(pl.trackIds)) {
      if (fromIndex < 0 || fromIndex >= pl.trackIds.length || toIndex < 0 || toIndex >= pl.trackIds.length) return false;
      const [moved] = pl.trackIds.splice(fromIndex, 1);
      pl.trackIds.splice(toIndex, 0, moved);
      pl.updatedAt = Date.now();
    }
    await this.storage.set('aura_playlists', this.playlists);
    this._notify();
    return true;
  }

  async deletePlaylist(playlistId) {
    this.playlists = this.playlists.filter(p => p.id !== playlistId);
    await this.storage.set('aura_playlists', this.playlists);
    this._notify();
    return true;
  }

  async addTrackToPlaylist(playlistId, trackId) {
    const pl = this.getPlaylistById(playlistId);
    if (!pl) return false;
    const added = pl.addTrack(trackId);
    if (added) {
      await this.storage.set('aura_playlists', this.playlists);
      this._notify();
    }
    return added;
  }

  async removeTrackFromPlaylist(playlistId, trackId) {
    const pl = this.getPlaylistById(playlistId);
    if (!pl) return false;
    const removed = pl.removeTrack(trackId);
    if (removed) {
      await this.storage.set('aura_playlists', this.playlists);
      this._notify();
    }
    return removed;
  }

  getPlaylistTracks(playlistId) {
    const pl = this.getPlaylistById(playlistId);
    if (!pl) return [];
    return pl.trackIds
      .map(id => this.getTrackById(id))
      .filter(Boolean);
  }

  // --- Search & Aggregations ---
  searchTracks(query = '', genre = null) {
    let result = [...this.tracks];
    const q = query.trim().toLowerCase();

    if (genre) {
      result = result.filter(t => t.genre.toLowerCase() === genre.toLowerCase());
    }

    if (q) {
      const matchingPlaylists = this.playlists.filter(p => p.title.toLowerCase().includes(q));
      const plTrackIds = new Set(matchingPlaylists.flatMap(p => p.trackIds));

      result = result.filter(t =>
        t.title.toLowerCase().includes(q) ||
        t.artist.toLowerCase().includes(q) ||
        t.album.toLowerCase().includes(q) ||
        t.genre.toLowerCase().includes(q) ||
        plTrackIds.has(t.id)
      );
    }

    return result;
  }

  async addSearchHistory(query) {
    if (!query || !query.trim()) return;
    const q = query.trim();
    this.searchHistory = [q, ...this.searchHistory.filter(item => item.toLowerCase() !== q.toLowerCase())].slice(0, 8);
    await this.storage.set('aura_search_history', this.searchHistory);
  }

  getSearchHistory() {
    return [...this.searchHistory];
  }

  async clearSearchHistory() {
    this.searchHistory = [];
    await this.storage.set('aura_search_history', []);
  }

  // Albums Aggregation
  getAlbums() {
    const map = new Map();
    for (const t of this.tracks) {
      if (!map.has(t.album)) {
        map.set(t.album, {
          name: t.album,
          artist: t.artist,
          cover: t.cover,
          tracks: []
        });
      }
      map.get(t.album).tracks.push(t);
    }
    return Array.from(map.values()).map(alb => ({
      ...alb,
      songsCount: alb.tracks.length
    }));
  }

  // Artists Aggregation
  getArtists() {
    const map = new Map();
    for (const t of this.tracks) {
      if (!map.has(t.artist)) {
        map.set(t.artist, {
          name: t.artist,
          cover: t.cover,
          tracks: []
        });
      }
      map.get(t.artist).tracks.push(t);
    }
    return Array.from(map.values()).map(art => ({
      ...art,
      songsCount: art.tracks.length
    }));
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = TrackRepository;
}
