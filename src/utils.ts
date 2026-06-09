import { Channel, UNCATEGORIZED } from './types';

export const PLAYLIST_URLS = [
  'https://raw.githubusercontent.com/Rakib49/Rakibiptv/refs/heads/main/aynaott.m3u',
  'https://raw.githubusercontent.com/Rakib49/Rakibiptv/refs/heads/main/Sports.m3u'
];

/**
 * Parses M3U database format and extracts channel structures
 */
export function parsePlaylist(m3uData: string, isSportsPlaylist = false): Channel[] {
  const channels: Channel[] = [];
  const lines = m3uData.split('\n');
  
  let currentLogo = '';
  let currentGroup = '';
  let currentName = '';
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    if (line.startsWith('#EXTINF:')) {
      // Extract tvg-logo
      const logoMatch = line.match(/tvg-logo="([^"]*)"/);
      currentLogo = logoMatch ? logoMatch[1] : '';
      
      // Extract group-title
      const groupMatch = line.match(/group-title="([^"]*)"/);
      currentGroup = groupMatch ? groupMatch[1] : UNCATEGORIZED;
      
      // Prepend or enforce sports prefix/category if sports playlist
      if (isSportsPlaylist) {
        currentGroup = 'SPORTS';
      }
      
      // Extract channel name (everything after the last comma)
      const commaIndex = line.lastIndexOf(',');
      if (commaIndex !== -1) {
        currentName = line.substring(commaIndex + 1).trim();
      } else {
        currentName = 'Unknown Channel';
      }
    } else if (line.startsWith('http') || line.startsWith('rtmp') || line.startsWith('rtsp')) {
      if (currentName) {
        channels.push({
          name: currentName,
          url: line,
          logo: currentLogo,
          category: currentGroup || (isSportsPlaylist ? 'SPORTS' : UNCATEGORIZED),
        });
      }
      // Reset state for next item
      currentLogo = '';
      currentGroup = '';
      currentName = '';
    }
  }
  
  return channels;
}

/**
 * Curated high-uptime fallbacks to keep the TV running beautifully
 * even if external files are un-fetchable or GitHub suffers downtime.
 */
export const STABLE_FALLBACK_CHANNELS: Channel[] = [
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
  },
  {
    name: 'Sintel Cine Stream',
    url: 'https://bitdash-a.akamaihd.net/content/sintel/hls/playlist.m3u8',
    logo: 'https://durian.blender.org/wp-content/uploads/2010/09/cropped-poster_sintel_web.jpg',
    category: 'Entertainment',
  },
  {
    name: 'Tears of Steel HLS',
    url: 'https://fcc3ccd9.ssl.hwcdn.net/interactive/tears-of-steel/tears-of-steel.m3u8',
    logo: 'https://mango.blender.org/wp-content/uploads/2012/09/cropped-vlc_021.jpg',
    category: 'Sci-Fi',
  }
];
