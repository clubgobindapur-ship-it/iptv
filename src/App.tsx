import React, { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Play, 
  Pause, 
  ChevronLeft, 
  ChevronRight, 
  Search, 
  Heart, 
  Tv, 
  Volume2, 
  VolumeX, 
  Maximize2, 
  Minimize2, 
  Info, 
  Activity, 
  Clock, 
  RefreshCw,
  Sliders,
  ListFilter
} from 'lucide-react';

import { Channel, Banner, CATEGORY_ALL, CATEGORY_FAVORITES } from './types';
import { PLAYLIST_URLS, parsePlaylist, STABLE_FALLBACK_CHANNELS } from './utils';
import { loadBanners } from './firebase';

export default function App() {
  // State management
  const [channels, setChannels] = useState<Channel[]>(STABLE_FALLBACK_CHANNELS);
  const [categories, setCategories] = useState<string[]>([CATEGORY_ALL, 'SPORTS', CATEGORY_FAVORITES]);
  const [selectedCategory, setSelectedCategory] = useState<string>(CATEGORY_ALL);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [favorites, setFavorites] = useState<string[]>([]);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  
  // UI Loading States
  const [isLoadingPlaylist, setIsLoadingPlaylist] = useState<boolean>(true);
  const [isVideoLoading, setIsVideoLoading] = useState<boolean>(false);
  const [videoError, setVideoError] = useState<boolean>(false);
  const [currentTimeStr, setCurrentTimeStr] = useState<string>('');

  // Audio & Fullscreen states
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [volume, setVolume] = useState<number>(0.8);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // Carousel slider state
  const [activeBannerIndex, setActiveBannerIndex] = useState<number>(0);
  const [sliderDirection, setSliderDirection] = useState<number>(1); // 1 = forward, -1 = backward
  const [isHoveringBanner, setIsHoveringBanner] = useState<boolean>(false);

  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const categoryScrollRef = useRef<HTMLDivElement>(null);

  // 1. Digital Clock & Initial Settings
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTimeStr(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    };
    updateTime();
    const clockInterval = setInterval(updateTime, 1000);

    // Load Local Storage Favorites
    try {
      const stored = localStorage.getItem('iptv-favorites');
      if (stored) {
        setFavorites(JSON.parse(stored));
      }
    } catch (e) {
      console.warn('LocalStorage reads are blocked or unsupported:', e);
    }

    return () => clearInterval(clockInterval);
  }, []);

  // 2. Fetch Playlist and Banners
  useEffect(() => {
    const assembleData = async () => {
      setIsLoadingPlaylist(true);

      // Load curated banners
      const fetchedBanners = await loadBanners();
      setBanners(fetchedBanners);

      try {
        let loadedChannels: Channel[] = [];
        const foundGroups = new Set<string>();

        // Async read Aynaott playlist (No CORS prefix since Rawgithub usually supports CORS)
        try {
          const res1 = await fetch(PLAYLIST_URLS[0]);
          if (res1.ok) {
            const data1 = await res1.text();
            const chunk1 = parsePlaylist(data1, false);
            loadedChannels = [...loadedChannels, ...chunk1];
            chunk1.forEach(c => foundGroups.add(c.category));
          }
        } catch (e) {
          console.warn('Playlist AynaOTT fetch failed:', e);
        }

        // Async read Sports playlist with category prefix
        try {
          const res2 = await fetch(PLAYLIST_URLS[1]);
          if (res2.ok) {
            const data2 = await res2.text();
            const chunk2 = parsePlaylist(data2, true); // true forces group to SPORTS
            loadedChannels = [...loadedChannels, ...chunk2];
            foundGroups.add('SPORTS');
          }
        } catch (e) {
          console.warn('Playlist Sports fetch failed:', e);
        }

        // Handle case where we retrieved nothing (CORS/Network offline)
        if (loadedChannels.length === 0) {
          console.log('No online playlists retrievable. Utilizing local stable backup channels.');
          loadedChannels = STABLE_FALLBACK_CHANNELS;
          STABLE_FALLBACK_CHANNELS.forEach(c => foundGroups.add(c.category));
        }

        setChannels(loadedChannels);

        // Filter and compile categories
        const distinctCategories = Array.from(foundGroups).filter(cat => cat !== 'SPORTS' && cat !== 'Uncategorized');
        distinctCategories.sort();
        
        // Final ordered categories
        const sortedCats = [CATEGORY_ALL, 'SPORTS', CATEGORY_FAVORITES, ...distinctCategories];
        setCategories(sortedCats);
        
        // Select first channel
        if (loadedChannels.length > 0) {
          setCurrentIndex(0);
        }
      } catch (err) {
        console.error('Core IPTV Loader error:', err);
        setChannels(STABLE_FALLBACK_CHANNELS);
      } finally {
        setIsLoadingPlaylist(false);
      }
    };

    assembleData();
  }, []);

  // 3. Auto Slider Carousel Loop (3 Seconds Smooth Rotation)
  useEffect(() => {
    if (banners.length === 0 || isHoveringBanner) return;

    const autoSlideTimer = setInterval(() => {
      setSliderDirection(1);
      setActiveBannerIndex((prev) => (prev + 1) % banners.length);
    }, 3000);

    return () => clearInterval(autoSlideTimer);
  }, [banners.length, isHoveringBanner]);

  // 4. Video Playback & HLS stream attachment hook
  const currentChannel = channels[currentIndex] || null;

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !currentChannel) return;

    setIsVideoLoading(true);
    setVideoError(false);
    setIsPlaying(true);

    const streamUrl = currentChannel.url;

    if (Hls.isSupported()) {
      // Clear old HLS to avoid memory leaks
      if (hlsRef.current) {
        hlsRef.current.destroy();
      }

      const hlsInstance = new Hls({
        enableWorker: true,
        maxBufferLength: 15,
        liveSyncDurationCount: 3,
      });
      hlsRef.current = hlsInstance;

      hlsInstance.loadSource(streamUrl);
      hlsInstance.attachMedia(video);

      hlsInstance.on(Hls.Events.MANIFEST_PARSED, () => {
        setIsVideoLoading(false);
        video.play().catch(() => {
          setIsPlaying(false);
        });
      });

      hlsInstance.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              hlsInstance.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              hlsInstance.recoverMediaError();
              break;
            default:
              setIsVideoLoading(false);
              setVideoError(true);
              hlsInstance.destroy();
              break;
          }
        }
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Safari Native HLS Handler
      video.src = streamUrl;
      
      const onCanPlay = () => {
        setIsVideoLoading(false);
        video.play().catch(() => setIsPlaying(false));
      };
      
      const onLoadStart = () => setIsVideoLoading(true);
      const onError = () => {
        setIsVideoLoading(false);
        setVideoError(true);
      };

      video.addEventListener('canplay', onCanPlay);
      video.addEventListener('loadstart', onLoadStart);
      video.addEventListener('error', onError);

      return () => {
        video.removeEventListener('canplay', onCanPlay);
        video.removeEventListener('loadstart', onLoadStart);
        video.removeEventListener('error', onError);
      };
    } else {
      // Fallback direct streams
      video.src = streamUrl;
      video.play()
        .then(() => setIsVideoLoading(false))
        .catch(() => {
          setIsVideoLoading(false);
          setVideoError(true);
        });
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [currentIndex, currentChannel]);

  // Synchronise audio states
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = isMuted;
      videoRef.current.volume = volume;
    }
  }, [isMuted, volume]);

  // 5. Filter Channels by Category & Search query
  const getFilteredChannels = (): Channel[] => {
    return channels.filter((channel) => {
      // 1. Search Query Filters
      const matchesSearch = channel.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            channel.category.toLowerCase().includes(searchQuery.toLowerCase());
      
      if (!matchesSearch) return false;

      // 2. Category Fit
      if (selectedCategory === CATEGORY_ALL) {
        return true;
      }
      if (selectedCategory === CATEGORY_FAVORITES) {
        return favorites.includes(channel.name);
      }
      return channel.category === selectedCategory;
    });
  };

  const filteredChannels = getFilteredChannels();

  // Action: Play specific channel by absolute channel index
  const playChannelByIndex = (index: number) => {
    if (index >= 0 && index < channels.length) {
      setCurrentIndex(index);
    }
  };

  // Action: Next & Previous Channel Controllers
  const handleNextChannel = () => {
    let nextIndex = currentIndex + 1;
    if (nextIndex >= channels.length) {
      nextIndex = 0;
    }
    setCurrentIndex(nextIndex);
  };

  const handlePrevChannel = () => {
    let prevIndex = currentIndex - 1;
    if (prevIndex < 0) {
      prevIndex = channels.length - 1;
    }
    setCurrentIndex(prevIndex);
  };

  // Action: Add / Remove Favorite Bookmarks
  const toggleFavorite = (channelName: string) => {
    let updated: string[];
    if (favorites.includes(channelName)) {
      updated = favorites.filter(fav => fav !== channelName);
    } else {
      updated = [...favorites, channelName];
    }
    setFavorites(updated);
    try {
      localStorage.setItem('iptv-favorites', JSON.stringify(updated));
    } catch (e) {
      console.warn('Unable to write to localStorage:', e);
    }
  };

  // Action: Play/Pause button
  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
        setIsPlaying(false);
      } else {
        videoRef.current.play().then(() => setIsPlaying(true));
      }
    }
  };

  // Action: Mute Toggle
  const toggleMute = () => {
    setIsMuted(!isMuted);
  };

  // Action: Fullscreen Toggle
  const toggleFullscreen = () => {
    const el = playerContainerRef.current;
    if (!el) return;

    if (!document.fullscreenElement) {
      el.requestFullscreen().then(() => {
        setIsFullscreen(true);
      }).catch(err => {
        console.warn('Error enabling fullscreen mode:', err);
      });
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  // Monitor fullscreen change events natively
  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  // Action: Handle banner clicks (redirection keyword/link)
  const handleBannerClick = (redirection: string) => {
    if (!redirection) return;

    // Search matches within Channels list by exact name or substring
    const matchedIdx = channels.findIndex(
      (c) => c.name.toLowerCase() === redirection.toLowerCase() ||
             c.name.toLowerCase().includes(redirection.toLowerCase())
    );

    if (matchedIdx !== -1) {
      setCurrentIndex(matchedIdx);
    } else {
      // If it's a direct url structure, execute play immediately as a custom source
      if (redirection.startsWith('http')) {
        const customChannel: Channel = {
          name: 'Featured Broadcast Event',
          url: redirection,
          logo: '',
          category: 'Promoted'
        };
        // Insert custom channel temporarily or play it directly
        setChannels(prev => {
          const exists = prev.find(ch => ch.url === redirection);
          if (exists) return prev;
          return [customChannel, ...prev];
        });
        setCurrentIndex(0);
      }
    }
  };

  // Carousel manual controls
  const handleBannerPrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSliderDirection(-1);
    setActiveBannerIndex((prev) => (prev - 1 + banners.length) % banners.length);
  };

  const handleBannerNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSliderDirection(1);
    setActiveBannerIndex((prev) => (prev + 1) % banners.length);
  };

  // Category horizontal scroll controls
  const scrollCategories = (dir: 'left' | 'right') => {
    if (categoryScrollRef.current) {
      const offset = dir === 'left' ? -200 : 200;
      categoryScrollRef.current.scrollBy({ left: offset, behavior: 'smooth' });
    }
  };

  return (
    <div id="shameem-iptv-root" className="min-h-screen bg-[#0a0a0c] text-slate-100 flex flex-col antialiased">
      
      {/* 1. APP HEADER */}
      <header id="shameem-header" className="bg-[#141419] border-b border-red-500/10 py-3.5 px-4 md:px-8 flex flex-col md:flex-row justify-between items-center gap-4 sticky top-0 z-50 shadow-md">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-red-600 rounded-lg shadow-lg shadow-red-600/20 flex items-center justify-center animate-pulse">
            <Tv className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-wider text-white flex items-center gap-1.5 font-sans">
              SHAMEEM <span className="text-red-500 bg-red-500/10 px-2 py-0.5 rounded text-xs tracking-widest font-mono">IPTV</span>
            </h1>
            <p className="text-[10px] text-gray-400 font-mono tracking-tight">PREMIUM HOME BROADCASTS</p>
          </div>
        </div>

        {/* Live info badge & System UTC Clock */}
        <div className="flex items-center gap-4 text-xs">
          <div className="bg-[#1c1c24] border border-neutral-800 rounded-full px-3 py-1 flex items-center gap-2 text-zinc-300">
            <Activity className="w-3.5 h-3.5 text-red-500" />
            <span className="font-sans font-medium">{channels.length} FEEDS ACTIVE</span>
          </div>
          <div className="bg-[#1c1c24] border border-neutral-800 rounded-full px-3 py-1 flex items-center gap-2 text-zinc-300 font-mono">
            <Clock className="w-3.5 h-3.5 text-red-500" />
            <span>{currentTimeStr || "LIVE"}</span>
          </div>
        </div>
      </header>

      {/* 2. MAIN PLAYER & GRID CONTENT PANEL */}
      <main id="shameem-main" className="flex-1 max-w-[1600px] w-full mx-auto px-4 md:px-8 py-6 grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* PLAYER WRAPPER (LEFT - COLUMN 1 TO 8) */}
        <section id="player-left-panel" className="lg:col-span-8 flex flex-col gap-6">
          
          {/* THE TELEVISION FRAME */}
          <div 
            id="shameem-player-box"
            ref={playerContainerRef}
            className="relative bg-black rounded-xl overflow-hidden aspect-video border border-neutral-800 shadow-2xl transition duration-300 hover:border-red-500/20 group"
          >
            {/* Real Video Player Component */}
            <video 
              id="video"
              ref={videoRef}
              className="w-full h-full object-contain"
              playsInline
              onClick={togglePlay}
            />

            {/* ERROR MASK overlay */}
            {videoError && (
              <div className="absolute inset-0 bg-neutral-950/90 flex flex-col items-center justify-center p-6 text-center gap-4 z-40">
                <div className="w-16 h-16 rounded-full bg-red-600/10 flex items-center justify-center border border-red-500/20">
                  <Tv className="w-8 h-8 text-red-500" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Playback Interrupted</h3>
                  <p className="text-sm text-gray-400 mt-1 max-w-sm">This channel stream is currently offline or unreachable. Please try another channel from the sidebar.</p>
                </div>
                <button 
                  onClick={() => playChannelByIndex(currentIndex)}
                  className="px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded text-xs transition font-semibold"
                >
                  Reload Stream Source
                </button>
              </div>
            )}

            {/* VIDEO LOADER / BUFFERING RING */}
            {isVideoLoading && (
              <div id="videoLoader" className="absolute inset-0 bg-black/75 flex items-center justify-center z-30 pointer-events-none">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-12 h-12 rounded-full border-4 border-red-500/20 border-t-red-500 animate-spin" />
                  <span className="text-[10px] text-zinc-400 font-mono tracking-widest uppercase">Buffering Feed...</span>
                </div>
              </div>
            )}

            {/* BOTTOM HUD INTERACTIVE OVERLAY CONTROLS */}
            <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black via-black/80 to-transparent p-4 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity duration-300 z-20 flex flex-col gap-3">
              
              {/* Progress-Like Tracker / Decorative Bar */}
              <div className="w-full h-1 bg-neutral-800 rounded-full overflow-hidden">
                <div className="h-full bg-red-500 w-[100%] animate-pulse" />
              </div>

              {/* HUD Controls */}
              <div className="flex items-center justify-between">
                
                {/* Control Action Buttons */}
                <div className="flex items-center gap-3">
                  <button 
                    onClick={handlePrevChannel}
                    title="Previous Channel"
                    className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>

                  <button 
                    onClick={togglePlay}
                    title={isPlaying ? "Pause Feed" : "Play Feed"}
                    className="p-2.5 bg-red-600 text-white hover:bg-red-500 rounded-lg transition shadow-md shadow-red-600/30"
                  >
                    {isPlaying ? <Pause className="w-4 h-4 fill-white" /> : <Play className="w-4 h-4 fill-white" />}
                  </button>

                  <button 
                    onClick={handleNextChannel}
                    title="Next Channel"
                    className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>

                  {/* Volume adjustments */}
                  <div className="flex items-center gap-2 ml-2 bg-neutral-900/80 px-2.5 py-1.5 rounded-lg border border-neutral-800">
                    <button 
                      onClick={toggleMute}
                      title={isMuted ? "Unmute" : "Mute"}
                      className="text-gray-400 hover:text-white transition"
                    >
                      {isMuted || volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                    </button>
                    <input 
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={isMuted ? 0 : volume}
                      onChange={(e) => {
                        setVolume(parseFloat(e.target.value));
                        setIsMuted(false);
                      }}
                      className="w-16 md:w-24 accent-red-500 h-1 cursor-pointer bg-neutral-700 rounded-lg appearance-none"
                    />
                  </div>
                </div>

                {/* HUD Right items */}
                <div className="flex items-center gap-3">
                  {/* Category Stamp */}
                  {currentChannel && (
                    <span className="hidden sm:inline text-[10px] bg-neutral-950 border border-neutral-800 py-1.5 px-3 rounded-full text-gray-400 font-mono uppercase tracking-wider">
                      Feed Category: <span className="text-red-400 font-bold">{currentChannel.category}</span>
                    </span>
                  )}
                  {/* Fullscreen key */}
                  <button 
                    onClick={toggleFullscreen}
                    title={isFullscreen ? "Exit Fullscreen" : "Fullscreen Video"}
                    className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition"
                  >
                    {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                  </button>
                </div>

              </div>

            </div>
          </div>

          {/* CHANNEL IDENTIFICATION AND BOOKMARK HUD */}
          {currentChannel && (
            <div id="channel-banner-info" className="bg-[#141419] rounded-xl p-5 border border-neutral-800/60 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <div className="flex items-center gap-2.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping shrink-0" />
                  <span className="text-[11px] text-red-500 font-bold tracking-widest font-mono uppercase">ONLINE CHNL</span>
                </div>
                <h2 id="currentChannelName" className="text-xl md:text-2xl font-bold text-white tracking-wide mt-1">
                  {currentChannel.name || "Default TV Channel Feed"}
                </h2>
                <p id="currentChannelCategory" className="text-xs text-slate-400 mt-1 flex items-center gap-1.5 uppercase font-mono">
                  <span className="bg-red-500/10 text-red-400 px-2.5 py-0.5 rounded border border-red-500/20">{currentChannel.category}</span>
                  <span className="text-neutral-600">•</span>
                  <span className="text-neutral-500">M3U Feed Source URL: {currentChannel.url.substring(0, 45)}...</span>
                </p>
              </div>

              {/* Bookmark Toggle */}
              <button 
                onClick={() => toggleFavorite(currentChannel.name)}
                className={`py-2 px-4 rounded-xl border flex items-center gap-2.5 font-medium text-xs transition duration-200 cursor-pointer ${
                  favorites.includes(currentChannel.name) 
                    ? 'bg-red-600/10 text-red-500 border-red-500' 
                    : 'bg-[#1c1c24] text-gray-400 border-neutral-800 hover:text-white hover:border-neutral-700'
                }`}
                title="Add this channel stream to Favorites category list"
              >
                <Heart className={`w-4 h-4 ${favorites.includes(currentChannel.name) ? 'fill-red-500 text-red-500' : ''}`} />
                <span>{favorites.includes(currentChannel.name) ? 'Saved in Favorites' : 'Add to Favorites'}</span>
              </button>
            </div>
          )}

          {/* FEATURED BANNER IMAGE SLIDER (AUTO SLIDES EVERY 3 SECONDS) */}
          <div id="featured-carousel-block" className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Tv className="w-5 h-5 text-red-500" />
                <h3 className="text-sm font-bold tracking-wider text-white font-sans uppercase">FEATURED FOCUS CHANNELS</h3>
              </div>
              <div className="flex items-center gap-1.5">
                <button 
                  onClick={handleBannerPrev}
                  className="p-1.5 bg-[#141419] hover:bg-[#1c1c24] border border-neutral-800 hover:border-neutral-700 text-white rounded transition cursor-pointer"
                  title="Previous Featured"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button 
                  onClick={handleBannerNext}
                  className="p-1.5 bg-[#141419] hover:bg-[#1c1c24] border border-neutral-800 hover:border-neutral-700 text-white rounded transition cursor-pointer"
                  title="Next Featured"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Sliding Banner Screen */}
            <div 
              className="relative rounded-xl overflow-hidden bg-[#141419] border border-neutral-800 h-[190px] md:h-[220px] transition group shadow-md"
              onMouseEnter={() => setIsHoveringBanner(true)}
              onMouseLeave={() => setIsHoveringBanner(false)}
            >
              {banners.length > 0 ? (
                <div className="absolute inset-0 w-full h-full cursor-pointer" onClick={() => handleBannerClick(banners[activeBannerIndex].redirection)}>
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.div
                      key={activeBannerIndex}
                      custom={sliderDirection}
                      initial={{ opacity: 0, x: sliderDirection * 150 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -sliderDirection * 150 }}
                      transition={{ duration: 0.5, ease: "easeInOut" }}
                      className="absolute inset-0 w-full h-full"
                    >
                      {/* Image layer */}
                      <img 
                        src={banners[activeBannerIndex].bannerURL} 
                        alt={banners[activeBannerIndex].title || 'IPTV Feature Banner'}
                        className="w-full h-full object-cover brightness-75 scale-grow transition duration-500 group-hover:scale-105"
                        referrerPolicy="no-referrer"
                      />
                      
                      {/* Gradient Ambient Overlay */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent flex flex-col justify-end p-5 md:p-7" />
                      
                      {/* Banner Information text */}
                      <div className="absolute bottom-0 left-0 right-0 p-5 md:p-7 text-left flex flex-col justify-end z-10">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 bg-red-600 text-white rounded text-[9px] font-bold uppercase tracking-wider font-mono">
                            PROMOTED
                          </span>
                          <span className="text-[10px] text-gray-400 font-mono">
                            Redirection Target: {banners[activeBannerIndex].redirection}
                          </span>
                        </div>
                        <h4 className="text-base md:text-xl font-black text-white mt-1.5 drop-shadow">
                          {banners[activeBannerIndex].title || 'Shameem Prime Channel Spotlight'}
                        </h4>
                        <p className="text-xs text-zinc-300 mt-1 max-w-xl line-clamp-1 truncate drop-shadow">
                          {banners[activeBannerIndex].description || 'Tune in now to enjoy instant uninterrupted streaming.'}
                        </p>
                      </div>
                    </motion.div>
                  </AnimatePresence>
                </div>
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center text-zinc-500">
                  <RefreshCw className="w-8 h-8 animate-spin mb-2 text-red-500/40" />
                  <p className="text-xs">Spinning up slider broadcasts...</p>
                </div>
              )}
            </div>

            {/* Slider Indicator Navigation Dots */}
            {banners.length > 0 && (
              <div className="flex items-center justify-center gap-1.5 mt-1.5">
                {banners.map((_, idx) => (
                  <button 
                    key={idx}
                    onClick={() => {
                      setSliderDirection(idx > activeBannerIndex ? 1 : -1);
                      setActiveBannerIndex(idx);
                    }}
                    className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
                      idx === activeBannerIndex 
                        ? 'bg-red-500 w-6' 
                        : 'bg-neutral-800 hover:bg-neutral-700'
                    }`}
                  />
                ))}
              </div>
            )}
          </div>
        </section>

        {/* SIDEBAR EXPLORER PANEL (RIGHT - COLUMNS 9 TO 12) */}
        <aside id="sidebar-panel" className="lg:col-span-4 flex flex-col gap-5 bg-[#141419]/80 border border-neutral-800/80 rounded-2xl p-5 max-h-[85vh] lg:sticky lg:top-[88px] overflow-hidden">
          
          {/* SEARCH BAR CARD */}
          <div className="flex flex-col gap-2">
            <label className="text-xs text-gray-500 font-bold font-mono tracking-wider">SEARCH STATION</label>
            <div className="relative">
              <input 
                type="text" 
                id="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Type and filter channels..."
                className="w-full bg-[#0a0a0c] text-white border border-neutral-800 hover:border-neutral-700 focus:border-red-500 focus:ring-1 focus:ring-red-500/20 rounded-xl py-3 pl-11 pr-4 text-sm transition-all focus:outline-none"
              />
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-gray-500 pointer-events-none" />
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery('')}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white text-xs font-semibold"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* CATEGORIES BUTTONS CONTAINER WITH HORIZONTAL SCROLLING */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label className="text-xs text-gray-500 font-bold font-mono tracking-wider">CHANNELS DIVISIONS</label>
              <div className="flex items-center gap-1">
                <button 
                  onClick={() => scrollCategories('left')}
                  className="p-1 text-gray-500 hover:text-white rounded transition"
                  title="Scroll Left"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <button 
                  onClick={() => scrollCategories('right')}
                  className="p-1 text-gray-500 hover:text-white rounded transition"
                  title="Scroll Right"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Horizontal list of categories */}
            <div 
              ref={categoryScrollRef}
              id="categoryFilter"
              className="flex items-center gap-2 overflow-x-auto py-1 scroll-smooth no-scrollbar scrollbar-none"
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
              {categories.map((category) => {
                const isActive = category === selectedCategory;
                return (
                  <button
                    key={category}
                    onClick={() => {
                      setSelectedCategory(category);
                      // Select the first channel item under this new filtered set
                      // to quickly refresh the active player experience if list resets
                    }}
                    className={`shrink-0 whitespace-nowrap text-xs py-2 px-3.5 rounded-xl border font-semibold transition duration-200 cursor-pointer ${
                      isActive 
                        ? 'bg-red-600 text-white border-red-600 shadow-md shadow-red-600/10' 
                        : 'bg-[#0a0a0c] text-gray-400 border-neutral-800 hover:text-white hover:border-neutral-700'
                    }`}
                  >
                    {category}
                  </button>
                );
              })}
            </div>
          </div>

          {/* CHANNELS GRID / FEED LIST VIEW */}
          <div className="flex-1 flex flex-col min-h-0">
            <div className="flex items-center justify-between pb-2 border-b border-neutral-800 mb-3">
              <div className="flex items-center gap-1.5 text-xs font-mono text-zinc-400">
                <ListFilter className="w-3.5 h-3.5 text-red-500" />
                <span>DISPLAYING {filteredChannels.length} OF {channels.length} FEEDS</span>
              </div>
            </div>

            <div 
              id="channels-container" 
              className="flex-1 overflow-y-auto pr-1 flex flex-col gap-2.5 min-h-0"
            >
              {isLoadingPlaylist ? (
                <div className="flex flex-col items-center justify-center p-12 text-center text-zinc-500">
                  <RefreshCw className="w-8 h-8 animate-spin mb-3 text-red-500" />
                  <p className="text-sm font-sans font-medium">Assembling M3U Television Database...</p>
                  <p className="text-[10px] uppercase font-mono tracking-wider mt-1.5 text-zinc-600">Please prepare live feeds</p>
                </div>
              ) : filteredChannels.length > 0 ? (
                filteredChannels.map((channel) => {
                  const absoluteChannelIndex = channels.indexOf(channel);
                  const isActive = absoluteChannelIndex === currentIndex;
                  const isFav = favorites.includes(channel.name);

                  return (
                    <div 
                      key={`${channel.name}-${absoluteChannelIndex}`}
                      onClick={() => setCurrentIndex(absoluteChannelIndex)}
                      className={`channel p-2.5 rounded-xl border flex items-center gap-3 transition-all duration-200 cursor-pointer group/item ${
                        isActive 
                          ? 'bg-red-600/10 border-red-500 shadow-sm' 
                          : 'bg-[#0a0a0c] border-neutral-800/80 hover:bg-neutral-900/60 hover:border-neutral-700'
                      }`}
                    >
                      {/* Logo container or avatar placeholder */}
                      <div className="w-11 h-11 rounded-lg bg-neutral-900 border border-neutral-800/80 overflow-hidden flex items-center justify-center shrink-0">
                        {channel.logo ? (
                          <img 
                            src={channel.logo} 
                            alt={channel.name} 
                            className="w-full h-full object-cover scale-grow group-hover/item:scale-110 transition duration-300"
                            onError={(e) => {
                              // If image fails to load, clear logo so custom text avatar renders
                              (e.target as HTMLElement).style.display = 'none';
                            }}
                          />
                        ) : (
                          <Tv className="w-5 h-5 text-zinc-500 group-hover/item:text-red-500 transition duration-200" />
                        )}
                      </div>

                      {/* Info lines */}
                      <div className="flex-1 min-w-0">
                        <h4 className={`text-xs font-bold leading-tight truncate ${isActive ? 'text-white' : 'text-zinc-200 group-hover/item:text-white'}`}>
                          {channel.name}
                        </h4>
                        <span className="text-[9px] bg-neutral-900/80 border border-neutral-800 text-neutral-400 font-mono px-1.5 py-0.5 rounded uppercase mt-1 inline-block">
                          {channel.category}
                        </span>
                      </div>

                      {/* Favorite Heart action */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation(); // Avoid triggering play channel
                          toggleFavorite(channel.name);
                        }}
                        className={`p-2 rounded-lg transition duration-200 cursor-pointer ${
                          isFav 
                            ? 'text-red-500 bg-red-500/10' 
                            : 'text-zinc-600 hover:text-white hover:bg-neutral-800'
                        }`}
                        title={isFav ? "Saved in Bookmarks" : "Click to Bookmark"}
                      >
                        <Heart className={`w-3.5 h-3.5 ${isFav ? 'fill-red-500' : ''}`} />
                      </button>
                    </div>
                  );
                })
              ) : (
                <div id="empty-state" className="flex flex-col items-center justify-center py-16 px-4 text-center text-zinc-500 border border-dashed border-neutral-800/80 rounded-2xl">
                  <Info className="w-8 h-8 mb-2.5 text-zinc-600" />
                  <h4 className="text-sm font-bold text-zinc-400">No match found</h4>
                  <p className="text-xs text-zinc-500 mt-1 max-w-[240px]">
                    {selectedCategory === CATEGORY_FAVORITES 
                      ? "You haven't bookmarked any channel streams yet. Press the Heart button to bookmark." 
                      : "We couldn't find any channels matching your active search filters."}
                  </p>
                </div>
              )}
            </div>
          </div>
        </aside>

      </main>

      {/* FOOTER METRICS INFO */}
      <footer className="bg-[#141419]/25 py-4 border-t border-neutral-800/40 text-center text-[10px] text-zinc-500 font-mono tracking-wider uppercase mt-auto">
        <p>© 2026 SHAMEEM IPTV NETWORKS • CRAFTED WITH REACT & HLS STREAMS • AUTO CAROUSEL SPOTLIGHTS</p>
      </footer>
    </div>
  );
}
