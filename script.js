/**
 * SHAMEEM IPTV - Main Application Engine (Vanilla)
 * High-performance, reactive streaming and carousel manager.
 */

// ============================================================
// CONFIGURATION & CONSTANTS
// ============================================================
const PLAYLIST_URLS = [
  'https://raw.githubusercontent.com/Rakib49/Rakibiptv/refs/heads/main/aynaott.m3u',
  'https://raw.githubusercontent.com/Rakib49/Rakibiptv/refs/heads/main/Sports.m3u'
];

const UNCATEGORIZED = 'Uncategorized';
const CATEGORY_ALL = 'All';
const CATEGORY_FAVORITES = '❤ Favorites';

// Curated high-quality banner items
const DEFAULT_BANNERS = [
  {
    bannerURL: 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&w=1200&h=450&q=80',
    redirection: 'T Sports',
    title: 'Live International Sports Coverage',
    description: 'Enjoy high-speed, live, uninterrupted video feeds from premium athletic leagues around the world.'
  },
  {
    bannerURL: 'https://images.unsplash.com/photo-1574375927938-d5a98e8edd86?auto=format&fit=crop&w=1200&h=450&q=80',
    redirection: 'Ayna TV',
    title: 'Ayna OTT Premium Entertainment',
    description: 'Stream modern dramatic serials, blockbusters, and high-contrast award ceremonies.'
  },
  {
    bannerURL: 'https://images.unsplash.com/photo-1540747737956-3787217a9602?auto=format&fit=crop&w=1200&h=450&q=80',
    redirection: 'Sony Sports Ten 1',
    title: 'Sony Sports Arena Live',
    description: 'Unleash direct access to premium tennis matches, football conferences, and classic tournaments.'
  }
];

// Curated high-uptime fallbacks to ensure instant visual playability and graceful fallbacks
const STABLE_FALLBACK_CHANNELS = [
  {
    name: 'Somoy TV Live (News)',
    url: 'https://shstream.somoynews.tv/somoy/somoy_high/index.m3u8',
    logo: 'https://raw.githubusercontent.com/Rakib49/Rakibiptv/refs/heads/main/logos/somoy.png',
    category: 'News',
  },
  {
    name: 'T Sports Live (Curated)',
    url: 'https://origin.akamaized.sh/tsports/index.m3u8',
    logo: 'https://raw.githubusercontent.com/Rakib49/Rakibiptv/refs/heads/main/logos/tsports.png',
    category: 'SPORTS',
  },
  {
    name: 'Big Buck Bunny (HLS HD)',
    url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/c/c5/Big_Buck_Bunny_Main_Poster.jpg',
    category: 'Entertainment',
  }
];

// ============================================================
// RUNTIME STATE MANAGEMENT
// ============================================================
const state = {
  channels: [...STABLE_FALLBACK_CHANNELS],
  categories: [CATEGORY_ALL, 'SPORTS', CATEGORY_FAVORITES],
  favorites: [],
  banners: [...DEFAULT_BANNERS],
  currentIndex: 0,
  selectedCategory: CATEGORY_ALL,
  searchQuery: '',
  activeBannerIndex: 0,
  autoSliderTimer: null
};

// ============================================================
// HLS PLAYER HANDLERS
// ============================================================
let hlsInstance = null;

// ============================================================
// DOM ELEMENTS POINTERS
// ============================================================
const dom = {
  video: null,
  channelGrid: null,
  categoryFilter: null,
  searchInput: null,
  currentChannelName: null,
  currentChannelCategory: null,
  videoLoader: null,
  playerControls: null,
  btnPlay: null,
  btnMute: null,
  volumeSlider: null,
  playerErrorOverlay: null,
  btnReload: null,
  bannersContainer: null,
  bannerDotsContainer: null,
  carouselWrapper: null,
  btnSaveMeta: null,
  totalFeedsBadge: null,
  currentTimeBadge: null,
  channelsCountText: null
};

// ============================================================
// INITIALIZATION
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  cacheElements();
  loadFavorites();
  updateTime();
  setInterval(updateTime, 1000);

  // Initialize features
  setupEventListeners();
  loadPlaylist();
  renderBanners();
  startAutoSlider();
});

function cacheElements() {
  dom.video = document.getElementById('video');
  dom.channelGrid = document.getElementById('channelGrid');
  dom.categoryFilter = document.getElementById('categoryFilter');
  dom.searchInput = document.getElementById('search');
  dom.currentChannelName = document.getElementById('currentChannelName');
  dom.currentChannelCategory = document.getElementById('currentChannelCategory');
  dom.videoLoader = document.getElementById('videoLoader');
  dom.playerControls = document.querySelector('.player-controls');
  dom.btnPlay = document.getElementById('btnPlay');
  dom.btnMute = document.getElementById('btnMute');
  dom.volumeSlider = document.getElementById('volumeSlider');
  dom.playerErrorOverlay = document.getElementById('playerErrorOverlay');
  dom.btnReload = document.getElementById('btnReload');
  dom.bannersContainer = document.getElementById('bannersContainer');
  dom.bannerDotsContainer = document.getElementById('bannerDotsContainer');
  dom.carouselWrapper = document.getElementById('carouselWrapper');
  dom.btnSaveMeta = document.getElementById('btnSaveMeta');
  dom.totalFeedsBadge = document.getElementById('totalFeedsBadge');
  dom.currentTimeBadge = document.getElementById('currentTimeBadge');
  dom.channelsCountText = document.getElementById('channelsCountText');
}

// Setup interaction hooks
function setupEventListeners() {
  if (dom.searchInput) {
    dom.searchInput.addEventListener('input', (e) => {
      state.searchQuery = e.target.value.trim().toLowerCase();
      renderChannelList();
    });
  }

  if (dom.btnSaveMeta) {
    dom.btnSaveMeta.addEventListener('click', () => {
      const activeChannel = state.channels[state.currentIndex];
      if (activeChannel) {
        toggleFavorite(activeChannel.name);
      }
    });
  }

  // Handle auto-hiding controls inside player section
  let controlHideTimeout;
  const container = document.querySelector('.video-container');
  if (container) {
    container.addEventListener('mousemove', () => {
      if (dom.playerControls) dom.playerControls.style.opacity = '1';
      clearTimeout(controlHideTimeout);
      controlHideTimeout = setTimeout(() => {
        if (dom.playerControls && !dom.video.paused) {
          dom.playerControls.style.opacity = '0';
        }
      }, 4000);
    });
  }

  // Banner carousel pause on hover
  if (dom.carouselWrapper) {
    dom.carouselWrapper.addEventListener('mouseenter', stopAutoSlider);
    dom.carouselWrapper.addEventListener('mouseleave', startAutoSlider);
  }
}

// Keep the clock sharp & modern
function updateTime() {
  if (dom.currentTimeBadge) {
    const now = new Date();
    dom.currentTimeBadge.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }
}

// ============================================================
// LOCAL STORAGE FAVORITES MANAGER
// ============================================================
function loadFavorites() {
  try {
    const stored = localStorage.getItem('iptv-favorites');
    state.favorites = stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.warn('LocalStorage access blocked by iframe sandboxing:', error);
    state.favorites = [];
  }
}

function saveFavorites() {
  try {
    localStorage.setItem('iptv-favorites', JSON.stringify(state.favorites));
  } catch (error) {
    console.warn('LocalStorage save is blocked:', error);
  }
}

function toggleFavorite(channelName) {
  const index = state.favorites.indexOf(channelName);
  if (index > -1) {
    state.favorites.splice(index, 1);
  } else {
    state.favorites.push(channelName);
  }
  saveFavorites();
  
  // Refresh views
  renderChannelList();
  updateBookmarkMetaButton();
}

// Update the glowing UI action state based on selected stream favoritedness
function updateBookmarkMetaButton() {
  const activeChannel = state.channels[state.currentIndex];
  if (!activeChannel || !dom.btnSaveMeta) return;

  const isFav = state.favorites.includes(activeChannel.name);
  if (isFav) {
    dom.btnSaveMeta.classList.add('saved');
    dom.btnSaveMeta.innerHTML = `<i class="fa-solid fa-heart"></i> Saved in Favorites`;
  } else {
    dom.btnSaveMeta.classList.remove('saved');
    dom.btnSaveMeta.innerHTML = `<i class="fa-regular fa-heart"></i> Add to Favorites`;
  }
}

// ============================================================
// DATA LOADERS & PARSERS
// ============================================================
async function loadPlaylist() {
  try {
    const playlistChannels = [];
    const foundTags = new Set();

    // 1. Fetch main base playlist
    try {
      const res1 = await fetch(PLAYLIST_URLS[0]);
      if (res1.ok) {
        const text1 = await res1.text();
        const parsed1 = parseM3U(text1, false);
        playlistChannels.push(...parsed1);
        parsed1.forEach(c => foundTags.add(c.category));
      }
    } catch (e) {
      console.warn('Failed to load playlist 1 (aynaott):', e);
    }

    // 2. Fetch Sports playlist with prefix override
    try {
      const res2 = await fetch(PLAYLIST_URLS[1]);
      if (res2.ok) {
        const text2 = await res2.text();
        const parsed2 = parseM3U(text2, true);
        playlistChannels.push(...parsed2);
        parsed2.forEach(c => foundTags.add(c.category));
      }
    } catch (e) {
      console.warn('Failed to load playlist 2 (Sports):', e);
    }

    // Assemble state channels
    if (playlistChannels.length > 0) {
      state.channels = playlistChannels;
    } else {
      console.log('Using static backup list due to network blocks.');
      state.channels = STABLE_FALLBACK_CHANNELS;
      STABLE_FALLBACK_CHANNELS.forEach(c => foundTags.add(c.category));
    }

    // Process and sort categories
    const distinct = Array.from(foundTags).filter(c => c !== 'SPORTS' && c !== UNCATEGORIZED);
    distinct.sort();

    state.categories = [CATEGORY_ALL, 'SPORTS', CATEGORY_FAVORITES, ...distinct];

    // Select default startup channel
    state.currentIndex = 0;
    
    // Refresh GUI representation
    renderCategories();
    renderChannelList();
    playChannel(state.currentIndex);

    if (dom.totalFeedsBadge) {
      dom.totalFeedsBadge.textContent = `${state.channels.length} FEEDS ACTIVE`;
    }

  } catch (error) {
    console.error('IPTV Engine global crash:', error);
    renderCategories();
    renderChannelList();
    payChannel(0);
  }
}

function parseM3U(data, isSportsSource) {
  const lines = data.split('\n');
  const items = [];
  
  let currentLogo = '';
  let currentGroup = '';
  let currentName = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    if (line.startsWith('#EXTINF:')) {
      const logoMatch = line.match(/tvg-logo="([^"]*)"/);
      currentLogo = logoMatch ? logoMatch[1] : '';

      const groupMatch = line.match(/group-title="([^"]*)"/);
      currentGroup = groupMatch ? groupMatch[1] : UNCATEGORIZED;

      if (isSportsSource) {
        currentGroup = 'SPORTS';
      }

      const commaIndex = line.lastIndexOf(',');
      currentName = commaIndex !== -1 ? line.substring(commaIndex + 1).trim() : 'Unknown Stream';
    
    } else if (line.startsWith('http') || line.startsWith('rtmp') || line.startsWith('rtsp')) {
      if (currentName) {
        items.push({
          name: currentName,
          url: line,
          logo: currentLogo,
          category: currentGroup || (isSportsSource ? 'SPORTS' : UNCATEGORIZED)
        });
      }
      currentLogo = '';
      currentGroup = '';
      currentName = '';
    }
  }

  return items;
}

// ============================================================
// COMPONENT RENDERERS
// ============================================================
function renderCategories() {
  if (!dom.categoryFilter) return;
  dom.categoryFilter.innerHTML = '';

  state.categories.forEach(category => {
    const button = document.createElement('button');
    button.className = `category-btn ${state.selectedCategory === category ? 'active' : ''}`;
    button.textContent = category;
    button.addEventListener('click', () => {
      state.selectedCategory = category;
      renderCategories();
      renderChannelList();
    });
    dom.categoryFilter.appendChild(button);
  });
}

function renderChannelList() {
  if (!dom.channelGrid) return;
  dom.channelGrid.innerHTML = '';

  const matchedChannels = state.channels.filter(ch => {
    // Search match
    const passesSearch = ch.name.toLowerCase().includes(state.searchQuery) ||
                         ch.category.toLowerCase().includes(state.searchQuery);
                         
    if (!passesSearch) return false;

    // Category filter
    if (state.selectedCategory === CATEGORY_ALL) return true;
    if (state.selectedCategory === CATEGORY_FAVORITES) return state.favorites.includes(ch.name);
    return ch.category === state.selectedCategory;
  });

  if (dom.channelsCountText) {
    dom.channelsCountText.textContent = `DISPLAYING ${matchedChannels.length} OF ${state.channels.length} FEEDS`;
  }

  if (matchedChannels.length === 0) {
    dom.channelGrid.innerHTML = `
      <div class="channel-empty-state">
        <i class="fa-solid fa-triangle-exclamation"></i>
        <p>No channels matches search or category filters.</p>
      </div>
    `;
    return;
  }

  matchedChannels.forEach(channel => {
    const isChannelActive = state.channels.indexOf(channel) === state.currentIndex;
    const isBookmark = state.favorites.includes(channel.name);

    const el = document.createElement('div');
    el.className = `channel ${isChannelActive ? 'active' : ''}`;
    el.innerHTML = `
      <img src="${channel.logo}" alt="${channel.name}" class="channel-logo" onerror="this.src='https://images.unsplash.com/photo-1542204172-e70528097629?auto=format&fit=crop&w=80&h=80&q=80'">
      <div class="channel-meta">
        <div class="channel-name-small">${channel.name}</div>
        <div class="channel-category-small">${channel.category}</div>
      </div>
      <button class="favorite-btn ${isBookmark ? 'is-active' : ''}" title="Bookmark">
        <i class="${isBookmark ? 'fa-solid' : 'fa-regular'} fa-heart"></i>
      </button>
    `;

    // Click trigger on channel frame (except active heart button)
    el.addEventListener('click', (e) => {
      if (e.target.closest('.favorite-btn')) return;
      const absIndex = state.channels.indexOf(channel);
      playChannel(absIndex);
    });

    const favButton = el.querySelector('.favorite-btn');
    favButton.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleFavorite(channel.name);
    });

    dom.channelGrid.appendChild(el);
  });
}

// ============================================================
// HLS CONTROLS & VIDEO HUD ENGAGEMENT
// ============================================================
function playChannel(index) {
  if (index < 0 || index >= state.channels.length) return;

  state.currentIndex = index;
  const channel = state.channels[index];

  // Refresh selected active classes in list
  document.querySelectorAll('.channel').forEach((it, idx) => {
    const listChannelName = it.querySelector('.channel-name-small')?.textContent;
    if (listChannelName === channel.name) {
      it.classList.add('active');
    } else {
      it.classList.remove('active');
    }
  });

  // Load stream
  if (dom.videoLoader) dom.videoLoader.classList.remove('hidden');
  if (dom.playerErrorOverlay) dom.playerErrorOverlay.style.display = 'none';

  if (dom.currentChannelName) dom.currentChannelName.textContent = channel.name;
  if (dom.currentChannelCategory) {
    dom.currentChannelCategory.innerHTML = `
      <span class="channel-tag">${channel.category}</span>
      &nbsp;&bull;&nbsp; STREAM FEED SOURCE ACTIVE
    `;
  }

  // Reload action triggers
  if (dom.btnReload) {
    dom.btnReload.onclick = () => playChannel(index);
  }

  // Setup Hls Source
  if (Hls.isSupported()) {
    if (hlsInstance) {
      hlsInstance.destroy();
    }

    hlsInstance = new Hls({
      enableWorker: true,
      maxBufferLength: 20
    });

    hlsInstance.loadSource(channel.url);
    hlsInstance.attachMedia(dom.video);

    hlsInstance.on(Hls.Events.MANIFEST_PARSED, () => {
      if (dom.videoLoader) dom.videoLoader.classList.add('hidden');
      dom.video.play().then(updatePlayButtonState).catch(() => {
        // Handle blocked autopays graceful indicator
        setPlaybackSuspended();
      });
    });

    hlsInstance.on(Hls.Events.ERROR, (_, data) => {
      console.warn('HLS.js loading encountered warning or media issue:', data);
      if (data.fatal) {
        if (dom.videoLoader) dom.videoLoader.classList.add('hidden');
        if (dom.playerErrorOverlay) {
          dom.playerErrorOverlay.style.display = 'flex';
        }
      }
    });

  } else if (dom.video.canPlayType('application/vnd.apple.mpegurl')) {
    // Safari direct stream pipeline channels fallback
    dom.video.src = channel.url;
    dom.video.addEventListener('canplay', () => {
      if (dom.videoLoader) dom.videoLoader.classList.add('hidden');
      dom.video.play().then(updatePlayButtonState).catch(setPlaybackSuspended);
    });
    dom.video.addEventListener('error', () => {
      if (dom.videoLoader) dom.videoLoader.classList.add('hidden');
      if (dom.playerErrorOverlay) dom.playerErrorOverlay.style.display = 'flex';
    });
  } else {
    // Direct stream
    dom.video.src = channel.url;
    dom.video.play()
      .then(() => {
        if (dom.videoLoader) dom.videoLoader.classList.add('hidden');
        updatePlayButtonState();
      })
      .catch(() => {
        if (dom.videoLoader) dom.videoLoader.classList.add('hidden');
        if (dom.playerErrorOverlay) dom.playerErrorOverlay.style.display = 'flex';
      });
  }

  // Refresh Bookmark Button state
  updateBookmarkMetaButton();
}

function updatePlayButtonState() {
  if (!dom.btnPlay) return;
  if (dom.video.paused) {
    dom.btnPlay.innerHTML = '<i class="fas fa-play"></i>';
  } else {
    dom.btnPlay.innerHTML = '<i class="fas fa-pause"></i>';
  }
}

function setPlaybackSuspended() {
  if (dom.btnPlay) dom.btnPlay.innerHTML = '<i class="fas fa-play"></i>';
}

// Media state controls
function togglePlay() {
  if (!dom.video) return;
  if (dom.video.paused) {
    dom.video.play().then(updatePlayButtonState).catch(console.error);
  } else {
    dom.video.pause();
    updatePlayButtonState();
  }
}

function prevChannel() {
  let target = state.currentIndex - 1;
  if (target < 0) {
    target = state.channels.length - 1;
  }
  playChannel(target);
}

function nextChannel() {
  let target = state.currentIndex + 1;
  if (target >= state.channels.length) {
    target = 0;
  }
  playChannel(target);
}

function toggleMute() {
  if (!dom.video) return;
  dom.video.muted = !dom.video.muted;
  if (dom.btnMute) {
    dom.btnMute.innerHTML = dom.video.muted ? '<i class="fa-solid fa-volume-xmark"></i>' : '<i class="fa-solid fa-volume-high"></i>';
  }
  if (dom.volumeSlider) {
    dom.volumeSlider.value = dom.video.muted ? 0 : dom.video.volume;
  }
}

function setVolume(val) {
  if (!dom.video) return;
  dom.video.volume = val;
  dom.video.muted = (val <= 0);
  if (dom.btnMute) {
    dom.btnMute.innerHTML = dom.video.muted ? '<i class="fa-solid fa-volume-xmark"></i>' : '<i class="fa-solid fa-volume-high"></i>';
  }
}

function toggleFullscreen() {
  const container = document.querySelector('.video-container');
  if (!container) return;

  if (!document.fullscreenElement) {
    container.requestFullscreen().catch(err => {
      console.warn('Fullscreen request blocked:', err);
    });
  } else {
    document.exitFullscreen();
  }
}

// category helper scroll controls
function scrollCategories(dir) {
  if (!dom.categoryFilter) return;
  const offset = dir === 'left' ? -200 : 200;
  dom.categoryFilter.scrollBy({ left: offset, behavior: 'smooth' });
}

// ============================================================
// BANNERS CAROUSEL SLIDESHOW
// ============================================================
function renderBanners() {
  if (!dom.bannersContainer || !dom.bannerDotsContainer) return;

  dom.bannersContainer.innerHTML = '';
  dom.bannerDotsContainer.innerHTML = '';

  state.banners.forEach((banner, idx) => {
    // Create Banner slides
    const slide = document.createElement('div');
    slide.className = 'banner-item';
    slide.innerHTML = `
      <img src="${banner.bannerURL}" alt="${banner.title}" class="banner-image">
      <div class="banner-overlay"></div>
      <div class="banner-sliding-text">
        <span class="banner-pill">PROMOTED BROADCAST</span>
        <h4 class="banner-heading">${banner.title}</h4>
        <p class="banner-caption">${banner.description}</p>
      </div>
    `;

    // Click trigger on entire banner
    slide.addEventListener('click', () => {
      handleBannerRedirection(banner.redirection);
    });

    dom.bannersContainer.appendChild(slide);

    // Create Indicator dots
    const dot = document.createElement('div');
    dot.className = `dot-indicator ${idx === state.activeBannerIndex ? 'active' : ''}`;
    dot.addEventListener('click', () => {
      goToBanner(idx);
    });
    dom.bannerDotsContainer.appendChild(dot);
  });

  updateCarouselOffset();
}

function goToBanner(index) {
  state.activeBannerIndex = index;
  updateCarouselOffset();
  updateCarouselIndicators();
}

function nextBannerSlide() {
  state.activeBannerIndex = (state.activeBannerIndex + 1) % state.banners.length;
  updateCarouselOffset();
  updateCarouselIndicators();
}

function prevBannerSlide() {
  state.activeBannerIndex = (state.activeBannerIndex - 1 + state.banners.length) % state.banners.length;
  updateCarouselOffset();
  updateCarouselIndicators();
}

function updateCarouselOffset() {
  if (!dom.bannersContainer) return;
  dom.bannersContainer.style.transform = `translateX(-${state.activeBannerIndex * 100}%)`;
}

function updateCarouselIndicators() {
  if (!dom.bannerDotsContainer) return;
  const dots = dom.bannerDotsContainer.querySelectorAll('.dot-indicator');
  dots.forEach((dot, idx) => {
    if (idx === state.activeBannerIndex) {
      dot.classList.add('active');
    } else {
      dot.classList.remove('active');
    }
  });
}

// Auto slider controls
function startAutoSlider() {
  stopAutoSlider(); // prevent double timers
  state.autoSliderTimer = setInterval(nextBannerSlide, 3000);
}

function stopAutoSlider() {
  if (state.autoSliderTimer) {
    clearInterval(state.autoSliderTimer);
    state.autoSliderTimer = null;
  }
}

// Redirect channels on promotional banner interaction
function handleBannerRedirection(target) {
  if (!target) return;
  const targetChannelIndex = state.channels.findIndex(
    ch => ch.name.toLowerCase() === target.toLowerCase() ||
          ch.name.toLowerCase().includes(target.toLowerCase())
  );

  if (targetChannelIndex !== -1) {
    playChannel(targetChannelIndex);
    // Smooth scroll page to video viewport element if scrolled down
    const playerEl = document.getElementById('shameem-player-box');
    if (playerEl) {
      playerEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }
}

// Global scope hooks for buttons using direct HTML onclick functions
window.prevChannel = prevChannel;
window.nextChannel = nextChannel;
window.togglePlay = togglePlay;
window.toggleMute = toggleMute;
window.setVolume = setVolume;
window.toggleFullscreen = toggleFullscreen;
window.scrollBannersPrev = prevBannerSlide;
window.scrollBannersNext = nextBannerSlide;
window.scrollCategories = scrollCategories;
